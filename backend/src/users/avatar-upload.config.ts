// backend/src/users/avatar-upload.config.ts
//
// Multer configuration for avatar uploads, kept in its own file so
// users.controller.ts doesn't get cluttered with storage/validation
// details. This is imported directly into the controller's
// @UseInterceptors(FileInterceptor(...)) call.

import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';

// Where uploaded avatar files get saved on disk, relative to the
// backend project root (where you run `npm run start:dev` from).
const AVATAR_UPLOAD_DIR = './uploads/avatars';

// Multer won't create missing folders on its own — if this directory
// doesn't exist yet the very first upload would fail. We check once,
// at startup, and create it if needed.
if (!fs.existsSync(AVATAR_UPLOAD_DIR)) {
  fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
}

// Only these image types are accepted. Anything else (including
// disguised executables, scripts, etc.) is rejected before it ever
// touches the disk.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Hard cap on upload size, in bytes. Prevents someone from trying to
// fill up your server's disk with one giant "avatar."
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export const avatarUploadOptions = {
  storage: diskStorage({
    destination: AVATAR_UPLOAD_DIR,
    // We deliberately IGNORE the original filename the browser sends us
    // and generate our own random one instead. Two reasons: (1) two
    // different users uploading "photo.jpg" would otherwise overwrite
    // each other's file, and (2) accepting a client-supplied filename
    // as-is is a classic path-traversal risk (e.g. "../../../evil.jpg").
    // We keep only the file EXTENSION from the original name.
    filename: (req, file, callback) => {
      const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
      callback(null, uniqueName);
    },
  }),
  fileFilter: (
    req: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return callback(
        new BadRequestException(
          'Only JPG, PNG, WEBP, or GIF images are allowed',
        ),
        false,
      );
    }
    callback(null, true);
  },
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
};