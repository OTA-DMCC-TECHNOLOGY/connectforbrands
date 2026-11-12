# Legal pack v12 — delta brief for all agents

Read `LEGAL_SPEC_v10.md` first: repo rules, demo rules (fictional OTA + ARVELO LIMITED / ARV, no real requisites in the repo,
no git), file ownership, shared contracts, the `cfb-demo-ownership` bridge and shared demo clock all stay as they are.
This brief only lists what changes with pack v12.

## Decision of the owner (OTA)
**Where pack v12 and ТЗ v10 disagree, pack v12 wins.** ТЗ v10 stays valid for everything v12 does not change
(ownership/binding part 4, numbering, AED line, credit notes, bank-change callback, price-increase rules, etc.).
**Germany (DE) is added as the third demo country** (UA, KZ, DE).

## Sources (private, outside the repo, read-only)
- Pack v12 DOCX/PDF: `/tmp/claude-0/-home-claude/a4908280-2fe9-593d-b9be-56ff1f220708/scratchpad/legal_v12/CONNECT_FOR_BRANDS_Legal_Pack_v12/`
- Line diff v10 → v12 of every document: `…/scratchpad/legal_v12/DIFF_v10_v12.txt` (read the part for your documents)
- Plain text of all v12 documents (JSON, file name → text): `…/scratchpad/legal_v12/v12_texts.json`
- ТЗ v10: `…/scratchpad/legal_v10/TZ_Portal_Agents_v10.md`
(`…` = `/tmp/claude-0/-home-claude/a4908280-2fe9-593d-b9be-56ff1f220708`)
Legal wording only from the v12 templates (or ТЗ tables where v12 is silent); otherwise `[wording to be approved]`.

## What v12 changes (summary — verify against the diff)
1. **GCC partners are no longer barred.** MPA 2.6 "Tax status": the partner states country of incorporation and tax
   residence, VAT registrations and fixed establishment (Partner Data Form asks "Tax residence, VAT registrations, fixed
   establishment in the UAE (yes/no)"). OTA charges **UAE VAT 5%** if the partner is resident / VAT-registered / has a
   fixed establishment in the **UAE**; **0% zero-rated export** otherwise when conditions are met; a partner in another
   GCC state accounts for its own indirect tax. → Remove the GCC registration block and the mandatory GCC checkbox;
   restore a 5% branch for AE partners (invoice VAT line: v12 template text "VAT 0% … – or, for a Partner in the UAE:
   VAT 5%"), AED line stays on every invoice/credit note (with the real AED VAT amount when 5%).
2. **Currency per country.** MPA 8.1: USD, except Order Forms for Approved Countries in Europe are in **EUR**; the
   Order Form currency applies to all prices, invoices, Statements, commission and payments for that country. Invoice
   template: currency `[USD / EUR]`, payment terms text per currency.
3. **Activation Keys and SIMs 1:1.** MPA 7.1/8.1: for each Activation Key bought for a country OTA provides one SIM
   for that country in custody, free; keys and these SIMs are shown in the cabinet **as one batch**. SIMs are shipped
   in the quantity of keys bought for the country, in one or several shipments; a further shipment within that
   quantity is made when **≥ 70 %** of SIMs previously delivered for that country have been activated (check exact text).
   OF 4.1: initial order "[1,000] Activation Keys (with the same number of SIMs)".
4. **Germany Order Form (02-DE)**: EUR; OTA is seller/merchant of record for Direct Subscriptions, charges **German VAT
   under EU OSS** (registration no. field); the DE end-user portal opens only after Documents 07 and 08 with the
   Germany Country Schedule are published **in German**; the portal offers an **online cancellation button** for
   subscriptions (§ 312k BGB); SIMs ship from OTA's EU warehouse.
5. **Document 07 (EUT)**: 4.1 activation code = "package code", redeemed by signing in with OTP and entering the code
   printed under the scratch layer, then choosing the device (check whether QR remains); 5.1 cancellation button in the
   portal, **available without logging in where the law requires it**; suspension list no longer includes an unpaid
   subscription; other changes in the diff.
6. Templates are now generic (`[PPP]`, `[BRAND]`, `connect.[brand-domain]`, `[Partner full legal name]` …) — map to keys.
7. Other documents (03, 04, 05A, 05B, 06, 08, 09, 10, 11, 12, 13A, 14, A, B, E) have smaller changes — see the diff.

## Shared contracts added for v12
- `S.ota.countries[CC].currency` = 'USD' | 'EUR' (DE = EUR; UA, KZ = USD) and `oss_no` (DE OSS registration, demo
  value fictional) — owned by the commercial agent; everyone reads `cur(cc)` / `ccy(cc)` helper it exposes.
- Partner tax status in the questionnaire: `P_INC_COUNTRY`, `P_TAX_COUNTRY`, `P_VAT_REGS`, `P_UAE_FE` (yes/no) — owned by
  the legal UI agent; the commercial agent derives the invoice VAT rate from them via `vatRateFor(org)` (5 % for AE
  resident / VAT-registered / fixed establishment, else 0 %).
- Germany demo seed (prices in EUR, Retained Amounts in EUR, a DE Order Form, a few DE SIMs/keys in the bridge with
  `country:'DE'`) — commercial agent; DE Country Schedule data for 07/08 — legal UI agent.

## File ownership (same as v10)
Template agent: extractor, `legal_src/templates/*`, `60_legal_templates.js`, `LEGAL_TEMPLATES_NOTES.md`.
Commercial agent: `01_core.js`, `02_shared.js`, `00_core.css`, `20_catalog`, `30_orders`, `40_sims_codes`, `45_codes`,
`50_pricing`, `55_actual`, `75_opsdocs`, `API.md`. Legal UI agent: `70_legal`, `10_onboarding`. Ownership module
`80_ownership` — commercial agent may touch it only for the DE country / batch view if strictly needed. Customer portal
agent: `src/customer-portal/*`. New UI strings: uk/en/ru (the 39 other languages fall back to English for now; the
coordinator re-runs translations afterwards — do not edit `i18n/*.json`).

Finish with build passing, Playwright checks at 390/1280 without page errors, and a report: what changed per item,
how you tested, open questions, `[wording to be approved]` list, changes needed in files you don't own.
