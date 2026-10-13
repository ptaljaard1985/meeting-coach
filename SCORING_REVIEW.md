# Scoring review: discussion draft

Status reviewed 12 October 2026: the consultant has not yet supplied labels or approved rubric changes. The nine-page [PDF guide](output/documents/meeting-coach-scoring-guide.pdf) and [editable Word guide](output/documents/meeting-coach-scoring-guide.docx), prepared 2 October, explain the current seven sections and 24 criteria one section per page. All refinements below remain proposals.

The owner selected `gpt-6.1-sol` with medium reasoning and standard service for the Render pilot on 12 October, after discussing cost. This supersedes the earlier Astra deployment preference; it is not evidence of scoring equivalence, a completed calibration or a runtime-code change. The review model must be explicitly configured in Render because the source/template default is still Astra. No successful live review has been verified. The rubric, prompt, scoring guide and disclosure versions remain unchanged.

The owner confirmed that all seven sections should remain and requested a consultant guide to each section and its method. The Afrikaans-specific Plain language criterion was removed; the other 24 criteria remain. English, Afrikaans and mixed-language meetings use the same rubric, as required by the seed brief. The original handoff files remain as provenance.

The current implementation retains the extracted categories while we review them. It has 24 criteria, a 1–5 category score, equal category weights and a server-calculated mean excluding n/a. The AI applies low/mid/high category anchors; criteria use Met / Partially met / Not met / Not assessable, with source evidence. Scores are model judgments, not arithmetic averages of the criterion verdicts.

| Current category | What it measures | Review point |
| --- | --- | --- |
| Human before agenda | Check-in, acknowledgement and client-shaped agenda | Useful and observable. A transcript excerpt beginning mid-meeting cannot fairly judge the opening. |
| Listening share | Talk share, follow-up questions, reflections, checks during explanations | Separate metrics from listening quality. A technical explanation may appropriately increase adviser talk. |
| Behavioural coaching moments | Naming concern, plan-based reassurance, rehearsing turbulence | Conditional on a relevant opportunity. A routine administrative meeting should not lose points for no anxiety or market discussion. |
| Plain language | Understandable explanations and checks for understanding | Keep; do not assume a client understood simply because they said yes. |
| Agreements & adherence | Actions, owners, deadlines and obstacles | Consider the clearer name “Decisions & next steps”. This is communication, not a compliance or suitability assessment. |
| Anchored to their why | Connecting discussion to goals and values | Useful; avoid counting the same reflective moment as strong evidence for every category. |
| Both voices | Participation and confirmation by each partner | Couple-only. Keep separate from the overall if comparing solo and couple meetings over time. An observer is never a spouse. For a couple on one device (one shared client label), only criteria 2 and 3 are scored, so compare those scores with care. |

Recommended method for discussion:

- Define all five score levels explicitly: 1 clear counter-evidence; 2 inconsistent/mostly missed opportunities; 3 competent; 4 strong and consistent; 5 exceptional and repeatedly evidenced. The shipped rubric currently defines low/mid/high only; do not imply it already has five calibrated anchors.
- Keep “no opportunity” and “not visible in this excerpt” as n/a, with the reason shown. A genuine missed opportunity needs the relevant interaction, not an assertion about missing behaviour.
- Show category scores to one decimal at most; the overall is an orientation aid, not a scientific measurement. Avoid converting it to a percentage or letter grade.
- Show how many categories/criteria were assessable alongside the overall. A 4 from limited evidence should not look equivalent to a 4 from a complete meeting.
- Retain five concrete takeaways with the first describing something that worked. Keep exact evidence available directly beneath each criterion.
- Calibrate the selected Sol pilot model on a small, varied set of synthetic or expressly authorised redacted meetings with adviser labels. Compare evidence fidelity, n/a fairness and coaching usefulness before treating its scores as a benchmark or making further model/weight changes.

These are proposed refinements, not silent rubric changes. Replacing category names, criteria, anchors or aggregation requires a new rubric/prompt version and an explicit decision after this review.

For the next session, first ask the consultant to review the guide and score a small, varied fictional meeting set independently. In particular, settle how the Listening share anchors apply at exactly 45% and 65% adviser share; the current boundaries overlap. Check solo/couple and missing-opportunity n/a decisions, evidence fidelity and usefulness of the five takeaways. Compare Astra and Sol on the same source only after live model access is configured. Record proposed changes separately, then update `lib/rubric.json`, prompt/provenance, tests and both guide formats together after the owner decides.
