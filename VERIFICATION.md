# MVP verification

Documentation updated 13 October 2026. Evidence below separates fresh local checks, the owner's deployment reports and historical checks. The actual CRM directory was not accessed or changed. The unchanged implementation baseline is `fa3db03`; fresh GitHub `main` at `e30ec35` was inspected on 12 October after the owner cloned it through their Mac Terminal.

## PDF fixed and redesigned as a slide deck, 13 October 2026

- First paid hosted review: the owner's screenshot showed a completed review page ("Your meeting review", title "Second Opinion") for a real Fathom transcript set up as a couple on one device. Duration, the model line and the Both voices output were not reported. This is the first evidence that a paid hosted review completes.
- The same screenshot showed "The PDF could not be prepared." Root cause, reproduced in headless Brave against a local production build: the PDF layout engine (yoga-layout 3.2.1 inside @react-pdf/renderer 4.9.0) compiles WebAssembly, and the production CSP lacked `'wasm-unsafe-eval'`. Development adds `'unsafe-eval'`, which hid the problem. The PDF had never worked in a production browser. Fix: `'wasm-unsafe-eval'` added to `script-src` in `proxy.ts`; it permits WebAssembly compilation only, not JavaScript eval. The engine's first attempt to fetch its embedded `data:` module is still refused by `connect-src` and logged in the console; its fallback then succeeds. Browsers without `'wasm-unsafe-eval'` support (for example Safari before 16) would still fail.
- Correction: earlier entries today called the browser full-flow failure ("timeout waiting for the PDF download") an existing test issue. It was this production defect and should have been investigated then. The other earlier failure (two `alert` roles) was a test selector also matching the Next.js route announcer; the test now targets `.error[role=alert]`.
- The owner asked for a PowerPoint-style landscape design. `lib/pdf.tsx` now renders a 960 × 540 pt (16:9) deck: title with overall score; scores at a glance with "Something to keep doing"; the conversation in numbers; a takeaways overview and one slide per takeaway; one slide per category (criteria with verdict badges, rationale and quotes, continuing under the same header when long); and "About this review" with provenance and disclaimers. Fraunces and IBM Plex Sans (latin subsets, OFL) are bundled from `lib/pdf-fonts/`; generating a PDF fetches only same-origin `/_next/` scripts and those fonts.
- react-pdf quirks, recorded in code comments: a non-wrapping page is sized to its content, which misplaces the footer, so every slide wraps; with a page `lineHeight`, a footer anchored with `bottom` disappears, so it is anchored from the top; an in-flow `fixed` header and `minPresenceAhead` cause early breaks, so the category header is absolutely positioned and the hint is not used.
- Checks: `npm run test` (107 tests), typecheck, lint and build passed. `npm run verify:pdf` (now using reading-order text) found all 7 categories, 24 criteria and 5 takeaways in the standard and long synthetic decks, with no overflow warnings. `npm run test:browser` passed all 7 tests for the first time, including the full flow that downloads a PDF (21 slides; `pdffonts` shows the fonts embedded and subset). Twenty-one unusual-character cases rendered without error; glyphs outside the latin subset (arrows, emoji, Greek, Cyrillic) are not drawn.
- Not verified: the PDF on the hosted site after deploy, and Safari or Firefox.

## Couple on one device, 13 October 2026

- PR #6 (`2f44978`) merged at 10:11 SAST. The owner's next screenshot of the hosted site showed "skipped 2 lines before the first speaker", so the heading fix is live. The agent's own script-chunk check reported otherwise; that check was faulty.
- The same screenshot showed two clients who joined from one computer, so the export has both partners under one label and "A couple" was refused. Interim advice was "Other client meeting". The owner then chose a dedicated meeting type with Both voices partly scored.
- Changes: new context `couple_shared`, shown as "A couple on one device (one shared label)", requiring exactly one client label. Both voices may be assessed on criteria 2 and 3 only. Validation rejects any verdict on criteria 1 or 4 (`shared_label_scope`), and the client balance ratio stays null. Prompt rule 8 was rewritten and `PROMPT_VERSION` moved to `meeting-coach-openai-2.3`; rubric 1.1 is unchanged. A one-label "A couple" error now points to the new type.
- `npm run test` (107 tests, two new), typecheck, lint and build passed.
- Not verified: live model behaviour with `couple_shared`, and calibration of the partial Both voices score. Both voices scores from shared-label and two-label couples are not like-for-like.

## Export headings and flexible headers, 13 October 2026

