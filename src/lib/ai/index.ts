/**
 * Draft generator used by discovery audits and outreach drafts.
 *
 * No external AI model is called: the only provider is the deterministic MockAiProvider, whose
 * output is template text marked as sample (see MOCK_MARKER). The AiProvider interface stays so
 * a real provider can be added back behind getAiProvider() without touching the callers.
 */

import { MockAiProvider } from "./mock";
import type { AiProvider } from "./types";

let _cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  return (_cached ??= new MockAiProvider());
}

export type { AiProvider, AiProviderName } from "./types";
