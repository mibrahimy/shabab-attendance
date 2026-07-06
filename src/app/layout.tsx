import type { Metadata, Viewport } from "next";
import { DM_Sans, Noto_Nastaliq_Urdu, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { getLocale } from "@/i18n/get-locale";
import { dir } from "@/i18n/config";
import { I18nProvider } from "@/i18n/client-provider";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

// Monospace for numbers + status letters (counts, attendance rate) per the design.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-jetbrains",
});

// Urdu script face, applied when the locale is Urdu (see globals.css :lang(ur)).
const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-urdu",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2f55ea",
};

export const metadata: Metadata = {
  title: "Attendance Management",
  description: "NGO Volunteer & Attendance Management System",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Attendance",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      dir={dir(locale)}
      className={`${dmSans.variable} ${nastaliq.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js');
          }
        `}</Script>
      </body>
    </html>
  );
}