- PR #5 (`3c2f220`) merged at 09:59 SAST. By 10:01 the hosted page and its parser script showed the 160 KB limit (checked from the agent shell).
- The owner then reported, with a screenshot, that a Fathom export's opening lines (meeting title, "VIEW RECORDING … : link", `---`) produced "Some transcript text could not be attributed". The title line was also being read as a speaker block.
- Changes: divider lines (`---`, `***`, `===` and similar) are read as blank lines. Around a timestamped conversation, untimestamped leading or trailing "turns" by labels that never speak inside it are treated as headings. Up to ten short (at most 300 characters) unattributed lines before the first turn or after the last are skipped and reported in the status line, for example "skipped 2 lines before the first speaker". Speaker blocks also accept `Name  0:03`, `Name - 0:03` and `Name (0:03)` headers. Unattributed text inside the conversation is still refused; the local error now gives the line number and quotes the line, while the server keeps its generic message. Segment IDs are renumbered after skipping.
- `npm run test` (105 tests, including five new parser cases), typecheck, lint and build passed. Synthetic 74 to 180-minute meetings with a Fathom-style heading parsed with two lines skipped. Browser suite: the five responsive tests passed; the same two existing failures remain.
- Not verified: real exports from other tools (Otter, Zoom, Teams) beyond the synthetic header shapes, and a paid review of a long transcript.

## Transcript size and header format, 13 October 2026

