import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit",
});

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

const themeScript = `
(function() {
  try {
    var theme = window.localStorage.getItem("cb_theme") === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: "Cardano Bounties - Learn, Contribute & Earn on Cardano",
  description:
    "An open platform where anyone regardless of experience or skill level can contribute to the Cardano ecosystem. Explore tasks, build in public, and earn ADA while contributing to real projects.",
  openGraph: {
    title: "Cardano Bounties - Learn, Contribute & Earn on Cardano",
    description:
      "Explore bounties, build in public, and earn ADA while contributing to real Cardano projects.",
    url: "/",
    siteName: "Cardano Bounties",
    images: [
      {
        url: "/og-image.jpg",
        width: 1024,
        height: 512,
        alt: "Cardano Bounties platform - open bounties for the Cardano ecosystem",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@cardanobounties",
    title: "Cardano Bounties - Learn, Contribute & Earn on Cardano",
    description:
      "Explore bounties, build in public, and earn ADA while contributing to real Cardano projects.",
    images: [`${process.env.NEXT_PUBLIC_SITE_URL ?? "https://cardanobounties.com"}/og-image.jpg`],
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${inter.variable}`}
      data-theme="light"
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
