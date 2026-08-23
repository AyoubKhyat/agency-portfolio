"use client";

import { useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { t, type ChatLocale } from "./chat-i18n";

interface Props {
  locale: ChatLocale;
  conversationId?: string;
  initialMessage?: string;
  onDone: () => void;
}

export default function LeadCaptureForm({ locale, conversationId, initialMessage, onDone }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(initialMessage ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/chat/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone: phone || undefined,
          message: message || "(no additional details)",
          conversationId,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to submit");
      setSuccess(true);
      setTimeout(onDone, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric", locale));
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="p-4 text-center">
        <div className="text-4xl mb-2">✅</div>
        <p className="text-sm text-foreground font-medium">{t("leadSuccess", locale)}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 space-y-2 border-t border-line bg-surface-2">
      <p className="text-xs text-text-muted mb-2">{t("leadCTA", locale)}</p>
      <input
        type="text"
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder={t("leadName", locale)}
        className="w-full rounded-lg bg-background border border-line px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("leadEmail", locale)}
        className="w-full rounded-lg bg-background border border-line px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={t("leadPhone", locale)}
        className="w-full rounded-lg bg-background border border-line px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder={t("leadMessage", locale)}
        className="w-full rounded-lg bg-background border border-line px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-primary text-white text-sm font-semibold py-2 hover:bg-primary-dark disabled:opacity-50"
      >
        {submitting ? "…" : t("leadSubmit", locale)}
      </button>
      <a
        href="https://wa.me/212625461645"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 text-xs text-text-muted hover:text-foreground pt-1"
      >
        <FaWhatsapp className="text-green-500" size={14} />
        {t("leadOrWhatsapp", locale)}
      </a>
    </form>
  );
}
