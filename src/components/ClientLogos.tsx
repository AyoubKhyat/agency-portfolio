"use client";

import Image from "next/image";
import { Marquee } from "./Marquee";

const clients = [
  { name: "Hammam Nour", logo: null, url: "https://hammam-nour.vercel.app/" },
  { name: "Goudoukh Luxury Cars", logo: "/clients/goudoukh.webp", url: "https://goudoukh-luxury-cars.vercel.app/" },
  { name: "Tannour", logo: null, url: "https://tannour.vercel.app/" },
  { name: "Terrene Studio", logo: null, url: "https://terrene.webyms.com/" },
  { name: "Aylani Parfums", logo: null, url: "https://aylani-parfums.vercel.app/" },
  { name: "Luxury Copro", logo: "/clients/luxury-copro.webp", url: "https://luxurycopro.webyms.com/" },
  { name: "Victory Path", logo: null, url: "https://victory-path-beta.vercel.app/" },
];

export default function ClientLogos({ title }: { title: string }) {
  return (
    <section className="bg-surface-2 border-t border-b border-line-soft py-14 overflow-hidden">
      <p className="text-center font-mono text-xs tracking-[0.18em] uppercase text-text-muted mb-10">
        {title}
      </p>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-surface-2 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-surface-2 to-transparent z-10 pointer-events-none" />
        <Marquee pauseOnHover className="[--duration:30s] [--gap:3rem]" repeat={2}>
          {clients.map((client) => (
            <a
              key={client.name}
              href={client.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 px-5 shrink-0 group"
            >
              {client.logo ? (
                <div className="relative w-12 h-12 shrink-0">
                  <Image
                    src={client.logo}
                    alt={client.name}
                    fill
                    className="object-contain"
                    sizes="48px"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full border border-line flex items-center justify-center shrink-0">
                  <span className="font-serif text-lg text-primary">
                    {client.name[0]}
                  </span>
                </div>
              )}
              <span className="font-mono text-sm tracking-wider text-text-muted whitespace-nowrap group-hover:text-primary transition-colors">
                {client.name}
              </span>
            </a>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
