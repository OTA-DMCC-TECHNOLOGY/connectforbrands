# Template data notes (template agent) — legal pack v10 (FINAL)

- Files: `legal_src/templates/{MPA,OF,TRT,SLA,BL,BOA,DPA,EUT,PN,SIM,RS,PF,SR,INV,CN,CI,CHG}.json`, `keys.json` (277 keys),
  `demo_values.json`; generated `src/modules/60_legal_templates.js`. Re-run: `python3 tools/extract_templates.py`
  (`--check` = verification only, no writes).
- Private inputs (gitignored, never commit): `legal_src/private_values.json` = `{pack_dir, replace:[[real, demo]…], forbidden_extra}`.
  Every DOCX text run is rewritten real→demo before extraction; the run aborts without writing if a real value would reach an output.
  `LEGAL_PACK_DIR=<dir>` overrides `pack_dir`.
- Module exports: `LEGAL_PACK_VER` ('v10'), `LEGAL_TPL`, `LEGAL_KEYS`, `LEGAL_DEMO_VALUES` (partner / status / ota / countries / system /
  samples / roundtrip), `LEGAL_CN_REASONS` ({cancel_unpaid|error|refund: {en, ru}} = ТЗ 2.3 texts), `legalDerive(V)` (sets
  CN_REASON_<CODE>, FEE_NONE, OF_EXCEPTIONS_NONE), boot hook: seeds `S.templates` and REPLACES any stored template whose ver number
  is lower than the base (old v3 / v09 patches) and adds new types (CN, CHG).
- Template versions: every type `ver:'T-<TYPE>-v10'`, `effective:'2026-11-07'`. v09 (`T-*-v3`) is not shipped: the engine only patches
  one base and ТЗ part 5 makes v10 the first edition for everyone (criterion 22). v09 JSON is in git history.

## Shape (unchanged from v09)
`{type, docNo, title:{en,ru}, ver, effective, cls:'A'|'B'|'C', blocks:[{id, kind:'heading'|'clause'|'para'|'table'|'signature'|'annex',
en, ru, cond?, rows?:[[{en,ru,bi?}]], rowCond?:{rowIndex:KEY}, repeat?:{row, list}}]}`. `{{KEY}}` value (KEY_L2 form for the ru column);
`[[KEY|…]]` fragment only if KEY filled (not empty / N/A / 0 / false); `bi:true` cell → "en / ru"; `cond` hides the block, `rowCond`
hides a row, `repeat` renders that row per list item (item keys first). cls: A = 01/02/03/05A/05B/06/09/E; B = 04, 10–14, 13A; C = 07/08.

## New templates
### CN — 13A Tax Credit Note (docNo `13A`, cls B, blocks CN-title, CN-ref, CN-t1…t4, CN-p1, CN-sig5)
- `CN_NUMBER` full `OTA-CN-YYYY-NNNNNN` (Ref line + number cell) · `CN_DATE` (date) · `CN_INV_NUMBER` full `OTA-INV-…` · `CN_INV_DATE` (date)
- `CN_REASON` = `cancel_unpaid | error | refund`; the template prints the ТЗ 2.3 EN/RU text via derived flags `CN_REASON_CANCEL_UNPAID` /
  `CN_REASON_ERROR` / `CN_REASON_REFUND` — call `legalDerive(V)` (or set the flag) before rendering.
- `CN_LINES` (repeat, `CN-t4` row 1) items `CN_LINE_NO`, `CN_LINE_DESC_EN` / `CN_LINE_DESC_L2` (bi cell), `CN_LINE_QTY`, `CN_LINE_PRICE`,
  `CN_LINE_AMOUNT`. `CN_SUBTOTAL`, `CN_TOTAL`. All CN amounts UNSIGNED — the template prints "–" (as the DOCX).
- `AED_RATE`; "VAT 0% …" line, "0.00" and "AED –0.00" are fixed text. Also P_NAME, P_ADDR_EN, P_REGNO, P_TAXNO (line hidden if empty),
  DOC_NO_MPA, OTA_*, LANG2_NAME_*. Sample: `LEGAL_DEMO_VALUES.samples.CN`.
### CHG — E Notice of Change of Details (docNo `E`, cls A, blocks CHG-title, CHG-ref, CHG-p2, CHG-t1, CHG-1…3, CHG-sig2) — replaces LG_CHG_TPL
- `DOC_NO` (own notice number, Ref line), `DOC_NO_MPA`, `CHG_PARTY_NAME`, `CHG_EFFECTIVE_DATE` (date)
- `CHG_LIST` (repeat, `CHG-t1` row 1) items `CHG_LABEL`, `CHG_OLD`, `CHG_NEW`
- signature of the notifying Party: `CHG_SIG_COMPANY`, `CHG_SIG_NAME`, `CHG_SIG_TITLE_EN`, `CHG_SIG_TITLE_L2` (partner notice = P_NAME,
  P_SIGNATORY, P_TITLE_EN, P_TITLE_L2). Sample: `samples.CHG`.

