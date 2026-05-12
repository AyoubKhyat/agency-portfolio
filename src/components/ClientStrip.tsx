"use client";

import Image from "next/image";
import { FadeIn } from "./motion";

const clients = [
  { name: "Hammam Nour", image: "/projects/hammam-nour.webp", url: "https://hammam-nour.vercel.app/" },
  { name: "Goudoukh", image: "/projects/goudoukh.webp", url: "https://goudoukh-luxury-cars.vercel.app/" },
  { name: "Tannour", image: "/projects/tannour.webp", url: "https://tannour.vercel.app/" },
  { name: "Terrene Studio", image: "/projects/terrene.webp", url: "https://terrene.webyms.com/" },
  { name: "Victory Path", image: "/projects/victory-path-v2.webp", url: "https://victory-path-beta.vercel.app/login" },
];

export default function ClientStrip({ title }: { title: string }) {
  return (
    <section className="bg-background border-t border-b border-line-soft py-16 overflow-hidden">
      <FadeIn className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center font-mono text-xs tracking-[0.18em] uppercase text-text-muted mb-10">
          {title}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          {clients.map((client) => (
            <a
              key={client.name}
              href={client.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-[16/10] rounded-xl overflow-hidden border border-line hover:border-primary/30 transition-all hover:-translate-y-1"
            >
              <Image
                src={client.image}
                alt={client.name}
                fill
                className="object-cover object-center opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <span className="absolute bottom-3 left-3 font-mono text-xs tracking-wider text-white/90">
                {client.name}
              </span>
            </a>
          ))}
        </div>
      </FadeIn>
    </section>
  );
}
