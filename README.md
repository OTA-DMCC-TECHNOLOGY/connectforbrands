# CONNECT FOR BRANDS

Site: https://connectforbrands.com (GitHub Pages, custom domain via `CNAME`).

| Path | What it is |
|---|---|
| `/` | Landing page (`index.html`) |
| `/partner/` | Partner console demo — v09 commercial model and legal module (questionnaire, document package, e-signing, versions, audit, invoices, statements, SIM shipments) |
| `/portal/` | End-customer portal demo (white-label, 42 languages) |

Both apps are static single-file pages; demo data lives in the browser (`localStorage`).

## Source
- `src/partner-console/` — modules in `src/`, build with `python3 build.py`. Developer docs: `API.md`, `LEGAL_SPEC.md`, `LEGAL_TEMPLATES_NOTES.md`. Legal templates (EN/RU, tokenised) in `legal_src/templates/*.json`; `tools/extract_templates.py` regenerates them from the v09 DOCX pack (the DOCX pack itself is not stored in this public repository).
- `src/customer-portal/` — `app_src.js` + translations in `i18n_base/` and `i18n/`; `build.py` injects them into `index.html`.

## Publish
```
python3 tools/publish.py   # builds both apps into partner/ and portal/
git add -A && git commit && git push
```

Demo limitations (need a backend): e-mail/SMS one-time codes, PAdES sealing, 10-year storage, payments.
