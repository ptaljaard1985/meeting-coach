# Architecture and data lifecycle

TypeScript, Next.js App Router, React, Zod, official OpenAI SDK, Vitest and browser `@react-pdf/renderer`. The server relay is needed because the operator funds a shared key. No CRM, Supabase, ORM, transcript store, object storage, content queue or hosted eval dataset is used.

```text
browser memory / local parser
  → same-origin bounded POST /api/review
  → request-scoped parse, role validation, metrics and challenge
  → shared atomic metadata limiter
  → private numerical request-start record (when configured)
  → OpenAI foreground Responses / store:false
  → strict schema and domain/evidence validation
  → numerical outcome/usage and validated score projection
  → browser memory / local PDF
```

The optional title remains local and is never in the review request. Raw transcript speech is supplied once per model attempt as stable parsed segments. A correction sends the same source again, without retaining/replaying the invalid answer. The server owns model, rubric, prompt, schema, token limits and spend settings. The API ignores no unknown fields: Zod rejects them.

## Content boundaries

Transcript, parsed segments, model output and evidence exist only in each request, then browser memory. No prompt/answer logging, content caches, exception attachments or content telemetry is added. Numerical analytics have a separate strict projection described below. Safe errors contain no provider stack, prompt or speech. API and page responses carry `no-store`. The app has no localStorage, sessionStorage, IndexedDB, content cookies, history payloads or service worker. Browser cache of static scripts/fonts contains no meeting content.

PDF code is lazy-loaded and uses the received review. Blob URLs are released on Clear, component unmount or pagehide. Navigation and persisted pageshow reset the app session. This is a session clear, not forensic erasure. The host, browser and provider have separate lifecycles; the host’s capture settings still need deployment review.

## Grading contract

The operative rubric is version 1.1: all seven categories are retained, with 24 criteria after the owner removed the Afrikaans-specific criterion. The original handoff is preserved as provenance. Prompt `meeting-coach-openai-2.2` preserves English, Afrikaans and mixed-language review with original quotes and British English coaching. Responses `text.format` uses a strict JSON schema. Model judgment is not deterministic.

Every category/criterion appears once under the right parent. Assessable values are 1–5; unassessable values are null with explanations. Assessable criteria require source-matched evidence. Quotes are exact substrings of one request-local segment, with speaker/time resolved from that source. A known duration never generates evidence timestamps. Overall is recomputed by the server and excludes n/a. Quotes being authentic does not prove a verdict is fair.

The adapter has no tools, background requests, conversations, Files, web search or provider fallback. The SDK has `maxRetries:0`; one safe correction is possible for invalid output. Refusals, incomplete output, schema failure, provider errors and timeout do not render partial success. AbortSignal and a promise race bound a hung provider; accepted upstream work may still incur cost after cancellation.

The default and maximum overall request deadline is 900,000 ms (15 minutes), shared across corrections. The request-local OpenAI SDK and matching Undici transport use the same headers/body timeout, avoiding shorter SDK or HTTP defaults. Transport sockets are destroyed after each attempt. Routes declare 960 seconds of host execution headroom; this declaration does not override a platform limit. Browser waiting panels preserve cancellation and instruct the user to keep the page open. No background worker or recoverable content history is introduced.

Example generation is a separate bounded POST to `/api/example`. It receives only an opaque request ID, optional challenge token and previous fictional scenario ID; no pasted transcript, local title or role selection is transmitted. The server selects a new scenario/variation and calls fixed `gpt-6.1-sol` with low reasoning and strict output. It validates 6,300–7,700 spoken words, three participating speakers and the 64 KB transcript cap. Timestamps are explicitly simulated from speech at 140 words per minute. Generation uses the same shared quota and request lease, `store:false`, and at most two counted attempts. Successful output replaces browser memory; failure/cancellation retains the existing paste. The offline preview disables this paid feature.

## Public-use controls

Turnstile is verified on the server, including hostname and `review` action. No transcript is sent to Cloudflare. An exact-origin check complements that gate but is not authentication. Fixed Redis REST destination comes from trusted server configuration, never request input.

Upstash Redis EVAL makes each concurrency, duplicate and call-quota decision atomic across instances. Redis time sets UTC daily allowance and rolling network hour. Limiter keys hold only pseudonymous network IDs, opaque request/call IDs and counters. Leases expire after the request deadline plus 30 seconds; submission IDs after 24 hours; network counters after two hours; daily call records after two days. Limiter data is bounded/pruned. There is also a shared 300-submission/hour pre-challenge ceiling. IPs do not identify people; a shared network gets 12 model calls/hour by default.

Allowance is reserved before **every** outbound model call, including a correction. Failed/ambiguous calls are never refunded. Production live calls fail closed without the key, exact HTTPS origin, challenge, shared limiter, trusted proxy IP header and pseudonym secret. The in-memory limiter is for local development only.

## Numerical analytics retained until deletion

The existing Redis connection also supports a separate metadata hash and index: `mc:{analytics}:records` and `mc:{analytics}:index`. A strict Zod schema rejects unknown fields. Request-local code projects only an independent UUID, start/finish times, duration, request type, model, prompt/rubric versions, a fixed outcome enum, attempt count, numerical token usage, overall score and seven category scores. No transcript, names, title, quotes, coaching, provider error strings, IP/network identifiers or submission/report IDs cross this boundary.

The record is written before each model attempt, then updated after validated success or failure. One correction updates the same record and contributes its returned usage. Scores are included only after successful review validation. Missing usage is explicitly incomplete. A server interruption can leave a `running` record. Storage failures emit only a constant warning and do not discard the review. This is best-effort operational analysis, not an exact billing ledger.

Atomic writes use HSET, ZADD and PERSIST with **no expiry, pruning or automatic deletion**, matching the operator's retention choice. The Redis service must preserve data without eviction. The index uses equal scores and lexicographic cursor pagination for export. The operator-only CLI validates each exported row; it has no public API counterpart. Explicit deletion targets only the two analytics keys and leaves limiter controls intact. Disable collection and finish active requests before deletion to prevent later writes; external CSV exports have their own lifecycle. Clear resets the browser session and does not delete analytics.

Official implementation references: [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data), [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Upstash EVAL](https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval).
