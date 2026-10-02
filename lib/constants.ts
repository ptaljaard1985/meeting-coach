export const NOTICE_VERSION = '2026-10-02.2';
export const ACKNOWLEDGEMENT = 'I take full responsibility for my decision to share this meeting transcript and the client data it contains. I confirm I have the authority and any required permissions to submit it to Meeting Coach and OpenAI for AI analysis.';
export const MAX_TRANSCRIPT_BYTES = 64_000;
export const MAX_BODY_BYTES = 80_000;
export const MAX_OUTPUT_TOKENS = 12_000;
export const REVIEW_TIMEOUT_MS = 15 * 60 * 1000;
// UTF-8 byte upper bound plus 4,096 tokens reserved for message framing.
export const MAX_PROMPT_BYTES = 123_904;
export const PROMPT_VERSION = 'meeting-coach-openai-2.2';
