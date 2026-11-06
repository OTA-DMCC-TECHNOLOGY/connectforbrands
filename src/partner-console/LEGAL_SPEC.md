# Legal module + commercial model v09 — shared brief for all agents

Product: CONNECT FOR BRANDS partner console (single-file vanilla JS demo, localStorage). Read `API.md` first (module rules, build, test). Owner: OTA TECHNOLOGY DMCC.

Sources (read-only):
- `legal_src/TZ_legal_module_RU.txt` — the specification (ТЗ) for the legal module. It is the acceptance contract. Sections 1–10.
- `legal_src/CONNECT_FOR_BRANDS_Legal_Pack_v09/` — 14 DOCX templates (EN | RU two-column tables) + Partner Data Form (A), Placement Guide (B), Document Register (D, xlsx), Legal memo (C).
- `legal_src/C_Legal_Memo_RU.txt` — the memo as text (why the model is what it is).

## 1. Commercial model of v09 (replaces the old "SIM + package credits in UAH" model)
- OTA invoices the Partner ONLY in **USD**, from **OTA TECHNOLOGY DMCC**, VAT 0% "zero-rated export of services (Article 31 of the Executive Regulation of Federal Decree-Law No. 8 of 2017 on VAT)" when Partner country ≠ AE; 5% if AE (warn finance). Document title "Tax Invoice". Unified numbering `OTA-INV-YYYY-NNNNNN` for all partners; credit notes `OTA-CN-YYYY-NNNNNN`.
- What is sold: **Activation Keys** ("copies of the CONNECT computer program (licence activation keys)", one per Approved Device, prepaid, not linked to SIM shipments) and **Service Tokens** (plan × term: Light / Standard / Premium × 12/24/36/48/60 months; prepaid; valid 36 months from issue; exchangeable for another plan/term — pay the difference if more expensive, no refund if cheaper). Keys and tokens are issued only after the invoice is marked paid.
- **SIM cards are never sold or invoiced.** They are shipped to the Partner **in custody, free of charge** (doc 09), DAP, delivery & insurance by OTA; each shipment has a customs **Pro Forma** `OTA-PF-YYYY-NNNN` (11) and a **SIM Receipt & Custody Acknowledgment** `OTA-SR-YYYY-NNNN` (12, same NNNN as the pro forma). Custody covers only uninstalled SIMs. Recommend key orders not matching SIM shipments in date/quantity (customs).
- **Direct Subscriptions**: end users pay on OTA's payment page (monthly, annual, prepaid 12–60). Partner sets retail prices (local currency incl. taxes) ≥ minimum. **OTA Retained Amount** per paid month per plan (USD) is set by OTA per country. Partner commission = Net Collected Revenue (MPA 7.4: minus OTA's taxes in the customer's country, acquiring, refunds, optional country compliance fee 0–3%) − OTA Retained Amount. Monthly **Reconciliation Statement** `OTA-PPP-RS-CC-YYYYMM` (10) by the 10th; partner confirms or disputes lines within 5 business days, silence = auto-confirm. Partner issues a **Commission Invoice** (14) by the 15th (portal proposes a draft from the RS, or partner uploads own invoice); OTA accounts UAE VAT by reverse charge (flag in system).
- Per-country commercial terms (OTA only): Activation Key price, Service Token prices 3 plans × 5 terms, OTA Retained Amount for 3 plans, country compliance fee 0–3%. These live in a versioned **PriceList** per country and enter the Order Form only when it is generated. Price increase: notice ≥ 90 days (MPA 9.1); other class-A changes ≥ 30 days.
- Initial order (Order Form 4.1): 1,000 SIM shipment (custody), 1,000 Activation Keys, 300 Service Tokens. Annual target 3,000 activated devices (not a purchase obligation).
- Excluded Territories (Russia, Belarus, sanctioned & occupied territories): no sales/activation. Restricted Countries (e.g. Turkey, India — permanent roaming): only temporary trips ≤ 90 days.
- Retail prices shown to the partner for planning (calculator) may stay in local currency; everything OTA bills is USD.

Current demo prices to seed (USD, net) — Ukraine: key $9.85; tokens from the existing UAH wholesale (Light 75 / Standard 99 UAH incl. VAT per month → net USD per month = UAH/1.2/45.0564) × months × (1 − discount 12m 10%, 24m 20%, 36m 30%, 48m 35%, 60m 40%), rounded to cents; Premium = Standard × 1.5. Retained Amount per paid month = the monthly net wholesale (Light/Standard/Premium). Kazakhstan: key $9.40; monthly wholesale 990 / 1 290 KZT incl. 16% VAT at 441.77; same discount logic. Compliance fee 0%.

