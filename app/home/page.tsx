"use client";

import { useAuth } from "@/contexts/AuthContext";
import SectionHeader from "@/components/SectionHeader";
import PromoCard from "@/components/PromoCard";
import GameCard from "@/components/GameCard";

const promoCards = [
  {
    titleStart: "Claim",
    titleHighlight: "Rakeback",
    highlightColor: "text-cyan-400",
    description: "Wager and get a part of your bet back!",
  },
  {
    titleStart: "Daily",
    titleHighlight: "Bonus",
    highlightColor: "text-violet-400",
    description: "Earn free rewards daily!",
  },
  {
    titleStart: "Be an",
    titleHighlight: "Affiliate",
    highlightColor: "text-pink-400",
    description: "And earn a part of your affiliate's wagers!",
  },
];

// Original Games row. Mines is the only one that's actually playable right
// now (has an href), so it's the only one wired to navigate. The rest show
// their cover video but don't link anywhere yet — add href once each
// game's page is built.
//
// hideTitle is true for all of them — every cover video already has the
// game's name baked into the footage, so no text label is rendered on top.
//
// Order: mines, coinflip, dice, roulette, tower, blackjack, hilo, plinko,
// keno, cases
const originalGames = [
  {
    id: "mines",
    title: "Mines",
    badge: "NEW",
    videoSrc: "/games/mines-cover.mp4",
    titleColorClassName: "text-cyan-300",
    hideTitle: true,
    href: "/games/mines",
  },
  {
    id: "coinflip",
    title: "Coinflip",
    videoSrc: "/games/coinflip.mp4",
    hideTitle: true,
  },
  {
    id: "dice",
    title: "Dice",
    videoSrc: "/games/dice.mp4",
    hideTitle: true,
  },
  {
    id: "roulette",
    title: "Roulette",
    videoSrc: "/games/roulette.mp4",
    hideTitle: true,
  },
  {
    id: "tower",
    title: "Tower",
    videoSrc: "/games/tower.mp4",
    hideTitle: true,
  },
  {
    id: "blackjack",
    title: "Blackjack",
    videoSrc: "/games/blackjack.mp4",
    hideTitle: true,
  },
  {
    id: "hilo",
    title: "HiLo",
    videoSrc: "/games/hilo.mp4",
    hideTitle: true,
  },
  {
    id: "plinko",
    title: "Plinko",
    videoSrc: "/games/plinko.mp4",
    hideTitle: true,
  },
  {
    id: "keno",
    title: "Keno",
    videoSrc: "/games/keno.mp4",
    hideTitle: true,
  },
  {
    id: "cases",
    title: "Cases",
    videoSrc: "/games/cases.mp4",
    hideTitle: true,
  },
];

export default function HomePage() {
  const { user, isLoading } = useAuth();

  // Avoid flashing an empty "Welcome back," before AuthContext finishes
  // its initial /users/me check.
  if (isLoading) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="relative w-full h-64 md:h-72 rounded-2xl overflow-hidden mb-10">
        <video
          src="/banners/banner1.webm"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover brightness-75"
        />
        {/* Flat black wash to mute the video overall, matching the darker reference look */}
        <div className="absolute inset-0 bg-black/30" />
        {/* Gradient on top of that for text legibility on the left side */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/10" />
        <div className="relative h-full flex flex-col justify-center px-8">
          <p className="text-sm md:text-base font-semibold text-foreground tracking-wide uppercase">
            Welcome back,
          </p>
          <h1 className="text-3xl md:text-5xl font-display font-extrabold text-violet-300">
            {user?.username ?? ""}
          </h1>
        </div>
      </div>

      <section className="mb-10">
        <SectionHeader title="Check this out" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {promoCards.map((card) => (
            <PromoCard key={card.titleHighlight} {...card} />
          ))}
        </div>
      </section>

      <section className="mb-10">
        <SectionHeader title="Original Games" showViewAll={false} showArrows={false} />
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-4">
          {originalGames.map((game) => (
            <GameCard key={game.id} {...game} />
          ))}
        </div>
      </section>
    </div>
  );
}