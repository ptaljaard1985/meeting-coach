export const NOTICE_VERSION = '2026-10-12.1';
export const ACKNOWLEDGEMENT = 'I take full responsibility for my decision to share this meeting transcript and the client data it contains. I confirm I have the authority and any required permissions to submit it to Meeting Coach and OpenAI for AI analysis.';
// Roughly three hours of conversation, including verbose per-turn speaker headers.
export const MAX_TRANSCRIPT_BYTES = 160_000;
export const MAX_BODY_BYTES = 200_000;
export const MAX_OUTPUT_TOKENS = 12_000;
export const REVIEW_TIMEOUT_MS = 15 * 60 * 1000;
// UTF-8 byte upper bound plus 4,096 tokens reserved for message framing: at most 272,000 input
// tokens, so a review never enters GPT-6.1 Sol's long-context price tier (above 272K).
export const MAX_PROMPT_BYTES = 267_904;
// Example requests carry no transcript, so they keep the original 128,000-token budget.
export const MAX_EXAMPLE_PROMPT_BYTES = 123_904;
export const PROMPT_VERSION = 'meeting-coach-openai-2.2';
