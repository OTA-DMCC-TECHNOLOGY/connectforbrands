# Template data notes (template agent) — legal pack v12 (FINAL)

- Files: `legal_src/templates/{MPA,OF,TRT,SLA,BL,BOA,DPA,EUT,PN,SIM,RS,PF,SR,INV,CN,CI,CHG}.json`, `keys.json` (293 keys),
  `demo_values.json`; generated `src/modules/60_legal_templates.js`. Re-run: `python3 tools/extract_templates.py`
  (`--check` = verification only, no writes).
- Private inputs (gitignored, never commit): `legal_src/private_values.json` = `{pack_dir, replace:[[real, demo]…], forbidden_extra}`;
  `pack_dir` now points to the v12 pack (`…/legal_v12/CONNECT_FOR_BRANDS_Legal_Pack_v12`, DOCX in `*/DOCX/`). Every DOCX text run is
  rewritten real→demo before extraction (v12 adds OTA's EUR account to the list); the run aborts without writing if a real value would
  reach an output. `LEGAL_PACK_DIR=<dir>` overrides `pack_dir`.
- Module exports: `LEGAL_PACK_VER` ('v12'), `LEGAL_TPL`, `LEGAL_KEYS`, `LEGAL_DEMO_VALUES` (partner / status / ota / countries UA, KZ, DE /
  system / samples / roundtrip), `LEGAL_CN_REASONS`, `legalDerive(V)`, boot hook (seeds `S.templates`, REPLACES any stored template whose
  ver number is lower than the base — i.e. every stored `T-*-v10` / `T-*-v3` — and adds missing types).
- Template versions: every type `ver:'T-<TYPE>-v12'`, `effective:'2026-09-01'`. v12 is the first edition; v10 JSON is in git history.

## v12 KEY CHANGES (v10 → v12)

NEW keys
| key | src | where | meaning |
|---|---|---|---|
| `CCY` | country | OF (section 2 heading, every price cell `{{CCY}} {{TOK_…}}`, Retained Amounts, bank Currency row), INV / CN / RS / CI (Currency cell; INV / CI bank Currency row) | `'USD'` \| `'EUR'` = `S.ota.countries[CC].currency` (DE = EUR, MPA 8.1) |
| `CCY_USD`, `CCY_EUR` | derived | OF 3.1, 3.2, bank table; INV OTA account / IBAN; OF + CI partner IBAN | currency variants of the 02-DE text |
| `CC_DE` (generic `CC_<CC>`) | derived | block `OF-1.6` (cond) | "1.6 Germany and the EU" shown only for DE |
| `OTA_OSS_NO` | country | OF-1.6 | OTA's EU One-Stop-Shop registration (`S.ota.countries.DE.oss_no`; demo `EU276DEMO01`, fictional) |
| `OTA_BANK_ACCOUNT_EUR`, `OTA_BANK_IBAN_EUR` | ota | OF bank table, INV bank table (when CCY_EUR) | OTA EUR account (demo `9876543210987` / `AE070339876543210987654`) |
| `P_BANK_IBAN_EUR` | partner | OF bank table, CI bank table (when CCY_EUR) | Data Form "EUR account (if Approved Countries in Europe)" |
| `VAT_AE` | invoice flag | INV, CN | true = UAE partner → VAT 5 % (`vatRateFor(org)===5`); empty = 0 % zero-rated |
| `VAT_ZERO` | derived | INV, CN | = not VAT_AE |
| `INV_VAT_AMOUNT`, `INV_VAT_AED` | invoice | INV (only with VAT_AE) | VAT in invoice currency / in AED at `AED_RATE` |
| `CN_VAT_AMOUNT`, `CN_VAT_AED` | invoice | CN (only with VAT_AE; unsigned, template prints "–") | VAT adjustment in currency / AED |
| `P_INC_COUNTRY`, `P_TAX_COUNTRY`, `P_VAT_REGS`, `P_UAE_FE` | partner | not printed (MPA 2.6 "Tax status" / Data Form) | ISO country of incorporation, ISO tax residence, VAT registrations (text, N/A-able), fixed establishment in the UAE (bool) |

CHANGED / REMOVED
- REMOVED `P_GCC_CONFIRM` (v12 MPA 2.6 is "Tax status"; GCC partners are no longer barred).
- REMOVED `P_BRAND_CONTACT` — 05A Annex 2 "Approval contact" is now `{{P_EMAIL_OPS}}` (template text "[ops e-mail]").
- `P_COUNTRY` → `P_INC_COUNTRY`; `P_COUNTRY` stays in the catalogue only as a deprecated alias (same value, optional, not printed).
- Format of PRICE_KEY / TOK_* / RET_* `'usd'` → `'money'` (2 decimals in CCY). Labels of INV_* / CN_* / CI_* amounts no longer say USD.
  PF (11) customs values stay USD (document unchanged in v12).
- `AED_RATE` = CBUAE rate of the document currency (USD→AED or EUR→AED) on the document date.
- `CARD_DESCRIPTOR` is no longer printed by any v12 template (kept in the catalogue).
- All other keys keep their v10 names.

`legalDerive(V)` (call before rendering) sets: CN_REASON_<CODE>; FEE_NONE / OF_EXCEPTIONS_NONE (and now deletes them when the value is set);
`CCY` (accepts aliases `CURRENCY` / `CUR`, default 'USD', upper-cased) + `CCY_USD` / `CCY_EUR`; removes stale `CC_XX` flags and sets
`CC_<V.CC>`; `VAT_AE` (alias `VAT_UAE` accepted) → `VAT_ZERO` when not set.

## Order Form: one template for UA / KZ / DE
The three DOCX are extracted separately and merged (`merge_variant`): blocks present only in 02-DE get `cond:'CC_DE'` (only `OF-1.6`);
all other differences are unified by rules: country literals → CC_* tokens, "USD"/"EUR" → `{{CCY}}`, 3.1 `[[CCY_USD|in local currency]][[CCY_EUR|in euro]]`
(RU в местной валюте / в евро), 3.2 last sentence (USD: "Currency conversion is made…" / EUR: "Where an End User pays in another currency,
conversion into euro is made…", RU likewise), bank label `Account / IBAN[[CCY_EUR| (EUR)]]`, OTA account/IBAN and partner IBAN per currency.
Clause 1.6 keeps "euro (EUR)" literal. The 02-DE Ref placeholder `{{[OTA-{PARTNER}-OF-DE-NNN-vN]}}` → `{{DOC_NO}}`.
Round trip per country is exact; the fidelity script renders each country file EN and RU.

## INV / CN VAT lines (MPA 2.6)
- INV VAT cell (bi): `[[VAT_ZERO|VAT 0% – zero-rated export of services (Article 31, …)]][[VAT_AE|VAT 5%]]` / RU `[[VAT_ZERO|НДС 0% – экспорт услуг (…)]][[VAT_AE|НДС 5%]]`;
  amount `[[VAT_ZERO|0.00]][[VAT_AE|{{INV_VAT_AMOUNT}}]]`; AED line unchanged text + `AED [[VAT_ZERO|0.00]][[VAT_AE|{{INV_VAT_AED}}]]` (always printed).
- CN: same VAT cell; amount `[[VAT_ZERO|0.00]][[VAT_AE|–{{CN_VAT_AMOUNT}}]]`; `AED –[[VAT_ZERO|0.00]][[VAT_AE|{{CN_VAT_AED}}]]`. The 13A DOCX has only the
  0 % wording; the 5 % wording ("VAT 5% / НДС 5%") is taken from the v12 13 template.
- `INV_TOTAL` / `CN_TOTAL` must include the VAT when VAT_AE. Samples: `LEGAL_DEMO_VALUES.samples.INV_AE`, `CN_AE`, `INV_DE`, `partner_AE`.

## Demo values (all fictional)
- Partner ARVELO LIMITED / ARV (v12 Data Form is generic, so the demo partner is defined in the extractor): + `P_INC_COUNTRY`/`P_TAX_COUNTRY` 'GB',
  `P_VAT_REGS` null, `P_UAE_FE` false, `P_BANK_IBAN_EUR` 'GB71DEMO60161300000077'.
- Countries: UA, KZ (CCY 'USD') and NEW DE: CCY 'EUR', OTA_OSS_NO 'EU276DEMO01', ANNUAL_TARGET 10000, prices in EUR (key 8.90),
  OTA_REP_LOCAL 'Demo EU Representative GmbH, 1 Demostraße, 10115 Berlin, Germany' (08 cl. 1.3 / Art. 27 GDPR), DOC_NO 'OTA-ARV-OF-DE-001-v1'.

## Shape (unchanged)
`{type, docNo, title:{en,ru}, ver, effective, cls:'A'|'B'|'C', blocks:[{id, kind:'heading'|'clause'|'para'|'table'|'signature'|'annex',
en, ru, cond?, rows?:[[{en,ru,bi?}]], rowCond?:{rowIndex:KEY}, repeat?:{row, list}}]}`. `{{KEY}}` value (KEY_L2 form for the ru column);
`[[KEY|…]]` fragment only if KEY filled (not empty / N/A / 0 / false); `bi:true` cell → "en / ru"; `cond` hides the block, `rowCond`
hides a row, `repeat` renders that row per list item (item keys first). cls: A = 01/02/03/05A/05B/06/09/E; B = 04, 10–14, 13A; C = 07/08.

## Kept from v10
- CN (13A) and CHG (E) keys, OF `OF-replaces` (cond OF_SUPERSEDES), OTA_VAT_LOCAL / OTA_REP_LOCAL rows (OF bank table, EUT annex) and PN-1.3,
  PF ship-from / exporter keys, TRT `{serial}`, RS_NO in CI — see git history of this file for the v10 details.
- Derived flags: BRAND_DOC_05A/05B from P_TM_OWNER_IS_PARTNER; CC_NAME_UPPER_* = upper(CC_NAME_*).
- Numbers: INIT_* / ANNUAL_TARGET integers (EN 1,000; RU 1 000). DOC_NO = own number; DOC_SEQ = YYYY-NNNN(NN); DOC_NO_OF = Order Form number.

## Structured replacements (template ≠ DOCX literally; listed by the extractor, checked by the fidelity script)
OF 1.5 "[none / list of exceptions]" and 3.2 "[not applicable / up to 3%]" → v10 / ТЗ 2.4 choice texts; 05A/05B brand doc choice; INV/CN VAT
alternatives; 13A reason choice; INV OF ref, CI RS refs; PF ship-from / exporter composites; SR "[OTA-PF-]"; RS "[CC-YYYYMM]"; TRT {serial};
E "(template)" marker dropped; 02-DE Ref placeholder.

## Open wording questions (do not change text without OTA Legal)
- `[wording to be approved]`: label of the OTA_VAT_LOCAL row (EUT annex, OF bank table) and of the OTA_REP_LOCAL row in the OF bank table (unchanged from v10).
- 13A has no 5 % VAT wording in v12 — the 13 wording "VAT 5% / НДС 5%" is reused; confirm with OTA Legal.
- 13 / 14 bank tables show only the USD account in the DOCX; for EUR documents the EUR account (OTA / partner) is printed instead (data only).
- 14 CI: EN cites `OTA-[PPP]-RS-[CC-YYYYMM]`, RU `OTA-RS-[PPP]-[ГГГГММ]` in the DOCX — both replaced by `{{RS_NO}}` (unchanged from v10).
- E notice: drafting marker "(template)" dropped; Ref shows the notice's own number (DOC_NO).
