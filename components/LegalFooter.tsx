import Link from "next/link";

// Compact legal link row — used on the public login screen and in Settings
// so both signed-out and signed-in users can always reach these pages.
export default function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600 ${className}`}>
      <Link href="/legal/about" className="hover:text-gray-400">About</Link>
      <span>·</span>
      <Link href="/legal/privacy" className="hover:text-gray-400">Privacy Policy</Link>
      <span>·</span>
      <Link href="/legal/terms" className="hover:text-gray-400">Terms of Use</Link>
      <span>·</span>
      <Link href="/legal/instructions" className="hover:text-gray-400">Instructions for Use</Link>
    </div>
  );
}
