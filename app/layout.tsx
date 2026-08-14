import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hari-CRM — Life Dashboard",
  description: "Shenaal & Shalini's shared life dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-base-bg text-gray-200 antialiased">{children}</body>
    </html>
  );
}
