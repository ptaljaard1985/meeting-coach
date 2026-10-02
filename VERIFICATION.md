# MVP verification

Recorded 2 October 2026. These checks use synthetic content only. The actual CRM directory was neither accessed nor changed.

## Completed

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

1. **Live OpenAI behaviour.** No dedicated Platform API key was supplied and no paid calls were made. Run a synthetic end-to-end review and example generation, then compare Astra and Sol against human labels. Measure actual cost, latency, evidence accuracy, usefulness and variation between generated meetings. Passing schema tests does not establish model quality.
2. **Full interactive browser flow.** Playwright tests are implemented, but the sandbox rejected the local server bind with `EPERM`; a headless browser launch was also blocked. Run `npm run build` followed by `npm run test:browser` in an environment that permits the server and browser. Check PDF download, keyboard navigation, cancellation, Clear, refresh and back/forward navigation.
3. **Public deployment.** Verify HTTPS, the fixed public origin, Turnstile, shared Redis counters, trusted proxy configuration and the 15-minute provider deadline on the chosen host. Verify analytics persistence/export and explicit deletion using a separate synthetic test database; ensure service eviction and backup settings match retention until deletion. Inspect network traffic and host logging to confirm that content is not captured. Verify the OpenAI account's retention settings and complete the operator/host details before publishing the privacy wording.
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

Use Node 24 LTS. PDF checks require Poppler. Paid calibration is separate and opt-in; see `README.md`. Do not run the historical handoff verifier against the CRM.
