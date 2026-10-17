import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { PortfolioCardProject } from "@/lib/dal";
import s from "./portfolio.module.css";

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const EXT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

export type CardLabels = { client: string; concept: string; caseStudy: string; liveSite: string; newTab: string };

// Image-led project card. The title link covers the whole card (case study); the live-site
// link sits above it. The screenshot link is a duplicate target, so it is hidden from AT and Tab.
export default function ProjectCard({ project: p, isClient, labels, priority = false }: { project: PortfolioCardProject; isClient: boolean; labels: CardLabels; priority?: boolean }) {
  const caseHref = `/portfolio/${p.slug}`;
  const host = hostname(p.url);
  return (
    <article className={s.pcard}>
      <Link href={caseHref} className={s.shot} tabIndex={-1} aria-hidden="true">
        {p.image.startsWith("/") && (
          <Image
            src={p.image}
            alt=""
            fill
            sizes="(max-width: 760px) 100vw, (max-width: 1520px) 50vw, 760px"
            // The first card is the page's largest above-the-fold element: load it eagerly, first.
            {...(priority ? { loading: "eager" as const, fetchPriority: "high" as const } : {})}
          />
        )}
      </Link>
      <div className={s.pbody}>
        <div className={s.pmeta}>
          <span className={`${s.badge} ${isClient ? s.badgeClient : s.badgeConcept}`}>{isClient ? labels.client : labels.concept}</span>
          {p.sector && <span className={s.sector}>{p.sector}</span>}
        </div>
        <h3 className={s.disp}>
          <Link href={caseHref}>{p.title}</Link>
        </h3>
        {p.desc && <p className={s.pdesc}>{p.desc}</p>}
        {p.tags.length > 0 && (
          <p className={s.ptags}>
            {p.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </p>
        )}
        <div className={s.pact}>
          <span className={s.more} aria-hidden="true">
            {labels.caseStudy} <span className={s.flip}>→</span>
          </span>
          {host && (
            <a className={s.ext} href={p.url} target="_blank" rel="noopener noreferrer">
              <span className={s.extLbl}>
                {labels.liveSite}
                {EXT_ICON}
              </span>
              <span className={s.host} dir="ltr">{host}</span>
              <span className={s.srOnly}>{labels.newTab}</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