## Changed templates / keys (v10)
- MPA: Parties `…company no. {{P_REGNO}}[[P_TAXNO|, tax no. {{P_TAXNO}}]], address…` (RU `, налоговый № …`) — now DOCX text; new clause `MPA-2.6` (GCC).
- OF: 1.5 `[[OF_EXCEPTIONS_NONE|none]][[OF_EXCEPTIONS_EN|the following: {{OF_EXCEPTIONS_EN}}]]` (RU нет / следующие:); 3.2
  `[[FEE_NONE|not applicable]][[FEE_PCT|{{FEE_PCT}}% of payments received, not more than 3%]]` (RU … но не более 3%; FEE_PCT ≤ 3 is the
  caller's check). NEW block `OF-replaces` (before OF-s1, `cond:'OF_SUPERSEDES'`, keys OF_SUPERSEDES = previous OF number, OF_EFFECTIVE =
  date): set OF_SUPERSEDES only for v2+ (criteria 5/22). `OF-t3` rows 9/10 = OTA_VAT_LOCAL / OTA_REP_LOCAL (rowCond; label `[wording to be approved]`).
- TRT: new 3.1(c), 4.1, 4.2, `TRT-4.4` printed cards, `TRT-5.4` ownership requests; packaging text `TRT-p2` contains the literal `{serial}`
  (print variable, not a `{{KEY}}`); `[12/24/36/48/60]`, `[date]`, `[country]` stay literal as in v09.
- DPA: 3.1, new `DPA-3.4`, `DPA-3.5`, Annex 2 rows. SIM: 2.1 (EU dispatch), new `SIM-4.6`. PN: section 2/3/4/6 texts; NEW `PN-1.3`
  (`cond:'OTA_REP_LOCAL'`, ТЗ 2.6 wording).
- EUT: new section 3 (`EUT-s3`, `EUT-3.1…3.6`), old 3–11 → 4–12 (ids follow the new numbers, e.g. `EUT-4.1`, `EUT-5.4`, `EUT-8.2`, section
  paragraphs `EUT-s6.p1` obligations…); annex row "(if different from clause 5)"; `EUT-t1` rows 7/8 = OTA_VAT_LOCAL (label `[wording to be
  approved]`) / OTA_REP_LOCAL ("OTA's representative in your country / Представитель OTA в вашей стране"), rowCond.
- PF: `PF-t1` rows: 1 Date, 2 Owner of the goods (OTA name, address, Reg. no. — no TRN), 3 Ship-from address
  `{{SHIP_FROM_NAME}}, {{SHIP_FROM_ADDR}}, {{SHIP_FROM_COUNTRY}}`, 4 Exporter of record and EORI `{{EXPORTER_EU}}, EORI no. {{EXPORTER_EORI}}`,
  … Country of dispatch / destination `{{SHIP_FROM_COUNTRY}} / {{CC_NAME_EN}}`; declaration "records of OTA as owner of the goods".
  No customs code anywhere. SR: DOCX unchanged in v10 (no ship-from wording exists for SR).
- INV: `INV-t4` rows: 0 header, 1 keys, 2 tokens ("Service Tokens …"), 3 other (rowCond), 4 Subtotal, 5 VAT 0% (single line), 6 NEW
  "VAT amount in AED at the UAE Central Bank rate {{AED_RATE}} on the invoice date … AED 0.00", 7 Total due. No 5% wording.
- CI: line text `… per Statement(s) {{RS_NO}}` / `… согласно Акту {{RS_NO}}` (RS_NO = statement number(s), comma-separated).
- New keys: AED_RATE (INV, CN; fmt 'rate'), OTA_VAT_LOCAL / OTA_REP_LOCAL (per country of the document, src 'country', N/A-able),
  SHIP_FROM_NAME / SHIP_FROM_ADDR / SHIP_FROM_COUNTRY / EXPORTER_EU / EXPORTER_EORI (shipment), OF_SUPERSEDES / OF_EFFECTIVE, RS_NO,
  P_GCC_CONFIRM (questionnaire, fmt bool, not printed), CN_*, CHG_* (above), `{serial}` (src 'print', catalogue only).
- REMOVED: OTA_CUSTOMS_CODE, OTA_VAT_{CC}, OTA_REP_{CC} (also from `demo_values.ota`). Demo countries: UA OTA_VAT_LOCAL='DEMO-UA-VAT-000001',
  KZ OTA_REP_LOCAL='Demo Representative LLP, 1 Demo Avenue, Almaty, Kazakhstan' (fictional; each shows only for its own country).

## Conventions kept from v09
- Derived flags: BRAND_DOC_05A/05B from P_TM_OWNER_IS_PARTNER; FEE_NONE; OF_EXCEPTIONS_NONE; CN_REASON_*; CC_NAME_UPPER_* = upper(CC_NAME_*).
- Numbers: INIT_* / ANNUAL_TARGET integers (EN 1,000; RU 1 000); prices USD 2 decimals. DOC_NO = own number; DOC_SEQ = YYYY-NNNN(NN)
  part of INV/PF/SR/CI (prefix literal); DOC_NO_OF = Order Form number; MPA_DATE = MPA date. RS empty cells = RS_A_* / RS_B_* / RS_C_* / RS_D_*.
- Page headers/footers are not in blocks.

## Open wording questions (do not change text without OTA Legal)
- `[wording to be approved]`: label of the OTA_VAT_LOCAL row (EUT annex, OF bank table) and of the OTA_REP_LOCAL row in the OF bank table.
- 14 CI: EN cites `OTA-{P}-RS-[CC-YYYYMM]` but RU still `OTA-RS-{P}-[ГГГГММ]` in the DOCX — both replaced by `{{RS_NO}}` (ТЗ 2.1 format).
- E notice: drafting marker "(template)" in the Ref line dropped; Ref shows the notice's own number (DOC_NO), the DOCX shows the MPA number.
- 13A original-invoice cell "OTA-INV-… of / от <date>" is language-neutral (EN date in both columns), as in the DOCX.
