import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fabry–Pérot Fringe Analyzer",
  description: "Estimate film thickness, real permittivity, and birefringence from Fabry–Pérot spectral fringes.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
