"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import emailjs from "@emailjs/browser";
import s from "./contact.module.css";

type FieldName = "fullName" | "email" | "phone" | "subject" | "message";
type FieldErrors = Partial<Record<FieldName, string>>;

// Same rules as the previous contact page.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-().]{7,}$/;
const FIELDS: FieldName[] = ["fullName", "email", "phone", "subject", "message"];

const ERR_ICON = (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 1.5 0v-4ZM10 14.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
  </svg>
);

export default function ContactForm({ waUrl }: { waUrl: string }) {
  const t = useTranslations("Contact");
  const sv = useTranslations("Services");
  const v = useTranslations("Validation");
  const h = useTranslations("HomeV2");
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});

  // Same subject values as the previous select: service titles, then "Other".
  const subjects = [
    ...(["web", "ecommerce", "mobile", "seo", "maintenance"] as const).map((k) => sv(`${k}_title`)),
    t("form_subject_other"),
  ];

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
    if (!formRef.current) return;

    const honeypot = new FormData(formRef.current).get("website") as string;
    if (honeypot) {
      setStatus("success");
      return;
    }

    const firstInvalid = validateAll();
    if (firstInvalid) {
      const el = formRef.current.querySelector<HTMLElement>(`[name="${firstInvalid}"]`);
      el?.focus();
      return;
    }

    setStatus("sending");

    const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
    const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

    if (!serviceId || !templateId || !publicKey) {
      setStatus("error");
      return;
    }

    try {
      const formData = new FormData(formRef.current);
      const [emailResult] = await Promise.allSettled([
        emailjs.sendForm(serviceId, templateId, formRef.current, { publicKey }),
        fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: formData.get("fullName"),
            email: formData.get("email"),
            phone: formData.get("phone") || undefined,
            subject: formData.get("subject"),
            message: formData.get("message"),
          }),
        }),
      ]);
      if (emailResult.status === "fulfilled") {
        setStatus("success");
        formRef.current?.reset();
        setErrors({});
        setTouched({});
      } else {
        setStatus("error");
      }
    } catch {
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

  if (status === "success") {
    return (
      <div className={s.done} role="status">
        <span className={s.doneIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h2 className={s.disp} tabIndex={-1} ref={doneRef}>{t("form_success")}</h2>
        <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setStatus("idle")}>
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
            {t("form_error")}{" "}
            <a href={waUrl} target="_blank" rel="noopener noreferrer">WhatsApp</a>
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
          <div className={s.chips}>
            {subjects.map((label, i) => (
              <label key={label} className={s.chip}>
                <input type="radio" name="subject" value={label} onChange={handleChange} required={i === 0} aria-required={i === 0 || undefined} />
                <span>{label}</span>
              </label>
            ))}
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
            {h("cta_kicker")} · <a href={waUrl} target="_blank" rel="noopener noreferrer">{h("cta_wa")}</a>
          </p>
        </div>
      </div>
    </form>
  );
}
