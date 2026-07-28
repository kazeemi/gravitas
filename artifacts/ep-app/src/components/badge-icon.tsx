import { repFill, type BadgeDefinition } from "@/lib/badges";

interface BadgeIconProps {
  badge: BadgeDefinition;
  size?: number;
}

export function BadgeIcon({ badge, size = 48 }: BadgeIconProps) {
  if (badge.category === "identity") return <MedallionBadge size={size} />;
  if (badge.category === "reps")     return <HexBadge badge={badge} size={size} />;
  return <ShieldBadge badge={badge} size={size} />;
}

// ── The Arena — navy medallion with double amber ring ────────────────────────

function MedallionBadge({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="23" fill="#0F1B2D" />
      <circle cx="24" cy="24" r="22" stroke="#F0953E" strokeWidth="1" />
      <circle cx="24" cy="24" r="17.5" stroke="#F0953E" strokeWidth="0.75" strokeOpacity="0.55" />
      {/* threshold dash */}
      <line x1="16" y1="24" x2="32" y2="24" stroke="#F0953E" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Reps — flat-top hexagon with stone fill progression ──────────────────────

function HexBadge({ badge, size }: { badge: BadgeDefinition; size: number }) {
  const fill = repFill(badge.sessionThreshold ?? 3);
  const num = (badge.name ?? "").split(" ")[0];
  const fontSize = num.length > 2 ? 12 : 14;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* flat-top hexagon */}
      <polygon points="24,4 41.3,14 41.3,34 24,44 6.7,34 6.7,14" fill={fill} />
      <text
        x="24"
        y="29"
        textAnchor="middle"
        fill="white"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="'DM Mono', monospace"
      >
        {num}
      </text>
    </svg>
  );
}

// ── Earned — champagne gold shield ───────────────────────────────────────────

function ShieldBadge({ badge, size }: { badge: BadgeDefinition; size: number }) {
  const isDistinguished = badge.id === "distinguished";

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* classic shield: flat top, straight sides, point at bottom */}
      <path d="M8,6 H40 V30 L24,46 L8,30 Z" fill="#C9952A" stroke="#F5EDD6" strokeWidth="1.2" strokeLinejoin="round" />
      {isDistinguished ? (
        /* 5-point star */
        <polygon
          points="24,14 26.5,21.5 34,21.5 28,26.5 30.5,34 24,29.5 17.5,34 20,26.5 14,21.5 21.5,21.5"
          fill="white"
          fillOpacity="0.92"
        />
      ) : (
        /* upward arrow for Breakthrough */
        <g stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="24" y1="32" x2="24" y2="16" />
          <polyline points="17,23 24,16 31,23" />
        </g>
      )}
    </svg>
  );
}
