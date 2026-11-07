# Legal pack v10 — shared brief for all agents

Repo: /home/claude/connectforbrands (public GitHub repo → never commit real OTA/partner requisites; demo uses fictional
OTA values and the fictional partner **ARVELO LIMITED, code ARV**). Partner console: `src/partner-console` (read `API.md`
first: module rules, build `python3 build.py`, test). Customer (end-user) portal: `src/customer-portal` (`build.py`).
Whole site build: `python3 tools/publish.py` (from repo root). Do NOT run git; the coordinator commits.

## Sources (private, read-only, outside the repo — never copy them into the repo)
- ТЗ v10 (acceptance contract, Russian): `/tmp/claude-0/-home-claude/a4908280-2fe9-593d-b9be-56ff1f220708/scratchpad/legal_v10/TZ_Portal_Agents_v10.md`
- Legal pack v10 DOCX: `…/scratchpad/legal_v10/CONNECT_FOR_BRANDS_Legal_Pack_v10/` (1_Partner_Package, 2_Templates_and_Tools, 3_Internal)
- Previous pack v09 + earlier ТЗ (context only): `…/scratchpad/console/legal_src/`
- The ТЗ refers to `TZ_Portal_Print_Materials.md` — not available; implement only what this ТЗ says about print items (PF, A2 box label, packaging text with `{serial}`).
(`…` = `/tmp/claude-0/-home-claude/a4908280-2fe9-593d-b9be-56ff1f220708`)

Legal texts: use ONLY wording from the v10 templates or the ТЗ tables (2.4, 4.12). If a needed wording does not exist,
render `[wording to be approved]` and list it in your final report. Never invent legal text.

## Hard rules for the demo
- Real OTA values from the ТЗ or the DOCX (registration and licence numbers, TRN, bank, signatory, etc.) must NOT appear
  in the repo. Demo OTA values stay fictional (see `S.ota` seed / `demo_values.json`: DMCC100200, DMCC-100200, Demo Bank…).
  For the trading licence use the fictional `DMCC-100300` if a value is needed (it is not printed now anyway, ТЗ 1.3).
- Ownership/binding, OTP, AED rates, callbacks etc. are simulated in the browser (localStorage), as in v09. OTP = demo
  code in a toast. Label simulations "demo" only in OTA mode.
- UI strings go through `I18N.add` with **uk, en, ru** for every new key (partner console). Approved texts T1–T12
  (ТЗ 4.12): use EN and RU verbatim; write a careful Ukrainian translation (UA professional translation comes later).
  15 extra languages exist in `src/partner-console/i18n/*.json`; do not edit them — new keys fall back to English.
- No 5% VAT anywhere. GCC partners (AE, SA, QA, KW, BH, OM) cannot register.

## Shared contracts (names other agents rely on)
Template types (in `LEGAL_TPL`, produced by the template agent): existing MPA, OF, TRT(03), SLA(04), BL(05A), BOA(05B),
DPA(06), EUT(07), PN(08), SIM(09), RS(10), PF(11), SR(12), INV(13), CI(14) — updated to v10 text — plus NEW:
- `CN` = 13A Tax Credit Note (`OTA-CN-YYYY-NNNNNN`), keys: CN_NUMBER, CN_DATE, CN_INV_NUMBER, CN_INV_DATE, CN_REASON (one of
  `cancel_unpaid | error | refund`, rendered with the EN/RU texts of ТЗ 2.3), CN_LINES (repeat, negative amounts), AED_RATE.
- `CHG` = E Notice of Change of Details (replaces the old ad-hoc CHG text), keys from the E template.
New/changed keys: AED_RATE (INV, CN), OTA_VAT_LOCAL / OTA_REP_LOCAL (per country; rendered only if set — EUT country
annex row, PN 1.3, OF requisites line), SHIP_FROM_NAME/ADDR/COUNTRY, EXPORTER_EU, EXPORTER_EORI (PF, SR, A2 label),
P_GCC_CONFIRM (questionnaire checkbox, mandatory), `{serial}` (TRT packaging text). REMOVED: OTA_CUSTOMS_CODE, any 5% VAT.
The template agent documents the final key list in `LEGAL_TEMPLATES_NOTES.md` and `legal_src/templates/keys.json`;
other agents read it when it lands and adapt names if they differ (do not block on it — code against the names above).

State additions (owner in brackets; others read only):
- `S.fx.aed` — `[{date:'YYYY-MM-DD', usd_aed:3.6725, src:'CBUAE (demo)'}]` reference table; invoices/CNs store the rate
  used (`inv.aedRate`). [commercial agent]
- `S.shipments[i]` + `ship_from{name,addr,country}`, `exporter{name,eori}`. [commercial agent]
- `S.ota.countries[CC]` + `{vat_local, rep_local, delay_hours (1–24, default 24), ownership_v10_enabled}`. [commercial
  agent adds fields + editor in the OTA data page; ownership agents read]
- `S.bankChange` pending bank-details change (E notice) `{fields, signedAt, callback:{by,at,phone}|null}`. [legal UI agent]
- Ownership (partner console side) `S.own = {bindings:[], transfers:[], requests:[], codes:{blocked:[]}, feed:[]}`, users
  gain roles `dealer`, `installer` with `sold_by_user_id` / `installed_by_user_id` on SIM records. [partner ownership agent]
- Demo bridge between the two apps (same origin on GitHub Pages: /partner and /portal): localStorage key
  `cfb-demo-ownership` = `{sims:{ICCID:{partner:'ARV', status:'issued'|'deactivated', imei}}, bindings:[], transfers:[],
  codes:{CODE:{serial, status:'new'|'redeemed'|'blocked', device_id}}, events:[]}`. The partner ownership agent seeds it
  (from the partner console SIM records) and reads binding events from it; the customer portal agent reads/writes it.
  Each app must also work alone (seed itself if the key is missing).

## File ownership (edit only your files; describe needed changes elsewhere in your final report)
1. Template agent: `tools/extract_templates.py`, `legal_src/templates/*.json`, `src/modules/60_legal_templates.js`,
   `LEGAL_TEMPLATES_NOTES.md`. Real values must not be in the repo: if the extractor needs real-value→key patterns, read
   them from `legal_src/private_values.json` (gitignored; create it, add it to `.gitignore` in your report).
2. Commercial/ops agent (ТЗ parts 1–3 except legal-UI items): `src/01_core.js`, `src/02_shared.js`, `src/00_core.css`,
   `src/modules/30_orders.*`, `45_codes.*`, `50_pricing.*`, `55_actual.*`, `75_opsdocs.*`, `20_catalog.*`, `40_sims_codes.*`, `API.md`.
3. Legal UI agent: `src/modules/70_legal.*`, `src/modules/10_onboarding.*`.
4. Partner ownership agent (ТЗ part 4, partner side): NEW `src/modules/80_ownership.js/.css` only (use HOOKS / nav
   registration like other modules; put role-visibility helpers there and ask the commercial agent via report for any core hook).
5. Customer portal agent (ТЗ part 4, end-user side): `src/customer-portal/*` only.

Finish with: build passes, a Playwright check of your screens at 1280px and 390px with no page errors (pattern:
`/tmp/claude-0/-home-claude/a4908280-2fe9-593d-b9be-56ff1f220708/scratchpad/smoke.js`), and a final report:
what you did per ТЗ item, acceptance criteria (ТЗ part 7) you cover and how you tested them, open questions, wordings
marked `[wording to be approved]`, and changes you need in files you don't own.
