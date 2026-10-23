"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import emailjs from "@emailjs/browser";
import { SERVICE_GROUPS, servicesInGroup, type ServiceId } from "@/lib/services-catalog";
import {
  parseApiResponse,
  resolveOutcome,
  shouldReportEmailFailure,
  shouldSendEmail,
  shouldTrackLead,
  type EmailResult,
  type Outcome,
} from "@/lib/contact-outcome";
import { trackEvent } from "@/lib/analytics";
import s from "./contact.module.css";

type FieldName = "fullName" | "email" | "phone" | "subject" | "message";
type FieldErrors = Partial<Record<FieldName, string>>;

// Same rules as the previous contact page.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-().]{7,}$/;
const FIELDS: FieldName[] = ["fullName", "email", "phone", "subject", "message"];
const OTHER = "other";

const ERR_ICON = (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 1.5 0v-4ZM10 14.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
  </svg>
);

export default function ContactForm({ waUrl, initialService = null }: { waUrl: string; initialService?: ServiceId | null }) {
  const t = useTranslations("Contact");
  const sv = useTranslations("Services");
  const v = useTranslations("Validation");
  const h = useTranslations("HomeV2");
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});

  // Every service from the shared catalog, grouped, then "Other". The submitted
  // value stays the translated title (what the CRM and the email show).
  const groups = SERVICE_GROUPS.map((g) => ({
    id: g.id,
    title: sv(`group_${g.msg}_title`),
    options: servicesInGroup(g.id).map((svc) => ({ id: svc.id as string, label: sv(`${svc.msg}_title`) })),
  }));
  const other = { id: OTHER, label: t("form_subject_other") };

  useEffect(() => {
    // Move focus to the outcome (the submit button was disabled while sending).
    if (status === "success") doneRef.current?.focus();
    if (status === "error") alertRef.current?.focus();
  }, [status]);

  function validateField(name: FieldName, value: string): string | undefined {
    switch (name) {
      case "fullName":
        if (!value.trim()) return v("name_required");
        if (value.trim().length < 2) return v("name_min");
        return undefined;
      case "email":
        if (!value.trim()) return v("email_required");
        if (!EMAIL_RE.test(value)) return v("email_invalid");
        return undefined;
      case "phone":
        if (value.trim() && !PHONE_RE.test(value)) return v("phone_invalid");
        return undefined;
      case "subject":
        if (!value) return v("subject_required");
        return undefined;
      case "message":
        if (!value.trim()) return v("message_required");
        if (value.trim().length < 10) return v("message_min");
        return undefined;
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const name = e.target.name as FieldName;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, e.target.value) }));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const name = e.target.name as FieldName;
    if (name === "subject") {
      setTouched((prev) => ({ ...prev, subject: true }));
      setErrors((prev) => ({ ...prev, subject: validateField("subject", e.target.value) }));
    } else if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, e.target.value) }));
    }
  }

  function validateAll(): FieldName | null {
    if (!formRef.current) return null;
    const data = new FormData(formRef.current);
    const next: FieldErrors = {};
    let first: FieldName | null = null;
    for (const field of FIELDS) {
      const err = validateField(field, (data.get(field) as string) || "");
      if (err) {
        next[field] = err;
        first ??= field;
      }
    }
    setErrors(next);
    setTouched(Object.fromEntries(FIELDS.map((f) => [f, true])));
    return first;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = formRef.current;
    if (!form || status === "sending") return;

    const honeypot = new FormData(form).get("website") as string;
    if (honeypot) {
      setOutcome("success");
      setStatus("success");
      return;
    }

    const firstInvalid = validateAll();
    if (firstInvalid) {
      const el = form.querySelector<HTMLElement>(`[name="${firstInvalid}"]`);
      el?.focus();
      return;
    }

    setStatus("sending");
    const formData = new FormData(form);
    const serviceKey = form.querySelector<HTMLInputElement>('input[name="subject"]:checked')?.dataset.serviceId ?? OTHER;

    // 1. Save the inquiry (source of truth). It also tells us about duplicates.
    let res: Response | null = null;
    try {
      res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.get("fullName"),
          email: formData.get("email"),
          phone: formData.get("phone") || undefined,
          subject: formData.get("subject"),
          message: formData.get("message"),
        }),
      });
    } catch {
      res = null;
    }
    const api = await parseApiResponse(res);

    // 2. Email notification, unless the server already has this exact inquiry.
    let email: EmailResult = "skipped";
    if (shouldSendEmail(api)) {
      const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
      const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
      const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
      if (!serviceId || !templateId || !publicKey) {
        email = "not_configured";
      } else {
        try {
          await emailjs.sendForm(serviceId, templateId, form, { publicKey });
          email = "sent";
        } catch {
          email = "failed";
        }
      }
    }

    if (shouldReportEmailFailure(api, email) && api.kind === "stored" && api.leadId) {
      fetch("/api/contact/notification-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: api.leadId, status: email === "not_configured" ? "not_configured" : "failed" }),
        keepalive: true,
      }).catch(() => {});
    }

    const result = resolveOutcome(api, email);
    if (shouldTrackLead(api, result)) {
      trackEvent("generate_lead", { method: "contact_form", service: serviceKey, locale, page_type: "contact" });
    }
    setOutcome(result);
    if (result === "success" || result === "email_only") {
      setStatus("success");
      formRef.current?.reset();
      setErrors({});
      setTouched({});
    } else {
      // Keep everything the visitor typed so they can retry or switch to WhatsApp.
      setStatus("error");
    }
  }

  const invalid = (name: FieldName) => Boolean(touched[name] && errors[name]);
  const errorText = (name: FieldName) => (
    <p className={s.err} id={`${name}-err`} aria-live="polite">
      {invalid(name) && (
        <>
          {ERR_ICON}
          <span>{errors[name]}</span>
        </>
      )}
    </p>
  );
  const fieldProps = (name: FieldName) => ({
    id: name,
    name,
    className: s.ctl,
    onBlur: handleBlur,
    onChange: handleChange,
    "aria-invalid": invalid(name) || undefined,
    "aria-describedby": `${name}-err`,
  });
  const required = <span className={s.req} aria-hidden="true">*</span>;
  const chip = (o: { id: string; label: string }, first: boolean) => (
    <label key={o.id} className={s.chip}>
      <input
        type="radio"
        name="subject"
        value={o.label}
        data-service-id={o.id}
        defaultChecked={o.id === initialService}
        onChange={handleChange}
        required={first}
      />
      <span>{o.label}</span>
    </label>
  );

  if (status === "success") {
    return (
      <div className={s.done} role="status">
        <span className={s.doneIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h2 className={s.disp} tabIndex={-1} ref={doneRef}>{t("form_success")}</h2>
        {outcome === "email_only" && (
          <p className={s.doneNote}>
            {t("form_success_email_only")}{" "}
            <a href={waUrl} target="_blank" rel="noopener noreferrer" data-wa-placement="contact_form_notice">{h("cta_wa")}</a>
          </p>
        )}
        <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => { setOutcome(null); setStatus("idle"); }}>
          {t("form_send_another")}
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate>
      <div aria-hidden="true" className={s.hp}>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className={s.fHead}>
        <h2 className={s.disp}>{h("cta_form")}</h2>
        <span className={s.reqNote}>
          <span className={s.req} aria-hidden="true">*</span> {t("required_note")}
        </span>
      </div>
      {status === "error" && (
        <div className={s.alert} role="alert" tabIndex={-1} ref={alertRef}>
          {ERR_ICON}
          <span>
            {outcome === "rate_limited" ? t("form_error_rate_limited") : t("form_error")}{" "}
            <a href={waUrl} target="_blank" rel="noopener noreferrer" data-wa-placement="contact_form_error">WhatsApp</a>
          </span>
        </div>
      )}
      <div className={s.fields}>
        <div>
          <label htmlFor="fullName" className={s.label}>{t("form_name")}{required}</label>
          <input {...fieldProps("fullName")} type="text" autoComplete="name" required aria-required="true" />
          {errorText("fullName")}
        </div>
        <div className={s.row2}>
          <div>
            <label htmlFor="email" className={s.label}>{t("form_email")}{required}</label>
            <input {...fieldProps("email")} type="email" dir="ltr" autoComplete="email" inputMode="email" required aria-required="true" />
            {errorText("email")}
          </div>
          <div>
            <label htmlFor="phone" className={s.label}>
              {t("form_phone")}
              <span className={s.opt}>{t("optional")}</span>
            </label>
            <input {...fieldProps("phone")} type="tel" dir="ltr" autoComplete="tel" inputMode="tel" />
            {errorText("phone")}
          </div>
        </div>
        <fieldset className={s.fieldset} aria-invalid={invalid("subject") || undefined} aria-describedby="subject-err">
          <legend className={s.label}>{t("form_subject")}{required}</legend>
          {groups.map((g, gi) => (
            <div key={g.id} className={s.chipGroup}>
              <span className={s.chipGroupLabel}>{g.title}</span>
              <div className={s.chips}>{g.options.map((o, i) => chip(o, gi === 0 && i === 0))}</div>
            </div>
          ))}
          <div className={s.chipGroup}>
            <div className={s.chips}>{chip(other, false)}</div>
          </div>
          {errorText("subject")}
        </fieldset>
        <div>
          <label htmlFor="message" className={s.label}>{t("form_message")}{required}</label>
          <textarea {...fieldProps("message")} rows={6} required aria-required="true" />
          {errorText("message")}
        </div>
        <div className={s.submitRow}>
          <button type="submit" className={`${s.btn} ${s.btnGrad} ${s.submit}`} disabled={status === "sending"} aria-busy={status === "sending"}>
            {status === "sending" ? (
              <>
                <span className={s.spin} aria-hidden="true" />
                <span>{t("form_sending")}</span>
              </>
            ) : (
              <>
                <span>{t("form_submit")}</span>
                <span className={s.flip} aria-hidden="true">→</span>
              </>
            )}
          </button>
          <p className={s.alt}>
            {h("cta_kicker")} · <a href={waUrl} target="_blank" rel="noopener noreferrer" data-wa-placement="contact_form">{h("cta_wa")}</a>
          </p>
        </div>
      </div>
    </form>
  );
}
