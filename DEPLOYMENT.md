# Deployment guide (prepared; not deployed)

Suggested pilot host: **one small paid Render Node web service, currently about US$7/month**, using its included subdomain. No background worker is needed for the present foreground design. Render documents a 100-minute HTTP request limit, leaving room for the app's 15-minute deadline and 16-minute route headroom. Add Cloudflare Turnstile and Upstash Redis REST for live public access. Sources checked on 2 October 2026: [Render pricing](https://render.com/pricing), [Render request limit](https://render.com/docs/render-vs-vercel-comparison). Nothing has been provisioned. Confirm actual request/disconnect behaviour with a synthetic test on the chosen service.

For Render, use Node 24 LTS, build with `npm ci && npm run build`, and start with `./node_modules/.bin/next start --hostname 0.0.0.0 --port "$PORT"`. The ordinary local `npm start` intentionally binds to 127.0.0.1; deployment must use the public binding and Render-assigned port. See [Render web service requirements](https://render.com/docs/web-services). The user must keep the browser page open and connected during a request. Refresh or navigation cannot recover a completed review because no meeting history is stored.

Netlify also supports the Next.js app and supplies a `*.netlify.app` address. Its current Personal plan is US$9/month with 1,000 monthly credits; Pro starts at US$20/month with 3,000 credits. However, [standard function execution is limited to 60 seconds](https://docs.netlify.com/build/functions/configuration/?fn-language=js), below this app’s default 900-second request timeout. Do not assume Next.js `maxDuration` overrides that host limit. The offline preview fits; reliable live reviews and long example generation need an independently hosted backend or a reviewed asynchronous design. Background Functions run up to 15 minutes but return an immediate empty 202, automatically retry errors and require a new result-delivery mechanism. That would change the present transient-content and paid-call controls, so it has not been introduced just to enable hosting. Sources checked on 2 October 2026: [pricing](https://www.netlify.com/pricing/), [Next.js support](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [domains](https://docs.netlify.com/manage/domains/domains-fundamentals/understand-domains/), [background functions](https://docs.netlify.com/build/functions/background-functions/). AI API charges remain separate from hosting.

## Inputs needed before a live launch

1. Host/project, server region and exact HTTPS domain/origin.
2. Dedicated OpenAI Platform project/key with access to `gpt-6-astra` for reviews and `gpt-6.1-sol` for example generation; verify the account’s access with a synthetic opt-in smoke test. A model appearing in documentation does not establish account access.
3. Turnstile site/secret keys restricted to the chosen hostname. The browser receives only the public site key.
4. Upstash Redis URL/token and a random limiter HMAC secret of at least 32 characters. Select a region and service agreement appropriate to the host/operator arrangement.
5. Verified proxy header handling. The provided `x-vercel-forwarded-for` assumption must be checked on Vercel; other hosts must overwrite an appropriate header and prevent direct untrusted access. Never trust arbitrary client `X-Forwarded-For`.
6. Public operator contact/domain details, host region disclosure and approved privacy/terms copy. Add these to the privacy page before opening the real service.
7. Account-specific provider retention/training/caching settings and host request/response capture settings.

Set `REVIEW_MODE=live` and the required variables from `.env.example` as server secrets. Never expose the API key, counter token or challenge secret through `NEXT_PUBLIC_*`. Use the default Astra/medium/standard configuration unless an explicit calibration decision changes it. There is no automatic Sol or Anthropic fallback.

Set `REVIEW_TIMEOUT_MS=900000` for the recommended 15-minute allowance. The SDK/transport and shared request deadline are aligned; a correction uses the remaining overall allowance. The hosting platform must permit this duration independently of the route's `maxDuration=960` declaration. Keep provider/body capture and SDK verbose logging disabled.

`ANALYTICS_ENABLED=true` stores numerical usage and validated scores in the configured Redis service until explicit operator deletion. Confirm Redis persistence, backups and eviction settings; there is no automatic cleanup or app record cap. Monitor capacity as the log grows. Collection can be disabled without deleting existing records. Verify CSV export, incomplete-usage reporting and explicit deletion against a separate synthetic test database before launch; do not run deletion against production records as a deployment check. Operator commands are in [README.md](README.md#private-numerical-analytics). No public analytics endpoint is exposed.

Run `npm ci`, tests, typecheck, lint and production build. Inspect an HTTPS synthetic request: browser → own API only, server → challenge/counter/OpenAI only. Verify that request/response bodies and prompts/quotes are absent from host logs, request tracing, APM, crash reporting and dashboard previews. Disable body capture and response caching, and document actual host metadata retention. Test bot denial, hostname/action mismatch, origin denial, daily-limit message, parallel allowance, lease expiry and a shared-office network.

## Conservative paid-call ceiling

Default global ceiling: **30 model calls per UTC day**, including reviews, example generation and their corrections. Reviews allow **12,000 output tokens**; example generation allows **20,000 output tokens** on fixed `gpt-6.1-sol` with low reasoning. These limits include billable reasoning. SDK hidden retries are disabled. The app caps serialized model parameters at 123,904 UTF-8 bytes and reserves an additional 4,096-token framing allowance, conservatively budgeting 128,000 input tokens. BPE text tokens are bounded by source bytes; confirm framing/actual usage with the installed SDK/model before relying on a published estimate. Transcript input itself is at most 64 KB; streamed API body is at most 80 KB.

Official standard prices checked on 2 October 2026: [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra) input $10 / million, cache write $12.50 / million, output $50 / million. Use the higher cache-write input price for a conservative exposure bound:

```text
Astra per call: 128,000 × $12.50 / 1m + 12,000 × $50 / 1m = $2.20
Astra default daily call ceiling: 30 × $2.20 = $66.00

Sol per call: 128,000 × $2.50 / 1m + 12,000 × $10 / 1m = $0.44
Sol generation per call: 128,000 × $2.50 / 1m + 20,000 × $10 / 1m = $0.52
All-Sol worst-case daily ceiling including generation: 30 × $0.52 = $15.60
```

Sol pricing: [official model page](https://developers.openai.com/api/docs/models/gpt-6.1-sol). These are deliberately generous technical bounds, not measured meeting costs or billing guarantees. They assume current standard pricing below long-context premium thresholds and exclude infrastructure, tax or other account charges. A generation call is below the default Astra review ceiling, so the conservative US$66 daily maximum still covers a mixture of both at the default global allowance. A request may reserve two calls; failed/ambiguous requests still consume allowance. Raising input/output/call limits or changing model/prices requires recomputing exposure. Budget alerts alone are not used as a hard spend control.

The SDK request uses `service_tier: default`, foreground `background:false`, `store:false`, medium reasoning and strict structured output, with no tools. `store:false` does not promise zero provider retention. Confirm actual OpenAI data controls, account exceptions and host retention before publishing privacy promises. Do not advertise legal compliance certification.

Public deployment, paid provisioning and real-client submissions were not authorised in this build. Prepare a reviewable private preview first and obtain the operator’s launch decision.
