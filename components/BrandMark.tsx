// The Hari logo ("refined trio", chosen 2026-11-16): blue square, pink
// circle, orange play-triangle. Single source for every place the mark
// appears. The soft glow comes from .brand-mark in globals.css and switches
// off in the Clean style.
export default function BrandMark({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Hari"
      className={`brand-mark shrink-0 ${className}`}
    >
      <rect x="4" y="23" width="18" height="18" rx="5" fill="#4fc3f7" />
      <circle cx="32" cy="32" r="9.5" fill="#fb7fc4" />
      <path d="M46 23.5 L58.5 32 L46 40.5 Z" fill="#ffa552" stroke="#ffa552" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
