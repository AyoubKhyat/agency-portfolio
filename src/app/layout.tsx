import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ibda3 Digital — Agence Web Marrakech",
  description:
    "Ibda3 Digital — Agence web à Marrakech. Création de sites web, applications mobiles et solutions e-commerce sur mesure.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
