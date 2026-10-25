"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import emailjs from "@emailjs/browser";
import type { Outcome } from "@/lib/contact-outcome";
import { emailParams, submitInquiry } from "@/lib/contact-submit";
import {
  EMPTY_DIAGNOSIS,
  PROBLEM_MAX,
  SITE_URL_FIELD,
  SITE_URL_MAX,
  STEP_FIELDS,
  buildDiagnosisInquiry,
  normalizeSiteUrl,
  validateDiagnosisField,
  validateStep,
  type DiagnosisError,
  type DiagnosisField as Field,
  type DiagnosisValues as Values,
} from "@/lib/diagnosis";
import { trackEvent } from "@/lib/analytics";
import s from "./home.module.css";

// Ids are prefixed: the homepage has other forms' worth of common names (email, phone…).
const id = (f: Field) => `dg-${f}`;

/**
 * Homepage hero: free website diagnosis in two steps on the same page.
 * Step 1 asks only for the site address; step 2 for how to reach the visitor.
 * The request is saved as a CRM lead through the shared contact path
 * (lib/contact-submit); the site itself is never fetched or changed.
 */
export default function DiagnosisForm({ waUrl }: { waUrl: string }) {
  const t = useTranslations("Diagnosis");
  const c = useTranslations("Contact");
  const v = useTranslations("Validation");
  const locale = useLocale();
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<Values>(EMPTY_DIAGNOSIS);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  // Where focus goes after the next render (set by user actions only, never on load).
  const focusNext = useRef<"url" | "details" | "done" | "alert" | null>(null);

  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    const el = ({ url: urlRef, details: detailsRef, done: doneRef, alert: alertRef })[target].current;
    if (!el) return;
    el.focus({ preventScroll: target !== "url" });
    // Step 2 is taller than step 1: bring the whole form (up to its submit button) into view.
    if (target !== "url") el.closest("form, [role=status]")?.scrollIntoView({ block: "nearest" });
  });

  // Rules live in lib/diagnosis (unit-tested); url_* messages are ours, the rest shared with the contact form.
  const message = (code: DiagnosisError | undefined) =>
    code === undefined ? undefined : code.startsWith("url_") ? t(code) : v(code);
  const validate = (field: Field, value: string) => message(validateDiagnosisField(field, value));

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const field = e.target.name as Field;
    setValues((prev) => ({ ...prev, [field]: e.target.value }));
    if (touched[field]) setErrors((prev) => ({ ...prev, [field]: validate(field, e.target.value) }));
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const field = e.target.name as Field;
    // An empty, untouched address is not an error until the visitor asks for the diagnosis.
    if (field === SITE_URL_FIELD && !e.target.value.trim() && !touched[field]) return;
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validate(field, e.target.value) }));
  };

  /** Validate a step; show its errors and focus the first invalid field. */
  function check(step: 1 | 2): boolean {
    const fields: readonly Field[] = STEP_FIELDS[step];
    const found = validateStep(step, values);
    setErrors((prev) => ({ ...prev, ...Object.fromEntries(fields.map((f) => [f, message(found[f])])) }));
    setTouched((prev) => ({ ...prev, ...Object.fromEntries(fields.map((f) => [f, true])) }));
    const first = fields.find((f) => found[f]);
    if (first) document.getElementById(id(first))?.focus();
    return !first;
  }

  function back() {
    setStep(1);
    setStatus("idle");
    focusNext.current = "url";
  }
  function cancel() {
    setValues(EMPTY_DIAGNOSIS);
    setErrors({});
    setTouched({});
    setOutcome(null);
    setStatus("idle");
    setStep(1);
    focusNext.current = "url";
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;

    if (step === 1) {
      if (!check(1)) return;
      setStep(2);
      focusNext.current = "details";
      return;
    }

    // Bots fill the hidden field: pretend it worked, send nothing.
    if (honeypot.current?.value) {
      setStatus("success");
      setOutcome("success");
      focusNext.current = "done";
      return;
    }
    if (!check(2)) return;
    if (!normalizeSiteUrl(values.siteUrl)) return back();

    setStatus("sending");
    const inquiry = buildDiagnosisInquiry({ ...values, locale });
    const { outcome: result, track } = await submitInquiry(inquiry, (cfg) =>
      // Same template params as the contact form (see emailParams).
      emailjs.send(cfg.serviceId, cfg.templateId, emailParams(inquiry), { publicKey: cfg.publicKey }),
    );
    if (track) trackEvent("generate_lead", { method: "diagnosis_form", service: "website-repair", locale, page_type: "home" });
    setOutcome(result);
    if (result === "success" || result === "email_only") {
      setStatus("success");
      setValues(EMPTY_DIAGNOSIS);
      setErrors({});
      setTouched({});
      focusNext.current = "done";
    } else {
      // Keep everything typed so the visitor can retry or switch to WhatsApp.
      setStatus("error");
      focusNext.current = "alert";
    }
  }

  const invalid = (f: Field) => Boolean(touched[f] && errors[f]);
  const ctl = (f: Field) => ({
    id: id(f),
    name: f,
    value: values[f],
    onChange,
    onBlur,
    "aria-invalid": invalid(f) || undefined,
    "aria-describedby": `${id(f)}-err`,
  });
  const err = (f: Field) => (
    <p className={s.dgErr} id={`${id(f)}-err`} aria-live="polite">
      {invalid(f) && errors[f]}
    </p>
  );
  const required = <span className={s.dgReq} aria-hidden="true">*</span>;

  if (status === "success") {
    return (
      <div className={`${s.dg} ${s.dgReveal}`} role="status">
        <h3 className={s.dgTitle} tabIndex={-1} ref={doneRef}>{t("success_title")}</h3>
        <p className={s.dgNote}>{t("success_body")}</p>
        {outcome === "email_only" && <p className={s.dgNote}>{c("form_success_email_only")}</p>}
        <div className={s.dgActions}>
          <button type="button" className={s.dgText} onClick={cancel}>{t("again")}</button>
        </div>
      </div>
    );
  }

  return (
    <form className={s.dg} onSubmit={onSubmit} noValidate aria-label={t("start")}>
      <div aria-hidden="true" className={s.srOnly}>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" ref={honeypot} defaultValue="" />
      </div>

      {step === 1 ? (
        <div>
          <label htmlFor={id(SITE_URL_FIELD)} className={`${s.label} ${s.dgLabel}`}>{t("url_label")}</label>
          <div className={s.dgRow} data-invalid={invalid(SITE_URL_FIELD) || undefined}>
            <input
              {...ctl(SITE_URL_FIELD)}
              ref={urlRef}
              className={s.dgUrl}
              type="url"
              inputMode="url"
              dir="ltr"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={SITE_URL_MAX}
              placeholder={t("url_placeholder")}
              required
              aria-required="true"
            />
            <button type="submit" className={`${s.pill} ${s.pillGrad} ${s.dgGo}`}>
              <span>{t("start")}</span>
              <span className={s.flip} aria-hidden="true">→</span>
            </button>
          </div>
          {err(SITE_URL_FIELD)}
          <p className={s.dgNote}>{t("note")}</p>
        </div>
      ) : (
        <div className={s.dgReveal}>
          <p className={s.label}>{t("step", { n: 2 })}</p>
          <h3 className={s.dgTitle} tabIndex={-1} ref={detailsRef}>{t("details_title")}</h3>
          <p className={s.dgSite}>
            <span className={s.label}>{t("site_label")}</span>
            <bdi dir="ltr">{normalizeSiteUrl(values.siteUrl)}</bdi>
          </p>

          {status === "error" && (
            <div className={s.dgAlert} role="alert" tabIndex={-1} ref={alertRef}>
              {outcome === "rate_limited" ? c("form_error_rate_limited") : c("form_error")}{" "}
              <a href={waUrl} target="_blank" rel="noopener noreferrer" data-wa-placement="home_diagnosis_error">WhatsApp</a>
            </div>
          )}

          <div className={s.dgFields}>
            <div>
              <label htmlFor={id("fullName")} className={s.label}>{c("form_name")}{required}</label>
              <input {...ctl("fullName")} className={s.dgCtl} type="text" autoComplete="name" required aria-required="true" />
              {err("fullName")}
            </div>
            <div>
              <label htmlFor={id("email")} className={s.label}>{c("form_email")}{required}</label>
              <input {...ctl("email")} className={s.dgCtl} type="email" dir="ltr" autoComplete="email" inputMode="email" required aria-required="true" />
              {err("email")}
            </div>
            <div className={s.dgFull}>
              <label htmlFor={id("phone")} className={s.label}>
                {t("phone_label")} <span className={s.dgOpt}>· {c("optional")}</span>
              </label>
              <input {...ctl("phone")} className={s.dgCtl} type="tel" dir="ltr" autoComplete="tel" inputMode="tel" />
              {err("phone")}
            </div>
            <div className={s.dgFull}>
              <label htmlFor={id("problem")} className={s.label}>
                {t("problem_label")} <span className={s.dgOpt}>· {c("optional")}</span>
              </label>
              <textarea {...ctl("problem")} className={s.dgCtl} rows={3} maxLength={PROBLEM_MAX} placeholder={t("problem_hint")} />
              {err("problem")}
            </div>
          </div>

          <div className={s.dgActions}>
            <button type="submit" className={`${s.pill} ${s.pillGrad} ${s.dgGo}`} disabled={status === "sending"} aria-busy={status === "sending"}>
              {status === "sending" ? (
                <>
                  <span className={s.dgSpin} aria-hidden="true" />
                  <span>{c("form_sending")}</span>
                </>
              ) : (
                <>
                  <span>{t("submit")}</span>
                  <span className={s.flip} aria-hidden="true">→</span>
                </>
              )}
            </button>
            <button type="button" className={s.dgText} onClick={back} disabled={status === "sending"}>{t("back")}</button>
            <button type="button" className={s.dgText} onClick={cancel} disabled={status === "sending"}>{t("cancel")}</button>
          </div>
        </div>
      )}
    </form>
  );
}
