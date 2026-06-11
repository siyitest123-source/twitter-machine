import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CreatePalette } from "@/components/CreatePalette";
import { Nav } from "@/components/Nav";
import { ThemeBoot } from "@/components/ThemeBoot";
import { AccountProvider } from "@/lib/account-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Twitter Factory",
  description:
    "Multi-account Twitter content + engagement factory — manual mode",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // No data-theme here — ThemeBoot stamps it before paint to avoid flicker.
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <ThemeBoot />
      </head>
      <body>
        <AccountProvider>
          <div className="app" data-nav="top">
            <Nav />
            <main className="canvas">
              <div className="scroll">{children}</div>
            </main>
          </div>
          <CreatePalette />
        </AccountProvider>
      </body>
    </html>
  );
}
