import type { Metadata } from "next";
import "./globals.css";
import { HouseholdProvider } from "@/lib/HouseholdContext";
import ProfileGate from "@/components/ProfileGate";
import MobileBackButton from "@/components/MobileBackButton";

export const metadata: Metadata = {
  title: "Hari-CRM — Life Dashboard",
  description: "Shenaal & Shalini's shared life dashboard.",
};

// Applied before paint so switching to light mode on a previous visit
// doesn't flash dark on reload.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-base-bg text-gray-200 antialiased">
        <HouseholdProvider>
          <MobileBackButton />
          <ProfileGate>{children}</ProfileGate>
        </HouseholdProvider>
      </body>
    </html>
  );
}
