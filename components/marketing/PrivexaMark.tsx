/**
 * PrivexaMark — the CerviGrade / Privexa brand mark.
 *
 * Motif: a governance/privacy SHIELD wrapping a concentric APERTURE / cytology-
 * lens (screening under a lens) with three ascending GRADING tiers at the base.
 * Pure SVG — crisp at any size, transparent, works on dark and light surfaces.
 *
 * No external logo asset exists, so the brand identity lives here.
 */

interface PrivexaMarkProps {
  size?: number;
  className?: string;
  /** Unique suffix so multiple instances don't collide on gradient ids. */
  uid?: string;
  /** Animate the aperture sweep + glow (hero centerpiece). */
  animated?: boolean;
}

export function PrivexaMark({ size = 36, className, uid = "pvx", animated = false }: PrivexaMarkProps) {
  const g = `pvx-grad-${uid}`;
  const gr = `pvx-ring-${uid}`;
  const gl = `pvx-glow-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="CerviGrade by Privexa"
    >
      <defs>
        <linearGradient id={g} x1="6" y1="2" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#67E8F9" />
          <stop offset="0.5" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient id={gr} x1="14" y1="14" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A5F3FC" />
          <stop offset="1" stopColor="#5EEAD4" />
        </linearGradient>
        <radialGradient id={gl} cx="0.5" cy="0.42" r="0.6">
          <stop stopColor="#22D3EE" stopOpacity="0.55" />
          <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft inner glow */}
      <circle cx="24" cy="21" r="13" fill={`url(#${gl})`} />

      {/* Shield outline */}
      <path
        d="M24 3.2 L40 8.4 V22 C40 32.4 33 39.6 24 44.2 C15 39.6 8 32.4 8 22 V8.4 Z"
        stroke={`url(#${g})`}
        strokeWidth="2.1"
        strokeLinejoin="round"
        fill="rgba(34,211,238,0.04)"
      />

      {/* Aperture / lens — concentric rings */}
      <circle cx="24" cy="20.5" r="8.4" stroke={`url(#${gr})`} strokeWidth="1.5" opacity="0.55" />
      <g style={animated ? { transformOrigin: "24px 20.5px", animation: "pvxSpin 16s linear infinite" } : undefined}>
        {/* Aperture blades — dashed ring gives the iris feel */}
        <circle
          cx="24"
          cy="20.5"
          r="5.4"
          stroke={`url(#${g})`}
          strokeWidth="2.2"
          strokeDasharray="5.6 3.2"
          strokeLinecap="round"
        />
      </g>
      <circle cx="24" cy="20.5" r="2.1" fill={`url(#${g})`} />

      {/* Grading tiers at the base */}
      <g>
        <rect x="18.4" y="33.2" width="3" height="3.4" rx="1" fill={`url(#${gr})`} opacity="0.7" />
        <rect x="22.5" y="31.4" width="3" height="5.2" rx="1" fill={`url(#${gr})`} opacity="0.85" />
        <rect x="26.6" y="29.4" width="3" height="7.2" rx="1" fill={`url(#${g})`} />
      </g>
    </svg>
  );
}

/** Horizontal lockup: mark + wordmark. `tone` sets the wordmark colour. */
export function PrivexaLockup({
  size = 32,
  tone = "light",
  uid = "lockup",
  showProduct = true,
  className,
}: {
  size?: number;
  tone?: "light" | "dark";
  uid?: string;
  showProduct?: boolean;
  className?: string;
}) {
  const primary = tone === "light" ? "text-white" : "text-slate-900";
  const secondary = tone === "light" ? "text-slate-400" : "text-slate-500";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <PrivexaMark size={size} uid={uid} />
      <span className="flex flex-col leading-none">
        <span className={`font-display text-[1.02rem] font-semibold tracking-tight ${primary}`}>
          CerviGrade
        </span>
        {showProduct && (
          <span className={`text-[10px] font-medium tracking-[0.16em] uppercase ${secondary}`}>
            by Privexa
          </span>
        )}
      </span>
    </span>
  );
}
