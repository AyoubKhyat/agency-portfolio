"use client";

import { useDialog } from "@/components/admin/dialog";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Hash, MessageCircle, Plus, Smile, Paperclip, Send, X, Search,
  Briefcase, Building2, CheckSquare, Calendar, Target, Loader2, ArrowLeft,
  Image, FileText, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MentionTextarea, HighlightedMentions } from "@/components/admin/mention-textarea";

type User = { id: string; fullName: string; avatarInitials: string };

type Channel = {
  id: string;
  slug: string;
  name: string;
  description: string;
  isDm: boolean;
  unread: number;
  lastMessage: { id: string; content: string; authorName: string; createdAt: string } | null;
  members: User[];
  partner?: User | null;
};

type Reaction = { emoji: string; userId: string; userName: string };

type Message = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  attachType: string | null;
  attachId: string | null;
  attachLabel: string | null;
  attachHref: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  createdAt: string;
  reactions: Reaction[];
};

type AttachResult = { type: string; id: string; label: string; sub: string; href: string };

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  PROSPECT: Target, CLIENT: Building2, PROJECT: Briefcase, TASK: CheckSquare, MEETING: Calendar,
};

const TYPE_COLOR: Record<string, string> = {
  PROSPECT: "text-violet-700 os-dark:text-violet-300 bg-violet-50 os-dark:bg-violet-500/10 border-violet-100 os-dark:border-violet-500/30",
  CLIENT:   "text-purple-700 os-dark:text-purple-300 bg-purple-50 os-dark:bg-purple-500/10 border-purple-100 os-dark:border-purple-500/30",
  PROJECT:  "text-blue-700 os-dark:text-blue-300 bg-blue-50 os-dark:bg-blue-500/10 border-blue-100 os-dark:border-blue-500/30",
  TASK:     "text-amber-700 os-dark:text-amber-300 bg-amber-50 os-dark:bg-amber-500/10 border-amber-100 os-dark:border-amber-500/30",
  MEETING:  "text-emerald-700 os-dark:text-emerald-300 bg-emerald-50 os-dark:bg-emerald-500/10 border-emerald-100 os-dark:border-emerald-500/30",
};

