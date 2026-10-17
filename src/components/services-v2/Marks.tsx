import s from "./services.module.css";

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

// Included / not-included mark with its spoken label.
export function Mark({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return on ? (
    <>
      <span className={s.yes}><CheckIcon /></span>
      <span className={s.srOnly}>{yes}</span>
    </>
  ) : (
    <>
      <span className={s.no} aria-hidden="true" />
      <span className={s.srOnly}>{no}</span>
    </>
  );
}