- The owner reported, with a screenshot, that a long transcript pasted into the hosted site showed "This transcript is too large". The text box silently cut pastes at 64,000 characters, and the parser then refused the remainder as over 64 KB. Separately, the parser read each `H:MM:SS - Name (Organisation)` header line as the speaker's name, so every turn became a new speaker (or, past six words, was left unattributed). Only synthetic text was used for the checks below.
- Changes: speaker blocks accept a `H:MM:SS - Name` header (optional brackets; hyphen, en or em dash; name up to 80 characters and ten words) with the speech on the following lines. Transcript limit 160 KB, body 200 KB, review request cap 267,904 bytes (below Sol's 272K-token long-context tier). Examples keep the 123,904-byte cap through `MAX_EXAMPLE_PROMPT_BYTES`. The text box no longer truncates, and the size error states the actual and maximum size.
- Synthetic 74, 120, 150 and 180-minute meetings in that header style parsed as two speakers and produced review requests of 101, 152, 186 and 220 KB. A 200-minute one (168 KB) was refused with the new message.
- `npm run test` (101 tests, seven files), typecheck, lint and build passed. Browser suite with the same `APP_ORIGIN` setup: the five responsive tests passed; the same two existing failures remain.
- Stop local servers by port (`lsof -tiTCP:3100 -sTCP:LISTEN | xargs kill`). Next renames its process to `next-server`, so `pkill -f "next start"` can leave a stale server holding the port, and later test runs then hit old code.
- Not verified: a paid review of a long transcript (duration against the 15-minute deadline, output quality, actual token usage). No rubric, prompt or privacy change.

## Input-page layout change, 13 October 2026

- At the owner's request the input page became three numbered steps stacked down the page: Your transcript (rose tint), Meeting context (new sage tint) and Confirm and review (cream). The meeting-context select is now labelled "Meeting type", and the transcript box takes its name from the "Your transcript" heading. `--color-boundary` moved from `#93877c` to `#857a70` so field borders keep at least 3:1 contrast on both tints. No rubric, prompt, privacy wording, server or API change.
- `npm run test` (100 tests, seven files), typecheck, lint and build passed on Node 25.5.0.
- `npm run test:browser` ran locally (Brave, headless) against a demo server started with `APP_ORIGIN=http://127.0.0.1:3100`. Without that value every review in the suite is rejected by the origin check, because the local Next server reports its own URL as `localhost` while the tests open `127.0.0.1`. The five responsive tests (320 to 1440 px) passed. Two tests failed in the same way on an untouched clone of `main` at `e0f6cdc`: the full-flow test times out waiting for the PDF download event, and the error/cancel test finds two `alert` roles (the app's error message and the Next.js route announcer). These are existing test issues, not caused by the layout change.
- Merged as PR #4 (`587f288`) at 09:45 SAST. The hosted homepage served the three-step markup and the sage stylesheet about 40 seconds later (checked from the agent shell, not in a browser).

## Completed locally on 12 October 2026

- `npm run test`: **100 tests passed in seven files** using synthetic fixtures and mocked providers.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; home, privacy, review and example routes built successfully.
- These checks ran on the locally installed Node 25.5.0. The Render setup instructions specify Node 24.21.0; host runtime and behaviour have not been independently verified.
- No paid API request or real client content was used. No runtime code, rubric, prompt or privacy UI change was made by this documentation refresh. PDF/document rendering and full interactive browser tests were not rerun.

## Later checks on 12 October 2026

- After the owner supplied the operator details and confirmed Render Frankfurt, `app/privacy/page.tsx` gained a "Who runs Meeting Coach" section and `NOTICE_VERSION` moved to `2026-10-12.1`. `npm run test` (100 tests, seven files), typecheck, lint and build passed again, and a local production server rendered the new section at `/privacy`. PR #2 merged it as `9941ab3`; the hosted `/privacy` page showed the section about 90 seconds after the merge (rechecked 13 October).
- The agent shell reached GitHub: PR #1 (`docs/render-pilot-20261012`) was merged at 17:12 SAST as `e05aacd`, a merge commit with no further changes.
- The agent fetched the hosted homepage: HTTP 200 through Cloudflare to Render, `no-store` and CSP headers present, a Turnstile site key in the page, and mode `demo`. This shows the site is up in demo mode. It does not verify AI requests, Redis, the Turnstile secret or the environment values.
- The owner asked to switch to live mode and was given the Render steps. A later check on 12 October showed mode `live`, and it was still `live` on 13 October. This confirms the mode only; it does not show that each credential is correct or that a paid review succeeds.

## Owner-reported setup on 12 October 2026

- Owner supplied `https://meeting-coach-0f6x.onrender.com` and reported deployments after adding Upstash credentials and the OpenAI key. The Render setup screenshot showed the $7/month plan selected. The owner later confirmed the site opens in their browser; this does not verify AI requests.
- Owner obtained Turnstile keys and was guided to add them, the exact hostname and `APP_ORIGIN` in Render. Successful verification is not established.
- Upstash setup screenshot showed Frankfurt (`eu-central-1`), pay-as-you-go $0.20/100K commands and no maximum budget set at that point. Eviction was off on the initial screenshot and instructed to remain off. Final settings and data lifecycle are not audited.
- OpenAI permissions screenshot showed Restricted, Responses Write and all other displayed permissions None. The owner reported adding the resulting key and deploying; the key value was not inspected. Dedicated project selection, billing, expiry and model access remain unverified.
- Owner explicitly selected `gpt-6.1-sol` for pilot reviews. The model override, 10-call suggested allowance, random limiter secret and remaining non-secret environment values have not been inspected. The owner later switched `REVIEW_MODE` to `live` (confirmed on the hosted homepage); no successful paid review is recorded.
- The owner supplied the public operator (Rob Macdonald, rob@coachingwayofbeing.com) and confirmed Render's region as Frankfurt.

## Access limitations observed on 12 October 2026

- Earlier on 12 October, web-tool requests could not load the new Render URL; shell `curl` failed DNS resolution. Computer-use attempts found no available browser. These failures do not establish that the deployed service is down.
- Agent-shell `git ls-remote` could not resolve `github.com`; the owner's Mac Terminal succeeded and cloned `main` at `e30ec35aba30ed8e8567081dd06bc394b513d894`. The agent inspected the checkout and confirmed all eleven targeted files matched the pre-edit backups. The intervening commit changes documentation/provenance only. The `docs/render-pilot-20261012` branch was prepared in that checkout; it was later merged as `e05aacd` (PR #1). The app workspace itself has no `.git`.
- Current dependency audit, live OpenAI/Redis/Turnstile integration, hosted proxy and long-request behaviour remain unverified. Prior sandbox browser restrictions are recorded below, not claimed as a fresh browser test failure.

## Historical checks completed on 2 October 2026

- **100 unit and component tests passed** across seven files. Coverage includes parsing and role-aware metrics; seven-category/24-criterion validation; exact evidence matching; bounded requests, cancellation, timeout and retry behaviour; quota enforcement with test adapters; example generation contracts; and preservation of pasted text after generation failure or cancellation.
- Fake-clock tests confirm both review and example generation can continue beyond the former three-minute and SDK ten-minute defaults, then stop at the shared 15-minute deadline even when a correction has begun. Waiting-message and cancellation state are checked in component tests. SDK/Undici transport options are explicitly aligned, but a live hosted long request has not been exercised.
- Numerical analytics tests cover the strict content-free projection, independent IDs, both attempts' returned usage, validated scores only, safe failure outcomes, interrupted-request records, disabled collection and best-effort storage failure. Redis command-adapter tests check PERSIST without expiry, 501-record cursor export and deletion of only analytics keys. CSV tests preserve n/a blanks and distinguish requests, model attempts and incomplete usage. These are synthetic adapters, not a live Redis integration check.
- TypeScript, ESLint and the Next.js production build passed. The build includes the home, privacy, review and example routes.
- PDF content checks passed for a seven-page standard report and fourteen-page long-content report: seven categories, 24 criteria and five takeaways remain present as selectable text. First-page visual inspection confirmed separation between headings, values and the footer.
- The consultant guide passed its content and pagination checks: nine pages, with one page for each of the seven categories, all 24 criteria and all 21 scoring anchors. Every guide page was visually inspected; the PDF and editable Word file are synchronised.
- The selected Calm layout with Editorial colours and type was visually inspected in Safari. Actual server-rendered home, results and waiting markup, styles and local fonts were inspected in offline fixtures at **320, 375, 414 and 768 px**. All twelve fixtures reported no horizontal overflow or clipped controls. These fixtures are not hydrated and do not establish browser interaction correctness.
- The new waiting panel was visually inspected at 320 px in Safari; its instruction text wraps within the panel and Cancel remains separate and visible.
- The standalone design options were checked for all three styles and both transcript/results views, including seven categories, 24 criteria and five takeaways. Their controls were checked in a DOM harness. The combined preview was visually inspected in Safari.
- The dependency audit before the timeout transport change reported zero vulnerabilities. The new pinned Undici 7.28.0 dependency was installed from the existing npm cache; a fresh network-backed audit remains to be run because registry access was unavailable.
- All 30 supplied reference and handoff file hashes match the local manifest. This check read only the extracted files inside this workspace. Selected body, muted-text and accent combinations exceed 4.5:1 contrast; the control boundary exceeds 3:1 against its surface.

## Still to verify

1. **Live OpenAI behaviour.** The owner reports installing a dedicated key in Render, but access to the selected Sol model and a successful paid request remain unverified. Confirm the explicit Sol environment override, then run a fictional end-to-end review and example generation. Measure actual cost, latency, evidence accuracy, usefulness and variation. Compare against human labels; passing schema tests does not establish model quality.
2. **Full interactive browser flow.** Playwright tests are implemented, but the sandbox rejected the local server bind with `EPERM`; a headless browser launch was also blocked. Run `npm run build` followed by `npm run test:browser` in an environment that permits the server and browser. Check PDF download, keyboard navigation, cancellation, Clear, refresh and back/forward navigation.
3. **Hosted pilot.** Verify the owner-provided Render URL, HTTPS, the fixed public origin, Turnstile, shared Redis counters, trusted proxy configuration (including forged-header behaviour) and the 15-minute provider deadline. Verify analytics persistence/export and explicit deletion using a separate synthetic test database; ensure service eviction and backup settings match retention until deletion. Inspect network traffic and host logging to confirm that content is not captured. Verify the OpenAI account's retention settings. The operator/host privacy section (notice `2026-10-12.1`) is now live on the hosted page.
4. **Scoring calibration.** A consultant should review the category anchors and applicability rules using the scoring guide, then independently label several varied synthetic meetings. The listening-share anchors have an overlap identified in `SCORING_REVIEW.md`; resolve this through the rubric review before treating scores as a reliable benchmark.

## Reproduce

```sh
npm ci
npm run test
npm run typecheck
npm run lint
npm run build
npm run verify:pdf
python3 scripts/document/verify_guide.py
npm run test:browser
```

Use the documented Node 24 LTS target. Report-PDF checks require Poppler; consultant-guide checks also require Python `python-docx`. Paid calibration is separate and opt-in; see `README.md`. **Do not run `handoff/verify_bundle.py`: it automatically accesses original CRM paths and assumes the pre-build extraction-only directory.** Preserve the source manifest as provenance; a check of extracted hashes must read only this project's local files.

## Documentation and repository continuity

The initial implementation was pushed to GitHub `main` on 2 October as `fa3db03fb283a622074135854bf651d62b3c3ccf`, including app source, tests, synthetic fixtures, design previews and scoring guide. The CRM extracts, credentials, analytics exports and temporary test/build files were excluded. A fresh checkout fetched on 7 October confirmed that baseline. `START_HERE.txt`, `HANDOFF_NOTES.txt` and `AGENTS.md` provide the restart path; historical 25-criterion handoff JSON must not replace the operative 24-criterion rubric.

This 12 October documentation refresh records the owner's Sol choice and deployment progress without changing source defaults or backdating live verification. The edits have been reconciled against freshly cloned GitHub `main` at `e30ec35`; that branch was later merged as PR #1 (`e05aacd`), and the privacy change as PR #2 (`9941ab3`). Check GitHub branch/PR state before repeating publication work.
