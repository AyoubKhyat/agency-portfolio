"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import emailjs from "@emailjs/browser";
import {
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import { FaWhatsapp } from "react-icons/fa";

export default function ContactPage() {
  const t = useTranslations("Contact");
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formRef.current) return;

    setStatus("sending");

    const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
    const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

    if (!serviceId || !templateId || !publicKey) {
      setStatus("error");
      return;
    }

    try {
      await emailjs.sendForm(serviceId, templateId, formRef.current, { publicKey });
      setStatus("success");
      formRef.current.reset();
    } catch {
      setStatus("error");
    }
  }

  const contactRows = [
    { label: "Tél", value: t("info_phone") },
    { label: "WhatsApp", value: "wa.me/212625461645", amber: true },
    { label: "E-mail", value: t("info_email") },
    { label: "Adresse", value: t("info_address") },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative bg-secondary py-24 md:py-32 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[800px] h-[800px] bg-primary -bottom-72 -right-48 opacity-25" />
        <div className="glow w-[500px] h-[500px] bg-accent -top-36 left-[10%] opacity-12" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-end">
            <div>
              <span className="pill">→ {t("title")}</span>
              <h1 className="mt-8 font-serif text-6xl md:text-8xl lg:text-[140px] leading-[0.9] tracking-tight text-white">
                Parlons de<br />votre <span className="text-primary italic">projet.</span>
              </h1>
              <p className="mt-8 font-serif italic text-2xl text-white leading-snug max-w-xl">
                {t("subtitle")}
              </p>
            </div>

            {/* Contact Card */}
            <div className="border border-line rounded-3xl p-8 md:p-10 bg-gradient-to-b from-primary/5 to-primary/[0.02]">
              {contactRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[80px_1fr] py-5 border-b border-line-soft items-baseline gap-6 last:border-b-0">
                  <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-primary">{row.label}</span>
                  <span className={`font-serif text-xl md:text-2xl ${row.amber ? "text-accent italic" : "text-white"}`}>
                    {row.value}
                  </span>
                </div>
              ))}
              <div className="mt-6 pt-6 border-t border-line-soft flex items-center justify-between">
                <span className="font-serif italic text-text-muted">Disponibles cette semaine.</span>
                <span className="font-mono text-xs tracking-[0.16em] uppercase text-accent">→ Available</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form + WhatsApp + Map */}
      <section className="relative py-20 bg-surface-2 overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            <div className="border border-line rounded-2xl p-8 bg-secondary">
              {status === "success" ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <HiOutlineCheckCircle className="w-16 h-16 text-green-400 mb-4" />
                  <p className="text-xl font-serif text-white">{t("form_success")}</p>
                  <button
                    onClick={() => setStatus("idle")}
                    className="mt-6 px-6 py-2.5 border border-line text-text-muted rounded-xl text-sm font-mono tracking-wider uppercase hover:border-primary/30 transition-colors"
                  >
                    {t("form_send_another")}
                  </button>
                </div>
              ) : (
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
                  {status === "error" && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      <HiOutlineExclamationTriangle className="w-5 h-5 flex-shrink-0" />
                      {t("form_error")}
                    </div>
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
                      className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-line-soft text-white placeholder-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
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
                        className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-line-soft text-white placeholder-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-mono tracking-wider uppercase text-text-muted mb-2">
                        {t("form_phone")}
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-line-soft text-white placeholder-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="subject" className="block text-sm font-mono tracking-wider uppercase text-text-muted mb-2">
                      {t("form_subject")}
                    </label>
                    <input
                      id="subject"
                      name="subject"
                      type="text"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-line-soft text-white placeholder-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
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
                      className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-line-soft text-white placeholder-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="w-full px-6 py-3.5 bg-primary text-secondary rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === "sending" ? t("form_sending") : t("form_submit")}
                  </button>
                </form>
              )}
            </div>

            <div className="space-y-6">
              <a
                href="https://wa.me/212625461645"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full px-6 py-5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl font-semibold hover:bg-green-500/20 transition-colors"
              >
                <FaWhatsapp size={22} />
                {t("whatsapp_cta")}
              </a>

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
          </div>
        </div>
      </section>
    </>
  );
}
