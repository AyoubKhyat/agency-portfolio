"use client";

/**
 * Vertically scrolling testimonial columns, adapted from the public
 * `testimonials-columns-1` component (21st.dev). Data only: pass real,
 * approved testimonials (see src/lib/testimonials.ts). The reference's demo
 * content (sample quotes, names, stock portraits) is deliberately not included,
 * and there is no image: a portrait is shown only if one is passed.
 *
 * Every testimonial is visible at every breakpoint: 1 column on phones,
 * 2 from `md`, 3 from `lg`, each layout holding all items round-robin.
 * Columns scroll only when they have enough cards to loop and the visitor
 * has not asked for reduced motion; otherwise they are static and fully
 * readable. The looping copy is hidden from assistive technology.
 */
import { useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "motion/react";

export type TestimonialItem = { text: string; name: string; role: string; image?: string };

/** Seconds per loop for columns 1–3: slightly different, as in the reference. */
export const COLUMN_DURATIONS = [15, 19, 17] as const;
/** A column needs at least this many cards before it scrolls (fewer would loop visibly). */
export const MIN_CARDS_TO_SCROLL = 2;

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/** False on the server and during hydration, true afterwards (no subscription needed). */
const noopSubscribe = () => () => {};
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

/** Round-robin split, so every column count shows every testimonial once. */
export function splitColumns<T>(items: readonly T[], columns: number): T[][] {
  const out: T[][] = Array.from({ length: Math.min(columns, items.length) }, () => []);
  items.forEach((item, i) => out[i % out.length].push(item));
  return out;
}

export function TestimonialsColumn({
  testimonials,
  duration = 10,
  animate = true,
  className,
  cardClassName,
}: {
  testimonials: TestimonialItem[];
  duration?: number;
  animate?: boolean;
  className?: string;
  cardClassName?: string;
}) {
  const reduce = useReducedMotion();
  // The server cannot know the visitor's motion preference, so the first client render matches the
  // server (moving) and the reduced-motion static layout applies right after hydration.
  const hydrated = useHydrated();
  const moving = animate && !(hydrated && reduce);
  const cards = (copy: number) =>
    testimonials.map(({ text, image, name, role }, i) => (
      <figure key={`${copy}-${i}`} className={cx("m-0 w-full max-w-xs rounded-3xl border border-line p-8", cardClassName)}>
        <blockquote className="m-0">
          {/* dir="auto": the quote reads in its own direction whatever the page language (one shared testimonial). */}
          <p className="m-0" dir="auto">{text}</p>
        </blockquote>
        <figcaption className="mt-5 flex items-center gap-3">
          {image && (
            // eslint-disable-next-line @next/next/no-img-element -- optional, caller-supplied portrait
            <img width={40} height={40} src={image} alt="" className="h-10 w-10 rounded-full object-cover" />
          )}
          <span className="flex flex-col">
            <span className="font-semibold leading-5 tracking-tight" dir="auto">{name}</span>
            <span className="leading-5 tracking-tight opacity-70" dir="auto">{role}</span>
          </span>
        </figcaption>
      </figure>
    ));

  if (!moving) {
    return (
      <div className={className}>
        <div className="flex flex-col gap-6">{cards(0)}</div>
      </div>
    );
  }
  return (
    <div className={className}>
      <motion.div
        animate={{ translateY: "-50%" }}
        transition={{ duration, repeat: Infinity, ease: "linear", repeatType: "loop" }}
        className="flex flex-col gap-6 pb-6"
      >
        {cards(0)}
        {/* The second copy only makes the loop seamless: hidden from screen readers. */}
        <div aria-hidden="true" className="contents">{cards(1)}</div>
      </motion.div>
    </div>
  );
}

/** 1 / 2 / 3 columns by breakpoint; each layout shows every testimonial. */
export function TestimonialsColumns({ testimonials, cardClassName }: { testimonials: TestimonialItem[]; cardClassName?: string }) {
  const layout = (count: 1 | 2 | 3, shownAt: string) => {
    const cols = splitColumns(testimonials, count);
    const scrolls = cols.every((c) => c.length >= MIN_CARDS_TO_SCROLL);
    return (
      <div
        key={count}
        data-columns={count}
        className={cx(
          "justify-center gap-6",
          shownAt,
          scrolls && "max-h-[740px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]",
        )}
      >
        {cols.map((col, i) => (
          <TestimonialsColumn key={i} testimonials={col} duration={COLUMN_DURATIONS[i]} animate={scrolls} cardClassName={cardClassName} className="w-full max-w-xs" />
        ))}
      </div>
    );
  };
  return (
    <>
      {layout(1, "flex md:hidden")}
      {layout(2, "hidden md:flex lg:hidden")}
      {layout(3, "hidden lg:flex")}
    </>
  );
}
