/**
 * Shape of the Phase 1 sales assistant.
 *
 * This is a fixed decision tree, not a chatbot: every reply is written copy,
 * chosen by the visitor tapping an option. Nothing is generated, no request
 * leaves the browser, and no state is stored anywhere.
 *
 * Only the emoji and the option order live here. All wording — labels,
 * replies, CTA and accessibility labels — comes from the `Assistant`
 * namespace in `src/messages/{fr,en,ar}.json`, keyed as `<id>_label` and
 * `<id>_reply`, so the widget follows the site's locale like every other
 * component.
 */

export type AssistantOption = {
  id: string;
  /** Rendered before the label; identical in every locale. */
  emoji: string;
  /** False for the option that goes straight to WhatsApp with no reply. */
  hasReply: boolean;
};

export const OPTIONS: AssistantOption[] = [
  { id: "website", emoji: "🌐", hasReply: true },
  { id: "bookings", emoji: "📅", hasReply: true },
  { id: "app", emoji: "📱", hasReply: true },
  { id: "automation", emoji: "⚡", hasReply: true },
  { id: "ai", emoji: "🤖", hasReply: true },
  { id: "pricing", emoji: "💰", hasReply: true },
  { id: "contact", emoji: "💬", hasReply: false },
];
