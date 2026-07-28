"use client";

import { useEffect, useRef, useState } from "react";
import { HiChatBubbleLeftRight, HiXMark, HiUserGroup } from "react-icons/hi2";
import ChatMessage, { type ChatMessageRole } from "./ChatMessage";
import ChatInput from "./ChatInput";
import LeadCaptureForm from "./LeadCaptureForm";
import { t, type ChatLocale } from "./chat-i18n";

interface Props {
  locale: string;
}

interface Message {
  role: ChatMessageRole;
  content: string;
}

const SESSION_KEY = "ibda3-chat-session";

export default function ChatWidget({ locale }: Props) {
  const chatLocale: ChatLocale = (["en", "fr", "ar"] as const).includes(locale as ChatLocale)
    ? (locale as ChatLocale)
    : "en";

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLead, setShowLead] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dir = chatLocale === "ar" ? "rtl" : "ltr";

  // restore session
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.messages)) setMessages(saved.messages);
        if (saved.conversationId) setConversationId(saved.conversationId);
      }
    } catch {}
  }, []);

  // persist session
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ messages, conversationId }));
    } catch {}
  }, [messages, conversationId]);

  // greet on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: t("greeting", chatLocale) }]);
    }
  }, [open, messages.length, chatLocale]);

  // auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, showLead]);

  async function sendMessage(userMessage: string) {
    setError(null);
    const nextMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(nextMessages);
    setLoading(true);

    // history excludes the message we're sending; we send that separately
    const history = messages
      .filter((m) => !(m.role === "assistant" && m.content === t("greeting", chatLocale)))
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: chatLocale,
          conversationId,
          message: userMessage,
          history,
        }),
      });
      const data = await res.json();

      if (res.status === 429) {
        setError(t("errorRateLimit", chatLocale));
        return;
      }
      if (!res.ok) {
        setError(data?.error || t("errorGeneric", chatLocale));
        return;
      }
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
      if (data.conversationId) setConversationId(data.conversationId);
    } catch {
      setError(t("errorGeneric", chatLocale));
    } finally {
      setLoading(false);
    }
  }

  // position — WhatsApp button is bottom-6 right-6 z-40, so we sit above it
  const containerBase = "fixed z-40 flex flex-col items-end";
  const containerPos = chatLocale === "ar" ? "bottom-24 left-6" : "bottom-24 right-6";

  return (
    <div className={`${containerBase} ${containerPos}`} dir={dir}>
      {open && (
        <div
          className="w-[360px] max-w-[calc(100vw-3rem)] h-[540px] max-h-[calc(100vh-8rem)] rounded-2xl border border-line bg-background shadow-2xl overflow-hidden flex flex-col mb-3"
          style={{ animation: "cookie-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both" }}
        >
          {/* header */}
          <div className="bg-primary px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <HiUserGroup className="text-white" size={20} />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{t("header", chatLocale)}</p>
                <p className="text-white/70 text-xs">{t("subheader", chatLocale)}</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label={t("close", chatLocale)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <HiXMark size={20} />
            </button>
          </div>

          {/* demo banner */}
          <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] px-3 py-2 border-b border-line">
            {t("demoBanner", chatLocale)}
          </div>

          {/* messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 bg-background">
            {messages.map((m, i) => (
              <ChatMessage key={i} role={m.role} content={m.content} />
            ))}
            {loading && (
              <div className="text-xs text-text-muted italic px-1 mt-1">{t("thinking", chatLocale)}</div>
            )}
            {error && <div className="text-xs text-red-500 px-1 mt-2">{error}</div>}
          </div>

          {/* input or lead form */}
          {showLead ? (
            <LeadCaptureForm
              locale={chatLocale}
              conversationId={conversationId}
              onDone={() => setShowLead(false)}
            />
          ) : (
            <>
              <ChatInput locale={chatLocale} disabled={loading} onSend={sendMessage} />
              <button
                onClick={() => setShowLead(true)}
                className="text-[11px] text-text-muted hover:text-primary transition-colors px-3 pb-2 text-center"
              >
                {t("leadCTA", chatLocale)}
              </button>
            </>
          )}
        </div>
      )}

      {/* floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("buttonLabel", chatLocale)}
        className="w-14 h-14 rounded-full bg-primary text-white shadow-2xl hover:bg-primary-dark hover:scale-105 transition-all flex items-center justify-center"
      >
        {open ? <HiXMark size={24} /> : <HiChatBubbleLeftRight size={24} />}
      </button>
    </div>
  );
}
