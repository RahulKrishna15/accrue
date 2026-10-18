import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { AppWash } from "@/components/backgrounds";
import { DemoControls } from "@/components/demo-controls";
import { Providers } from "@/components/providers";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { themeScript } from "@/components/theme-toggle";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Accrue: fair income for tokenized funds", template: "%s | Accrue" },
  description:
    "Accrue streams USDC income to holders of tokenized investment funds on Solana, split fairly by time held. Devnet only.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f0" },
    { media: "(prefers-color-scheme: dark)", color: "#1b2510" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only rounded-control bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-40">
          Skip to content
        </a>
        <Providers>
          <SiteHeader />
          <main id="main" className="relative isolate flex flex-1 flex-col">
            <AppWash />
            {children}
          </main>
          <SiteFooter />
          <DemoControls />
        </Providers>
      </body>
    </html>
  );
}
