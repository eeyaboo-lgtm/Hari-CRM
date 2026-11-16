"use client";

// Small grey "i" that explains an option in one sentence. Opens on hover
// (desktop), on tap (phones — there is no hover), and on keyboard focus.
// Rendered through a portal with fixed positioning because .glass-card has
// overflow:hidden + backdrop-filter, which would otherwise clip the bubble.
import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TIP_WIDTH = 240;

export default function InfoTip({ text, label = "What does this do?" }: { text: string; label?: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const open = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - TIP_WIDTH - 8);
    setPos({ top: r.bottom + 6, left: Math.min(Math.max(8, r.left - 8), maxLeft) });
  };
  const close = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: PointerEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-describedby={pos ? id : undefined}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        onClick={open}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:text-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-purple"
      >
        <Info size={16} aria-hidden />
      </button>
      {pos &&
        createPortal(
          <span
            role="tooltip"
            id={id}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: TIP_WIDTH, maxWidth: "calc(100vw - 16px)" }}
            className="z-[100] rounded-xl bg-white px-3 py-2 text-xs leading-relaxed text-base-bg shadow-lg"
          >
            {text}
          </span>,
          document.body
        )}
    </>
  );
}
