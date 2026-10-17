"use client";

import { useState, type ReactNode } from "react";
import s from "./portfolio.module.css";

type Filter = "all" | "clients" | "concepts";

// One control: All / Clients / Concepts. The two sections are rendered on the server and
// passed in; the filter only hides one of them.
export default function WorkFilter({
  clients,
  concepts,
  counts,
  labels,
}: {
  clients: ReactNode;
  concepts: ReactNode;
  counts: { clients: number; concepts: number };
  labels: { group: string; all: string; clients: string; concepts: string; tagClient: string; tagConcept: string; secClients: string; secConcepts: string };
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [changed, setChanged] = useState(0);
  const total = counts.clients + counts.concepts;
  const options: [Filter, string, number][] = [
    ["all", labels.all, total],
    ["clients", labels.clients, counts.clients],
    ["concepts", labels.concepts, counts.concepts],
  ];
  const shown = filter === "all" ? total : counts[filter];

  function choose(f: Filter) {
    setFilter(f);
    setChanged((n) => n + 1);
  }

  // After a change, re-mount the visible section so it fades in (skipped under reduced motion by CSS).
  const sectionKey = (name: string) => (changed ? `${name}-${changed}` : name);

  return (
    <>
      <div className={s.filterBar}>
        <div className={s.wrap}>
          <div className={s.filterRow}>
            <div className={s.seg} role="group" aria-labelledby="portfolio-filter-label">
              <span className={s.srOnly} id="portfolio-filter-label">{labels.group}</span>
              {options.map(([key, label, n]) => (
                <button key={key} type="button" aria-pressed={filter === key} onClick={() => choose(key)}>
                  {label} <span className={s.n} dir="ltr">{n}</span>
                </button>
              ))}
            </div>
            <ul className={s.legend} aria-hidden="true">
              <li>
                <span className={`${s.badge} ${s.badgeClient}`}>{labels.tagClient}</span>
                <span className={s.label}>{labels.secClients}</span>
              </li>
              <li>
                <span className={`${s.badge} ${s.badgeConcept}`}>{labels.tagConcept}</span>
                <span className={s.label}>{labels.secConcepts}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <p className={s.srOnly} aria-live="polite">{changed ? `${shown} / ${total}` : ""}</p>
      <div key={sectionKey("clients")} hidden={filter === "concepts"} className={changed ? s.fade : undefined}>
        {clients}
      </div>
      <div key={sectionKey("concepts")} hidden={filter === "clients"} className={changed ? s.fade : undefined}>
        {concepts}
      </div>
    </>
  );
}
