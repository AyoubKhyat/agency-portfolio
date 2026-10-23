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

import type { ServiceGroupId, ServiceId } from "@/lib/services-catalog";

export type AssistantOption = {
  id: string;
  /** What the option is about in the shared service catalog (for consistency and analytics). */
  catalog?: { service: ServiceId } | { group: ServiceGroupId };
  /** Rendered before the label; identical in every locale. */
  emoji: string;
  /** False for the option that goes straight to WhatsApp with no reply. */
  hasReply: boolean;
};

export const OPTIONS: AssistantOption[] = [
  { id: "website", emoji: "🌐", hasReply: true, catalog: { service: "web" } },
  { id: "bookings", emoji: "📅", hasReply: true, catalog: { service: "booking" } },
  { id: "app", emoji: "📱", hasReply: true, catalog: { service: "mobile" } },
  { id: "automation", emoji: "⚡", hasReply: true, catalog: { service: "automation" } },
  { id: "ai", emoji: "🤖", hasReply: true, catalog: { service: "ai" } },
  { id: "creative", emoji: "🎬", hasReply: true, catalog: { group: "creative" } },
  { id: "pricing", emoji: "💰", hasReply: true },
  { id: "contact", emoji: "💬", hasReply: false },
];
