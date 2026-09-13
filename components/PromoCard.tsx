interface PromoCardProps {
  titleStart: string;
  titleHighlight: string;
  highlightColor: string;
  description: string;
}

// Placeholder version of the reference site's promo cards (Claim Rakeback,
// Daily Bonus, Be an Affiliate). The reference uses full artwork/photos for
// these — we don't have those assets yet, so this renders a simple text-only
// box instead. Swap this out for an image-backed version later if/when we
// get real artwork.
export default function PromoCard({
  titleStart,
  titleHighlight,
  highlightColor,
  description,
}: PromoCardProps) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 min-h-[140px] flex flex-col justify-center hover:border-violet-400/40 transition-colors duration-200">
      <h3 className="text-lg font-display font-bold text-foreground mb-1.5">
        {titleStart} <span className={highlightColor}>{titleHighlight}</span>
      </h3>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
}