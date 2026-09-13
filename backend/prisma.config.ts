// backend/prisma.config.ts

// As of Prisma 7, this file is where the database connection URL lives,
// instead of inside schema.prisma. This keeps connection details (which
// can differ between local dev, staging, and production) separate from
// the schema definition itself.

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});