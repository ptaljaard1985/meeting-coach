# Meeting Coach

Documentation updated 13 October 2026. The owner reports deploying the pilot at **https://meeting-coach-0f6x.onrender.com** and adding Upstash credentials and an OpenAI key; they also confirm the site opens in their browser. The owner switched to **live** mode on 12 October and the homepage has reported it since (rechecked 13 October); no hosted AI review has been verified yet. The owner selected **GPT-6.1 Sol / medium / standard** for pilot reviews. This requires an explicit Render environment override because the unchanged source and `.env.example` still default to Astra.

Fresh local verification on 12 October passed all 100 tests, TypeScript, ESLint and the production build. Hosted integrations, browser interaction, dependency audit and calibration remain outstanding. The documentation refresh was merged into GitHub `main` as `e05aacd` (PR #1) and the privacy-page operator section as `9941ab3` (PR #2). Start with [START_HERE.txt](START_HERE.txt), [HANDOFF_NOTES.txt](HANDOFF_NOTES.txt) and the current [deployment runbook](DEPLOYMENT.md).

Standalone, public-access adviser communication coaching. No CRM integration, account registration or saved meeting history. Transcript text and written reviews are not stored; live requests can contribute private numerical usage and scoring records. The same rubric applies to English, Afrikaans and mixed-language meetings, with original-language quotes and British English coaching. The owner removed the Afrikaans-specific criterion; this does not restrict transcript languages.

## Run locally

Use Node 24 LTS and npm. Dependencies are pinned with `package-lock.json`.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000. Default mode is **Synthetic preview**: load the supplied example, explicitly choose Adviser, mark Client A and Client B as clients, choose a couple meeting, tick the responsibility declaration, and review. Example scores are hand-authored and visibly labelled. Arbitrary transcripts cannot be graded by the demo.

For an opt-in real synthetic smoke test, securely put a dedicated OpenAI Platform key in `.env.local` and set `REVIEW_MODE=live`. Never use a CRM key or a Codex session credential. Local development permits an in-memory counter and no challenge; public production requires the configuration in [DEPLOYMENT.md](DEPLOYMENT.md). A review can make two paid model calls. There is no provider fallback. For the owner-selected pilot model, set `REVIEW_MODEL=gpt-6.1-sol` and `REVIEW_REASONING_EFFORT=medium` explicitly; example generation already uses Sol 6.1/low.

## Verify

```sh
npm run test
npm run typecheck
npm run lint
npm run build
npm run verify:pdf
npm run test:browser
```

PDF verification needs Poppler (`pdftotext`, `pdftoppm`) and writes synthetic reports/page renders into ignored `tmp/pdfs/`. Browser tests use Brave on this Mac; set `PLAYWRIGHT_EXECUTABLE_PATH` to a compatible Chromium binary on another machine. They start the production app on port 3100. If a server already runs there, Playwright reuses it. This sandbox may block opening a port; starting `npm run dev -- --port 3100` from your own terminal allows visual inspection but browser checks should ultimately be repeated against a production build.

Tests and runtime imports exclude `reference/` and `handoff/`. The supplied CRM extraction is reference material only. The actual CRM directory must never be accessed or changed. **Do not run `handoff/verify_bundle.py`: it automatically accesses original CRM paths and assumes an extraction-only directory.** The historical reference hashes were checked separately using only the local extracted files. `lib/rubric.json` is the operative 24-criterion rubric; handoff JSON preserves the former 25-criterion extraction.

The GitHub repository contains the standalone application, synthetic fixtures, handoff notes and finished design/scoring documents. The local `reference/` extraction is excluded from Git; it is not needed to build or run the app. The manifest and original handoff instructions describe historical local reference material.

## Example meeting generator

The button beside the transcript box generates a fresh fictional couple meeting in live mode, using `gpt-6.1-sol` through the normal OpenAI Responses API. It does not run the Codex coding agent or use a Codex subscription credential. No pasted content, local title or speaker selection is sent to generation.

The detailed prompt is in [lib/examples/prompt.ts](lib/examples/prompt.ts). Each click gets a fresh variation ID and changes the scenario from the preceding example. It requests a complete natural conversation with varied adviser strengths and missed opportunities across all seven sections. The server requires 6,300–7,700 spoken words, all three speakers and a transcript within 64 KB. Synthetic timestamps use 140 words per minute; these are explicitly labelled as simulated. Qualitative realism still needs human review.

Generation shares the review challenge, concurrency, network and daily call allowances. It uses foreground `store:false`, low reasoning, up to 20,000 output tokens and at most one correction call. Existing text stays intact on failure or cancellation. Live generation requires the dedicated Platform API key and production safeguards; the offline preview does not pretend to have generated an AI example.

## What it does

Local parsing supports speaker blocks, inline speaker labels and attributed VTT/SRT. It rejects unsupported/unparsed text and incomplete diarisation. All speakers require role confirmation. Observers remain in judge context but contribute no adviser/client speaking time. Couple scoring requires explicit couple context.

Reviews show seven categories, 24 criteria, exact source-linked quotes, deterministic conversation metrics and five takeaways. Unassessable categories are `n/a` and excluded from the equal-weight overall. AI score judgments can vary. See [SCORING_REVIEW.md](SCORING_REVIEW.md) for the current method and review points. The nine-page consultant pack is available as [PDF](output/documents/meeting-coach-scoring-guide.pdf) and [editable Word](output/documents/meeting-coach-scoring-guide.docx), with one page per category. `python3 scripts/document/verify_guide.py` checks its contents against the operative rubric.

Download PDF lazily loads a browser renderer and generates selectable text from the existing result. Downloads do not regrade. Input, local title, full result and download URLs are session-memory only. Clear and navigation release that state; downloaded files, numerical analytics and accepted provider requests remain outside Clear’s control.

Reviews and example generation have a **15-minute overall deadline**, including any correction. The SDK and HTTP headers/body deadlines match that allowance; route declarations allow 16 minutes for surrounding work. The waiting panel asks the user to keep the page open, avoid refreshing or navigating away, and wait until completion. Cancellation remains available. This uses a foreground request without a background worker; the selected host must permit that request duration.

## Private numerical analytics

With `ANALYTICS_ENABLED=true` and the project's Upstash Redis credentials configured, live AI requests record start/finish dates, server processing duration, review/example type, model, prompt/rubric versions, outcome, model-call attempts and returned token counts. Successful reviews also record the overall and seven category scores; unassessable scores remain blank. Each record has an independent random ID. No transcript text, names, meeting titles, quotes, written coaching, IP addresses, network identifiers or submission/report IDs are included. The offline demo and rejected submissions are excluded.

**Records stay until the operator deletes them.** There is no automatic expiry or record cap in the app. Redis must be configured to preserve its data without eviction, and its capacity must be monitored. There is no public analytics endpoint or dashboard; export and deletion use server credentials through the operator CLI:

```sh
npm run analytics:export
npm run analytics:export -- --out output/analytics/reviews.csv
# Explicitly deletes the numerical log; leaves quota and duplicate protections intact:
npm run analytics:delete -- --confirm-delete
```

The export includes a CSV and a console summary of request counts, outcomes, mean/median/95th-percentile duration and mean overall score. The default output directory is ignored by Git. Set `ANALYTICS_ENABLED=false` to stop future collection; it does not remove old records. Disable collection and let active requests finish before deletion if no subsequent record should be written. Exported CSV copies must be deleted separately.

Analytics are best effort: a storage failure does not discard a completed review. A `running` record can indicate an interrupted server request rather than active work. A request may involve two model-call attempts; these are separate from request counts. Missing provider usage is marked `usageComplete=false`, and known token totals are not a zero-cost claim or a billing ledger. No real records have been collected during this local verification.

The owner reports a Render deployment, but live provider access, account retention settings and deployed challenge/counter/host behaviour remain unverified. The operator (Rob Macdonald, rob@coachingwayofbeing.com) and Render's Frankfurt region were supplied on 12 October and are stated on the privacy page. See [ARCHITECTURE.md](ARCHITECTURE.md), [DEPLOYMENT.md](DEPLOYMENT.md) and [VERIFICATION.md](VERIFICATION.md).

## Finish deployment

The owner has completed account/key setup steps and reports deploying after the Upstash and OpenAI additions. Turnstile keys were obtained and Render configuration instructions supplied. The Upstash setup screenshot shows Frankfurt and pay-as-you-go pricing; the owner confirmed Render is also in Frankfurt. The OpenAI permissions screenshot shows Responses Write only. Secret values are not documented or available to the agent.

1. Check the remaining Render settings without revealing secrets: Sol review override, `LIMIT_KEY_SECRET`, exact HTTPS origin, documented Render proxy header and limits. The proposed pilot allowance is 10 model calls/day; the source/template default remains 30. Confirm the actual `REVIEW_MODE` rather than inferring it from a deploy.
2. The operator name/email and Render's Frankfurt region are now on the privacy page (notice `2026-10-12.1`). Still verify account-specific retention, host body/response logging and trusted proxy behaviour.
3. Live mode is on. Test the supplied fictional transcript and a separately generated example. Measure actual usage, timing, completeness and evidence. No successful paid call is recorded yet.
4. Complete browser/PDF interactions, hosted long-request/cancellation behaviour, shared quotas and numerical persistence/export/deletion using an isolated synthetic database. Run the outstanding dependency audit when registry access permits.
5. Have the consultant calibrate the selected Sol model against human labels before treating scores as a benchmark. The rubric and existing nine-page guide are unchanged.
6. PR #1 (docs, `e05aacd`) and PR #2 (privacy page, `9941ab3`) are merged. Check branch/PR state before publishing later changes, and preserve any remote changes.

The intended service configuration and dated cost examples are in [DEPLOYMENT.md](DEPLOYMENT.md). At the illustrative 20,000 ordinary input + 10,000 billed output tokens per Sol review, 100 reviews cost $14 in AI usage, or $21 including $7 Render compute, before Redis, tax, corrections, generation and overages. These are estimates, not measured app costs. See [official Sol pricing](https://developers.openai.com/api/docs/models/gpt-6.1-sol).

The owner confirms the site opens in their browser. Later on 12 October the agent also fetched the homepage (HTTP 200; mode `demo`, then `live` after the owner's switch); that is not an AI-request test. Use [VERIFICATION.md](VERIFICATION.md) to distinguish owner-reported setup, current local checks and remaining live work.

## Calibration (paid; never normal CI)

```sh
npm run calibrate -- --allow-paid
# Optional local human labels using score/criterion IDs from lib/rubric.json:
npm run calibrate -- --allow-paid --labels tests/fixtures/human-labels.json
```

This compares Astra and Sol on the **same supplied synthetic example**, with at most four calls. No hosted dataset is created. It reports actual token usage, latency, exact-evidence validation, n/a decisions and optional agreement with adviser labels. Rate coaching usefulness and semantic distinctness manually; unique titles alone cannot establish distinct ideas. Do not redirect real client content into this harness. The short example is a functional smoke test, not a quality benchmark.

The selected design combines Calm's separated panels with Editorial's burgundy and warm cream palette, Fraunces headings and IBM Plex Sans body text. Open the [combined HTML preview](output/design/meeting-coach-combined-style.html) or the [three original options](output/design/meeting-coach-style-options.html) locally; both are self-contained and make no AI calls. The app self-hosts its fonts under their included OFL licences. PDF generation uses built-in Helvetica/Times fonts and no font download. Licence copies are in `public/licences/`.

The scoring guide and HTML previews remain valid for rubric 1.1; they were prepared on 2 October and have not been redesigned or regenerated for the 12 October documentation refresh. Guide verification requires Python `python-docx` and Poppler. Its builder writes the Word document; the matching PDF needs rendering/export and visual QA before replacing it. The design-options builder also needs `tmp/layout/demo-review.json` and a separate font cache currently configured under `/private/tmp/meeting-coach-design-fonts/`; this cache can disappear between sessions. The committed previews embed their fonts and remain usable without it. These artifact-building prerequisites do not affect the normal app build.
