# Translating the CONNECT FOR BRANDS partner console UI

The partner console is a B2B web app used by brand-owners/distributors (partners) and staff of OTA TECHNOLOGY DMCC.
Users: company directors, finance, operations, legal. Tone: clear, concise, professional, polite but not stiff —
the register of a modern business web app in that language (e.g. formal "you" where the language distinguishes it:
Sie, vous, Вы, Siz, etc.). Keep button labels short.

## Files
- Source (English, authoritative): `i18n_src/parts/part1.json` … `part6.json` (~408 keys each; together = `i18n_src/en.json`).
- Context only: `i18n_src/uk.json` (Ukrainian) and `i18n_src/ru.json` (Russian) — the reviewed human-quality versions; use them to
  disambiguate meaning (same keys). Translate from English; when English is ambiguous, follow the meaning of uk/ru.
- Output: `i18n_work/<code>/part1.json` … `part6.json` — same keys as the source part, values translated. Valid JSON (UTF-8,
  no comments, no trailing commas). Then run `node tools/i18n_check.js merge <code>` from `src/partner-console`.
  It writes `i18n/<code>.json` and validates. Fix every ✗ error and re-run until it prints `OK`.

## Hard rules (the checker enforces 1–3)
1. Keep every key; do not add keys. Every value must be a non-empty string.
2. Keep placeholders exactly: `{n}`, `{name}`, `{y}` … — same names, same count; move them where the grammar needs.
3. Keep HTML tags exactly (`<b>`, `<p>`, `<br>` …), same order; translate only the text between them.
4. Programme name: `c.program` = `CONNECT` + a space + the translation of "FOR BRANDS" in CAPITALS, in that language's natural
   word order after CONNECT, e.g. de `CONNECT FÜR MARKEN`, pl `CONNECT DLA MAREK`, fr `CONNECT POUR LES MARQUES`.
   "CONNECT" itself is never translated. Wherever an English string says "CONNECT FOR BRANDS", use exactly your `c.program` form.
   Partner programme names like "BRAND CONNECT" / "ARVELO CONNECT" stay as they are.
5. Never translate: OTA, OTA TECHNOLOGY DMCC, ARVELO, CONNECT, SIM, eSIM, IMEI, ICCID, TAC, IBAN, SWIFT/BIC, USD, UAH, KZT, PDF,
   CSV, Excel, XLSX, SHA-256, PAdES, OTP, 2FA, API, URL, DNS, e-mail addresses, file names, document numbers and number
   patterns (`OTA-INV-YYYY-NNNNNN`, `OTA-PPP-…`, `CFBI`, `CFBO` …), document type codes (MPA, OF, TRT, SLA, BL, BOA, DPA, SIM,
   EUT, PN, CHG, INV, CN, RS, PF, SR, CI, 05A, 05B), plan names **Light / Standard / Premium**, legal citations
   ("Article 31 …", "MPA 7.4", "§10.10"), ISO country/language codes, units like "MB".
6. Translate consistently (pick one term and keep it everywhere): Activation Key(s), Service Token(s), Order Form, Tax Invoice,
   Credit Note, Reconciliation Statement, Commission Invoice, Pro Forma (customs), SIM Receipt & Custody Acknowledgment,
   custody, reseller / point of sale, package, price list, OTA Retained Amount, Net Collected Revenue, questionnaire,
   signatory, Direct Subscriptions. For VAT use the term customary in that language (e.g. MwSt., TVA, IVA, ДДС, KDV).
   Legal document titles (`lg.tt.*`) — use the standard legal term in that language.
7. Plurals: keys ending in `.one / .few / .many / .other` are selected with `Intl.PluralRules` (CLDR) for your language.
   Fill all four. If your language has only one/other, set `.few` and `.many` = the `.other` form. For languages with
   'two'/'zero' categories (sl, ga, mt, lv), those fall back to `.other`, so make `.other` the general plural.
   `c.year1` is used for "one", `c.year2` for "few" and "other", `c.year5` for "many" (number + word, e.g. "2 years").
8. Do not translate placeholder-like demo text in square brackets literally if it is a note to the reader — translate the
   meaning, keep the brackets. Keep typographic quotes natural for the language („…“, «…», “…”).
9. Keep the same capitalisation style as the source (sentence case for labels; CAPS only where the source uses CAPS).
10. Don't shorten meaning, don't add explanations. Keep strings roughly the same length where possible (UI space).
