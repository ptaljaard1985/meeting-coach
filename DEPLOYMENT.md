# Render pilot deployment

Updated 12 October 2026. The owner supplied **https://meeting-coach-0f6x.onrender.com** and reports deployments after entering Upstash credentials and the OpenAI key. Cloudflare Turnstile keys were obtained and configuration instructions supplied. The owner confirms the site opens in their browser. **The last instructed mode is `demo`; live AI reviews have not been verified.** The agent could not independently load the URL (web-tool access failed, shell DNS failed, and no browser was available). A reported deployment is not an end-to-end test.

The owner explicitly selected **GPT-6.1 Sol for reviews** on 12 October, retaining medium reasoning and standard service. Examples remain fixed Sol 6.1/low. Set the model override explicitly: unchanged runtime code and `.env.example` still default to Astra. Claude was discussed but no provider change or fallback was selected.

## Progress and evidence

| Item | Status as of 12 October |
| --- | --- |
| Render service | Owner-provided URL, browser access confirmation and repeated reports of successful deployment; $7/month 0.5 CPU / 512 MB plan selected in screenshot |
| Render region | Frankfurt recommended; actual selection still needs confirmation |
| Turnstile | Owner obtained keys; instructed to add site/secret keys and exact origin in Render; widget integration not tested |
| Upstash | Setup screenshot confirms `meeting-coach`, Frankfurt (`eu-central-1`), pay-as-you-go $0.20/100K commands; owner reports adding REST credentials and deploying |
| Upstash retention/cost settings | Eviction shown off initially and instructed to stay off; no read regions or Prod Pack requested; maximum budget was not set in the screenshot; final settings/backups not inspected |
| OpenAI key | Owner reports adding key and deploying; screenshot confirms only Responses Write enabled under Restricted permissions |
| OpenAI project/access | Dedicated project, billing and 90-day expiry were instructed/recommended; actual project selection, billing, expiry and Sol access are unverified |
| Remaining environment values | Instructions supplied below; actual model override, limiter secret, limits, mode and IP-header value have not been inspected |
| Public operator details | Operator name/public email and Render region were requested; awaiting reply |
| Live testing | No successful review, generation, challenge/counter integration or live numerical record verified |

## Render service settings

These are the supplied setup instructions, not a claim that the environment has been inspected:

| Setting | Value |
| --- | --- |
| Source | `ptaljaard1985/meeting-coach`, branch `main` |
| Language | Node |
| Root directory | Empty (repository root) |
| Compute | `0.5c-512mb` (formerly Starter), one instance, $7/month |
| Region | Frankfurt recommended; confirm the actual service region |
| Node runtime | `NODE_VERSION=24.21.0` (Node 24 LTS) |
| Build | `npm ci --include=dev && npm run build` |
| Start | `./node_modules/.bin/next start --hostname 0.0.0.0 --port "$PORT"` |
| Initial mode | `REVIEW_MODE=demo` |

