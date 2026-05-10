"use client";

import { useTranslations } from "next-intl";
import { HiStar } from "react-icons/hi2";
import { FadeIn } from "./motion";
import { Marquee } from "./Marquee";

function ReviewCard({
  name,
  role,
  body,
  stars,
}: {
  name: string;
  role: string;
  body: string;
  stars: number;
}) {
  return (
    <div className="w-[340px] shrink-0 border border-line rounded-2xl p-6 bg-background hover:border-primary/30 transition-colors">
      <div className="flex gap-0.5 mb-3">
        {Array.from({ length: stars }, (_, i) => (
          <HiStar key={i} className="w-4 h-4 text-accent" />
        ))}
      </div>
      <p className="text-sm text-text-muted leading-relaxed mb-4">{body}</p>
      <div className="flex items-center gap-3 pt-3 border-t border-line-soft">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-serif text-primary text-sm font-semibold">
          {name.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{name}</p>
          <p className="text-xs text-text-muted">{role}</p>
        </div>
      </div>
    </div>
  );
}

export default function Testimonials() {
  const t = useTranslations("Testimonials");

  const reviews = [1, 2, 3, 4, 5, 6].map((n) => ({
    name: t(`r${n}_name`),
    role: t(`r${n}_role`),
    body: t(`r${n}_body`),
    stars: 5,
  }));

  const firstRow = reviews.slice(0, 3);
  const secondRow = reviews.slice(3);

  return (
    <section className="relative py-24 bg-surface-2 overflow-hidden">
      <div className="grid-bg" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <FadeIn className="text-center">
          <span className="pill">★ {t("pill")}</span>
          <h2 className="mt-8 font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight text-foreground">
            {t("heading")} <span className="text-primary italic">{t("heading_accent")}</span>
          </h2>
        </FadeIn>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-surface-2 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-surface-2 to-transparent z-10 pointer-events-none" />
        <Marquee pauseOnHover className="[--duration:35s] [--gap:1.25rem] mb-4">
          {firstRow.map((review) => (
            <ReviewCard key={review.name} {...review} />
          ))}
        </Marquee>
        <Marquee pauseOnHover reverse className="[--duration:35s] [--gap:1.25rem]">
          {secondRow.map((review) => (
            <ReviewCard key={review.name} {...review} />
          ))}
        </Marquee>
      </div>
    </section>
  );
}
