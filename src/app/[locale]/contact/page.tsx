"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import emailjs from "@emailjs/browser";
import {
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import { FaWhatsapp } from "react-icons/fa";
import { FadeIn, motion } from "@/components/motion";

type FieldErrors = {
  fullName?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-().]{7,}$/;

export default function ContactPage() {
  const t = useTranslations("Contact");
  const s = useTranslations("Services");
  const v = useTranslations("Validation");
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const services = [
    { key: "web", label: s("web_title") },
    { key: "ecommerce", label: s("ecommerce_title") },
    { key: "mobile", label: s("mobile_title") },
    { key: "seo", label: s("seo_title") },
    { key: "maintenance", label: s("maintenance_title") },
  ];

  function validateField(name: string, value: string): string | undefined {
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
      default:
        return undefined;
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  }

  function validateAll(): boolean {
    if (!formRef.current) return false;
    const data = new FormData(formRef.current);
    const fields = ["fullName", "email", "phone", "subject", "message"];
    const newErrors: FieldErrors = {};
    let valid = true;
    for (const field of fields) {
      const err = validateField(field, (data.get(field) as string) || "");
      if (err) {
        newErrors[field as keyof FieldErrors] = err;
        valid = false;
      }
    }
    setErrors(newErrors);
    setTouched(Object.fromEntries(fields.map((f) => [f, true])));
    return valid;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formRef.current) return;

    const honeypot = new FormData(formRef.current).get("website") as string;
    if (honeypot) {
      setStatus("success");
      return;
    }

    if (!validateAll()) return;

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
        formRef.current.reset();
        setErrors({});
        setTouched({});
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  const fieldClass = (name: keyof FieldErrors) =>
    `w-full px-4 py-3 rounded-xl bg-surface-2 border text-foreground placeholder-text-muted outline-none transition-all ${
      touched[name] && errors[name]
        ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
        : "border-line-soft focus:border-primary focus:ring-2 focus:ring-primary/20"
    }`;

  const contactRows = [
    { label: "Tél", value: t("info_phone") },
    { label: "WhatsApp", value: "wa.me/212625461645", amber: true },
    { label: "E-mail", value: t("info_email") },
    { label: "Adresse", value: t("info_address") },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative bg-background py-24 md:py-32 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[800px] h-[800px] bg-primary -bottom-72 -right-48 opacity-25" />
        <div className="glow w-[500px] h-[500px] bg-accent -top-36 left-[10%] opacity-12" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-end">
            <FadeIn>
              <div>
                <span className="pill">→ {t("title")}</span>
                <h1 className="mt-8 font-serif text-6xl md:text-8xl lg:text-[140px] leading-[0.9] tracking-tight text-foreground">
                  {t("hero_heading")}
                </h1>
                <p className="mt-8 font-serif italic text-2xl text-foreground leading-snug max-w-xl">
                  {t("subtitle")}
                </p>
              </div>
            </FadeIn>

            {/* Contact Card */}
            <FadeIn direction="right" delay={0.2}>
              <div className="border border-line rounded-3xl p-8 md:p-10 bg-gradient-to-b from-primary/5 to-primary/[0.02]">
                {contactRows.map((row) => (
                  <div key={row.label} className="grid grid-cols-[80px_1fr] py-5 border-b border-line-soft items-baseline gap-6 last:border-b-0">
                    <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-primary">{row.label}</span>
                    <span className={`font-serif text-xl md:text-2xl ${row.amber ? "text-accent italic" : "text-foreground"}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
                <div className="mt-6 pt-6 border-t border-line-soft flex items-center justify-between">
                  <span className="font-serif italic text-text-muted">{t("availability")}</span>
                  <span className="font-mono text-xs tracking-[0.16em] uppercase text-accent">{t("availability_tag")}</span>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Form + WhatsApp + Map */}
      <section className="relative py-20 bg-surface-2 overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            <FadeIn>
              <div className="border border-line rounded-2xl p-8 bg-background">
                {status === "success" ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col items-center justify-center py-16 text-center"
                  >
                    <HiOutlineCheckCircle className="w-16 h-16 text-green-400 mb-4" />
                    <p className="text-xl font-serif text-foreground">{t("form_success")}</p>
                    <button
                      onClick={() => setStatus("idle")}
                      className="mt-6 px-6 py-2.5 border border-line text-text-muted rounded-xl text-sm font-mono tracking-wider uppercase hover:border-primary/30 transition-colors"
                    >
                      {t("form_send_another")}
                    </button>
                  </motion.div>
                ) : (
                  <form ref={formRef} onSubmit={handleSubmit} className="space-y-5" noValidate>
                    <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
                      <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                    </div>
                    {status === "error" && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                      >
                        <HiOutlineExclamationTriangle className="w-5 h-5 flex-shrink-0" />
                        {t("form_error")}
                      </motion.div>
                    )}
                    <div>
                      <label htmlFor="fullName" className="block text-sm font-mono tracking-wider uppercase text-text-muted mb-2">
                        {t("form_name")}
                      </label>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        required
                        onBlur={handleBlur}
                        onChange={handleChange}
                        className={fieldClass("fullName")}
                      />
                      {touched.fullName && errors.fullName && (
                        <p className="mt-1.5 text-xs text-red-400">{errors.fullName}</p>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="email" className="block text-sm font-mono tracking-wider uppercase text-text-muted mb-2">
                          {t("form_email")}
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          required
                          onBlur={handleBlur}
                          onChange={handleChange}
                          className={fieldClass("email")}
                        />
                        {touched.email && errors.email && (
                          <p className="mt-1.5 text-xs text-red-400">{errors.email}</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="phone" className="block text-sm font-mono tracking-wider uppercase text-text-muted mb-2">
                          {t("form_phone")}
                        </label>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          onBlur={handleBlur}
                          onChange={handleChange}
                          className={fieldClass("phone")}
                        />
                        {touched.phone && errors.phone && (
                          <p className="mt-1.5 text-xs text-red-400">{errors.phone}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="subject" className="block text-sm font-mono tracking-wider uppercase text-text-muted mb-2">
                        {t("form_subject")}
                      </label>
                      <select
                        id="subject"
                        name="subject"
                        required
                        defaultValue=""
                        onBlur={handleBlur}
                        onChange={handleChange}
                        className={`${fieldClass("subject")} appearance-none`}
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239CA3AF' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 16px center" }}
                      >
                        <option value="" disabled className="text-text-muted">{t("form_subject_placeholder")}</option>
                        {services.map((svc) => (
                          <option key={svc.key} value={svc.label}>{svc.label}</option>
                        ))}
                        <option value={t("form_subject_other")}>{t("form_subject_other")}</option>
                      </select>
                      {touched.subject && errors.subject && (
                        <p className="mt-1.5 text-xs text-red-400">{errors.subject}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="message" className="block text-sm font-mono tracking-wider uppercase text-text-muted mb-2">
                        {t("form_message")}
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        rows={5}
                        required
                        onBlur={handleBlur}
                        onChange={handleChange}
                        className={`${fieldClass("message")} resize-none`}
                      />
                      {touched.message && errors.message && (
                        <p className="mt-1.5 text-xs text-red-400">{errors.message}</p>
                      )}
                    </div>
                    <motion.button
                      type="submit"
                      disabled={status === "sending"}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full px-6 py-3.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {status === "sending" ? t("form_sending") : t("form_submit")}
                    </motion.button>
                  </form>
                )}
              </div>
            </FadeIn>

            <FadeIn direction="right" delay={0.15}>
              <div className="space-y-6">
                <motion.a
                  href="https://wa.me/212625461645"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-3 w-full px-6 py-5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl font-semibold hover:bg-green-500/20 transition-colors"
                >
                  <FaWhatsapp size={22} />
                  {t("whatsapp_cta")}
                </motion.a>

                <div className="rounded-2xl overflow-hidden border border-line h-80">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d108703.09129584506!2d-8.076584949999999!3d31.634723!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xdafee43480edd89%3A0x6b16e153eec0e748!2sMarrakech!5e0!3m2!1sfr!2sma!4v1699999999999!5m2!1sfr!2sma"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Marrakech Map"
                  />
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>
    </>
  );
}
