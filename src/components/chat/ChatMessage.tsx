"use client";

export type ChatMessageRole = "user" | "assistant";

interface Props {
  role: ChatMessageRole;
  content: string;
}

export default function ChatMessage({ role, content }: Props) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={[
          "max-w-[85%] px-3 py-2 text-sm rounded-2xl whitespace-pre-wrap break-words leading-relaxed",
          isUser
            ? "bg-primary text-white rounded-br-sm"
            : "bg-surface-2 text-foreground rounded-bl-sm border border-line",
        ].join(" ")}
      >
        {content}
      </div>
    </div>
  );
}
