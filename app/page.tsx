"use client";

import { useState } from "react";
import CasinoToolbar from "@/components/CasinoToolbar";
import SectionHeader from "@/components/SectionHeader";
import GameCard from "@/components/GameCard";

// Same Original Games lineup as the logged-in /home page, same order.
// hideTitle is true for all of them — every cover video already has the
// game's name baked into the footage, so no text label is rendered on top.
// No href on any of them — logged-out users shouldn't be able to click
// into a game, only registered/logged-in users should.
const originalGames = [
  {
    id: "mines",
    title: "Mines",
    badge: "NEW",
    videoSrc: "/games/mines-cover.mp4",
    titleColorClassName: "text-cyan-300",
    hideTitle: true,
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

export default function Home() {
  const [activeTab, setActiveTab] = useState("Games");

  return (
    <div>
      <CasinoToolbar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* key={activeTab} forces React to remount this wrapper on every
            tab switch, which re-triggers the CSS animation each time. */}
        <div key={activeTab} className="animate-tab-content">
          {activeTab === "Games" && (
            <section className="mb-10">
              <SectionHeader
                title="Original Games"
                showViewAll={false}
                showArrows={false}
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-4">
                {originalGames.map((game, index) => (
                  <div
                    key={game.id}
                    className="animate-card-fade-in"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <GameCard {...game} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === "Live Games" && (
            <p className="text-muted text-sm">Live games coming soon.</p>
          )}

          {activeTab === "Sports" && (
            <p className="text-muted text-sm">Sports coming soon.</p>
          )}
        </div>
      </div>
    </div>
  );
}