The ordinary local `npm start` binds to `127.0.0.1`; the Render command above supplies the public binding and host port. Render provides the `onrender.com` address and managed HTTPS, so no custom domain or DNS change is required. [Web service setup](https://render.com/docs/web-services), [Node version](https://render.com/docs/node-version), [compute plan names](https://render.com/docs/compute-plans).

Render documents a 100-minute HTTP response limit, sufficient in principle for the app's 15-minute foreground deadline and 16-minute route declaration. Actual long requests and cancellation still need testing. The user must keep the page open; refresh/navigation cannot recover a review. No background worker or content storage was introduced. [Render request duration](https://render.com/docs/render-vs-vercel-comparison).

## Required environment values

Enter secrets directly in Render; do not put their values in chat, screenshots, source or commits. The table records intended pilot configuration. The owner's completed key/deployment reports do not establish every value below.

| Key | Intended value / source |
| --- | --- |
| `NODE_VERSION` | `24.21.0` |
| `REVIEW_MODE` | `demo` until configuration and launch checks are ready; switch deliberately to `live` for the authorised pilot |
| `OPENAI_API_KEY` | Dedicated Meeting Coach Platform project key, with funded API billing and Sol access |
| `REVIEW_MODEL` | **`gpt-6.1-sol`** (owner selected; source/template default is Astra) |
| `REVIEW_REASONING_EFFORT` | `medium` |
| `REVIEW_DAILY_CALL_LIMIT` | `10` suggested for the initial pilot (source/template default: `30`) |
| `REVIEW_NETWORK_HOURLY_CALL_LIMIT` | `12` (existing default) |
| `REVIEW_CONCURRENCY` | `3` (existing default) |
| `REVIEW_TIMEOUT_MS` | `900000` (15 minutes including any correction) |
| `ANALYTICS_ENABLED` | `true` |
| `APP_ORIGIN` | `https://meeting-coach-0f6x.onrender.com` — no trailing slash |
| `TURNSTILE_SITE_KEY` | Widget's public site key |
| `TURNSTILE_SECRET_KEY` | Widget's private secret key |
| `UPSTASH_REDIS_REST_URL` | Database HTTPS REST URL ending in `.upstash.io`, not the Redis TCP connection URL |
| `UPSTASH_REDIS_REST_TOKEN` | Standard read/write REST token, not the read-only token |
| `LIMIT_KEY_SECRET` | Fresh random value of at least 32 characters; suggested generator below |
| `TRUSTED_IP_HEADER` | `x-forwarded-for` for Render, subject to hosted verification below |

Generate the limiter secret locally, then copy the result directly to Render:

```sh
openssl rand -hex 32
```

The OpenAI key permissions screenshot showed **Restricted**, **Responses (`/v1/responses`) = Write**, every other displayed individual permission **None**, and the parent Model capabilities group **Mixed**. A 90-day expiry was suggested but not confirmed; record the actual expiry and replace the key in Render before that date. Never use another application's key or a Codex session credential. [OpenAI permissions](https://developers.openai.com/api/docs/guides/rbac), [API key handling](https://developers.openai.com/api/docs/guides/production-best-practices).

Turnstile setup instructions: widget name `Meeting Coach`, hostname `meeting-coach-0f6x.onrender.com` (no scheme/path), **Managed**, pre-clearance disabled. The app already embeds the widget and verifies tokens server-side, including hostname and action `review`; no DNS proxy change is needed. [Widget setup](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/).

## Proxy verification and retention

Render's documentation identifies `x-forwarded-for` as the client IP header; a Render staff response states that the first value is set to the real client IP. The app uses the first comma-separated value. This supports the Render-specific configuration, but **normal and forged-header behaviour have not been tested on this service**. Verify that clients cannot control the value used by the limiter and cannot bypass the trusted edge before treating network quotas as verified. The template's `x-vercel-forwarded-for` is not the Render setting. [Render client IP guidance](https://render.com/articles/how-render-handles-ddos-attacks), [Render staff clarification](https://feedback.render.com/features/p/send-the-correct-x-forwarded-for).

Keep Upstash eviction **off**. Private numerical records have no automatic expiry or cap and remain until owner deletion. Expiring limiter keys are separate. Verify final persistence, backup/deletion lifecycle and capacity monitoring. Upstash documents durable storage; paid tiers also avoid the free-tier endpoint archival caused by prolonged inactivity. This is not a claim that the database settings have been audited. [Durable storage](https://upstash.com/docs/redis/features/durability), [eviction](https://upstash.com/docs/redis/features/eviction), [inactivity FAQ](https://upstash.com/docs/redis/help/faq).

The displayed Upstash monthly maximum budget was **not set**. Set an appropriate pilot budget in its console; Upstash rate-limits the database at the cap, which can also prevent the app's live requests because its limiter fails closed. The $200/month Prod Pack was not requested. [Upstash pricing and budgets](https://upstash.com/pricing/redis).

Before public use with real content, finish `app/privacy/page.tsx` with the owner-approved public operator name/email, confirmed host region and actual provider/host handling. Do not infer public contact details from account screenshots. Confirm request/response bodies, prompts, quotes and raw provider errors are absent from host logging/tracing/APM. `store:false` does not promise zero OpenAI retention; account-specific data controls remain unverified. No transcript or written-review storage, public analytics endpoint, or privacy wording change is part of this documentation update.

## Costs checked 12 October 2026 (USD)

| Service | Price basis |
| --- | --- |
| Render | $7/month for the selected server; Hobby workspace has no additional monthly plan fee; tax, overages or later upgrades are additional |
| Turnstile | Free plan includes unlimited challenges |
| Upstash | Selected pay-as-you-go: $0.20 per 100K commands; storage/bandwidth allowances and excess charges apply; no Prod Pack requested |
| OpenAI Sol 6.1 | Per million tokens: $2 ordinary input, $0.10 cached read, $2.50 cache write, $10 output |
| Address and HTTPS | Render-provided subdomain/TLS included; no domain purchase required |

Sources: [Render compute pricing](https://render.com/articles/render-vs-railway), [workspace fees](https://render.com/docs/platform-features-by-plan), [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/), [Upstash pricing](https://upstash.com/pricing/redis), [Sol model pricing](https://developers.openai.com/api/docs/models/gpt-6.1-sol). Recheck before new spending decisions.

The owner's cost illustration used **20,000 ordinary input + 10,000 billed output tokens per review**: $0.04 + $0.10 = **$0.14**, or **$14 for 100 reviews**. With $7 Render compute this is **$21/month**, excluding Redis, tax, hosting overages, example generation, caching differences and correction attempts. Output includes reasoning tokens. These are arithmetic estimates, not observed app usage or a fixed review price.

### Conservative technical exposure

The app caps serialized model parameters at 123,904 UTF-8 bytes plus a conservative 4,096-token framing allowance, budgeting 128,000 input tokens. Reviews allow 12,000 output tokens and examples 20,000; both include reasoning. Confirm framing/actual usage before relying on these technical bounds. Transcript input is at most 64 KB and API body at most 80 KB.

Using the higher cache-write input price as a conservative input assumption:

```text
Sol review attempt:    128,000 × $2.50 / 1m + 12,000 × $10 / 1m = $0.44
Sol example attempt:   128,000 × $2.50 / 1m + 20,000 × $10 / 1m = $0.52
Suggested 10 calls/day: 10 × $0.52 = $5.20/day technical exposure
Source-default 30/day:  30 × $0.52 = $15.60/day technical exposure
```

The daily counter includes reviews, examples and corrections; ten calls are not ten completed reviews. Hidden SDK retries are disabled and failed/ambiguous attempts are not refunded. This is a deliberately generous technical bound, not a measured bill or monthly dollar cap; it excludes tax/other account charges and depends on model/pricing/token assumptions. If the Sol override is missing, the Astra source default has a higher bound ($2.20/review attempt at the checked prices), so verifying `REVIEW_MODEL` matters. [Astra pricing](https://developers.openai.com/api/docs/models/gpt-6-astra).

## Finish the pilot

1. Inspect configuration without revealing secrets. Confirm the dedicated project/billing/model access, Sol override, random limiter secret, exact origin, limits and actual mode. Do not switch to live merely for this docs update.
2. Resolve the outstanding operator name/public email and Render region; finish account-specific privacy/host logging disclosures and verify proxy handling.
3. When ready, deliberately set `REVIEW_MODE=live` and deploy. Use the supplied synthetic transcript for the first paid review, then test fictional example generation separately. Record success/failure, actual usage, timing, evidence quality and model shown in the report. If access fails, diagnose it; no silent model/provider substitution.
4. Verify challenge failures, hostname/action mismatch, origin rejection, quotas, concurrent requests, leases and shared-office behaviour. Check a hosted long request and cancellation/disconnect against the shared 15-minute allowance. A single fast success does not prove the long-request behaviour.
5. Exercise PDF download, keyboard, Clear, refresh/back navigation and mobile flow. Verify no content capture or browser persistence.
6. Test private numerical persistence/export/deletion using a separate synthetic database. Do not run deletion against production records as a launch check. No public analytics route is authorised.
7. Complete dependency audit and consultant calibration; do not advertise uncalibrated scores as a benchmark. Record evidence in `VERIFICATION.md` and current status in `HANDOFF_NOTES.txt`.

Fresh local tests/typecheck/lint/build passed on 12 October, but no hosted paid test is claimed. Agent-shell GitHub access failed DNS resolution, so the owner cloned the repository through their Mac Terminal. The agent reconciled this refresh against fresh `main` at `e30ec35`; check publication/PR state for `docs/render-pilot-20261012` before continuing. Preserve any later remote changes. Never access the CRM or run the obsolete extraction verifier.
