"use client";

import { useState } from "react";
import { num } from "./data";
import s from "./services.module.css";

// One answer open at a time, as on the previous Services page.
export default function FaqList({ items }: { items: { question: string; answer: string }[] }) {
  const [open, setOpen] = useState(-1);
  return (
    <ul className={s.faqList} data-reveal="">
      {items.map((item, i) => (
        <li key={i}>
          <button
            type="button"
            className={s.q}
            id={`services-faq-q${i + 1}`}
            aria-expanded={open === i}
            aria-controls={`services-faq-a${i + 1}`}
            onClick={() => setOpen(open === i ? -1 : i)}
          >
            <span className={s.idx} dir="ltr">{num(i)}</span>
            <span className={s.qText}>{item.question}</span>
            <span className={s.pm} aria-hidden="true" />
          </button>
          <div className={s.a} id={`services-faq-a${i + 1}`} role="region" aria-labelledby={`services-faq-q${i + 1}`}>
            <div>
              <p>{item.answer}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
