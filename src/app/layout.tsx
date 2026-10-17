import type { Metadata } from "next";
import Script from "next/script";
import { preconnect } from "react-dom";
import { getLocale } from "next-intl/server";
import { Inter, Instrument_Serif, JetBrains_Mono, Plus_Jakarta_Sans, Noto_Kufi_Arabic } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const notoKufiArabic = Noto_Kufi_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
  // Not preloaded: only Arabic pages use it, and they fetch it from the @font-face rule. Preloading
  // made every FR/EN page download it (~121 KB) at high priority.
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Ibda3 Digital — Agence Web Marrakech",
  description:
    "Ibda3 Digital — Agence web à Marrakech. Création de sites web, applications mobiles et solutions e-commerce sur mesure.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Server-rendered lang/dir: the locale comes from the next-intl proxy (request header); routes it
  // does not handle (admin, sign) fall back to the default locale. SetLang keeps them in sync on
  // client-side language switches, where this root layout is not re-rendered.
  const locale = await getLocale();
  // Cabinet Grotesk files (@font-face in globals.css); used by the footer wordmark on every page.
  preconnect("https://cdn.fontshare.com", { crossOrigin: "anonymous" });
  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${inter.variable} ${instrumentSerif.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} ${notoKufiArabic.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})();`}
        </Script>
        {children}
        {/* Google Analytics is opt-in: it loads only after the visitor accepts (stored
            "cookie-consent" === "accepted"). Without that choice, leftover GA cookies from
            earlier visits are removed. CookieConsent calls __ibda3Analytics.load() on Accept. */}
        <Script id="ga-consent-gate" strategy="afterInteractive">
          {`(function(){var ID='G-PK5HSDWHYM',loaded=false;function clear(){window['ga-disable-'+ID]=true;try{var h=location.hostname,p=h.split('.'),d=['',h,'.'+h];for(var i=1;i<p.length-1;i++)d.push('.'+p.slice(i).join('.'));document.cookie.split(';').forEach(function(c){var n=c.split('=')[0].trim();if(n==='_ga'||n.indexOf('_ga_')===0||n==='_gid'||n==='_gat'){d.forEach(function(x){document.cookie=n+'=; Max-Age=0; path=/'+(x?'; domain='+x:'')})}})}catch(e){}}function load(){window['ga-disable-'+ID]=false;if(loaded)return;loaded=true;var s=document.createElement('script');s.src='https://www.googletagmanager.com/gtag/js?id='+ID;s.async=true;document.head.appendChild(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};window.gtag('js',new Date());window.gtag('config',ID)}window.__ibda3Analytics={load:load,clear:clear};var c=null;try{c=localStorage.getItem('cookie-consent')}catch(e){}if(c==='accepted')load();else clear()})();`}
        </Script>
      </body>
    </html>
  );
}
