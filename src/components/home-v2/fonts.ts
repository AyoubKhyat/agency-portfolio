import { Alexandria, Tajawal } from "next/font/google";

// Arabic faces for the homepage only (headings / body). Latin text keeps Cabinet Grotesk
// (Fontshare stylesheet) and Inter (root layout). Not preloaded: French and English pages
// only need Alexandria for the إبداع word, and Arabic pages pick both up from the CSS.
export const alexandria = Alexandria({
  variable: "--font-alexandria",
  subsets: ["arabic"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  preload: false,
});

export const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
});
