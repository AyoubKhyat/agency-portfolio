"use client";

import { useState, KeyboardEvent } from "react";
import { HiPaperAirplane } from "react-icons/hi2";
import { t, type ChatLocale } from "./chat-i18n";

interface Props {
  locale: ChatLocale;
  disabled: boolean;
  onSend: (message: string) => void;
}

export default function ChatInput({ locale, disabled, onSend }: Props) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 p-3 border-t border-line bg-background">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        maxLength={2000}
        disabled={disabled}
        placeholder={t("placeholder", locale)}
        className="flex-1 resize-none rounded-xl bg-surface-2 border border-line px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 max-h-32"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label={t("send", locale)}
        className="shrink-0 rounded-xl bg-primary text-white p-2 hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <HiPaperAirplane className="rotate-90" size={18} />
      </button>
    </div>
  );
}
