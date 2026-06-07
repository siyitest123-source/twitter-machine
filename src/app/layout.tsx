import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CreatePalette } from "@/components/CreatePalette";
import { Nav } from "@/components/Nav";
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
  description: "Multi-account Twitter content + engagement factory — manual mode",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AccountProvider>
          <div className="flex min-h-screen">
            <Nav />
            <main className="flex-1 min-w-0">{children}</main>
          </div>
          <CreatePalette />
        </AccountProvider>
      </body>
    </html>
  );
}
