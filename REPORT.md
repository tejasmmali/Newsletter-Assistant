# Overnight report

Times below are Asia/Calcutta (UTC+5:30). The preview brief measurements are durations, not clock times.

## 1. Outcome

Shipped to production: yes.

- Pull request: https://github.com/tejasmmali/Newsletter-Assistant/pull/2
- Production URL: https://newsletter-assistant-navy.vercel.app
- Production deployment: `dpl_CJoKWA6p1AQq8VyWjmE8Tvuizykw` (commit `5828afc` on `main`). Ready, and the `newsletter-assistant-navy.vercel.app` alias points at it.
- Preview deployment exercised for T1–T7: `dpl_GqjXnHF1GUtssw7boPcs477RyrJB` (commit `3711448`, branch `ui-redesign`)
- Earlier preview on the same branch alias: `dpl_3bc3LLwsaXKUWhhScTzD8F2phtus` (commit `87d0481`)
- Rollback target, not used: `dpl_7stwB5cD31vbhDxj1ymyAidbbpEz` (previous production deployment, commit `c4944b6`)

Production smoke on the navy alias: `/research` and `/write` returned 200 and rendered the new headings. `POST /api/ingest` with no token returned 401. `POST /api/brief` returned 200 in 10.9 seconds (`latency_ms` 9563, 3 sources, 12 claims, 8 verified, 4 unverified, 3 angles). `POST /api/rewrite` returned 200 in 1.0 second with `guard_rejected: true` and the original sentence kept, including `$40 million`, `reportedly`, `may`, `RLHF`, `OpenAI`, `12%`, and `2026`.

## 2. Tests

| Test | Result | Attempts | Fix commit |
| --- | --- | --- | --- |
| `npm run check` | Pass. typecheck, lint, 18 unit files / 61 tests, 3 Playwright tests. | 1 on the final code (earlier UI lint and e2e selector fixes were before this) | `87d0481` for the redesign; e2e selectors updated in that commit |
| T1 smoke, no console errors, 390px | Pass on the preview. `/research` and `/write` returned 200. No page errors. Header fits at 390px. | 1 | — |
| T2 security | Pass. `POST /api/sources` with a link-local URL returned 400 `invalid_url` / “Blocked private or local URL (SSRF).” `POST /api/ingest` with no token returned 401 `Unauthorized`. Eleven client scripts on `/write` contained no `GEMINI_API_KEY`, `INGEST_TOKEN`, `SUPABASE_SERVICE_ROLE`, or `AIza` substring. Anonymous Supabase select returned `[]`. Anonymous insert returned 401, row-level security violation. | 1 | — |
| T3 ingest three sources plus VC Corner | Pass. Bernama, IPO Scoop, and Finimize saved as Ready (746, 314, and 681 words). VC Corner saved as Needs text: “This looks truncated (subscribe to continue).” | 1 | — |
| T4 brief under 45s | Pass. With the three Ready sources, the preview rendered angles in 12.1s and again in 10.1s. Meta on the first of those: 3 sources, 9 verified claims, 3 unverified. | 2 measured runs. An earlier checker exited in 30ms because an existing alert matched, while the skeletons were already on screen. A six-source duplicate set was not used for the timed run. | — |
| T5 failure and retry | Pass. A forced 429 response showed “Try again in a minute (Gemini free tier).” and a Retry button. Retry then ran the real brief. | 1 | — |
| T6 writing assistant | Pass on `3711448`. 26 quoted originals were all substrings of the draft. Get AI rewrites enabled 15 Accept buttons and showed 14 AI badges. Three accepts changed Compare (2,473 chars vs 2,421 after revert). Metrics show before → after and the “Rough signal only” caveat. Revert all restored the working draft. | 1 product fix. The first preview kept Revert all inside the Editor tab, so it was hidden on Metrics. | `3711448` |
| T7 rewrite guard | Pass. Preview `POST /api/rewrite` returned 200. The model’s rewrite was rejected (`guard_rejected: true`) and the stored sentence stayed identical, so `$40 million`, `reportedly`, `may`, `RLHF`, `OpenAI`, `12%`, and `2026` survived. | 1 | — |
| Lighthouse accessibility | Pass. Local `/research` 100, local `/write` 100 (accessibility category only). | 1 | — |

## 3. Screenshots, Lighthouse, check

Screenshots in `docs/screenshots/`:

- `research-light-desktop.png`, `research-dark-desktop.png`, `research-light-390.png`, `research-dark-390.png`
- `write-light-desktop.png`, `write-dark-desktop.png`, `write-light-390.png`, `write-dark-390.png`

Live preview captures from this run are not committed. They showed the three Ready rows, the VC Corner paste box, the brief skeletons, and the rate-limit retry.

Lighthouse accessibility: research 100, write 100.

`npm run check` on commit `3711448`: `tsc --noEmit` clean, `eslint` clean, Vitest 18 files / 61 tests passed, Playwright 3 tests passed.

## 4. Bugs, leftovers, rows

Fixed in the UI pass:

- Playwright strict-mode clashes after the redesign (duplicate “Load example draft”, the claims table plus the mobile cards, the error toast plus the alert). Selectors were narrowed. Tests were not weakened.
- Theme icon hydration mismatch. The sun/moon icons are now toggled with the `dark` class instead of rendering a different icon on the server.
- Severity dots used `aria-label` on a span. They now have `role="img"`.
- The 390px header wrapped the wordmark. It is now one line, and the Theme menu is hidden under `sm` because the icon toggle remains.
- Revert, Accept all, and Get AI rewrites were inside the Editor tab, so they disappeared on Compare and Metrics. They sit above the tabs now.

Not a product bug: the first brief timing run included duplicate Ready rows (the ingest was executed twice against the same table). Duplicates were deleted before the timed run. Gemini was not “fixed” for slowness; the three-source brief was simply fast.

Still unverified:

- `POST /api/ingest` with the real bearer token. The token is a Vercel secret and was not decrypted. Without a token the route correctly returns 401.
- The bookmarklet, for the same reason.
- GitHub CI on the pull request had been subscribed to, and the result is recorded here only if it arrived before this file was written. Absence of a CI line means the check had not reported yet.

Rows: the four test URLs (Bernama, IPO Scoop, Finimize, VC Corner) were deleted after the production smoke test. A following `count(*)` on `public.sources` returned 0. The demo table starts empty.

## 5. Morning TODO (only you can do these)

- Fill in the `TODO (author must fill in honestly)` block in `README.md`.
- Edit `docs/sample/final-newsletter.md` in your own voice.
- Rotate the Gemini API key and update the Vercel value.
- Try the bookmarklet with the real `INGEST_TOKEN`.
- Attach your resume.
- Send the email to hardeep@thisweekinai.club yourself.
