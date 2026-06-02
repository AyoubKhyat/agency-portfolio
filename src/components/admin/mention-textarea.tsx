"use client";

import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
import { handleForUser, suggestForPrefix, type MentionableUser } from "@/lib/mentions";

/**
 * Drop-in <textarea> replacement that opens a user picker when the caret sits
 * inside an `@partial` token. Returns plain text via onChange.
 *
 * Pass `users` if the caller already has them, otherwise the component fetches
 * /api/admin/users on mount.
 */

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  users?: MentionableUser[];
};

type MentionState = {
  open: boolean;
  prefix: string;
  start: number; // character index of the @ in the textarea value
  end: number;   // character index of the caret
  selected: number;
};

export const MentionTextarea = forwardRef<HTMLTextAreaElement, Props>(function MentionTextarea(
  { value, onChange, users: usersProp, className, ...rest },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

  const [users, setUsers] = useState<MentionableUser[]>(usersProp ?? []);
  const [state, setState] = useState<MentionState>({ open: false, prefix: "", start: 0, end: 0, selected: 0 });

  useEffect(() => {
    if (usersProp) { setUsers(usersProp); return; }
    fetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (Array.isArray(d)) setUsers(d); })
      .catch(() => {});
  }, [usersProp]);

  const suggestions = useMemo(() => {
    if (!state.open) return [];
    return suggestForPrefix(users, state.prefix);
  }, [state.open, state.prefix, users]);

  // Detect @prefix at caret position
  const detect = useCallback((text: string, caret: number) => {
    // Walk backwards from caret looking for '@', breaking on whitespace.
    let i = caret - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === "@") {
        // Make sure the character before is whitespace or string start
        if (i === 0 || /\s/.test(text[i - 1])) {
          const prefix = text.slice(i + 1, caret);
          // The prefix itself can't contain whitespace.
          if (!/\s/.test(prefix)) {
            return { start: i, end: caret, prefix };
          }
        }
        return null;
      }
      if (/\s/.test(ch)) return null;
      i--;
    }
    return null;
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    onChange(text);
    const caret = e.target.selectionStart ?? text.length;
    const m = detect(text, caret);
    if (m) {
      setState({ open: true, prefix: m.prefix, start: m.start, end: m.end, selected: 0 });
    } else {
      setState((prev) => (prev.open ? { ...prev, open: false } : prev));
    }
  }

  function pick(user: MentionableUser) {
    const handle = handleForUser(user);
    const before = value.slice(0, state.start);
    const after = value.slice(state.end);
    const inserted = `@${handle} `;
    const nextValue = before + inserted + after;
    onChange(nextValue);
    setState({ open: false, prefix: "", start: 0, end: 0, selected: 0 });
    // restore caret position right after the inserted handle
    setTimeout(() => {
      const ta = innerRef.current;
      if (!ta) return;
      const pos = before.length + inserted.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!state.open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setState((prev) => ({ ...prev, selected: (prev.selected + 1) % suggestions.length }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setState((prev) => ({ ...prev, selected: (prev.selected - 1 + suggestions.length) % suggestions.length }));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(suggestions[state.selected]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setState((prev) => ({ ...prev, open: false }));
    }
  }

  function handleBlur() {
    // Delay so click on a suggestion fires before we close.
    setTimeout(() => setState((prev) => ({ ...prev, open: false })), 150);
  }

  return (
    <div className="relative">
      <textarea
        ref={innerRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={cn(
          "w-full px-3.5 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-[14px] leading-relaxed text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#8B00FF] focus:ring-2 focus:ring-[#8B00FF]/15",
          className,
        )}
        {...rest}
      />
      {state.open && suggestions.length > 0 && (
        <div className="absolute z-50 left-3 top-full mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg shadow-slate-900/[0.08] py-1 min-w-[220px] max-w-[320px]">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
            Mention a teammate
          </div>
          {suggestions.map((u, i) => {
            const active = i === state.selected;
            return (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep textarea focused
                onClick={() => pick(u)}
                onMouseEnter={() => setState((prev) => ({ ...prev, selected: i }))}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors",
                  active ? "bg-[#F3E8FF] text-[#7E22CE]" : "text-[#374151] hover:bg-[#F9FAFB]",
                )}
              >
                <span className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white shrink-0",
                  active ? "bg-[#7E22CE]" : "bg-gradient-to-br from-[#8B00FF] to-[#C026D3]",
                )}>
                  {u.avatarInitials ?? u.fullName.charAt(0)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-medium">{u.fullName}</span>
                  <span className="block truncate text-[11px] text-[#9CA3AF]">@{handleForUser(u)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

/**
 * Render plain text with `@handle` tokens highlighted (for display in lists).
 */
export function HighlightedMentions({ text, users, className }: { text: string; users?: MentionableUser[]; className?: string }) {
  const parts = useMemo(() => {
    if (!text) return [];
    const out: { type: "text" | "mention"; value: string; userId?: string }[] = [];
    let last = 0;
    const re = /@([a-zA-Z0-9_-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
      const handle = m[1];
      const match = users?.find((u) => handleForUser(u) === handle.toLowerCase());
      out.push({ type: "mention", value: `@${handle}`, userId: match?.id });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ type: "text", value: text.slice(last) });
    return out;
  }, [text, users]);

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.type === "mention" ? (
          <span key={i} className="inline-flex items-center px-1 rounded bg-[#F3E8FF] text-[#7E22CE] font-medium">
            {p.value}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </span>
  );
}
