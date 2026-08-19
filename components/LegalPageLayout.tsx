"use client";

// Shared shell for every legal page (Privacy / Terms / About / Instructions):
// kicker label, title, "Last updated" line, sticky in-page section nav, and
// a <Section> wrapper each page's content anchors into. One layout, reused
// four times, instead of four hand-rolled pages — pattern reused from the
// DinoHistory project's legal pages template.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export type LegalNavItem = { id: string; label: string };

export function LegalPageLayout({
  kicker,
  title,
  lastUpdated,
  nav,
  children,
}: {
  kicker: string;
  title: string;
  lastUpdated: string;
  nav: LegalNavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-base-bg px-4 py-10 text-gray-200 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/login" className="mb-8 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-white">
          <ArrowLeft size={13} /> Back to Hari-CRM
        </Link>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[200px_1fr]">
          <aside className="lg:sticky lg:top-10 lg:self-start">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-accent-purple">{kicker}</p>
            <h1 className="mb-1 text-2xl font-semibold text-white">{title}</h1>
            <p className="mb-6 text-xs text-gray-500">Last updated: {lastUpdated}</p>
            <nav className="hidden flex-col gap-1 text-sm lg:flex">
              {nav.map((n) => (
                <a key={n.id} href={`#${n.id}`} className="rounded-lg px-2 py-1.5 text-gray-400 hover:bg-white/5 hover:text-white">
                  {n.label}
                </a>
              ))}
            </nav>
            <div className="mt-6 hidden flex-col gap-1 border-t border-white/5 pt-4 text-xs lg:flex">
              <Link href="/legal/privacy" className="text-gray-500 hover:text-accent-blue">Privacy Policy</Link>
              <Link href="/legal/terms" className="text-gray-500 hover:text-accent-blue">Terms of Use</Link>
              <Link href="/legal/about" className="text-gray-500 hover:text-accent-blue">About</Link>
              <Link href="/legal/instructions" className="text-gray-500 hover:text-accent-blue">Instructions for Use</Link>
            </div>
          </aside>

          <div className="glass-card rounded-xl2 p-6 sm:p-8">
            <div className="relative z-10 space-y-8">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-10">
      <h2 className="mb-2 text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-gray-400">{children}</div>
    </section>
  );
}