const QUICK_REACTIONS = ["👍", "🎉", "❤️", "😂", "🔥", "👀"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDayHeader(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString("fr-FR", { weekday: "long" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function ChatInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSlug = searchParams.get("channel");

  const [me, setMe] = useState<User | null>(null);
  const [team, setTeam] = useState<User[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dms, setDms] = useState<Channel[]>([]);
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [active, setActive] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [composer, setComposer] = useState("");
  const [attach, setAttach] = useState<AttachResult | null>(null);
  const [filePreview, setFilePreview] = useState<{ file: File; url: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [sending, setSending] = useState(false);
  // Below lg the channel list and the conversation take turns: a link to a
  // specific channel opens the conversation, otherwise the list comes first.
  const [sidebarOpen, setSidebarOpen] = useState(!initialSlug);
  const messagesBoxRef = useRef<HTMLDivElement>(null);

  // Load me + team once
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/me").then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/admin/users").then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([m, t]) => {
      if (m?.userId) setMe({ id: m.userId, fullName: m.fullName, avatarInitials: m.avatarInitials ?? m.fullName.slice(0, 2).toUpperCase() });
      if (Array.isArray(t)) setTeam(t);
    });
  }, []);

  // Load channel list + poll for unread. Always flips `channelsLoaded` so the
  // UI can fall back to an empty state instead of spinning forever when the
  // current session has no channel memberships.
  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/chat/channels");
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) return;
      const data = await res.json();
      setChannels(data.channels ?? []);
      setDms(data.dms ?? []);
    } catch (e) {
      console.warn("[chat] loadChannels failed:", e);
    } finally {
      setChannelsLoaded(true);
    }
  }, [router]);

  useEffect(() => {
    loadChannels();
    const t = setInterval(loadChannels, 10_000);
    return () => clearInterval(t);
  }, [loadChannels]);

  // Resolve initial channel from URL once channels are loaded
  useEffect(() => {
    if (active || (channels.length === 0 && dms.length === 0)) return;
    const all = [...channels, ...dms];
    const target = initialSlug ? all.find((c) => c.slug === initialSlug) : all[0];
    if (target) setActive(target);
  }, [channels, dms, active, initialSlug]);

  // Update URL when active changes (so refresh + share keeps the channel)
  useEffect(() => {
    if (!active) return;
    const sp = new URLSearchParams(window.location.search);
    sp.set("channel", active.slug);
    window.history.replaceState(window.history.state, "", `/admin/chat?${sp.toString()}`);
  }, [active]);

  // Load + poll messages for the active channel (cursor-based: only fetch new)
  const lastMsgTimeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    lastMsgTimeRef.current = null;
    setLoadingMessages(true);
    const pull = async (initial?: boolean) => {
      const cursor = initial ? "" : lastMsgTimeRef.current ? `&after=${encodeURIComponent(lastMsgTimeRef.current)}` : "";
      const limit = initial ? 100 : 50;
      const res = await fetch(`/api/admin/chat/channels/${active.id}/messages?limit=${limit}${cursor}`);
      if (!res.ok || cancelled) return;
      const data: Message[] = await res.json();
      if (initial) {
        setMessages(data);
        setLoadingMessages(false);
      } else if (data.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const fresh = data.filter((m) => !existingIds.has(m.id));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
      }
      if (data.length > 0) {
        lastMsgTimeRef.current = data[data.length - 1].createdAt;
      }
      if (initial) {
        fetch(`/api/admin/chat/channels/${active.id}/read`, { method: "POST" }).catch(() => {});
      }
    };
    pull(true);
    const t = setInterval(() => pull(false), 2_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [active]);

  // Scroll to bottom on new messages
  useEffect(() => {
    // Scroll only the message list; scrollIntoView would also scroll the page and hide the chat header.
    const box = messagesBoxRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [messages.length, sidebarOpen]);

  async function send() {
    if (!active || !composer.trim() || sending) return;
    setSending(true);
    const payload: Record<string, unknown> = { content: composer.trim() };
    if (attach) {
      payload.attachType = attach.type;
      payload.attachId = attach.id;
      payload.attachLabel = attach.label;
      payload.attachHref = attach.href;
    }
    const res = await fetch(`/api/admin/chat/channels/${active.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const m: Message = await res.json();
      setMessages((prev) => [...prev, m]);
      setComposer("");
      setAttach(null);
      // Update sidebar's "last message" preview
      loadChannels();
    }
    setSending(false);
  }

  // Below lg, opening a conversation from the list adds a history entry so the
  // browser Back button returns to the list (and Forward reopens it). Desktop
  // and ?channel= deep links keep their single entry.
  function openConversation(c: Channel) {
    setActive(c);
    setSidebarOpen(false);
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      const sp = new URLSearchParams(window.location.search);
      sp.set("channel", c.slug);
      window.history.pushState({ ...window.history.state, chatView: "conversation" }, "", `/admin/chat?${sp.toString()}`);
    }
  }

  function backToList() {
    if (window.history.state?.chatView === "conversation") window.history.back();
    else setSidebarOpen(true);
  }

  useEffect(() => {
    const onPop = () => {
      const isConversation = window.history.state?.chatView === "conversation";
      setSidebarOpen(!isConversation);
      const slug = new URLSearchParams(window.location.search).get("channel");
      const target = [...channels, ...dms].find((c) => c.slug === slug);
      if (target) setActive((prev) => (prev?.id === target.id ? prev : target));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [channels, dms]);

  async function openDm(user: User) {
    const res = await fetch(`/api/admin/chat/dm/${user.id}`, { method: "POST" });
    if (!res.ok) return;
    const dm = await res.json();
    await loadChannels();
    // Construct a synthetic Channel and switch.
    openConversation({ id: dm.id, slug: dm.slug, name: dm.name, description: "", isDm: true, unread: 0, lastMessage: null, members: [], partner: dm.partner });
  }

  async function toggleReaction(message: Message, emoji: string) {
    setMessages((prev) => prev.map((m) => {
      if (m.id !== message.id) return m;
      const hasMine = m.reactions.some((r) => r.emoji === emoji && r.userId === me?.id);
      const nextReactions = hasMine
        ? m.reactions.filter((r) => !(r.emoji === emoji && r.userId === me?.id))
        : [...m.reactions, { emoji, userId: me?.id ?? "", userName: me?.fullName ?? "" }];
      return { ...m, reactions: nextReactions };
    }));
    await fetch(`/api/admin/chat/messages/${message.id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
  }

  async function editMessage(messageId: string, newContent: string) {
    const res = await fetch(`/api/admin/chat/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newContent }),
    });
    if (res.ok) {
      const updated: Message = await res.json();
      setMessages((prev) => prev.map((m) => m.id === messageId ? updated : m));
    }
  }

  async function deleteMessage(messageId: string) {
    const res = await fetch(`/api/admin/chat/messages/${messageId}`, { method: "DELETE" });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      loadChannels();
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("File too large (max 5 MB)"); return; }
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) { alert("Only images and PDFs allowed"); return; }
    const url = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
    setFilePreview({ file, url });
    e.target.value = "";
  }

  function clearFilePreview() {
    if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
    setFilePreview(null);
  }

  async function sendFile() {
    if (!active || !filePreview || sending) return;
    setSending(true);
    const fd = new FormData();
    fd.append("file", filePreview.file);
    fd.append("channelId", active.id);
    fd.append("content", composer.trim() || filePreview.file.name);
    const res = await fetch("/api/admin/chat/upload", { method: "POST", body: fd });
    if (res.ok) {
      const m: Message = await res.json();
      setMessages((prev) => [...prev, m]);
      setComposer("");
      clearFilePreview();
      loadChannels();
    }
    setSending(false);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (filePreview) sendFile();
      else send();
    }
  }

  // Reactions grouped by emoji for display
  function groupReactions(rs: Reaction[]) {
    const map = new Map<string, { emoji: string; count: number; mine: boolean; users: string[] }>();
    for (const r of rs) {
      const existing = map.get(r.emoji);
      if (existing) {
        existing.count++; existing.users.push(r.userName);
        if (r.userId === me?.id) existing.mine = true;
      } else {
        map.set(r.emoji, { emoji: r.emoji, count: 1, mine: r.userId === me?.id, users: [r.userName] });
      }
    }
    return Array.from(map.values());
  }

  // Group messages by day for the chronological feed
  const messagesByDay = useMemo(() => {
    const groups: { day: string; items: Message[] }[] = [];
    let lastDay: string | null = null;
    for (const m of messages) {
      const dayKey = new Date(m.createdAt).toDateString();
      if (dayKey !== lastDay) {
        groups.push({ day: formatDayHeader(m.createdAt), items: [m] });
        lastDay = dayKey;
      } else {
        groups[groups.length - 1].items.push(m);
      }
    }
    return groups;
  }, [messages]);

  const dmCandidates = useMemo(() => {
    const existingPartnerIds = new Set(dms.map((d) => d.partner?.id).filter(Boolean) as string[]);
    return team.filter((u) => u.id !== me?.id && !existingPartnerIds.has(u.id));
  }, [team, dms, me]);

  // Below lg only one pane shows; with no channels at all the empty state wins.
  const showList = sidebarOpen && !(channelsLoaded && !active);

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 -mb-4 sm:-mb-6 lg:mb-0 flex h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))] lg:h-dvh bg-[var(--os-surface)] border-t border-[var(--os-border)] overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "w-full lg:w-72 shrink-0 lg:border-r border-[var(--os-border)] flex flex-col bg-[var(--os-surface-2)]",
        !showList && "hidden lg:flex",
      )}>
        <div className="px-4 py-4 border-b border-[var(--os-border)]">
          <h2 className="text-[15px] font-bold text-[#111827] os-dark:text-[var(--os-text)]">Chat</h2>
          <p className="text-[11px] text-[#6B7280] os-dark:text-[var(--os-text)] mt-0.5">Team-wide channels + direct messages</p>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          <Section title="Channels">
            {channels.map((c) => (
              <ChannelRow
                key={c.id}
                active={active?.id === c.id}
                onClick={() => openConversation(c)}
                icon={<Hash className="w-3.5 h-3.5 text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]" />}
                name={c.name}
                unread={c.unread}
                preview={c.lastMessage?.content}
              />
            ))}
          </Section>

          <Section title="Direct messages">
            {dms.map((c) => (
              <ChannelRow
                key={c.id}
                active={active?.id === c.id}
                onClick={() => openConversation(c)}
                icon={
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white text-[10px] font-bold flex items-center justify-center">
                    {c.partner?.avatarInitials ?? "?"}
                  </span>
                }
                name={c.partner?.fullName ?? "DM"}
                unread={c.unread}
                preview={c.lastMessage?.content}
              />
            ))}
            {dmCandidates.length > 0 && (
              <div className="mt-2">
                <p className="px-3 text-[11px] font-semibold text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] uppercase tracking-wider mb-1">Start a DM</p>
                {dmCandidates.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => openDm(u)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white os-dark:hover:bg-[var(--os-hover)] rounded-md text-[12px] text-[#6B7280] os-dark:text-[var(--os-text)] hover:text-[#111827] os-dark:hover:text-[var(--os-text)]"
                  >
                    <Plus className="w-3 h-3" />
                    {u.fullName}
                  </button>
                ))}
              </div>
            )}
          </Section>
        </div>
      </aside>

      {/* Main pane */}
      <div className={cn("flex-1 flex flex-col min-w-0 bg-[var(--os-surface)]", showList && "hidden lg:flex")}>
        {!active && !channelsLoaded ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !active ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div className="max-w-sm">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#F3F4F6] os-dark:bg-[var(--os-surface-2)] text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] mb-3">
                <MessageCircle className="w-7 h-7" />
              </div>
              <h3 className="text-[15px] font-semibold text-[#111827] os-dark:text-[var(--os-text)] mb-1">No channels yet</h3>
              <p className="text-[13px] text-[#6B7280] os-dark:text-[var(--os-text)] mb-3">
                You don&apos;t have any channels assigned yet. This usually means your session is
                stale — try logging out and back in.
              </p>
              <button
                type="button"
                onClick={() => router.push("/admin/login")}
                className="inline-flex items-center gap-1.5 h-9 px-3 bg-[#8B00FF] hover:bg-[#7A00E0] text-white rounded-lg text-[12px] font-semibold"
              >
                Log in again
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Channel header */}
            <div className="px-4 sm:px-6 py-3 border-b border-[var(--os-border)] flex items-center gap-3">
              <button
                className="lg:hidden p-1.5 rounded-md text-[#475569] os-dark:text-[var(--os-text)] hover:bg-[#F3F4F6] os-dark:hover:bg-[var(--os-hover)]"
                onClick={backToList}
                aria-label="Show channels"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              {active.isDm ? (
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white text-[11px] font-bold flex items-center justify-center">
                  {active.partner?.avatarInitials ?? "?"}
                </span>
              ) : (
                <Hash className="w-4 h-4 text-[#475569] os-dark:text-[var(--os-text)]" />
              )}
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#111827] os-dark:text-[var(--os-text)] truncate">
                  {active.isDm ? active.partner?.fullName ?? "DM" : active.name}
                </p>
                {active.description && !active.isDm && (
                  <p className="text-[11px] text-[#6B7280] os-dark:text-[var(--os-text)] truncate">{active.description}</p>
                )}
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesBoxRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 bg-[#FAFAFE]/40 os-dark:bg-[var(--os-surface-2)]">
              {loadingMessages ? (
                <div className="flex justify-center pt-10"><Loader2 className="w-5 h-5 text-[#8B00FF] os-dark:text-[var(--os-purple)] animate-spin" /></div>
              ) : messages.length === 0 ? (
                <div className="text-center text-[12px] text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] py-10">
                  No messages yet. Say hi!
                </div>
              ) : (
                <div className="space-y-4">
                  {messagesByDay.map((g, gi) => (
                    <div key={gi}>
                      <div className="text-center my-3">
                        <span className="inline-block px-3 py-0.5 rounded-full bg-[var(--os-surface)] border border-[var(--os-border)] text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] os-dark:text-[var(--os-text)]">{g.day}</span>
                      </div>
                      <div className="space-y-1">
                        {g.items.map((m, i) => {
                          const isMe = m.authorId === me?.id;
                          const prev = g.items[i - 1];
                          const groupWithPrev = prev && prev.authorId === m.authorId && (new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000);
                          const reactions = groupReactions(m.reactions);
                          return (
                            <MessageBubble
                              key={m.id}
                              message={m}
                              isMe={isMe}
                              isAdmin={me?.id ? (team.find((u) => u.id === me.id) as Record<string, unknown>)?.role === "admin" : false}
                              groupWithPrev={!!groupWithPrev}
                              team={team}
                              reactions={reactions}
                              onReact={(emoji) => toggleReaction(m, emoji)}
                              onEdit={(content) => editMessage(m.id, content)}
                              onDelete={() => deleteMessage(m.id)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="px-4 sm:px-6 py-3 border-t border-[var(--os-border)] bg-[var(--os-surface)]">
              {attach && (
                <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-[#F3F4F6] os-dark:bg-[var(--os-surface-2)] border border-[var(--os-border)] text-[12px] text-[#374151] os-dark:text-[var(--os-text)]">
                  <AttachChip result={attach} />
                  <button onClick={() => setAttach(null)} aria-label="Remove attached record" className="ml-auto text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {filePreview && (
                <div className="flex items-center gap-3 mb-2 px-3 py-2 rounded-lg bg-[#F3F4F6] os-dark:bg-[var(--os-surface-2)] border border-[var(--os-border)]">
                  {filePreview.file.type.startsWith("image/") ? (
                    <img src={filePreview.url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-red-50 os-dark:bg-red-500/10 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-red-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#111827] os-dark:text-[var(--os-text)] truncate">{filePreview.file.name}</p>
                    <p className="text-[11px] text-[#6B7280] os-dark:text-[var(--os-text)]">{(filePreview.file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button onClick={clearFilePreview} aria-label="Remove file" className="text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="relative">
                <MentionTextarea
                  value={composer}
                  onChange={setComposer}
                  onKeyDown={handleKey}
                  placeholder={filePreview ? "Add a caption..." : `Message ${active.isDm ? active.partner?.fullName ?? "" : "#" + active.name}`}
                  rows={1}
                  users={team}
                  className="min-h-[44px] pr-40 resize-none os-dark:bg-[var(--os-control-bg)] os-dark:border-[var(--os-control-border)] os-dark:text-[var(--os-text)] os-dark:placeholder:text-[var(--os-text-soft)]"
                />
                <div className="absolute right-2 top-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 rounded-md text-[#6B7280] os-dark:text-[var(--os-text)] hover:bg-[#F3F4F6] os-dark:hover:bg-[var(--os-hover)]"
                    title="Upload image or PDF"
                    aria-label="Upload image or PDF"
                  >
                    <Image className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttachOpen(true)}
                    className="p-1.5 rounded-md text-[#6B7280] os-dark:text-[var(--os-text)] hover:bg-[#F3F4F6] os-dark:hover:bg-[var(--os-hover)]"
                    title="Attach a record"
                    aria-label="Attach a record"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={filePreview ? sendFile : send}
                    disabled={sending || (!composer.trim() && !filePreview)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[#8B00FF] hover:bg-[#7A00E0] text-white disabled:opacity-40"
                    title="Send"
                    aria-label="Send message"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] mt-1">⏎ to send · ⇧⏎ for newline · @ to mention · @AI for assistant · 📎 images & PDFs</p>
            </div>
          </>
        )}
      </div>

      <AttachPicker
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        onPick={(r) => { setAttach(r); setAttachOpen(false); }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="px-3 text-[11px] font-semibold text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] uppercase tracking-wider mb-1">{title}</p>
      <div className="space-y-0.5 px-2">{children}</div>
    </div>
  );
}

function ChannelRow({ active, onClick, icon, name, unread, preview }: { active: boolean; onClick: () => void; icon: React.ReactNode; name: string; unread: number; preview?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors",
        active ? "bg-[var(--os-surface)] border border-[var(--os-border)] shadow-sm" : "hover:bg-white os-dark:hover:bg-[var(--os-hover)] border border-transparent",
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-[13px] truncate", unread > 0 ? "font-bold text-[#111827] os-dark:text-[var(--os-text)]" : "font-medium text-[#374151] os-dark:text-[var(--os-text)]")}>
            {name}
          </span>
          {unread > 0 && (
            <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#8B00FF] text-white text-[11px] font-bold">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
        {preview && unread === 0 && (
          <p className="text-[11px] text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] truncate mt-0.5">{preview}</p>
        )}
      </div>
    </button>
  );
}

function MessageBubble({ message, isMe, isAdmin, groupWithPrev, team, reactions, onReact, onEdit, onDelete }: {
  message: Message; isMe: boolean; isAdmin: boolean; groupWithPrev: boolean; team: User[];
  reactions: { emoji: string; count: number; mine: boolean; users: string[] }[];
  onReact: (emoji: string) => void;
  onEdit: (content: string) => void;
  onDelete: () => void;
}) {
  const author = team.find((u) => u.id === message.authorId);
  const isAI = message.authorName === "AI Assistant";
  const [hovering, setHovering] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function submitEdit() {
    if (!editContent.trim()) return;
    onEdit(editContent.trim());
    setEditing(false);
  }

  return (
    <div
      className={cn("group flex gap-3 px-2 py-1 rounded-md relative", hovering && "bg-[var(--os-surface)] os-dark:bg-[var(--os-hover)]", isAI && "bg-blue-50/40 os-dark:bg-blue-500/10")}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setEmojiOpen(false); setConfirmDelete(false); }}
    >
      <div className="w-8 shrink-0">
        {!groupWithPrev && (
          isAI ? (
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#06B6D4] text-white">
              <Sparkles className="w-4 h-4" />
            </span>
          ) : (
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white text-[11px] font-bold">
              {author?.avatarInitials ?? message.authorName.slice(0, 2).toUpperCase()}
            </span>
          )
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!groupWithPrev && (
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn("text-[13px] font-semibold", isAI ? "text-blue-600 os-dark:text-blue-400" : "text-[#111827] os-dark:text-[var(--os-text)]")}>{message.authorName}</span>
            {isAI && <Sparkles className="w-3 h-3 text-blue-400" />}
            <span className="text-[11px] text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]">{formatTime(message.createdAt)}</span>
          </div>
        )}
        {editing ? (
          <div className="mt-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitEdit(); } if (e.key === "Escape") setEditing(false); }}
              className="w-full px-3 py-2 rounded-lg bg-[var(--os-control-bg)] border border-purple-200 os-dark:border-purple-500/30 text-[13px] text-[#111827] os-dark:text-[var(--os-text)] focus:ring-2 focus:ring-purple-100 os-dark:focus:ring-purple-500/40 outline-none resize-none"
              rows={2}
              autoFocus
            />
            <div className="flex gap-2 mt-1.5">
              <button onClick={submitEdit} className="text-[11px] px-2.5 py-1 rounded-md bg-[#8B00FF] text-white font-medium hover:bg-[#7A00E0]">Save</button>
              <button onClick={() => setEditing(false)} className="text-[11px] px-2.5 py-1 rounded-md text-[#6B7280] os-dark:text-[var(--os-text)] hover:bg-[#F3F4F6] os-dark:hover:bg-[var(--os-hover)]">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {!message.fileUrl && (
              <div className="text-[13px] text-[#111827] os-dark:text-[var(--os-text)] leading-relaxed">
                <HighlightedMentions text={message.content} users={team} />
              </div>
            )}
            {message.fileUrl && message.fileType?.startsWith("image/") && (
              <div className="mt-1">
                {message.content && message.content !== message.fileName && (
                  <div className="text-[13px] text-[#111827] os-dark:text-[var(--os-text)] leading-relaxed mb-1">
                    <HighlightedMentions text={message.content} users={team} />
                  </div>
                )}
                <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={message.fileUrl}
                    alt={message.fileName ?? "image"}
                    className="max-w-[320px] max-h-[240px] rounded-lg border border-[var(--os-border)] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  />
                </a>
              </div>
            )}
            {message.fileUrl && message.fileType === "application/pdf" && (
              <div className="mt-1">
                {message.content && message.content !== message.fileName && (
                  <div className="text-[13px] text-[#111827] os-dark:text-[var(--os-text)] leading-relaxed mb-1">
                    <HighlightedMentions text={message.content} users={team} />
                  </div>
                )}
                <a
                  href={message.fileUrl}
                  download={message.fileName ?? "file.pdf"}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 os-dark:border-red-500/30 bg-red-50 os-dark:bg-red-500/10 text-red-700 os-dark:text-red-300 text-[12px] font-medium hover:bg-red-100 os-dark:hover:bg-red-500/15 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  {message.fileName ?? "Document.pdf"}
                </a>
              </div>
            )}
          </>
        )}
        {message.attachType && message.attachLabel && (
          <AttachChip result={{
            type: message.attachType,
            id: message.attachId ?? "",
            label: message.attachLabel,
            sub: "",
            href: message.attachHref ?? "#",
          }} />
        )}
        {reactions.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(r.emoji)}
                title={r.users.join(", ")}
                aria-label={`${r.emoji} ${r.count}, ${r.users.join(", ")}`}
                aria-pressed={r.mine}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[12px]",
                  r.mine ? "bg-[#F3E8FF] os-dark:bg-purple-500/10 border-[#E9D5FF] os-dark:border-purple-500/30 text-[#7E22CE] os-dark:text-[var(--os-purple)]" : "bg-[var(--os-surface)] border-[var(--os-border)] text-[#374151] os-dark:text-[var(--os-text)] hover:bg-[#F9FAFB] os-dark:hover:bg-[var(--os-hover)]",
                )}
              >
                <span>{r.emoji}</span>
                <span className="text-[11px] font-semibold">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {hovering && !editing && (
        <div className="absolute -top-3 right-2 bg-[var(--os-popover)] border border-[var(--os-border)] rounded-md shadow-sm px-1 py-0.5 flex items-center gap-0.5">
          {QUICK_REACTIONS.slice(0, emojiOpen ? QUICK_REACTIONS.length : 3).map((e) => (
            <button key={e} onClick={() => onReact(e)} aria-label={`React with ${e}`} className="px-1 hover:bg-[#F3F4F6] os-dark:hover:bg-[var(--os-hover)] rounded">{e}</button>
          ))}
          <button onClick={() => setEmojiOpen((s) => !s)} aria-label={emojiOpen ? "Fewer reactions" : "More reactions"} aria-expanded={emojiOpen} className="px-1 text-[#6B7280] os-dark:text-[var(--os-text)] hover:bg-[#F3F4F6] os-dark:hover:bg-[var(--os-hover)] rounded">
            <Smile className="w-3 h-3" />
          </button>
          {isMe && (
            <button onClick={() => { setEditContent(message.content); setEditing(true); }} className="px-1 text-[#6B7280] os-dark:text-[var(--os-text)] hover:bg-[#F3F4F6] os-dark:hover:bg-[var(--os-hover)] rounded" title="Edit" aria-label="Edit message">
              <span className="text-[11px]">✏️</span>
            </button>
          )}
          {(isMe || isAdmin) && (
            confirmDelete ? (
              <button onClick={onDelete} aria-label="Confirm delete message" className="px-1.5 py-0.5 text-[11px] font-medium text-red-600 os-dark:text-red-400 bg-red-50 os-dark:bg-red-500/10 hover:bg-red-100 os-dark:hover:bg-red-500/15 rounded">Delete?</button>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="px-1 text-[#6B7280] os-dark:text-[var(--os-text)] hover:bg-red-50 os-dark:hover:bg-red-500/10 hover:text-red-500 rounded" title="Delete" aria-label="Delete message">
                <X className="w-3 h-3" />
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function AttachChip({ result }: { result: AttachResult }) {
  const Icon = TYPE_ICON[result.type] ?? Paperclip;
  const color = TYPE_COLOR[result.type] ?? "text-[#374151] os-dark:text-[var(--os-text)] bg-[#F3F4F6] os-dark:bg-[var(--os-surface-2)] border-[var(--os-border)]";
  return (
    <Link
      href={result.href}
      target="_blank"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] font-medium hover:underline mt-1.5 max-w-[280px]",
        color,
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{result.label}</span>
    </Link>
  );
}

function AttachPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (r: AttachResult) => void }) {
  const { dialogProps } = useDialog({ open, onClose, label: "Attach a record" });
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AttachResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open || q.length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`/api/admin/chat/attach-search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setResults(Array.isArray(d) ? d : []))
        .finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => { if (!open) { setQ(""); setResults([]); } }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
          onClick={onClose}
        >
          <motion.div
            {...dialogProps}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }}
            className="w-full max-w-[520px] bg-[var(--os-popover)] rounded-2xl border border-[var(--os-border)] shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[var(--os-border)] flex items-center gap-2">
              <Search className="w-4 h-4 text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search prospects, clients, projects, tasks, meetings..."
                className="flex-1 bg-transparent text-[14px] text-[#111827] os-dark:text-[var(--os-text)] placeholder:text-[#9CA3AF] os-dark:placeholder:text-[var(--os-text-soft)] focus:outline-none"
              />
              <button onClick={onClose} aria-label="Close" className="text-[#9CA3AF] os-dark:text-[var(--os-text-soft)] hover:text-[#111827] os-dark:hover:text-[var(--os-text)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {q.length < 2 ? (
                <p className="px-4 py-6 text-center text-[12px] text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]">Type at least 2 characters.</p>
              ) : searching && results.length === 0 ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-[#8B00FF] os-dark:text-[var(--os-purple)] animate-spin" /></div>
              ) : results.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-[#9CA3AF] os-dark:text-[var(--os-text-soft)]">No matches.</p>
              ) : (
                <ul>
                  {results.map((r, i) => {
                    const Icon = TYPE_ICON[r.type] ?? Paperclip;
                    const color = TYPE_COLOR[r.type] ?? "text-[#374151] os-dark:text-[var(--os-text)]";
                    return (
                      <li key={`${r.type}-${r.id}-${i}`}>
                        <button
                          onClick={() => onPick(r)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#FAFAFE] os-dark:hover:bg-[var(--os-hover)] border-t border-[#F3F4F6] os-dark:border-[var(--os-border)]"
                        >
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color)}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-[#111827] os-dark:text-[var(--os-text)] truncate">{r.label}</p>
                            <p className="text-[11px] text-[#6B7280] os-dark:text-[var(--os-text)] truncate">{r.type} · {r.sub}</p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex justify-center pt-20"><Loader2 className="w-6 h-6 text-[#8B00FF] os-dark:text-[var(--os-purple)] animate-spin" /></div>}>
      <ChatInner />
    </Suspense>
  );
}
