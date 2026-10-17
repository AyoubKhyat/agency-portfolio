"use client";

import { useState } from "react";
import { Mark } from "./Marks";
import s from "./services.module.css";

// Phone layout of the comparison: pick one service, see its feature checklist.
export default function ComparePicker({
  services,
  features,
  pickLabel,
  yes,
  no,
}: {
  services: string[];
  features: { label: string; included: readonly boolean[] }[];
  pickLabel: string;
  yes: string;
  no: string;
}) {
  const [picked, setPicked] = useState(0);
  return (
    <div className={s.cmpMobile}>
      <p className={`${s.label} ${s.pickLabel}`} id="services-v2-pick">{pickLabel}</p>
      <div className={s.chips} role="group" aria-labelledby="services-v2-pick">
        {services.map((name, i) => (
          <button key={name} type="button" aria-pressed={i === picked} onClick={() => setPicked(i)}>
            {name}
          </button>
        ))}
      </div>
      <ul className={s.checklist} aria-live="polite">
        {features.map((f) => {
          const on = f.included[picked];
          return (
            <li key={f.label} className={on ? undefined : s.off}>
              <span>{f.label}</span>
              <Mark on={on} yes={yes} no={no} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
