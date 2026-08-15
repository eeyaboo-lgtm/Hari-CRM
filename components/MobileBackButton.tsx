"use client";

// Small top-left back icon, mobile only (Sidebar is desktop-only, so phones
// had no way to navigate back between pages without it). Uses browser
// history via router.back() — the usual back-arrow behavior. Hidden on
// dashboard/login since there's nothing to go "back" to from the home page.
import { ArrowLeft } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

const HIDE_ON = ["/", "/dashboard", "/login"];

export default function MobileBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (!pathname || HIDE_ON.includes(pathname)) return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Back"
      className="glass-card fixed left-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-full text-gray-200 md:hidden"
    >
      <ArrowLeft size={18} className="relative z-10" />
    </button>
  );
}