## 2. Legal module (the ТЗ) — demo scope
Implement everything in the ТЗ in the browser demo, with these honest simulations (label them "demo" in OTA mode only, never to partners):
- e-mail/SMS OTP → demo code shown in a toast; 2FA = OTP at sign-in.
- PDF = print-ready A4 HTML document (two columns EN | LANG2) printed via `window.print()` in a print view; SHA-256 computed with WebCrypto over the canonical document text; "PAdES seal" shown as a seal block with the hash (real PAdES needs a backend — note in OTA mode).
- Storage 10 years / AWS backup → stated in OTA settings as a backend requirement; demo keeps everything in state, append-only.
- DocuSign/Dropbox Sign → not integrated; built-in signing per ТЗ §6. Ukrainian KEP: "download PDF / upload signed copy" stores the uploaded file name as an additional copy.

## 3. Data model additions (in `S`, created by the core refactor agent; others use them)
- `S.ota` — OTA data (ТЗ §3 "Данные OTA"): keys OTA_NAME, OTA_REGNO, OTA_LICENCE, OTA_TRN, OTA_ADDR, OTA_SIGNATORY, OTA_TITLE, OTA_BANK_* , OTA_CUSTOMS_CODE, OTA_VAT_{CC}, OTA_REP_{CC}, OTA_EMAIL_OPS/LEGAL/FIN/SUPPORT/PRIVACY, OTA_SUPPORT_HOURS. Empty = N/A automatically. Replaces `S.ourEnt`/`ENTITIES` for invoices.
- `S.org.code` — partner code PPP (3 Latin letters, unique, reserved OTA/INV/TST; proposed from name, approved by OTA). Demo partner: ARV (ARVELO LIMITED).
- `S.org.lang2` — second document language ('ru' is the only approved translation now).
- `S.form` — partner questionnaire: `{KEY:{value, status:'filled'|'empty'|'na', comment, by, at}}` for all keys in ТЗ §3 (P_NAME, P_FORM_EN/L2, P_COUNTRY, P_REGNO, P_TAXNO, P_ADDR_EN/L2, P_SIGNATORY, P_TITLE_EN/L2/L2_GEN, P_AUTHORITY (+file), LANG2, P_BRAND, P_PROGRAMME, P_TM_OWNER_IS_PARTNER, P_TM_*, P_DOMAIN (+DNS contact), P_LOGO, P_BRANDBOOK, P_EMAIL_OPS/LEGAL/FIN/SUPPORT, P_PHONE, P_BANK_* ) + per-country order params and Annex 1 devices. Only OTA can set 'na'; partner can only comment "no such data".
- `S.priceLists[CC]` — versioned: `[{ver, from, to, key, tokens:{light:{12:..,24:..},...}, retained:{light,standard,premium}, fee}]`.
- `S.templates` — loaded from the generated template data module (see §4): `{TYPE:{ver:'T-MPA-v3', effective, cls, paras:[{id, en, l2:{ru}, cond?}]}}`; old versions kept.
- `S.docs` — issued documents: `{id, type, number, cc?, ver, templateVer, status:'draft'|'issued'|'signed_partner'|'signed_both'|'superseded'|'acknowledged'|'terminated', supersedes, effective, cls, hash, signatures:[{party, name, title, at, ip, ua, otp:'email', id}], text snapshot (frozen at issue), createdAt}`.
- `S.seq` — number counters (never reused): per partner/type, per partner/country, global INV/CN/PF.
- `S.audit` — append-only `[{ts, actor, role, action, object, details, ip, ua, hash?}]`.
- `S.roles` / users: OTA Admin, OTA Legal, OTA Finance, Partner Admin, Partner Signatory, Partner Operations (demo user switcher in OTA mode).
- `S.shipments` — SIM shipments `{id, pf, sr, qty, iccidFrom, iccidTo, status, receivedAt, condition}`; `S.keyOrders`, `S.tokenOrders`; `S.statements` (RS), `S.commissionInvoices` (CI).

## 4. File ownership (do not edit files you don't own; describe needed changes in your report)
- Core refactor agent: `src/01_core.js`, `src/02_shared.js`, `src/00_core.css`, `src/modules/30_orders.*`, `src/modules/45_codes.*`, `src/modules/50_pricing.*`, `src/modules/55_actual.*`, `src/modules/10_onboarding.*` (only what the model change requires), `API.md` (update business rules).
- Template agent: `tools/extract_templates.py`, `legal_src/templates/*.json`, generated `src/modules/60_legal_templates.js` (data only: `const LEGAL_TPL = {...}` + `HOOKS.onBoot` that loads it into `S.templates` if missing).
- Legal UI agent: `src/modules/70_legal.js/.css` (questionnaire, OTA review, generation, signing, versions, audit, documents).
- Ops documents agent: `src/modules/75_opsdocs.js/.css` (OTA invoice 13 rendering, RS 10, PF 11, SR 12, CI 14 using templates + legal engine API).
Shared rendering engine (template → document): owned by the Legal UI agent in 70_legal.js, exported as globals `lg_render(type, ctx)`, `lg_number(type, cc)`, `lg_hash(text)`, `lg_audit(action, object, details)`; the ops agent uses them (if not there yet, stub locally with the same names prefixed `ops_` and switch at integration).
