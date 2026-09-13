"use client";

import { useRef } from "react";
import Link from "next/link";

interface GameCardProps {
  title: string;
  badge?: string;
  videoSrc?: string;
  imageSrc?: string;
  titleColorClassName?: string;
  hideTitle?: boolean;
  href?: string;
}

// One game tile for the Original Games / Popular Games rows.
// Pass either videoSrc (looping muted video cover) or imageSrc (static
// artwork) — whichever the game has available. If neither is passed the
// tile just shows a plain dark background with the title, so this never
// breaks while we're still gathering assets game by game.
//
// Set hideTitle when the cover video/image already has the game's name
// baked into it (like Mines does) so we don't render a duplicate label.
//
// Pass href to make the tile a real link (e.g. "/games/mines"). If href
// is omitted, the card still renders with its hover/cursor styling but
// doesn't navigate anywhere — useful for games we haven't built yet.
//
// Video only plays while the card is hovered (paused on its first frame
// otherwise) — keeps the whole row from animating in sync at page load.
export default function GameCard({
  title,
  badge,
  videoSrc,
  imageSrc,
  titleColorClassName = "text-foreground",
  hideTitle = false,
  href,
}: GameCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => {
    videoRef.current?.play();
  };

  const handleMouseLeave = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  };

  const content = (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative aspect-[2/3] rounded-xl overflow-hidden border border-border bg-surface group cursor-pointer"
    >
      {videoSrc ? (
        <video
          ref={videoRef}
          src={videoSrc}
          loop
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : null}

      {!hideTitle && (
        <>
          {/* Bottom gradient so the title stays readable over any cover */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />
          <span
            className={`absolute bottom-3 left-3 font-display font-extrabold text-xl uppercase tracking-wide [text-shadow:2px_2px_0_rgba(0,0,0,0.6)] ${titleColorClassName}`}
          >
            {title}
          </span>
        </>
      )}

      {badge && (
        <span className="absolute top-2 left-2 bg-violet-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full">
          {badge}
        </span>
      )}

      {/* Subtle hover lift, matching the reference's clickable feel */}
      <div className="absolute inset-0 group-hover:bg-white/5 transition-colors duration-200" />
    </div>
  );

  if (href) {
    return (
      <Link href={href} aria-label={title}>
        {content}
      </Link>
    );
  }

  return content;
}