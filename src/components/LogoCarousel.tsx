"use client";

import {
  SiNextdotjs,
  SiReact,
  SiLaravel,
  SiPhp,
  SiTailwindcss,
  SiWordpress,
  SiTypescript,
  SiVercel,
} from "react-icons/si";
import { Marquee } from "./Marquee";

const logos = [
  { icon: SiNextdotjs, name: "Next.js" },
  { icon: SiReact, name: "React" },
  { icon: SiLaravel, name: "Laravel" },
  { icon: SiPhp, name: "PHP" },
  { icon: SiTailwindcss, name: "Tailwind CSS" },
  { icon: SiWordpress, name: "WordPress" },
  { icon: SiTypescript, name: "TypeScript" },
  { icon: SiVercel, name: "Vercel" },
];

export default function LogoCarousel({ title }: { title: string }) {
  return (
    <section className="bg-surface-2 border-t border-b border-line-soft py-12 overflow-hidden">
      <p className="text-center font-mono text-xs tracking-[0.18em] uppercase text-text-muted mb-8">
        {title}
      </p>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-surface-2 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-surface-2 to-transparent z-10 pointer-events-none" />
        <Marquee pauseOnHover className="[--duration:25s] [--gap:2rem]" repeat={2}>
          {logos.map((logo) => (
            <div
              key={logo.name}
              className="flex items-center gap-3 px-6 shrink-0"
            >
              <logo.icon className="w-7 h-7 text-text-muted" />
              <span className="font-mono text-sm tracking-wider text-text-muted whitespace-nowrap">
                {logo.name}
              </span>
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
