# Meeting Coach working instructions

This is an implemented standalone Next.js app. Start with `START_HERE.txt` and `HANDOFF_NOTES.txt`; use `VERIFICATION.md` to distinguish completed local checks from untested live behaviour.

## CRM boundary

The owner explicitly instructed: **never touch the CRM**. Do not access, read, search, modify or execute anything in `/Users/pierretaljaard/crm`; do not use its credentials, databases, transcripts or reports. Already extracted files in this project's local `reference/` directory may be read, but remain outside runtime imports and Git. Do not run `handoff/verify_bundle.py`: it automatically checks original CRM paths and is an obsolete extraction-only verifier.

## Accepted product decisions

- Preserve seven scoring sections and 24 criteria in `lib/rubric.json`, version 1.1. The Afrikaans-specific criterion is removed; English, Afrikaans and mixed-language support remains.
- Preserve the Calm panel layout with Editorial palette and type. The owner accepted the design for now.
- On 12 October 2026 the owner selected `gpt-6.1-sol` for pilot reviews, with medium reasoning and standard service. Set `REVIEW_MODEL=gpt-6.1-sol` explicitly: the existing code and `.env.example` still default to Astra, and this documentation update does not change runtime code. Fictional 45–55-minute examples remain fixed to `gpt-6.1-sol`, low reasoning. Use a dedicated OpenAI Platform key; no Codex credential or provider fallback.
- Keep foreground requests, the 15-minute overall deadline including corrections, and the waiting notice. No background worker is currently implemented.
- Keep transcript text, quotes and written reviews transient. Numerical analytics are private and retained **until the owner deletes them**, without automatic expiry. No public analytics endpoint is authorised by the existing scope.
- Version and document deliberate rubric/prompt/privacy changes. Do not silently change these decisions or restore old 25-criterion rules from handoff JSON.

## Verification and repository hygiene

Pilot setup is in progress at `https://meeting-coach-0f6x.onrender.com`. The owner reports deployment after adding Upstash credentials and the OpenAI key, and confirms the site opens in their browser; Turnstile keys were obtained and configuration instructions supplied. The last instructed mode is `demo`, not a verified live AI launch. Use `DEPLOYMENT.md` for the intended settings and evidence status. Never treat an instructed setting, account screenshot or successful build as proof of a working paid request. The public operator name/contact and Render region are still awaiting confirmation.

Run checks appropriate to the change. Normal code checks are `npm run test`, `npm run typecheck`, `npm run lint` and `npm run build`. Browser/PDF checks and paid calibration have separate prerequisites documented in `VERIFICATION.md` and `README.md`. Use synthetic fixtures; do not make paid calls or submit real client data merely to verify a documentation change.

Keep credentials, `.env.local`, numerical exports, `node_modules`, `.next`, temporary fixtures and document lock files out of Git. The upstream is `https://github.com/ptaljaard1985/meeting-coach.git`, branch `main`; fetch and inspect it before pushing. The workspace may lack a writable `.git`; use a fresh checkout in a permitted directory if necessary, compare files, and never assume a previous `/private/tmp` checkout still exists. Do not overwrite remote changes or force-push.
