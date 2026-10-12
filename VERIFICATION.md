# MVP verification

Documentation updated 12 October 2026. Evidence below separates fresh local checks, the owner's deployment reports and historical checks. The actual CRM directory was not accessed or changed. The unchanged implementation baseline is `fa3db03`; fresh GitHub `main` at `e30ec35` was inspected on 12 October after the owner cloned it through their Mac Terminal.

## Completed locally on 12 October 2026

- `npm run test`: **100 tests passed in seven files** using synthetic fixtures and mocked providers.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; home, privacy, review and example routes built successfully.
- These checks ran on the locally installed Node 25.5.0. The Render setup instructions specify Node 24.21.0; host runtime and behaviour have not been independently verified.
- No paid API request or real client content was used. No runtime code, rubric, prompt or privacy UI change was made by this documentation refresh. PDF/document rendering and full interactive browser tests were not rerun.

## Owner-reported setup on 12 October 2026

- Owner supplied `https://meeting-coach-0f6x.onrender.com` and reported deployments after adding Upstash credentials and the OpenAI key. The Render setup screenshot showed the $7/month plan selected. The owner later confirmed the site opens in their browser; this does not verify AI requests.
- Owner obtained Turnstile keys and was guided to add them, the exact hostname and `APP_ORIGIN` in Render. Successful verification is not established.
- Upstash setup screenshot showed Frankfurt (`eu-central-1`), pay-as-you-go $0.20/100K commands and no maximum budget set at that point. Eviction was off on the initial screenshot and instructed to remain off. Final settings and data lifecycle are not audited.
- OpenAI permissions screenshot showed Restricted, Responses Write and all other displayed permissions None. The owner reported adding the resulting key and deploying; the key value was not inspected. Dedicated project selection, billing, expiry and model access remain unverified.
- Owner explicitly selected `gpt-6.1-sol` for pilot reviews. The model override, 10-call suggested allowance, random limiter secret and remaining non-secret environment values have not been inspected. Last instructed `REVIEW_MODE` is `demo`; no switch to live or successful paid review is recorded.
- Public operator name/email and confirmation of Render's region were requested but not supplied.

## Access limitations observed on 12 October 2026

- Web-tool requests could not load the new Render URL; shell `curl` failed DNS resolution. Computer-use attempts found no available browser. These failures do not establish that the deployed service is down.
- Agent-shell `git ls-remote` could not resolve `github.com`; the owner's Mac Terminal succeeded and cloned `main` at `e30ec35aba30ed8e8567081dd06bc394b513d894`. The agent inspected the checkout and confirmed all eleven targeted files matched the pre-edit backups. The intervening commit changes documentation/provenance only. The `docs/render-pilot-20261012` branch was prepared in that checkout; check GitHub for publication/merge state. The app workspace itself has no `.git`.
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
3. **Hosted pilot.** Verify the owner-provided Render URL, HTTPS, the fixed public origin, Turnstile, shared Redis counters, trusted proxy configuration (including forged-header behaviour) and the 15-minute provider deadline. Verify analytics persistence/export and explicit deletion using a separate synthetic test database; ensure service eviction and backup settings match retention until deletion. Inspect network traffic and host logging to confirm that content is not captured. Verify the OpenAI account's retention settings and complete the operator/host details before publishing the privacy wording.
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

This 12 October documentation refresh records the owner's Sol choice and deployment progress without changing source defaults or backdating live verification. The edits have been reconciled against freshly cloned GitHub `main` at `e30ec35`; inspect the prepared branch and PR before repeating publication work.
