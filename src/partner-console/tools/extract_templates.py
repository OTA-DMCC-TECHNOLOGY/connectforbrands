#!/usr/bin/env python3
"""Extract the CONNECT FOR BRANDS legal pack v12 DOCX templates into tokenised, paragraph-level
bilingual (EN | RU) JSON templates + key catalogue + ARVELO demo values, generate
src/modules/60_legal_templates.js, and run the verification suite.

Private inputs (never committed): legal_src/private_values.json (gitignored) gives
  "pack_dir": path of the DOCX pack (or env LEGAL_PACK_DIR), and
  "replace": [[real, demo], ...] substitutions applied to every DOCX text run before extraction,
so this script, the templates and the module only ever contain fictional demo values; the run
aborts without writing if any real value would reach an output file.

Usage:  python3 tools/extract_templates.py            (writes files, prints report)
        python3 tools/extract_templates.py --check    (verification only, no writes)

Template text syntax (ТЗ §4):
  {{KEY}}           value of KEY (bilingual keys appear as KEY_EN in "en", KEY_L2 in "ru")
  [[KEY|text]]      conditional fragment: rendered only if KEY is filled (not empty / N/A)
Block-level:  "cond":"KEY"  whole block shown only if KEY is filled.
Table-level:  "rowCond":{"<row index>":"KEY"}  row shown only if KEY is filled.
              "repeat":{"row":i,"list":"LIST"} row i is rendered once per item of LIST
              (item keys are resolved from the item first).
Table cell:   {"en","ru"} ; "bi":true = the source cell was one bilingual string "EN / RU"
              (render "en / ru" in the bilingual PDF); cells without "bi" are
              language-neutral (en == ru).

Round-trip principle: every highlighted run of the DOCX and every OTA_* value is replaced
by a token; substituting ARVELO's values (with the placeholders the DOCX shows, e.g. "[ ]")
must reproduce the DOCX cell text exactly. A short list of "structured" replacements
(choices / composite placeholders) and "additions" (ТЗ-mandated conditional fragments) is
reported separately; those are verified by checking the rest of the text is identical.
"""
import json, os, re, sys, copy, collections, difflib
import docx
from docx.oxml.ns import qn
from docx.text.run import Run
from docx.table import Table

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Real-value -> demo-value substitutions and the location of the private DOCX pack live in the gitignored
# legal_src/private_values.json (never commit real OTA / partner requisites). See LEGAL_TEMPLATES_NOTES.md.
PRIVATE_FILE = os.path.join(ROOT, 'legal_src', 'private_values.json')
PRIVATE = json.load(open(PRIVATE_FILE)) if os.path.exists(PRIVATE_FILE) else {}
PACK = os.environ.get('LEGAL_PACK_DIR') or PRIVATE.get('pack_dir') or os.path.join(ROOT, 'legal_src', 'CONNECT_FOR_BRANDS_Legal_Pack_v12')
SANITIZE = sorted(PRIVATE.get('replace', []), key=lambda x: -len(x[0]))
FORBIDDEN = [a for a, _ in SANITIZE] + PRIVATE.get('forbidden_extra', [])


def sanitize(t):
    for a, b in SANITIZE:
        if a in t:
            t = t.replace(a, b)
    return t
OUT = os.path.join(ROOT, 'legal_src', 'templates')
MODULE = os.path.join(ROOT, 'src', 'modules', '60_legal_templates.js')
EFFECTIVE = '2026-09-01'   # on/before the earliest demo v12 issue (3 Sep 2026) and signatures (4–5 Sep), before the demo clock (1 Nov)
TPL_VER = 'v12'   # template version suffix: T-<TYPE>-v12 (legal pack v12 = first edition)
CYR = re.compile('[Ѐ-ӿ]')

# --------------------------------------------------------------------------------------
# Document list
# --------------------------------------------------------------------------------------
P1, P2 = '1_Partner_Package/DOCX/', '2_Templates_and_Tools/DOCX/'
DOCS = [
    # type, docNo, variants {variant: file}, cls, title en, title ru
    ('MPA', '01', {'MPA': P1 + '01_Master_Partner_Agreement.docx'}, 'A', 'Master Partner Agreement', 'Рамочное партнёрское соглашение'),
    ('OF', '02', {'OF-UA': P1 + '02-UA_Order_Form_Ukraine.docx', 'OF-KZ': P1 + '02-KZ_Order_Form_Kazakhstan.docx',
                   'OF-DE': P1 + '02-DE_Order_Form_Germany.docx'}, 'A', 'Order Form', 'Заказ'),
    ('TRT', '03', {'TRT': P1 + '03_Service_Token_Reseller_Terms.docx'}, 'A', 'Service Token Reseller Terms', 'Условия перепродажи сервисных токенов'),
    ('SLA', '04', {'SLA': P1 + '04_Service_Terms_SLA.docx'}, 'B', 'Service Terms and SLA', 'Условия сервиса и SLA'),
    ('BL', '05A', {'BL': P1 + '05A_Brand_Licence_Partner_Owner.docx'}, 'A', 'Brand Licence (Partner is brand owner)', 'Лицензия на бренд (Партнёр – правообладатель)'),
    ('BOA', '05B', {'BOA': P1 + '05B_Brand_Owner_Authorisation_Letter.docx'}, 'A', 'Brand Owner Authorisation Letter', 'Письмо-разрешение правообладателя бренда'),
    ('DPA', '06', {'DPA': P1 + '06_Data_Protection_Addendum.docx'}, 'A', 'Data Protection Addendum', 'Соглашение о защите данных'),
    ('EUT', '07', {'EUT': P1 + '07_End_User_Terms.docx'}, 'C', 'End User Terms (public)', 'Условия для Конечных пользователей (публичный документ)'),
    ('PN', '08', {'PN': P1 + '08_Privacy_Notice.docx'}, 'C', 'Privacy Notice (public)', 'Политика конфиденциальности (публичный документ)'),
    ('SIM', '09', {'SIM': P1 + '09_SIM_Custody_Delivery_Customs.docx'}, 'A', 'SIM Custody, Delivery and Customs Schedule', 'Порядок хранения, поставки и таможенного оформления SIM'),
    ('RS', '10', {'RS': P2 + '10_Monthly_Reconciliation_Statement.docx'}, 'B', 'Monthly Reconciliation Statement', 'Ежемесячный акт сверки'),
    ('PF', '11', {'PF': P2 + '11_SIM_Customs_Pro_Forma.docx'}, 'B', 'Pro Forma Invoice for Customs', 'Проформа-инвойс для таможни'),
    ('SR', '12', {'SR': P2 + '12_SIM_Receipt_Custody_Acknowledgment.docx'}, 'B', 'SIM Receipt and Custody Acknowledgment', 'Акт приёмки SIM на хранение'),
    ('INV', '13', {'INV': P2 + '13_OTA_Invoice_Template.docx'}, 'B', 'Tax Invoice (OTA)', 'Налоговый счёт (счёт OTA)'),
    ('CN', '13A', {'CN': P2 + '13A_OTA_Tax_Credit_Note_Template.docx'}, 'B', 'Tax Credit Note (OTA)', 'Налоговая кредит-нота (OTA)'),
    ('CI', '14', {'CI': P2 + '14_Partner_Commission_Invoice_Template.docx'}, 'B', 'Partner Commission Invoice', 'Счёт Партнёра на вознаграждение'),
    ('CHG', 'E', {'CHG': P2 + 'E_Notice_Change_of_Details.docx'}, 'A', 'Notice of Change of Details', 'Уведомление об изменении реквизитов'),
]
FORM_A = P2 + 'A_Partner_Data_Form.docx'
PKG = {'TRT', 'SLA', 'BL', 'BOA', 'DPA', 'SIM'}   # package docs referring to the MPA

# --------------------------------------------------------------------------------------
# DOCX reading
# --------------------------------------------------------------------------------------
def read_para(p):
    segs = []
    for r in p._p.iter(qn('w:r')):
        run = Run(r, p)
        t = run.text
        if not t:
            continue
        hl = run.font.highlight_color is not None
        if segs and segs[-1][1] == hl:
            segs[-1] = (segs[-1][0] + t, hl)
        else:
            segs.append((t, hl))
    return [(sanitize(t), h) for t, h in segs]


def cell_shade(c):
    pr = c._tc.tcPr
    if pr is None:
        return None
    s = pr.find(qn('w:shd'))
    return s.get(qn('w:fill')) if s is not None else None


def read_doc(path):
    d = docx.Document(path)
    tables = []
    body_paras = []
    for el in d.element.body.iterchildren():
        tag = el.tag.split('}')[1]
        if tag == 'p':
            txt = ''.join(t for t, _ in read_para(docx.text.paragraph.Paragraph(el, d)))
            if txt.strip():
                body_paras.append(txt)
        elif tag == 'tbl':
            t = Table(el, d)
            rows = []
            for r in t.rows:
                cells = []
                for c in r.cells:
                    cells.append({'paras': [read_para(p) for p in c.paragraphs], 'shade': cell_shade(c)})
                rows.append(cells)
            tables.append(rows)
    return tables, body_paras


def seg_text(segs):
    return ''.join(t for t, _ in segs)


def cell_text(cell):
    return '\n'.join(seg_text(p) for p in cell['paras'])


def plain_nohl(cell):
    return '\n'.join(''.join(t for t, h in p if not h) for p in cell['paras'])

# --------------------------------------------------------------------------------------
# Tokenisation rules
# --------------------------------------------------------------------------------------
# Global value map for highlighted text (exact match) -> token
HL_VALUES = {
    # v12 templates are generic: placeholders -> keys
    '[Partner full legal name / Полное наименование Партнёра]': '{{P_NAME}}',
    '[legal form and country of incorporation]': '{{P_FORM_EN}}',
    '[организационно-правовая форма и страна регистрации]': '{{P_FORM_L2}}',
    '[Registration number / Рег. номер]': '{{P_REGNO}}',
    '[Tax / VAT number / Налоговый номер]': '{{P_TAXNO}}',
    '[Registered address]': '{{P_ADDR_EN}}',
    '[Юридический адрес]': '{{P_ADDR_L2}}',
    '[Title]': '{{P_TITLE_EN}}',
    '[Должность]': '{{P_TITLE_L2}}',
    '[должности в родительном падеже]': '{{P_TITLE_L2_GEN}}',
    '[Full name of signatory / ФИО подписанта]': '{{P_SIGNATORY}}',
    '[BRAND] CONNECT': '{{P_PROGRAMME}}',
    'connect.[brand-domain]': '{{P_DOMAIN}}',
    '[BRAND]': '{{P_BRAND}}',
    '[PPP]': '{{P_CODE}}',
    '[Bank]': '{{P_BANK_NAME}}',
    '[Bank address / Адрес банка]': '{{P_BANK_ADDR}}',
    '[SWIFT]': '{{P_BANK_SWIFT}}',
    '[Intermediary bank SWIFT, if any / SWIFT банка-посредника, если есть]': '{{P_BANK_INTERMEDIARY}}',
    '[ops e-mail]': '{{P_EMAIL_OPS}}',
    '[legal e-mail]': '{{P_EMAIL_LEGAL}}',
    '[finance e-mail]': '{{P_EMAIL_FIN}}',
    '[support e-mail]': '{{P_EMAIL_SUPPORT}}',
    '[USD / EUR]': '{{CCY}}',
    '[OSS No.]': '{{OTA_OSS_NO}}', '[№ OSS]': '{{OTA_OSS_NO}}',
    'OTA-[PPP]-OF-UA-001-v1': '{{DOC_NO}}',
    'OTA-[PPP]-OF-KZ-001-v1': '{{DOC_NO}}',
    '[1.0]': '{{DOC_VER}}',
    '[YYYY-NNNN]': '{{DOC_SEQ}}',
    '[YYYY-NNNNNN]': '{{DOC_SEQ}}',
    '[1,000]': None, '[1 000]': None,   # resolved by context
}


class R:
    """Context rule for a highlighted span (or a forced span)."""
    def __init__(self, types, text, rep, lang='*', before=None, label=None, col=None, kind='tok', after=None):
        self.types = types if isinstance(types, (set, list, tuple)) else {types}
        self.text, self.rep, self.lang, self.kind = text, rep, lang, kind
        self.before = re.compile(before) if before else None
        self.after = re.compile(after) if after else None
        self.label = re.compile(label) if label else None
        self.col = re.compile(col) if col else None

    def match(self, typ, lang, text, ctx, before, after):
        if '*' not in self.types and typ not in self.types:
            return False
        if self.lang != '*' and self.lang != lang:
            return False
        if self.text is not None and self.text != text:
            return False
        if self.before and not self.before.search(before):
            return False
        if self.after and not self.after.match(after):
            return False
        if self.label and not self.label.search(ctx.get('label', '')):
            return False
        if self.col and not self.col.search(ctx.get('col', '')):
            return False
        return True


B = '[ ]'
ANY = '*'
# kind: tok = plain token (RT via value), struct = structured replacement (RT keeps literal),
#       lit = allowed literal placeholder kept as text
HL_RULES = [
    # --- document numbers / dates -------------------------------------------------------
    R('MPA', 'OTA-[PPP]-MPA-001-v1', '{{DOC_NO}}'),
    R(PKG, 'OTA-[PPP]-MPA-001-v1', '{{DOC_NO}}', before=r'(Ref\. |№ )$', label=r'^Document \d'),
    R('CHG', 'OTA-[PPP]-MPA-001-v1', '{{DOC_NO}}', before=r'(Ref\. |№ )$', label=r'^Notice of Change'),   # own notice number
    R(ANY, 'OTA-[PPP]-MPA-001-v1', '{{DOC_NO_MPA}}'),
    R('MPA', '[DATE / ДАТА]', '{{DATE}}'),
    R('OF', '[DATE / ДАТА]', '{{MPA_DATE}}'),
    R('OF', '[DATE]', '{{LAUNCH_DATE}}'), R('OF', '[ДАТА]', '{{LAUNCH_DATE}}'),
    R('BOA', '[DATE]', '{{DATE}}'), R('BOA', '[ДАТА]', '{{DATE}}'),
    R({'EUT', 'PN'}, '[DATE]', '{{EFFECTIVE_DATE}}'), R({'EUT', 'PN'}, '[ДАТА]', '{{EFFECTIVE_DATE}}'),
    # --- Order Form ------------------------------------------------------------------------
    R('OF', 'Document 05A (Partner is the brand owner) / Document 05B (authorisation from brand owner)',
      '[[BRAND_DOC_05A|Document 05A (Partner is the brand owner)]][[BRAND_DOC_05B|Document 05B (authorisation from brand owner)]]', kind='struct'),
    R('OF', 'Документ 05A (Партнёр – правообладатель) / Документ 05B (разрешение правообладателя)',
      '[[BRAND_DOC_05A|Документ 05A (Партнёр – правообладатель)]][[BRAND_DOC_05B|Документ 05B (разрешение правообладателя)]]', kind='struct'),
    # v10 (ТЗ 2.4): 1.5 "none" or "the following: {list}"; 3.2 "not applicable" or "X% of payments received, not more than 3%"
    # v12 template: "[none / list of exceptions]" and "[not applicable / up to 3%]" -> ТЗ 2.4 choice texts (v10 wording kept)
    R('OF', '[none / list of exceptions]', '[[OF_EXCEPTIONS_NONE|none]][[OF_EXCEPTIONS_EN|the following: {{OF_EXCEPTIONS_EN}}]]', kind='struct'),
    R('OF', '[нет / перечень исключений]', '[[OF_EXCEPTIONS_NONE|нет]][[OF_EXCEPTIONS_L2|следующие: {{OF_EXCEPTIONS_L2}}]]', kind='struct'),
    R('OF', '[not applicable / up to 3%]', '[[FEE_NONE|not applicable]][[FEE_PCT|{{FEE_PCT}}% of payments received, not more than 3%]]', kind='struct'),
    R('OF', '[не применяется / до 3%]', '[[FEE_NONE|не применяется]][[FEE_PCT|{{FEE_PCT}}% от полученных платежей, но не более 3%]]', kind='struct'),
    # (v09 wording, kept for reference)
    R('OF', '[none / list of programmes, brands, device categories or countries]',
      '[[OF_EXCEPTIONS_EN|{{OF_EXCEPTIONS_EN}}]][[OF_EXCEPTIONS_NONE|none]]', kind='struct'),
    R('OF', '[нет / перечень программ, брендов, категорий устройств или стран]',
      '[[OF_EXCEPTIONS_L2|{{OF_EXCEPTIONS_L2}}]][[OF_EXCEPTIONS_NONE|нет]]', kind='struct'),
    R('OF', '[none / __% of payments received, not more than 3%]',
      '[[FEE_PCT|{{FEE_PCT}}% of payments received]][[FEE_NONE|none]]', kind='struct'),
    R('OF', '[не применяется / __% от полученных платежей, не более 3%]',
      '[[FEE_PCT|{{FEE_PCT}}% от полученных платежей]][[FEE_NONE|не применяется]]', kind='struct'),
    R('OF', B, '{{PRICE_KEY}}', before=r'(Activation Key|Ключ активации).*(USD|EUR) $'),
    R('OF', '[1,000]', '{{INIT_KEYS}}', before=r'Initial order: $'), R('OF', '[1 000]', '{{INIT_KEYS}}', before=r'Первый заказ: $'),
    R('OF', '[1,000]', '{{INIT_SIMS}}', before=r'shipment.*: $'), R('OF', '[1 000]', '{{INIT_SIMS}}', before=r'SIM.*: $'),
    R('OF', '[300]', '{{INIT_TOKENS}}'),
    R('OF', '[3,000]', '{{ANNUAL_TARGET}}'), R('OF', '[3 000]', '{{ANNUAL_TARGET}}'),
    R('OF', '[10,000]', '{{ANNUAL_TARGET}}'), R('OF', '[10 000]', '{{ANNUAL_TARGET}}'),
    R('OF', '[Partner full legal name / Полное наименование Партнёра]', '{{P_BANK_BENEFICIARY}}', label=r'^Beneficiary'),
    R({'OF'}, B, '{{P_EMAIL_OPS}}', label=r'^Operations'),
    R({'OF'}, B, '{{P_EMAIL_LEGAL}}', label=r'^Legal notices'),
    R({'OF'}, B, '{{P_EMAIL_FIN}}', label=r'^Finance'),
    R('OF', '[confirm]', None),  # covered by forced OTA_EMAIL spans (never reached)
    # --- 03 packaging annex: recommended wording keeps its placeholders literally ---------
    R('TRT', '[12/24/36/48/60]', None, kind='lit'), R('TRT', '[date]', None, kind='lit'),
    R('TRT', '[country]', None, kind='lit'), R('TRT', '[дата]', None, kind='lit'), R('TRT', '[страна]', None, kind='lit'),
    R('TRT', '[serial]', '{serial}', kind='struct'), R('TRT', '[серийный]', '{serial}', kind='struct'),   # ТЗ part 5: print variable {serial}
    # --- 05A Brand Licence --------------------------------------------------------------------
    R('BL', B, '{{P_LOGO}}', label=r'^Logo files'),
    R('BL', '[as listed in Annex 1 to each Order Form / согласно Приложению 1 к каждому Заказу]', None, kind='lit'),
    R('BL', '[attach file / приложить файл]', '{{P_BRANDBOOK}}'),
    R('BL', B, '{{P_BRAND_RULES}}', label=r'^Logo use'),
    # --- 05B Brand Owner letter ---------------------------------------------------------------
    R('BOA', '[BRAND OWNER LETTERHEAD]', None, kind='lit'), R('BOA', '[ФИРМЕННЫЙ БЛАНК ПРАВООБЛАДАТЕЛЯ]', None, kind='lit'),
    R('BOA', '[Brand Owner legal name]', '{{P_TM_OWNER_NAME}}'), R('BOA', '[наименование правообладателя]', '{{P_TM_OWNER_NAME}}'),
    R('BOA', '[country]', '{{P_TM_OWNER_COUNTRY_EN}}'), R('BOA', '[страна]', '{{P_TM_OWNER_COUNTRY_L2}}'),
    R('BOA', B, '{{P_TM_OWNER_REGNO}}', before=r'(registration no\.|рег\. №) $'),
    R('BOA', B, '{{P_TM_OWNER_ADDR}}', before=r'(address|адрес) $'),
    R('BOA', '[distributor / licensee]', '{{P_TM_OWNER_RELATION_EN}}'), R('BOA', '[дистрибьютором / лицензиатом]', '{{P_TM_OWNER_RELATION_L2}}'),
    R('BOA', '[countries]', '{{P_TM_OWNER_TERRITORY_EN}}'), R('BOA', '[страны]', '{{P_TM_OWNER_TERRITORY_L2}}'),
    R('BOA', '[Name]', '{{P_TM_OWNER_SIGNATORY}}'), R('BOA', '[Title / Должность]', '{{P_TM_OWNER_TITLE}}'),
    # --- 06 DPA sub-processor row (OTA data) -------------------------------------------------
    R('DPA', '[Email service provider / Почтовый сервис]', '{{OTA_SUBPROC_EMAIL}}'),
    R('DPA', B, '{{OTA_SUBPROC_EMAIL_LOC}}'),
    # --- 07 EUT ---------------------------------------------------------------------------------
    R('EUT', B, '{{P_EMAIL_SUPPORT}}', before=r'(Support|Поддержка): $'),
    R('EUT', B, '{{CC_NAME_EN}}', label=r'^Country /'),
    R('EUT', B, '{{EUT_LANGS}}', label=r'^Languages'),
    R('EUT', B, '{{EUT_WITHDRAWAL}}', label=r'^Consumer withdrawal'),
    R('EUT', B, '{{EUT_CONSUMER_AUTH}}', label=r'^Consumer protection'),
    R('EUT', B, '{{EUT_DP_AUTH}}', label=r'^Data protection'),
    R('EUT', B, '{{EUT_OTHER}}', label=r'^Other mandatory'),
    # --- 10 RS -----------------------------------------------------------------------------------
    R('RS', '[CC-YYYYMM]', '{{CC}}-{{RS_YYYYMM}}', kind='struct'),
    R('RS', '[YYYY-MM]', '{{RS_MONTH}}'),
    R('RS', '[OTA-OF-__-____-___]', '{{DOC_NO_OF}}'),
    R('RS', '[date, no later than the 10th / дата, не позднее 10-го числа]', '{{DATE}}'),
    # --- 11 PF -----------------------------------------------------------------------------------
    R('PF', B, '{{DATE}}', label=r'^Date /'),
    R('PF', B, '{{SHIP_CONSIGNEE}}', label=r'^Consignee'),
    R('PF', B, '{{SHIP_IMPORTER}}', label=r'^Importer of record'),
    R('PF', B, '{{CC_NAME_EN}}', label=r'^Country of (export|dispatch)'),
    R('PF', '[EU country / страна ЕС]', '{{SHIP_FROM_COUNTRY}}'),
    R('PF', '[Warehouse name, street, postcode, city, EU country / Склад, улица, индекс, город, страна ЕС]',
      '{{SHIP_FROM_NAME}}, {{SHIP_FROM_ADDR}}, {{SHIP_FROM_COUNTRY}}', kind='struct'),
    R('PF', '[Supplier / logistics provider acting for OTA, EORI no. / Поставщик или логист от имени OTA, № EORI]',
      '{{EXPORTER_EU}}, EORI no. {{EXPORTER_EORI}}', kind='struct'),
    R('PF', '[named place / адрес]', '{{SHIP_PLACE}}'),
    R('PF', B, '{{SHIP_WAYBILL}}', label=r'^Carrier'),
    R('PF', B, '{{DOC_NO_OF}}', label=r'^Related documents'),
    R('PF', '[form factor]', '{{SHIP_FORM_FACTOR}}'), R('PF', '[форм-фактор]', '{{SHIP_FORM_FACTOR}}'),
    R('PF', '[per manufacturer / по документам производителя]', '{{SHIP_ORIGIN}}'),
    R('PF', B, '{{SHIP_QTY}}', col=r'^Qty'),
    R('PF', B, '{{SHIP_UNIT_VALUE}}', col=r'^Unit value'),
    R('PF', B, '{{SHIP_TOTAL_VALUE}}', col=r'^Total USD'),
    R('PF', B, '{{SHIP_CARTONS}}', before=r'(Packages|Места): $'),
    R('PF', B, '{{SHIP_GROSS_KG}}', before=r'(weight|нетто) $'),
    R('PF', B, '{{SHIP_NET_KG}}', before=r'(weight|нетто) \[ \] / $'),
    R('PF', B, '{{SHIP_ICCID_REF}}', before=r'(reference|ссылка) $'),
    # --- 12 SR -----------------------------------------------------------------------------------
    R('SR', B, '{{DOC_NO_OF}}', label=r'^Order Form'),
    R('SR', '[OTA-PF-]', 'OTA-PF-{{DOC_SEQ}}', kind='struct'),
    R('SR', B, '{{SHIP_WAYBILL}}', label=r'^Waybill'),
    R('SR', B, '{{SR_DELIVERY}}', label=r'^Delivery date'),
    R('SR', B, '{{SR_IMPORTER_DECL}}', label=r'^Importer of record'),
    R('SR', B, '{{SR_STORAGE}}', label=r'^Storage place'),
    R('SR', B, '{{SR_SIM_TYPE}}', col=r'^SIM type'),
    R('SR', B, '{{SHIP_QTY}}', col=r'^Per pro forma'),
    R('SR', B, '{{SR_RECEIVED}}', col=r'^Received'),
    R('SR', B, '{{SR_DIFF}}', col=r'^Difference'),
    R('SR', B, '{{SHIP_ICCID_RANGE}}', col=r'^ICCID'),
    R('SR', '[intact / damaged – description and photos attached]', '{{SR_CONDITION_EN}}'),
    R('SR', '[целая / повреждена – описание и фото прилагаются]', '{{SR_CONDITION_L2}}'),
    R('SR', '[Name of person receiving]', '{{SR_RECEIVER_NAME}}'),
    R('SR', '[Title / Должность]', '{{SR_RECEIVER_TITLE}}'),
    # --- 13 INV ----------------------------------------------------------------------------------
    R({'INV', 'CN'}, B, '{{P_TAXNO}}', before=r'Tax / VAT no\. $'),
    R({'INV', 'CN'}, B, '{{AED_RATE}}', before=r'(rate|курсу ЦБ ОАЭ) $'),
    # --- 13A CN -----------------------------------------------------------------------------------
    R('CN', B, '{{CN_DATE}}', col=r'^Date /'),
    R('CN', B, '{{CN_INV_DATE}}', before=r'от $'),
    R('CN', B, '{{CN_SUBTOTAL}}', label=r'^\|Subtotal credited'),
    R('CN', B, '{{CN_TOTAL}}', label=r'^\|Total credited'),
    # --- E CHG ------------------------------------------------------------------------------------
    R('CHG', '[Party name]', '{{CHG_PARTY_NAME}}'), R('CHG', '[наименование Стороны]', '{{CHG_PARTY_NAME}}'),
    R('CHG', '[DATE]', '{{CHG_EFFECTIVE_DATE}}'), R('CHG', '[ДАТА]', '{{CHG_EFFECTIVE_DATE}}'),
    R('CHG', '[Partner full legal name / Полное наименование Партнёра]', '{{CHG_SIG_COMPANY}}', label=r'^Company'),
    R('CHG', '[Full name of signatory / ФИО подписанта]', '{{CHG_SIG_NAME}}', label=r'^Name'),
    R('CHG', '[Title]', '{{CHG_SIG_TITLE_EN}}', label=r'^Title'), R('CHG', '[Должность]', '{{CHG_SIG_TITLE_L2}}', label=r'^Title'),
    R('INV', B, '{{DATE}}', col=r'^Invoice date'),
    R('INV', B, '{{DUE_DATE}}', col=r'^Due date'),
    R('INV', '[CC-NNN-vN]', None),  # covered by forced span (DOC_NO_OF)
    R('INV', '[Approved Country]', '{{CC_NAME_EN}}'), R('INV', '[страна]', '{{CC_NAME_L2}}'),
    R('INV', '[Light / Standard / Premium]', '{{INV_TOK_PLAN}}'),
    R('INV', '[12/24/36/48/60]', '{{INV_TOK_TERM}}'),
    R('INV', '[Other agreed service / Прочая согласованная услуга]', '{{INV_OTHER_DESC}}'),
    R('INV', B, '{{INV_KEY_QTY}}', label=r'^1$', col=r'^Qty'),
    R('INV', B, '{{INV_KEY_PRICE}}', label=r'^1$', col=r'^Unit price'),
    R('INV', B, '{{INV_KEY_AMOUNT}}', label=r'^1$', col=r'^Amount'),
    R('INV', B, '{{INV_TOK_QTY}}', label=r'^2$', col=r'^Qty'),
    R('INV', B, '{{INV_TOK_PRICE}}', label=r'^2$', col=r'^Unit price'),
    R('INV', B, '{{INV_TOK_AMOUNT}}', label=r'^2$', col=r'^Amount'),
    R('INV', B, '{{INV_OTHER_QTY}}', label=r'^3$', col=r'^Qty'),
    R('INV', B, '{{INV_OTHER_PRICE}}', label=r'^3$', col=r'^Unit price'),
    R('INV', B, '{{INV_OTHER_AMOUNT}}', label=r'^3$', col=r'^Amount'),
    R('INV', B, '{{INV_SUBTOTAL}}', label=r'^\|Subtotal'),
    R('INV', B, '{{INV_TOTAL}}', label=r'^\|Total due'),
    # --- 14 CI -----------------------------------------------------------------------------------
    R('CI', B, '{{P_TAXNO}}', before=r'Tax / VAT no\. $'),
    R('CI', B, '{{DATE}}', col=r'^Invoice date'),
    R('CI', '[20th of the month / 20-е число]', '{{DUE_DATE}}'),
    R('CI', '[YYYY-MM]', '{{RS_MONTH}}'), R('CI', '[ГГГГ-ММ]', '{{RS_MONTH}}'),
    R('CI', '[YYYYMM]', '{{RS_YYYYMM}}'), R('CI', '[ГГГГММ]', '{{RS_YYYYMM}}'),
    R('CI', None, '{{CI_VAT_TREATMENT}}', before=r'НДС $'),
    R('CI', B, '{{CI_AMOUNT}}', label=r'^1$'),
    R('CI', B, '{{CI_VAT_AMOUNT}}', label=r'^\|VAT'),
    R('CI', B, '{{CI_TOTAL}}', label=r'^\|Total due'),
    R('CI', '[Partner full legal name / Полное наименование Партнёра]', '{{P_BANK_BENEFICIARY}}', label=r'^Beneficiary'),
]

OF32_EN = ("Currency conversion is made at the actual settlement rate of OTA's acquirer, shown in the Statement.",
           "Where an End User pays in another currency, conversion into euro is made at the actual settlement rate of OTA's acquirer, shown in the Statement.")
OF32_RU = ('Пересчёт валют производится по фактическому курсу расчётов эквайера OTA, отражаемому в Акте сверки.',
           'Если Конечный пользователь платит в другой валюте, пересчёт в евро производится по фактическому курсу расчётов эквайера OTA, указанному в Акте сверки.')
# Forced spans: matched on the original text (highlighted or not) before anything else.
FORCED = [
    # OTA e-mails with the drafting marker "[confirm]" -> one OTA_* token
    R(ANY, 'ops@example.com [confirm]', '{{OTA_EMAIL_OPS}}'),
    R(ANY, 'legal@example.com [confirm]', '{{OTA_EMAIL_LEGAL}}'),
    R(ANY, 'finance@example.com [confirm]', '{{OTA_EMAIL_FIN}}'),
    R(ANY, 'privacy@example.com [confirm]', '{{OTA_EMAIL_PRIVACY}}'),
    R(ANY, 'privacy@example.com [подтвердить]', '{{OTA_EMAIL_PRIVACY}}'),
    # composite references
    R('INV', 'OTA-[PPP]-OF-[CC-NNN-vN]', '{{DOC_NO_OF}}', kind='struct'),
    R('CN', 'OTA-CN-[YYYY-NNNNNN]', '{{CN_NUMBER}}'),
    R('CHG', 'Notice of Change of Details (template) · Ref.', 'Notice of Change of Details · Ref.', kind='struct'),   # drafting marker dropped
    R('CN', 'OTA-INV-[YYYY-NNNNNN]', '{{CN_INV_NUMBER}}'),
    # 14: statement reference(s) (ТЗ 2.1: OTA-{PARTNER}-RS-{CC}-{YYYYMM}, one invoice may cite several statements)
    R('CI', 'OTA-[PPP]-RS-[CC-YYYYMM]', '{{RS_NO}}', kind='struct'),
    R('CI', 'OTA-RS-[PPP]-[ГГГГММ]', '{{RS_NO}}', kind='struct'),
    # OTA signatory / title in prose
    R('MPA', 'represented by its Manager, Anna Petrova', 'represented by its {{OTA_TITLE_EN}}, {{OTA_SIGNATORY}}'),
    R('MPA', 'в лице менеджера Анны Петровой', 'в лице {{OTA_TITLE_L2_GEN}} {{OTA_SIGNATORY_L2_GEN}}'),
    # OF country-specific literals (UA / KZ) -> country tokens
    R('OF', 'ORDER FORM – UKRAINE', 'ORDER FORM – {{CC_NAME_UPPER_EN}}'),
    R('OF', 'ORDER FORM – KAZAKHSTAN', 'ORDER FORM – {{CC_NAME_UPPER_EN}}'),
    R('OF', 'ORDER FORM – GERMANY', 'ORDER FORM – {{CC_NAME_UPPER_EN}}'), R('OF', 'ЗАКАЗ – ГЕРМАНИЯ', 'ЗАКАЗ – {{CC_NAME_UPPER_L2}}'),
    R('OF', 'Document 02-DE of 14', 'Document 02-{{CC}} of 14'), R('OF', 'Документ 02-DE из 14', 'Документ 02-{{CC}} из 14'),
    R('OF', '{{[OTA-{PARTNER}-OF-DE-NNN-vN]}}', '{{DOC_NO}}', kind='struct'),   # 02-DE drafting placeholder of the Ref line
    R('OF', 'Approved Country: Federal Republic of Germany.', 'Approved Country: {{CC_NAME_FULL_EN}}[[CC_EXCLUSION_EN|, {{CC_EXCLUSION_EN}}]].'),
    R('OF', 'Одобренная страна: Федеративная Республика Германия.', 'Одобренная страна: {{CC_NAME_FULL_L2}}[[CC_EXCLUSION_L2|, {{CC_EXCLUSION_L2}}]].'),
    R('OF', 'functions are available in Germany and', 'functions are available in {{CC_NAME_EN}} and'),
    R('OF', 'доступны в Германии и', 'доступны в {{CC_NAME_LOC_L2}} и'),
    R('OF', 'ЗАКАЗ – УКРАИНА', 'ЗАКАЗ – {{CC_NAME_UPPER_L2}}'),
    R('OF', 'ЗАКАЗ – КАЗАХСТАН', 'ЗАКАЗ – {{CC_NAME_UPPER_L2}}'),
    R('OF', 'Document 02-UA of 14', 'Document 02-{{CC}} of 14'), R('OF', 'Document 02-KZ of 14', 'Document 02-{{CC}} of 14'),
    R('OF', 'Документ 02-UA из 14', 'Документ 02-{{CC}} из 14'), R('OF', 'Документ 02-KZ из 14', 'Документ 02-{{CC}} из 14'),
    R('OF', 'Approved Country: Ukraine, excluding the temporarily occupied territories.',
      'Approved Country: {{CC_NAME_FULL_EN}}[[CC_EXCLUSION_EN|, {{CC_EXCLUSION_EN}}]].'),
    R('OF', 'Approved Country: Republic of Kazakhstan.',
      'Approved Country: {{CC_NAME_FULL_EN}}[[CC_EXCLUSION_EN|, {{CC_EXCLUSION_EN}}]].'),
    R('OF', 'Одобренная страна: Украина, за исключением временно оккупированных территорий.',
      'Одобренная страна: {{CC_NAME_FULL_L2}}[[CC_EXCLUSION_L2|, {{CC_EXCLUSION_L2}}]].'),
    R('OF', 'Одобренная страна: Республика Казахстан.',
      'Одобренная страна: {{CC_NAME_FULL_L2}}[[CC_EXCLUSION_L2|, {{CC_EXCLUSION_L2}}]].'),
    R('OF', 'functions are available in Ukraine and', 'functions are available in {{CC_NAME_EN}} and'),
    R('OF', 'functions are available in Kazakhstan and', 'functions are available in {{CC_NAME_EN}} and'),
    R('OF', 'доступны в Украине и', 'доступны в {{CC_NAME_LOC_L2}} и'),
    R('OF', 'доступны в Казахстане и', 'доступны в {{CC_NAME_LOC_L2}} и'),
    # v12 currency per Order Form (MPA 8.1): USD, or EUR for Approved Countries in Europe (02-DE)
    R('OF', 'euro (EUR)', 'euro (EUR)'), R('OF', 'евро (EUR)', 'евро (EUR)'),     # clause 1.6 wording stays literal
    R({'OF', 'CI'}, '[Partner EUR account / IBAN]', '[[CCY_USD|{{P_BANK_IBAN}}]][[CCY_EUR|{{P_BANK_IBAN_EUR}}]]'),
    R({'OF', 'CI'}, '[Account / IBAN]', '[[CCY_USD|{{P_BANK_IBAN}}]][[CCY_EUR|{{P_BANK_IBAN_EUR}}]]'),
    R('OF', 'Account / IBAN (EUR)', 'Account / IBAN[[CCY_EUR| (EUR)]]', kind='struct'),
    R('OF', 'Account / IBAN', 'Account / IBAN[[CCY_EUR| (EUR)]]', kind='struct'),
    R({'OF', 'INV'}, 'AE070331234567890123456', '[[CCY_USD|{{OTA_BANK_IBAN}}]][[CCY_EUR|{{OTA_BANK_IBAN_EUR}}]]'),
    R({'OF', 'INV'}, 'AE070339876543210987654', '[[CCY_USD|{{OTA_BANK_IBAN}}]][[CCY_EUR|{{OTA_BANK_IBAN_EUR}}]]'),
    R({'OF', 'INV'}, '1234567890123', '[[CCY_USD|{{OTA_BANK_ACCOUNT}}]][[CCY_EUR|{{OTA_BANK_ACCOUNT_EUR}}]]'),
    R({'OF', 'INV'}, '9876543210987', '[[CCY_USD|{{OTA_BANK_ACCOUNT}}]][[CCY_EUR|{{OTA_BANK_ACCOUNT_EUR}}]]'),
    R('OF', 'in local currency, including taxes', '[[CCY_USD|in local currency]][[CCY_EUR|in euro]], including taxes', kind='struct'),
    R('OF', 'in euro, including taxes', '[[CCY_USD|in local currency]][[CCY_EUR|in euro]], including taxes', kind='struct'),
    R('OF', 'в местной валюте, с налогами', '[[CCY_USD|в местной валюте]][[CCY_EUR|в евро]], с налогами', kind='struct'),
    R('OF', 'в евро, с налогами', '[[CCY_USD|в местной валюте]][[CCY_EUR|в евро]], с налогами', kind='struct'),
    R('OF', OF32_EN[0], '[[CCY_USD|%s]][[CCY_EUR|%s]]' % OF32_EN, kind='struct'),
    R('OF', OF32_EN[1], '[[CCY_USD|%s]][[CCY_EUR|%s]]' % OF32_EN, kind='struct'),
    R('OF', OF32_RU[0], '[[CCY_USD|%s]][[CCY_EUR|%s]]' % OF32_RU, kind='struct'),
    R('OF', OF32_RU[1], '[[CCY_USD|%s]][[CCY_EUR|%s]]' % OF32_RU, kind='struct'),
    R('OF', 'USD', '{{CCY}}'), R('OF', 'EUR', '{{CCY}}'),
    # language line (ТЗ §4: generated from LANG2)
    R(ANY, 'made in English and Russian.', 'made in English and {{LANG2_NAME_EN}}.'),
    R(ANY, 'на английском и русском языках', 'на английском и {{LANG2_NAME_L2}} языках'),
]

# Literal (non-highlighted) OTA data -> OTA_* tokens (ТЗ §3 "Данные OTA")
OTA_LIT = [
    ('Unit No. 0101, Demo Business Centre, Level 1, Demo Tower, Dubai, UAE', '{{OTA_ADDR_EN}}'),
    ('Unit No. 0101, Demo Business Centre, Level 1, Demo Tower, Дубай, ОАЭ', '{{OTA_ADDR_L2}}'),
    ('DEMO BANK PJSC, 1 Demo Street, Business Bay, Dubai, UAE', '{{OTA_BANK_NAME}}, {{OTA_BANK_ADDR}}'),
    ('AE070331234567890123456', '{{OTA_BANK_IBAN}}'),
    ('1234567890123', '{{OTA_BANK_ACCOUNT}}'),
    ('DEMOAEADXXX', '{{OTA_BANK_SWIFT}}'),
    ('OTA TECHNOLOGY DMCC', '{{OTA_NAME}}'),
    ('DMCC100200', '{{OTA_REGNO}}'),
    ('DMCC-100200', '{{OTA_LICENCE}}'),
    ('100000000000003', '{{OTA_TRN}}'),
    ('Anna Petrova', '{{OTA_SIGNATORY}}'),
    ('AE070339876543210987654', '{{OTA_BANK_IBAN_EUR}}'),   # v12 EUR account (sanitised demo value)
    ('9876543210987', '{{OTA_BANK_ACCOUNT_EUR}}'),
]
OTA_LIT_RE = re.compile('|'.join(re.escape(a) for a, _ in sorted(OTA_LIT, key=lambda x: -len(x[0]))))
OTA_LIT_MAP = dict(OTA_LIT)
# whole-cell literal in signature blocks
SIG_TITLE = {('en', 'Manager'): '{{OTA_TITLE_EN}}', ('ru', 'Менеджер'): '{{OTA_TITLE_L2}}'}

# Conditional wraps applied to tpl AND rt (text exists in the source, depends on N/A-able key)
WRAPS = [
    (ANY, re.compile(r'\nTax / VAT no\. \{\{P_TAXNO\}\}'), '[[P_TAXNO|\nTax / VAT no. {{P_TAXNO}}]]'),
    (ANY, re.compile(r', tax no\. \{\{P_TAXNO\}\}'), '[[P_TAXNO|, tax no. {{P_TAXNO}}]]'),
    (ANY, re.compile(r', налоговый № \{\{P_TAXNO\}\}'), '[[P_TAXNO|, налоговый № {{P_TAXNO}}]]'),
    (ANY, re.compile(r'\nIntermediary / банк-посредник: \{\{P_BANK_INTERMEDIARY\}\}'),
     '[[P_BANK_INTERMEDIARY|\nIntermediary / банк-посредник: {{P_BANK_INTERMEDIARY}}]]'),
]
# Additions to tpl only (ТЗ §4 example; hidden for ARVELO because P_TAXNO is N/A there) -> lawyer check
ADDS = []   # v10: the MPA ", tax no." fragment is now in the DOCX (see WRAPS)

CHOICE_TEXTS = {'none', 'нет', 'not applicable', 'не применяется', '0.00'}   # '0.00' = VAT_ZERO amount (13 / 13A)
WTBA = '[wording to be approved]'
ADDITION_LOG = []


def apply_additions(templates):
    """Blocks / rows mandated by ТЗ v10 that are not in the DOCX (shown only when their key is set)."""
    def find(t, bid):
        return next(i for i, b in enumerate(t['blocks']) if b['id'] == bid)
    # OF: "This version replaces…" paragraph before section 1, only for versions v2+ (ТЗ 2.4, criteria 5 / 22)
    of = templates['OF']
    of['blocks'].insert(find(of, 'OF-s1'), {
        'id': 'OF-replaces', 'kind': 'para', 'cond': 'OF_SUPERSEDES',
        'en': 'This version replaces Order Form No. {{OF_SUPERSEDES}} from {{OF_EFFECTIVE}} under clause 16.5 of the Master Agreement. '
              'Orders paid before that date remain governed by the version under which they were paid.',
        'ru': 'Настоящая версия заменяет Заказ № {{OF_SUPERSEDES}} с {{OF_EFFECTIVE}} согласно п. 16.5 Рамочного соглашения. '
              'Заказы, оплаченные до этой даты, регулируются версией, по которой они были оплачены.'})
    ADDITION_LOG.append(('OF', 'OF-replaces', 'cond OF_SUPERSEDES', 'ТЗ 2.4 wording'))
    # OF: OTA requisites rows (ТЗ 2.6) - no approved label wording exists
    t3 = next(b for b in of['blocks'] if b.get('rows') and b['rows'][1][0].get('en') == 'Beneficiary')
    for key in ('OTA_VAT_LOCAL', 'OTA_REP_LOCAL'):
        t3.setdefault('rowCond', {})[str(len(t3['rows']))] = key
        t3['rows'].append([{'en': WTBA, 'ru': WTBA}, {'en': '{{%s}}' % key, 'ru': '{{%s}}' % key}, {'en': '', 'ru': ''}])
        ADDITION_LOG.append(('OF', t3['id'], 'row if ' + key, 'label ' + WTBA))
    # EUT: Country Schedule rows (ТЗ 2.6)
    eut = templates['EUT']
    t1 = next(b for b in eut['blocks'] if b.get('rows') and b['rows'][0][0].get('en') == 'Item')
    for key, label in (('OTA_VAT_LOCAL', {'en': WTBA, 'ru': WTBA}),
                       ('OTA_REP_LOCAL', {'en': "OTA's representative in your country", 'ru': 'Представитель OTA в вашей стране', 'bi': True})):
        t1.setdefault('rowCond', {})[str(len(t1['rows']))] = key
        t1['rows'].append([label, {'en': '{{%s}}' % key, 'ru': '{{%s}}' % key}])
        ADDITION_LOG.append(('EUT', t1['id'], 'row if ' + key, 'label ' + (label['en'] if label['en'] == WTBA else 'ТЗ 2.6 wording (08 cl. 1.3)')))
    # PN: clause 1.3 OTA's representative (ТЗ 2.6 wording)
    pn = templates['PN']
    pn['blocks'].insert(find(pn, 'PN-1.2') + 1, {
        'id': 'PN-1.3', 'kind': 'clause', 'cond': 'OTA_REP_LOCAL',
        'en': "1.3 OTA's representative in your country: {{OTA_REP_LOCAL}}", 'ru': '1.3 Представитель OTA в вашей стране: {{OTA_REP_LOCAL}}'})
    ADDITION_LOG.append(('PN', 'PN-1.3', 'cond OTA_REP_LOCAL', 'ТЗ 2.6 wording'))


# Repeat rows (lists): (type, header-cell-0 prefix) -> list name, item keys
REPEATS = {
    ('OF', 'Brand / Бренд'): ('DEVICES', ['DEV_BRAND', 'DEV_MODEL', 'DEV_HW', 'DEV_FW', 'DEV_PLAN', 'DEV_MB', 'DEV_SIM']),
    ('BL', 'Mark / Знак'): ('P_TM_LIST', ['TM_MARK', 'TM_REGNO', 'TM_COUNTRIES', 'TM_CLASSES']),
    ('BOA', 'Mark / Знак'): ('P_TM_LIST', ['TM_MARK', 'TM_REGNO', 'TM_COUNTRIES', 'TM_CLASSES']),
    ('CN', 'No. / №'): ('CN_LINES', ['CN_LINE_NO', {'en': '{{CN_LINE_DESC_EN}}', 'ru': '{{CN_LINE_DESC_L2}}', 'bi': True},
                                    'CN_LINE_QTY', 'CN_LINE_PRICE', {'en': '–{{CN_LINE_AMOUNT}}', 'ru': '–{{CN_LINE_AMOUNT}}'}], 1),
    ('CHG', 'Detail / Реквизит'): ('CHG_LIST', ['CHG_LABEL', 'CHG_OLD', 'CHG_NEW']),
}
# Whole-cell replacements (type, exact source cell text) -> template cell; RT keeps the source literal (struct)
CN_REASON_TXT = collections.OrderedDict([
    ('cancel_unpaid', ('Cancellation of an unpaid invoice', 'Отмена неоплаченного счёта')),
    ('error', ('Correction of an error', 'Исправление ошибки')),
    ('refund', ('Refund under clause 4.3 of Document 03 or clause 10.3 of the Master Agreement', 'Возврат по п. 4.3 Документа 03 или п. 10.3 Рамочного соглашения')),
])
VAT0_EN = 'VAT 0% – zero-rated export of services (Article 31, Executive Regulation of Federal Decree-Law No. 8 of 2017 on VAT)'
VAT0_RU = 'НДС 0% – экспорт услуг (ст. 31 Исполнительного регламента Федерального декрета-закона № 8 от 2017 г. о НДС)'
VAT_CELL = {'en': '[[VAT_ZERO|%s]][[VAT_AE|VAT 5%%]]' % VAT0_EN, 'ru': '[[VAT_ZERO|%s]][[VAT_AE|НДС 5%%]]' % VAT0_RU, 'bi': True}
CELL_OVERRIDES = {
    # v12 VAT line variants (MPA 2.6): 0% zero-rated export, or 5% for a Partner in the UAE (flag VAT_AE; VAT_ZERO = not VAT_AE)
    ('INV', '[%s / %s – or, for a Partner in the UAE: VAT 5%% / или для Партнёра в ОАЭ: НДС 5%%]' % (VAT0_EN, VAT0_RU)): VAT_CELL,
    ('INV', '[0.00 / 5%]'): {'en': '[[VAT_ZERO|0.00]][[VAT_AE|{{INV_VAT_AMOUNT}}]]', 'ru': '[[VAT_ZERO|0.00]][[VAT_AE|{{INV_VAT_AMOUNT}}]]'},
    ('INV', 'AED 0.00'): {'en': 'AED [[VAT_ZERO|0.00]][[VAT_AE|{{INV_VAT_AED}}]]', 'ru': 'AED [[VAT_ZERO|0.00]][[VAT_AE|{{INV_VAT_AED}}]]'},
    ('CN', '%s / %s' % (VAT0_EN, VAT0_RU)): VAT_CELL,
    ('CN', '0.00'): {'en': '[[VAT_ZERO|0.00]][[VAT_AE|–{{CN_VAT_AMOUNT}}]]', 'ru': '[[VAT_ZERO|0.00]][[VAT_AE|–{{CN_VAT_AMOUNT}}]]'},
    ('CN', 'AED –0.00'): {'en': 'AED –[[VAT_ZERO|0.00]][[VAT_AE|{{CN_VAT_AED}}]]', 'ru': 'AED –[[VAT_ZERO|0.00]][[VAT_AE|{{CN_VAT_AED}}]]'},
    ('CN', '[Cancellation of an unpaid invoice / Correction of an error / Refund under clause 4.3 of Document 03 or clause 10.3 of the Master Agreement – '
           'Отмена неоплаченного счёта / Исправление ошибки / Возврат по п. 4.3 Документа 03 или п. 10.3 Рамочного соглашения]'):
        {'en': ''.join('[[CN_REASON_%s|%s]]' % (c.upper(), e) for c, (e, r) in CN_REASON_TXT.items()),
         'ru': ''.join('[[CN_REASON_%s|%s]]' % (c.upper(), r) for c, (e, r) in CN_REASON_TXT.items()), 'bi': True},
}
# Row conditions: (type, row label prefix) -> key
ROW_COND = {
    ('CI', 'Intermediary bank'): 'P_BANK_INTERMEDIARY',
    ('DPA', '{{OTA_SUBPROC_EMAIL}}'): 'OTA_SUBPROC_EMAIL',
    ('INV', '3'): 'INV_OTHER_DESC',
}
NO_SPLIT = [re.compile(r'^\d+ months / мес\.$'), re.compile(r'^VAT / НДС '), re.compile(r' of / от ')]

# RS: tokens for empty value cells (filled by the ops module)
RS_A_LINES = ['MONTHS', 'GROSS', 'TAX', 'ACQ', 'REFUNDS', 'FEE', 'NCR', 'RETAINED', 'CORR', 'COMMISSION']
RS_B_LINES = ['KEYS', 'TOKENS', 'OTHER', 'TOTAL']
RS_D_LINES = ['SIM_CUSTODY', 'SIM_LOST', 'KEYS', 'TOKENS', 'ACTIVE', 'IMEI_ADDED']

# --------------------------------------------------------------------------------------
STRUCT_LOG, LIT_LOG, ADD_LOG, UNMAPPED = [], [], [], []
HL_SEEN = collections.Counter()


def resolve_hl(typ, lang, text, ctx, before, after):
    if typ == 'OF' and text == B and ctx.get('label') in ('Light', 'Standard', 'Premium'):
        m = re.match(r'^(\d+) months', ctx.get('col', ''))
        if m:
            return '{{TOK_%s_%s}}' % (ctx['label'].upper(), m.group(1)), 'tok'
        if ctx.get('col', '').startswith('OTA Retained Amount'):
            return '{{RET_%s}}' % ctx['label'].upper(), 'tok'
    for r in HL_RULES:
        if r.match(typ, lang, text, ctx, before, after):
            return r.rep, r.kind
    v = HL_VALUES.get(text)
    if v:
        return v, 'tok'
    return None, None


def tokenise(typ, variant, segs, lang, ctx):
    """segs: [(text, hl)] for one paragraph/part. Returns (tpl, rt)."""
    S = ''.join(t for t, _ in segs)
    mask = []
    for t, h in segs:
        mask += [h] * len(t)
    covered = [None] * len(S)  # index -> span id
    spans = []  # (start, end, tpl, rt)
    # 1. forced spans
    for r in FORCED:
        if '*' not in r.types and typ not in r.types:
            continue
        i = 0
        while True:
            j = S.find(r.text, i)
            if j < 0:
                break
            k = j + len(r.text)
            if all(c is None for c in covered[j:k]):
                rt = S[j:k] if r.kind == 'struct' else r.rep
                if r.kind == 'struct':
                    STRUCT_LOG.append((variant, lang, S[j:k], r.rep))
                spans.append((j, k, r.rep, rt))
                for x in range(j, k):
                    covered[x] = len(spans)
                for x in range(j, k):
                    if mask[x]:
                        HL_SEEN['forced'] += 1
                        break
            i = k
    # 2. highlighted spans
    i = 0
    while i < len(S):
        if mask[i] and covered[i] is None:
            j = i
            while j < len(S) and mask[j] and covered[j] is None:
                j += 1
            text = S[i:j]
            core = text.strip()
            lead = text[:len(text) - len(text.lstrip())]
            trail = text[len(text.rstrip()):]
            if not core:
                i = j
                continue
            rep, kind = resolve_hl(typ, lang, core, ctx, S[:i] + lead, S[j - len(trail):])
            HL_SEEN['hl'] += 1
            if rep is None and kind != 'lit':
                UNMAPPED.append((variant, lang, core, ctx.get('label', '')[:40], S[max(0, i - 50):i]))
                rep = '<<UNMAPPED:%s>>' % core
            if kind == 'lit':
                LIT_LOG.append((variant, lang, core))
                rep = core
                rt = core
            elif kind == 'struct':
                STRUCT_LOG.append((variant, lang, core, rep))
                rt = core
            else:
                rt = rep
            spans.append((i, j, lead + rep + trail, lead + rt + trail))
            for x in range(i, j):
                covered[x] = len(spans)
            i = j
        else:
            i += 1
    # 3. literal OTA data in the remaining text
    for m in OTA_LIT_RE.finditer(S):
        a, b = m.span()
        if all(c is None for c in covered[a:b]):
            rep = OTA_LIT_MAP[m.group(0)]
            spans.append((a, b, rep, rep))
            for x in range(a, b):
                covered[x] = len(spans)
    # whole-part OTA title in signature tables
    if ctx.get('sig') and (lang, S) in SIG_TITLE and all(c is None for c in covered):
        rep = SIG_TITLE[(lang, S)]
        spans.append((0, len(S), rep, rep))
    spans.sort()
    tpl = rt = ''
    pos = 0
    for a, b, t, r in spans:
        tpl += S[pos:a] + t
        rt += S[pos:a] + r
        pos = b
    tpl += S[pos:]
    rt += S[pos:]
    return tpl, rt


def apply_wraps(typ, lang, tpl, rt):
    for types, rx, rep in WRAPS:
        tpl = rx.sub(lambda m: rep, tpl)
        rt = rx.sub(lambda m: rep, rt)
    for t, lg, old, new in ADDS:
        if t == typ and lg == lang and old in tpl:
            tpl = tpl.replace(old, new)
            ADD_LOG.append((typ, lang, new))
    return tpl, rt


def tok_cell_paras(typ, variant, paras, lang, ctx):
    tp, rp = [], []
    for segs in paras:
        a, b = tokenise(typ, variant, segs, lang, ctx)
        tp.append(a)
        rp.append(b)
    return apply_wraps(typ, lang, '\n'.join(tp), '\n'.join(rp))


def split_bi(paras):
    """Return split index in the single paragraph if the cell is 'EN / RU', else None."""
    if len(paras) != 1:
        return None
    segs = paras[0]
    S = ''.join(t for t, _ in segs)
    if any(rx.search(S) for rx in NO_SPLIT):
        return None
    mask = []
    for t, h in segs:
        mask += [h] * len(t)
    best = None
    for m in re.finditer(' / ', S):
        a = m.start()
        if any(mask[a:a + 3]):
            continue
        left, right = S[:a], S[a + 3:]
        lnh = ''.join(ch for ch, h in zip(left, mask[:a]) if not h)
        rnh = ''.join(ch for ch, h in zip(right, mask[a + 3:]) if not h)
        if not CYR.search(lnh) and CYR.search(right) and not CYR.search(left.split('[')[0] if '[' in left else left):
            best = a
    return best


def cut_segs(segs, a, b):
    out, pos = [], 0
    for t, h in segs:
        s, e = pos, pos + len(t)
        x, y = max(s, a), min(e, b)
        if x < y:
            out.append((t[x - s:y - s], h))
        pos = e
    return out

# --------------------------------------------------------------------------------------
NUM_RE = re.compile(r'^(\d+(?:\.\d+)+)\s')
SEC_RE = re.compile(r'^(\d+|[A-Z])\.\s')
LETTER_CLAUSE_RE = re.compile(r'^([A-Z]\.\d+)\s')
PRE_RE = re.compile(r'^\(([A-Z])\)\s')


def table_is_bi(rows):
    if any(len(r) != 2 for r in rows):
        return False
    for r in rows:
        if CYR.search(plain_nohl(r[0])):
            return False
    return True


def build(typ, variant, path):
    tables, body = read_doc(os.path.join(PACK, path))
    assert not body, (variant, body)
    blocks, rt_blocks, orig_blocks = [], [], []
    ids = set()
    sec = None
    pcount = collections.Counter()
    tcount = 0

    def uid(i):
        base = i
        n = 1
        while i in ids:
            n += 1
            i = '%s.%s' % (base, chr(96 + n))
        ids.add(i)
        return i

    first = True
    for ti, rows in enumerate(tables):
        if table_is_bi(rows):
            for ri, r in enumerate(rows):
                en_c, ru_c = r
                ctx = {'label': cell_text(en_c)}
                en_t, en_rt = tok_cell_paras(typ, variant, en_c['paras'], 'en', ctx)
                ru_t, ru_rt = tok_cell_paras(typ, variant, ru_c['paras'], 'ru', ctx)
                oen, oru = cell_text(en_c), cell_text(ru_c)
                shade = en_c['shade']
                if first and ri == 0:
                    kind, bid = 'heading', '%s-title' % typ
                elif first and ri == 1 and (oen.startswith('Document ') or typ == 'CHG'):
                    kind, bid = 'para', '%s-ref' % typ
                elif shade in ('F3F3F3', 'E8ECF2'):
                    kind = 'annex' if re.match(r'^(Annex|Country Schedule)', oen) else 'heading'
                    m = SEC_RE.match(oen)
                    if m:
                        sec = m.group(1)
                        bid = '%s-s%s' % (typ, sec)
                    else:
                        sec = None
                        pcount['h'] += 1
                        bid = '%s-h%d' % (typ, pcount['h'])
                else:
                    m = NUM_RE.match(oen) or LETTER_CLAUSE_RE.match(oen)
                    m2 = SEC_RE.match(oen)
                    m3 = PRE_RE.match(oen)
                    if m:
                        kind, bid = 'clause', '%s-%s' % (typ, m.group(1))
                    elif m2:
                        kind, bid = 'clause', '%s-%s' % (typ, m2.group(1))
                    elif m3:
                        kind, bid = 'clause', '%s-%s' % (typ, m3.group(1))
                    else:
                        kind = 'para'
                        pcount[sec] += 1
                        bid = ('%s-s%s.p%d' % (typ, sec, pcount[sec])) if sec else ('%s-p%d' % (typ, pcount[sec]))
                b = {'id': uid(bid), 'kind': kind, 'en': en_t, 'ru': ru_t}
                blocks.append(b)
                rt_blocks.append({'en': en_rt, 'ru': ru_rt})
                orig_blocks.append({'en': oen, 'ru': oru})
            first = False
            continue
        first = False
        # grid table
        tcount += 1
        hdr0 = cell_text(rows[0][0])
        sig = hdr0.startswith('Company / Компания')
        kind = 'signature' if sig else 'table'
        bid = uid('%s-%s%d' % (typ, 'sig' if sig else 't', tcount))
        rep = REPEATS.get((typ, hdr0))
        rep_n = (rep[2] if rep and len(rep) > 2 else 10 ** 6)
        trows, rtrows, orows = [], [], []
        rowcond = {}
        rs_tbl = None
        if typ == 'RS':
            rs_tbl = {'Line / Строка': 'A', 'Indicator / Показатель': 'D'}.get(hdr0)
            if hdr0.startswith('Invoice no.'):
                rs_tbl = 'B' if len(rows) > 2 else 'C'
        rep_items = []
        for ri, r in enumerate(rows):
            label = cell_text(r[0])
            ocells, tcells, rcells = [], [], []
            for ci, c in enumerate(r):
                col = cell_text(rows[0][ci]) if ri > 0 else ''
                ctx = {'label': label if ci > 0 else '', 'col': col, 'sig': sig}
                if ri > 0 and ci > 0 and len(r) > 2 and typ in ('INV', 'CI', 'CN') and label == '':
                    ctx['label'] = '|' + cell_text(r[1])
                oc = cell_text(c)
                ocells.append(oc)
                if rep and 0 < ri <= rep_n:
                    k = rep[1][ci]
                    tcells.append(dict(k) if isinstance(k, dict) else {'en': '{{%s}}' % k, 'ru': '{{%s}}' % k})
                    rcells.append(None)
                    continue
                ov = CELL_OVERRIDES.get((typ, oc))
                if ov:
                    STRUCT_LOG.append((variant, 'cell', oc, json.dumps(ov, ensure_ascii=False)))
                    tcells.append(dict(ov))
                    rcells.append({'en': oc, 'ru': oc})
                    continue
                if rs_tbl and ri > 0 and ci > 0 and oc == '':
                    if rs_tbl == 'A':
                        k = 'RS_A_%s_%s' % (RS_A_LINES[ri - 1], cell_text(rows[0][ci]).upper())
                    elif rs_tbl == 'B':
                        k = 'RS_B_%s_%s' % (RS_B_LINES[ri - 1], ['NO', 'DESC', 'AMOUNT', 'PAID', 'DUE'][ci])
                    elif rs_tbl == 'C':
                        k = 'RS_C_COMMISSION_%s' % ['NO', 'DESC', 'AMOUNT', 'PAID', 'DUE'][ci]
                    else:
                        k = 'RS_D_%s' % RS_D_LINES[ri - 1]
                    tcells.append({'en': '{{%s}}' % k, 'ru': '{{%s}}' % k})
                    rcells.append({'en': '{{%s}}' % k, 'ru': '{{%s}}' % k})
                    continue
                sp = split_bi(c['paras'])
                if sp is not None:
                    segs = c['paras'][0]
                    S = seg_text(segs)
                    lctx = dict(ctx)
                    a1, r1 = tok_cell_paras(typ, variant, [cut_segs(segs, 0, sp)], 'en', lctx)
                    a2, r2 = tok_cell_paras(typ, variant, [cut_segs(segs, sp + 3, len(S))], 'ru', lctx)
                    tcells.append({'en': a1, 'ru': a2, 'bi': True})
                    rcells.append({'en': r1, 'ru': r2, 'bi': True})
                else:
                    lang = 'ru' if (CYR.search(plain_nohl(c)) and not CYR.search(plain_nohl(c).split(' / ')[0])) else 'en'
                    a1, r1 = tok_cell_paras(typ, variant, c['paras'], 'en', ctx)
                    tcells.append({'en': a1, 'ru': a1})
                    rcells.append({'en': r1, 'ru': r1})
            if rep and 0 < ri <= rep_n:
                rep_items.append(dict(zip(range(len(ocells)), ocells)))
                if ri == 1:
                    trows.append(tcells)
                    rtrows.append(None)
                orows.append(ocells)
                continue
            for (t, lab), k in ROW_COND.items():
                if t == typ and (label.startswith(lab) or (tcells and tcells[0]['en'].startswith(lab))):
                    if lab == '3' and label != '3':
                        continue
                    rowcond[str(len(trows))] = k
            trows.append(tcells)
            rtrows.append(rcells)
            orows.append(ocells)
        b = {'id': bid, 'kind': kind, 'rows': trows}
        if rowcond:
            b['rowCond'] = rowcond
        if rep:
            b['repeat'] = {'row': 1, 'list': rep[0]}
        blocks.append(b)
        rt_blocks.append({'rows': rtrows, 'repeat': rep, 'items': rep_items, 'rep_n': rep_n})
        orig_blocks.append({'rows': orows})
    return blocks, rt_blocks, orig_blocks

# --------------------------------------------------------------------------------------
# Partner Data Form (A) -> ARVELO values
# --------------------------------------------------------------------------------------
FORM_KEYS = {
    'Legal name / Полное наименование': ['P_NAME'],
    'Legal form and country of incorporation (EN)': ['P_FORM_EN'],
    'Legal form and country of incorporation (RU)': ['P_FORM_L2'],
    'Company no. / Рег. №': ['P_REGNO'],
    'Tax / VAT no. / Налоговый номер': ['P_TAXNO'],
    'Registered address / Юридический адрес': ['P_ADDR_EN'],
    'Signatory name / ФИО подписанта': ['P_SIGNATORY'],
    'Signatory title (EN / RU)': ['P_TITLE_EN', 'P_TITLE_L2'],
    'Basis of authority': ['P_AUTHORITY'],
    'Brand / Бренд': ['P_BRAND'],
    'Programme name': ['P_PROGRAMME'],
    'Who owns the trade marks?': ['P_TM_OWNER_IS_PARTNER'],
    'Trade mark owner (if not Partner)': ['P_TM_OWNER_NAME'],
    'Trade mark registrations': ['P_TM_REGS'],
    'Second language of documents': ['LANG2'],
    'Domain / subdomain for the portal': ['P_DOMAIN'],
    'Technical contact for DNS': ['P_DNS_CONTACT'],
    'Logo files and brand book': ['P_LOGO'],
    'Operations email': ['P_EMAIL_OPS'],
    'Legal notices email': ['P_EMAIL_LEGAL'],
    'Finance email': ['P_EMAIL_FIN'],
    'Support email for End Users': ['P_EMAIL_SUPPORT'],
    'Phone / Телефон': ['P_PHONE'],
    'Bank account / IBAN': ['P_BANK_IBAN'],
    'Bank name and address': ['P_BANK_NAME', 'P_BANK_ADDR'],
    'SWIFT / Intermediary SWIFT': ['P_BANK_SWIFT', 'P_BANK_INTERMEDIARY'],
}


def read_form():
    tables, _ = read_doc(os.path.join(PACK, FORM_A))
    vals = {}
    sec = 0
    for rows in tables:
        if len(rows) == 1 and len(rows[0]) == 2:
            m = re.match(r'^(\d)\.', cell_text(rows[0][0]))
            if m:
                sec = int(m.group(1))
            continue
        if not (len(rows[0]) == 2 and cell_text(rows[0][0]).startswith('Field')):
            continue
        for r in rows[1:]:
            label = cell_text(r[0])
            if sec == 1:
                continue
            for pre, keys in FORM_KEYS.items():
                if label.startswith(pre) and not (sec == 4 and pre == 'Brand / Бренд'):
                    if pre in ('Operations email', 'Legal notices email', 'Finance email') and sec != 4:
                        continue
                    hls = [t for p in r[1]['paras'] for t, h in p if h]
                    parts = [h for h in hls if h.strip(' /,')]
                    for k, v in zip(keys, parts):
                        vals[k] = v
    return vals

# --------------------------------------------------------------------------------------
# Key catalogue
# --------------------------------------------------------------------------------------
# key: (label RU, source, required, tz-listed)
#  source: partner | ota | commercial | country | system | shipment | invoice | statement
#  required: required | na (may be N/A, flag by OTA / empty OTA field) | optional | auto
K = {}
def k(key, label, src, req='required', tz=True, fmt=None, pair=None, note=None):
    K[key] = dict(key=key, label=label, src=src, req=req, tz=tz)
    if fmt: K[key]['format'] = fmt
    if pair: K[key]['pair'] = pair
    if note: K[key]['note'] = note

# partner questionnaire (ТЗ §3)
k('P_NAME', 'Полное наименование партнёра', 'partner')
k('P_FORM_EN', 'Форма и страна учреждения (англ.)', 'partner', pair='P_FORM')
k('P_FORM_L2', 'Форма и страна учреждения (второй язык)', 'partner', pair='P_FORM')
k('P_INC_COUNTRY', 'Страна регистрации (учреждения), ISO', 'partner', note='v12 МПА п. 2.6 / Анкета: налоговый статус; не выводится в текстах')
k('P_COUNTRY', 'Страна регистрации (ISO) – устаревший синоним P_INC_COUNTRY (v10)', 'partner', req='optional', tz=False, note='deprecated: = P_INC_COUNTRY; не выводится в текстах')
k('P_TAX_COUNTRY', 'Страна налогового резидентства, ISO', 'partner', note='v12 МПА п. 2.6 / Анкета; не выводится в текстах')
k('P_VAT_REGS', 'Регистрации плательщиком НДС (страны и номера; «нет» если нет)', 'partner', req='na', note='v12 МПА п. 2.6 / Анкета; не выводится в текстах')
k('P_UAE_FE', 'Постоянное представительство в ОАЭ (да/нет)', 'partner', fmt='bool', note='v12 МПА п. 2.6: НДС 5% если резидент ОАЭ / зарегистрирован по НДС в ОАЭ / есть постоянное представительство в ОАЭ (→ VAT_AE), иначе 0%')
k('P_REGNO', 'Регистрационный номер', 'partner')
k('P_TAXNO', 'Налоговый / VAT-номер', 'partner', req='na')
k('P_ADDR_EN', 'Юридический адрес (англ.)', 'partner', pair='P_ADDR')
k('P_ADDR_L2', 'Юридический адрес (второй язык)', 'partner', pair='P_ADDR')
k('P_SIGNATORY', 'ФИО подписанта', 'partner')
k('P_TITLE_EN', 'Должность подписанта (англ.)', 'partner', pair='P_TITLE')
k('P_TITLE_L2', 'Должность подписанта (второй язык)', 'partner', pair='P_TITLE')
k('P_TITLE_L2_GEN', 'Должность подписанта, родительный падеж («в лице …»)', 'partner', pair='P_TITLE')
k('P_AUTHORITY', 'Основание полномочий (+ файл доверенности)', 'partner', note='не выводится в текстах v09')
k('LANG2', 'Второй язык документов', 'partner', note='не выводится напрямую; см. LANG2_NAME_*')
k('P_BRAND', 'Бренд', 'partner')
k('P_PROGRAMME', 'Название программы («БРЕНД CONNECT»)', 'partner')
k('P_TM_OWNER_IS_PARTNER', 'Знаки принадлежат партнёру? (да → 05A, нет → 05B)', 'partner', note='управляет BRAND_DOC_05A/05B и выбором 05A/05B')
k('P_TM_OWNER_NAME', 'Правообладатель: наименование (05B)', 'partner', req='na')
k('P_TM_OWNER_COUNTRY_EN', 'Правообладатель: страна учреждения (англ.)', 'partner', req='na', pair='P_TM_OWNER_COUNTRY')
k('P_TM_OWNER_COUNTRY_L2', 'Правообладатель: страна учреждения (второй язык, предл. падеж «в …»)', 'partner', req='na', pair='P_TM_OWNER_COUNTRY')
k('P_TM_OWNER_REGNO', 'Правообладатель: рег. номер', 'partner', req='na')
k('P_TM_OWNER_ADDR', 'Правообладатель: адрес', 'partner', req='na')
k('P_TM_OWNER_RELATION_EN', 'Статус партнёра у правообладателя (distributor / licensee)', 'partner', req='na', pair='P_TM_OWNER_RELATION')
k('P_TM_OWNER_RELATION_L2', 'Статус партнёра у правообладателя (твор. падеж: дистрибьютором / лицензиатом)', 'partner', req='na', pair='P_TM_OWNER_RELATION')
k('P_TM_OWNER_TERRITORY_EN', 'Страны действия разрешения правообладателя (англ.)', 'partner', req='na', pair='P_TM_OWNER_TERRITORY')
k('P_TM_OWNER_TERRITORY_L2', 'Страны действия разрешения правообладателя (второй язык, предл. падеж)', 'partner', req='na', pair='P_TM_OWNER_TERRITORY')
k('P_TM_OWNER_SIGNATORY', 'Правообладатель: ФИО подписанта', 'partner', req='na')
k('P_TM_OWNER_TITLE', 'Правообладатель: должность подписанта', 'partner', req='na')
k('P_TM_LIST', 'Регистрации знаков (список: знак, №/ведомство, страны, классы МКТУ)', 'partner', fmt='list')
k('TM_MARK', 'Знак (элемент списка P_TM_LIST)', 'partner', fmt='item')
k('TM_REGNO', '№ регистрации и ведомство (элемент P_TM_LIST)', 'partner', fmt='item')
k('TM_COUNTRIES', 'Страны регистрации (элемент P_TM_LIST)', 'partner', fmt='item')
k('TM_CLASSES', 'Классы МКТУ (элемент P_TM_LIST)', 'partner', fmt='item')
k('P_DOMAIN', 'Домен портала (connect.бренд.com)', 'partner')
k('P_DNS_CONTACT', 'Технический контакт по DNS', 'partner', note='не выводится в текстах v09')
k('P_LOGO', 'Файлы логотипа и версия', 'partner')
k('P_BRANDBOOK', 'Брендбук (файл)', 'partner', req='optional')
k('P_BRAND_RULES', 'Правила использования логотипа, цвета, шрифты (05A, прил. 2)', 'partner', req='optional', tz=False)
k('P_EMAIL_OPS', 'E-mail для операций', 'partner')
k('P_EMAIL_LEGAL', 'E-mail для юридических уведомлений', 'partner')
k('P_EMAIL_FIN', 'E-mail для финансов', 'partner')
k('P_EMAIL_SUPPORT', 'E-mail поддержки для пользователей (первая линия)', 'partner')
k('P_PHONE', 'Телефон', 'partner', note='не выводится в текстах v09')
k('P_BANK_BENEFICIARY', 'Банк: получатель', 'partner')
k('P_BANK_IBAN', 'Банк: счёт / IBAN', 'partner')
k('P_BANK_NAME', 'Банк: наименование', 'partner')
k('P_BANK_ADDR', 'Банк: адрес', 'partner')
k('P_BANK_SWIFT', 'Банк: SWIFT', 'partner')
k('P_BANK_INTERMEDIARY', 'Банк-посредник: SWIFT', 'partner', req='na')
k('P_BANK_IBAN_EUR', 'Банк: счёт / IBAN в EUR (если есть Одобренные страны в Европе)', 'partner', req='na', note='v12 Анкета «EUR account»; Заказ и счёт партнёра 14 при CCY = EUR')
k('P_CODE', 'Код партнёра PPP (присваивает OTA)', 'ota')
# OTA data
k('OTA_NAME', 'OTA: наименование', 'ota')
k('OTA_REGNO', 'OTA: регистрационный номер', 'ota')
k('OTA_LICENCE', 'OTA: номер лицензии', 'ota')
k('OTA_TRN', 'OTA: налоговый номер ОАЭ (TRN)', 'ota')
k('OTA_ADDR_EN', 'OTA: адрес (англ.)', 'ota', pair='OTA_ADDR')
k('OTA_ADDR_L2', 'OTA: адрес (второй язык)', 'ota', pair='OTA_ADDR')
k('OTA_SIGNATORY', 'OTA: подписант (латиницей)', 'ota')
k('OTA_SIGNATORY_L2_GEN', 'OTA: подписант, второй язык, родительный падеж («в лице …»)', 'ota', tz=False, pair='OTA_SIGNATORY')
k('OTA_TITLE_EN', 'OTA: должность подписанта (англ.)', 'ota', pair='OTA_TITLE')
k('OTA_TITLE_L2', 'OTA: должность подписанта (второй язык)', 'ota', pair='OTA_TITLE')
k('OTA_TITLE_L2_GEN', 'OTA: должность, родительный падеж («в лице …»)', 'ota', tz=False, pair='OTA_TITLE')
k('OTA_BANK_NAME', 'OTA: банк', 'ota')
k('OTA_BANK_ADDR', 'OTA: адрес банка', 'ota')
k('OTA_BANK_ACCOUNT', 'OTA: номер счёта', 'ota')
k('OTA_BANK_IBAN', 'OTA: IBAN', 'ota')
k('OTA_BANK_SWIFT', 'OTA: SWIFT', 'ota')
k('OTA_BANK_ACCOUNT_EUR', 'OTA: номер счёта в EUR (Одобренные страны в Европе)', 'ota', note='v12: Заказ (DE) и счёт 13 при CCY = EUR')
k('OTA_BANK_IBAN_EUR', 'OTA: IBAN в EUR', 'ota', note='v12: Заказ (DE) и счёт 13 при CCY = EUR')
k('OTA_EMAIL_OPS', 'OTA: e-mail операций', 'ota')
k('OTA_EMAIL_LEGAL', 'OTA: e-mail юридических уведомлений', 'ota')
k('OTA_EMAIL_FIN', 'OTA: e-mail финансов', 'ota')
k('OTA_EMAIL_PRIVACY', 'OTA: e-mail по персональным данным', 'ota')
k('OTA_EMAIL_SUPPORT', 'OTA: e-mail поддержки (вторая линия)', 'ota', note='не выводится в текстах v09 (04 п. 7.1 ссылается на «адрес поддержки OTA» без значения)')
k('OTA_SUPPORT_HOURS', 'OTA: часы поддержки', 'ota', note='не выводится: 04 п. 7.1 содержит часы прозой (литерал)')
# OTA_CUSTOMS_CODE removed in v10 (ТЗ 1.2: SIMs never shipped to/through the UAE)
k('OTA_VAT_LOCAL', 'OTA: налоговая регистрация в стране документа (по стране, S.ota.countries[CC].vat_local)', 'country', req='na', note='ТЗ v10 2.6: выводится только если задано – строка Странового приложения 07, строка реквизитов Заказа')
k('OTA_REP_LOCAL', 'OTA: представитель в стране документа (по стране, S.ota.countries[CC].rep_local)', 'country', req='na', note='ТЗ v10 2.6: выводится только если задано – Страновое приложение 07, п. 1.3 Документа 08, строка реквизитов Заказа')
k('OTA_OSS_NO', 'OTA: регистрационный номер EU One-Stop-Shop (НДС Германии/ЕС; по стране, S.ota.countries[CC].oss_no)', 'country', req='na', note='v12 Заказ 02-DE п. 1.6')
k('OTA_SUBPROC_EMAIL', 'OTA: почтовый сервис-субобработчик (06, прил. 1)', 'ota', req='na', tz=False)
k('OTA_SUBPROC_EMAIL_LOC', 'OTA: расположение почтового субобработчика', 'ota', req='na', tz=False)
k('CARD_DESCRIPTOR', 'Дескриптор в выписке по карте (OTA*БРЕНДCONNECT)', 'ota', tz=False)
# country / order-form params
k('CC', 'Код страны ISO 3166-1 alpha-2', 'country')
k('CCY', 'Валюта Заказа / документа: USD | EUR (S.ota.countries[CC].currency; Европа = EUR)', 'country', note='v12 МПА п. 8.1; выводится в Заказе (цены, раздел 2, реквизиты), счетах 13/13A/14 и акте 10')
k('CCY_USD', 'Флаг: валюта USD', 'system', req='auto', tz=False, note='= (CCY != "EUR"); legalDerive')
k('CCY_EUR', 'Флаг: валюта EUR', 'system', req='auto', tz=False, note='= (CCY == "EUR"); legalDerive')
k('CC_DE', 'Флаг: страна документа – Германия (п. 1.6 Заказа)', 'system', req='auto', tz=False, note='legalDerive ставит CC_<CC> = true для страны документа')
k('CC_NAME_EN', 'Страна (англ.)', 'country', pair='CC_NAME')
k('CC_NAME_L2', 'Страна (второй язык)', 'country', pair='CC_NAME')
k('CC_NAME_UPPER_EN', 'Страна прописными (англ., заголовок Заказа)', 'country', req='auto', tz=False, pair='CC_NAME_UPPER', note='= upper(CC_NAME_EN)')
k('CC_NAME_UPPER_L2', 'Страна прописными (второй язык, заголовок)', 'country', req='auto', tz=False, pair='CC_NAME_UPPER', note='= upper(CC_NAME_L2)')
k('CC_NAME_FULL_EN', 'Официальное название страны (англ., п. 1.1 Заказа)', 'country', tz=False, pair='CC_NAME_FULL')
k('CC_NAME_FULL_L2', 'Официальное название страны (второй язык)', 'country', tz=False, pair='CC_NAME_FULL')
k('CC_NAME_LOC_L2', 'Страна, предложный падеж («в Украине»)', 'country', tz=False, pair='CC_NAME')
k('CC_EXCLUSION_EN', 'Исключение территорий страны (англ.)', 'country', req='na', tz=False, pair='CC_EXCLUSION')
k('CC_EXCLUSION_L2', 'Исключение территорий страны (второй язык)', 'country', req='na', tz=False, pair='CC_EXCLUSION')
k('OF_EXCEPTIONS_EN', 'Исключения из п. 5.6 (англ.)', 'country', req='na', pair='OF_EXCEPTIONS')
k('OF_EXCEPTIONS_L2', 'Исключения из п. 5.6 (второй язык)', 'country', req='na', pair='OF_EXCEPTIONS')
k('OF_EXCEPTIONS_NONE', 'Флаг: исключений из п. 5.6 нет', 'system', req='auto', tz=False, note='= OF_EXCEPTIONS_EN пусто/N/A')
k('BRAND_DOC_05A', 'Флаг: документ о бренде 05A', 'system', req='auto', tz=False, note='= P_TM_OWNER_IS_PARTNER = да')
k('BRAND_DOC_05B', 'Флаг: документ о бренде 05B', 'system', req='auto', tz=False, note='= P_TM_OWNER_IS_PARTNER = нет')
k('LAUNCH_DATE', 'Дата коммерческого запуска', 'country', fmt='date')
k('INIT_SIMS', 'Начальная отгрузка SIM, шт.', 'country', fmt='int')
k('INIT_KEYS', 'Первый заказ: ключей активации', 'country', fmt='int')
k('INIT_TOKENS', 'Первый заказ: сервисных токенов', 'country', fmt='int')
k('ANNUAL_TARGET', 'Годовая цель, активированных устройств', 'country', fmt='int')
k('DEVICES', 'Приложение 1: одобренные устройства (список)', 'country', fmt='list')
for kk, lab in [('DEV_BRAND', 'бренд'), ('DEV_MODEL', 'модель'), ('DEV_HW', 'ревизия'), ('DEV_FW', 'прошивка'), ('DEV_PLAN', 'тариф'), ('DEV_MB', 'ожидаемо МБ в мес.'), ('DEV_SIM', 'тип SIM')]:
    k(kk, 'Устройство: %s (элемент DEVICES)' % lab, 'country', fmt='item')
# commercial terms (OTA only, PriceList)
k('PRICE_KEY', 'Цена ключа активации, в валюте Заказа (CCY)', 'commercial', fmt='money')
for pl in ('LIGHT', 'STANDARD', 'PREMIUM'):
    for tm in (12, 24, 36, 48, 60):
        k('TOK_%s_%d' % (pl, tm), 'Цена токена %s, %d мес., в валюте Заказа' % (pl.title(), tm), 'commercial', fmt='money')
    k('RET_%s' % pl, 'Удерживаемая OTA сумма %s за оплаченный месяц, в валюте Заказа' % pl.title(), 'commercial', fmt='money')
k('FEE_PCT', 'Сбор на соблюдение страновых требований, % (0–3)', 'commercial', req='na', fmt='pct')
k('FEE_NONE', 'Флаг: сбора нет', 'system', req='auto', tz=False, note='= FEE_PCT пусто/0/N/A; FEE_PCT > 3 не принимать (ТЗ 2.4)')
k('OF_SUPERSEDES', 'Номер заменяемой версии Заказа (только версии v2+)', 'system', req='auto', tz=False, note='абзац OF-replaces выводится только если задано (ТЗ 2.4, критерий 5/22)')
k('OF_EFFECTIVE', 'Дата вступления в силу новой версии Заказа', 'system', req='auto', tz=False, fmt='date')
# system / document
k('DOC_NO', 'Номер документа (присваивает портал)', 'system', req='auto')
k('DOC_NO_MPA', 'Номер Рамочного соглашения', 'system', req='auto')
k('DOC_NO_OF', 'Номер Заказа по стране', 'system', req='auto')
k('DOC_SEQ', 'Часть номера YYYY-NNNN(NN) (счёт / проформа / акт / счёт партнёра)', 'system', req='auto')
k('DOC_VER', 'Версия публичного документа (vX.Y)', 'system', req='auto')
k('DATE', 'Дата документа', 'system', req='auto', fmt='date')
k('MPA_DATE', 'Дата Рамочного соглашения', 'system', req='auto', fmt='date')
k('EFFECTIVE_DATE', 'Дата вступления в силу / обновления', 'system', req='auto', fmt='date')
k('DUE_DATE', 'Срок оплаты', 'invoice', req='auto', fmt='date')
k('AED_RATE', 'Курс ЦБ ОАЭ валюта документа (USD/EUR)→AED на дату счёта / кредит-ноты (хранится с документом)', 'invoice', req='auto', tz=False, fmt='rate', note='ТЗ v10 2.2; счёт 13 и кредит-нота 13A')
k('VAT_AE', 'Флаг: НДС ОАЭ 5% (партнёр – резидент / плательщик НДС / постоянное представительство в ОАЭ)', 'invoice', req='auto', tz=False, fmt='bool', note='v12 МПА п. 2.6; = vatRateFor(org) === 5; иначе 0% (экспорт услуг)')
k('VAT_ZERO', 'Флаг: НДС 0% (экспорт услуг)', 'system', req='auto', tz=False, note='= не VAT_AE; legalDerive')
k('INV_VAT_AMOUNT', 'Счёт OTA: сумма НДС 5% в валюте счёта (только VAT_AE)', 'invoice', req='na', tz=False, fmt='money')
k('INV_VAT_AED', 'Счёт OTA: сумма НДС в AED по курсу AED_RATE (только VAT_AE; иначе 0.00 в шаблоне)', 'invoice', req='na', tz=False, fmt='money')
k('CN_VAT_AMOUNT', 'Кредит-нота: корректировка НДС 5% в валюте (без знака; только VAT_AE)', 'invoice', req='na', tz=False, fmt='money')
k('CN_VAT_AED', 'Кредит-нота: корректировка НДС в AED (без знака; только VAT_AE)', 'invoice', req='na', tz=False, fmt='money')
k('LANG2_NAME_EN', 'Название второго языка по-английски (строка о языке)', 'system', req='auto', tz=False)
k('LANG2_NAME_L2', 'Название второго языка на нём самом, форма для строки о языке («русском»)', 'system', req='auto', tz=False)
# public docs (07) country schedule
for kk, lab in [('EUT_LANGS', 'Языки публикации'), ('EUT_WITHDRAWAL', 'Правила отказа и возврата для потребителей'), ('EUT_CONSUMER_AUTH', 'Орган по защите прав потребителей'), ('EUT_DP_AUTH', 'Орган по защите персональных данных'), ('EUT_OTHER', 'Иная обязательная информация')]:
    k(kk, '07 страновое приложение: ' + lab, 'country', req='optional' if kk in ('EUT_WITHDRAWAL', 'EUT_OTHER') else 'required', tz=False)
# shipments (PF 11 / SR 12)
for kk, lab in [('SHIP_FROM_NAME', 'Склад отправки в ЕС: название'), ('SHIP_FROM_ADDR', 'Склад отправки: адрес (улица, индекс, город)'), ('SHIP_FROM_COUNTRY', 'Склад отправки: страна ЕС'),
                ('EXPORTER_EU', 'Экспортёр в декларации (поставщик или логист от имени OTA)'), ('EXPORTER_EORI', 'Экспортёр: номер EORI')]:
    k(kk, 'Отгрузка (v10): ' + lab, 'shipment', tz=False)
for kk, lab in [('SHIP_CONSIGNEE', 'Грузополучатель и адрес доставки'), ('SHIP_IMPORTER', 'Импортёр и налоговый номер'), ('SHIP_PLACE', 'Место поставки DAP'), ('SHIP_WAYBILL', 'Перевозчик и накладная'), ('SHIP_FORM_FACTOR', 'Форм-фактор SIM'), ('SHIP_ORIGIN', 'Происхождение SIM'), ('SHIP_QTY', 'Количество SIM'), ('SHIP_UNIT_VALUE', 'Таможенная стоимость за ед., USD'), ('SHIP_TOTAL_VALUE', 'Итого таможенная стоимость, USD'), ('SHIP_CARTONS', 'Количество коробок'), ('SHIP_GROSS_KG', 'Вес брутто, кг'), ('SHIP_NET_KG', 'Вес нетто, кг'), ('SHIP_ICCID_REF', 'Ссылка на перечень ICCID'), ('SHIP_ICCID_RANGE', 'Диапазон ICCID')]:
    k(kk, 'Отгрузка: ' + lab, 'shipment', tz=False)
for kk, lab in [('SR_DELIVERY', 'дата и адрес доставки'), ('SR_IMPORTER_DECL', 'импортёр и № таможенной декларации'), ('SR_STORAGE', 'место хранения и ответственное лицо'), ('SR_SIM_TYPE', 'тип SIM'), ('SR_RECEIVED', 'получено, шт.'), ('SR_DIFF', 'расхождение, шт.'), ('SR_RECEIVER_NAME', 'ФИО принявшего'), ('SR_RECEIVER_TITLE', 'должность принявшего')]:
    k(kk, 'Акт приёмки SIM: ' + lab, 'shipment', tz=False)
k('SR_CONDITION_EN', 'Акт приёмки: состояние упаковки (англ.)', 'shipment', tz=False, pair='SR_CONDITION')
k('SR_CONDITION_L2', 'Акт приёмки: состояние упаковки (второй язык)', 'shipment', tz=False, pair='SR_CONDITION')
# invoice 13
for kk, lab in [('INV_KEY_QTY', 'ключи: кол-во'), ('INV_KEY_PRICE', 'ключи: цена'), ('INV_KEY_AMOUNT', 'ключи: сумма'), ('INV_TOK_PLAN', 'токены: тариф'), ('INV_TOK_TERM', 'токены: срок, мес.'), ('INV_TOK_QTY', 'токены: кол-во'), ('INV_TOK_PRICE', 'токены: цена'), ('INV_TOK_AMOUNT', 'токены: сумма'), ('INV_OTHER_DESC', 'прочая услуга: описание'), ('INV_OTHER_QTY', 'прочая услуга: кол-во'), ('INV_OTHER_PRICE', 'прочая услуга: цена'), ('INV_OTHER_AMOUNT', 'прочая услуга: сумма'), ('INV_SUBTOTAL', 'итого без НДС'), ('INV_TOTAL', 'итого к оплате')]:
    k(kk, 'Счёт OTA: ' + lab, 'invoice', req='na' if kk.startswith('INV_OTHER') else 'auto', tz=False)
# commission invoice 14
for kk, lab in [('CI_AMOUNT', 'сумма вознаграждения'), ('CI_VAT_TREATMENT', 'режим НДС (по заключению консультанта партнёра)'), ('CI_VAT_AMOUNT', 'сумма НДС'), ('CI_TOTAL', 'итого к оплате')]:
    k(kk, 'Счёт партнёра: ' + lab, 'invoice', tz=False)
# credit note 13A
k('CN_NUMBER', 'Номер кредит-ноты OTA-CN-YYYY-NNNNNN (сквозной, не переиспользуется)', 'invoice', req='auto', tz=False)
k('CN_DATE', 'Дата кредит-ноты', 'invoice', req='auto', tz=False, fmt='date')
k('CN_INV_NUMBER', 'Исходный счёт: номер OTA-INV-…', 'invoice', req='auto', tz=False)
k('CN_INV_DATE', 'Исходный счёт: дата', 'invoice', req='auto', tz=False, fmt='date')
k('CN_REASON', 'Основание: cancel_unpaid | error | refund (тексты ТЗ 2.3)', 'invoice', tz=False, note='управляет флагами CN_REASON_CANCEL_UNPAID / CN_REASON_ERROR / CN_REASON_REFUND')
for c in CN_REASON_TXT:
    k('CN_REASON_' + c.upper(), 'Флаг: основание кредит-ноты = ' + c, 'system', req='auto', tz=False, note='= (CN_REASON == "%s")' % c)
k('CN_LINES', 'Строки кредит-ноты (список; суммы без знака – знак «–» в шаблоне)', 'invoice', fmt='list', tz=False)
for kk, lab in [('CN_LINE_NO', '№'), ('CN_LINE_DESC_EN', 'описание (англ., из исходного счёта)'), ('CN_LINE_DESC_L2', 'описание (второй язык)'),
                ('CN_LINE_QTY', 'кол-во'), ('CN_LINE_PRICE', 'цена'), ('CN_LINE_AMOUNT', 'сумма без знака')]:
    k(kk, 'Строка кредит-ноты: %s (элемент CN_LINES)' % lab, 'invoice', fmt='item', tz=False)
k('CN_SUBTOTAL', 'Кредит-нота: итого к уменьшению без НДС (без знака)', 'invoice', req='auto', tz=False)
k('CN_TOTAL', 'Кредит-нота: итого к уменьшению (без знака)', 'invoice', req='auto', tz=False)
# notice of change of details (E)
k('CHG_PARTY_NAME', 'Уведомление E: наименование уведомляющей Стороны', 'notice', tz=False)
k('CHG_EFFECTIVE_DATE', 'Уведомление E: дата вступления изменения в силу', 'notice', tz=False, fmt='date')
k('CHG_LIST', 'Уведомление E: изменения (список: реквизит, прежнее, новое)', 'notice', fmt='list', tz=False)
for kk, lab in [('CHG_LABEL', 'реквизит'), ('CHG_OLD', 'прежнее значение'), ('CHG_NEW', 'новое значение')]:
    k(kk, 'Уведомление E: %s (элемент CHG_LIST)' % lab, 'notice', fmt='item', tz=False)
k('CHG_SIG_COMPANY', 'Уведомление E: подпись – компания (уведомляющая Сторона)', 'notice', tz=False)
k('CHG_SIG_NAME', 'Уведомление E: подпись – ФИО подписанта', 'notice', tz=False)
k('CHG_SIG_TITLE_EN', 'Уведомление E: подпись – должность (англ.)', 'notice', tz=False, pair='CHG_SIG_TITLE')
k('CHG_SIG_TITLE_L2', 'Уведомление E: подпись – должность (второй язык)', 'notice', tz=False, pair='CHG_SIG_TITLE')
k('{serial}', 'Серийный номер токена в тексте упаковки (Документ 03, приложение) – переменная печати, не ключ шаблона', 'print', req='auto', tz=False, note='в шаблоне TRT остаётся литералом {serial}; подставляется при печати карт')
# statement 10
k('RS_NO', 'Номер(а) акта(ов) сверки OTA-{P}-RS-{CC}-{YYYYMM} через запятую (счёт партнёра 14)', 'statement', req='auto', tz=False)
k('RS_MONTH', 'Отчётный месяц (ГГГГ-ММ)', 'statement', req='auto', tz=False)
k('RS_YYYYMM', 'Отчётный месяц (ГГГГММ, для номера акта)', 'statement', req='auto', tz=False)
RS_A_LAB = ['Оплаченные месяцы подписки', 'Валовые поступления', 'Минус косвенные налоги', 'Минус эквайринг', 'Минус возвраты и chargeback', 'Минус страновой сбор', 'Чистая собранная выручка', 'Минус удерживаемая OTA сумма', 'Корректировки за прошлые месяцы', 'Вознаграждение Партнёра']
for i, ln in enumerate(RS_A_LINES):
    for pl in ('LIGHT', 'STANDARD', 'PREMIUM'):
        k('RS_A_%s_%s' % (ln, pl), 'Акт сверки A: %s – %s' % (RS_A_LAB[i], pl.title()), 'statement', req='optional', tz=False)
RS_B_LAB = ['ключи активации', 'сервисные токены', 'прочие услуги', 'итого']
for i, ln in enumerate(RS_B_LINES):
    for c, cl in [('NO', '№ счёта'), ('DESC', 'описание'), ('AMOUNT', 'сумма'), ('PAID', 'оплачено'), ('DUE', 'к оплате до 20-го')]:
        k('RS_B_%s_%s' % (ln, c), 'Акт сверки B (%s): %s' % (RS_B_LAB[i], cl), 'statement', req='optional', tz=False)
for c, cl in [('NO', '№ счёта'), ('DESC', 'описание'), ('AMOUNT', 'сумма'), ('PAID', 'оплачено'), ('DUE', 'к оплате до 20-го')]:
    k('RS_C_COMMISSION_%s' % c, 'Акт сверки C (счёт партнёра): %s' % cl, 'statement', req='optional', tz=False)
RS_D_LAB = ['неустановленные SIM на хранении', 'SIM утрачено/похищено', 'ключи куплено/использовано/не использовано', 'токены выпущено/погашено/не погашено/истекло', 'активные устройства: токен/подписка', 'IMEI добавлено в Белый список']
for i, ln in enumerate(RS_D_LINES):
    k('RS_D_%s' % ln, 'Акт сверки D: %s' % RS_D_LAB[i], 'statement', req='optional', tz=False)

# --------------------------------------------------------------------------------------
# Values: ARVELO (partner form), OTA seed, countries + round-trip placeholders
# --------------------------------------------------------------------------------------
def demo_prices(key_usd, light_local, std_local, vat, fx):
    disc = {12: .10, 24: .20, 36: .30, 48: .35, 60: .40}
    mon = {'LIGHT': light_local / vat / fx, 'STANDARD': std_local / vat / fx}
    mon['PREMIUM'] = mon['STANDARD'] * 1.5
    out = {'PRICE_KEY': '%.2f' % key_usd}
    for pl, m in mon.items():
        for t, d in disc.items():
            out['TOK_%s_%d' % (pl, t)] = '%.2f' % round(m * t * (1 - d) + 1e-9, 2)
        out['RET_%s' % pl] = '%.2f' % round(m + 1e-9, 2)
    return out


def make_values(form):
    # v12: the Data Form is a generic template ([ ] placeholders) -> the fictional ARVELO demo partner is defined here
    # (same values as the v10 demo; never real requisites)
    ARVELO = {
        'P_NAME': 'ARVELO LIMITED', 'P_FORM_EN': 'a private limited company incorporated in England and Wales',
        'P_FORM_L2': 'частная компания с ограниченной ответственностью, учреждённая в Англии и Уэльсе',
        'P_INC_COUNTRY': 'GB', 'P_COUNTRY': 'GB', 'P_TAX_COUNTRY': 'GB', 'P_VAT_REGS': None, 'P_UAE_FE': False,
        'P_REGNO': '00012345', 'P_TAXNO': None,
        'P_ADDR_EN': '10 Demo Lane, London, N1 0AA, United Kingdom', 'P_ADDR_L2': '10 Demo Lane, London, N1 0AA, Великобритания',
        'P_SIGNATORY': 'Daniel Hart', 'P_TITLE_EN': 'Director', 'P_TITLE_L2': 'Директор', 'P_TITLE_L2_GEN': 'директора',
        'P_BRAND': 'ARVELO', 'P_PROGRAMME': 'ARVELO CONNECT', 'P_DOMAIN': 'connect.arvelo.example',
        'P_BANK_IBAN': 'GB29NWBK60161331926819', 'P_BANK_NAME': 'Demo Bank Ltd', 'P_BANK_ADDR': '2 Demo Square, London, E1 0AA, United Kingdom',
        'P_BANK_SWIFT': 'DEMOGB21', 'P_BANK_INTERMEDIARY': 'DEMOGB2L', 'P_BANK_IBAN_EUR': 'GB71DEMO60161300000077',
    }
    partner = {}
    for key, meta in K.items():
        if meta['src'] != 'partner' or meta.get('format') == 'item':
            continue
        partner[key] = ARVELO.get(key)
    partner['P_BANK_BENEFICIARY'] = partner['P_NAME']
    partner['LANG2'] = 'ru' if form.get('LANG2') == 'Russian' else form.get('LANG2')   # the only real value of the v12 form
    partner['P_TM_OWNER_IS_PARTNER'] = None
    partner['P_TM_LIST'] = [{'TM_MARK': 'ARVELO (word / словесный)', 'TM_REGNO': None, 'TM_COUNTRIES': None, 'TM_CLASSES': None},
                            {'TM_MARK': 'ARVELO (logo / логотип)', 'TM_REGNO': None, 'TM_COUNTRIES': None, 'TM_CLASSES': None}]
    status = {}
    for kk, v in partner.items():
        status[kk] = 'filled' if v not in (None, '', []) else 'empty'
    for kk in ('P_TAXNO',):
        status[kk] = 'empty'   # form shows "[ ]"; OTA decides N/A
    ota = {
        'OTA_NAME': 'OTA TECHNOLOGY DMCC', 'OTA_REGNO': 'DMCC100200', 'OTA_LICENCE': 'DMCC-100200', 'OTA_TRN': '100000000000003',
        'OTA_ADDR_EN': 'Unit No. 0101, Demo Business Centre, Level 1, Demo Tower, Dubai, UAE',
        'OTA_ADDR_L2': 'Unit No. 0101, Demo Business Centre, Level 1, Demo Tower, Дубай, ОАЭ',
        'OTA_SIGNATORY': 'Anna Petrova', 'OTA_SIGNATORY_L2_GEN': 'Анны Петровой',
        'OTA_TITLE_EN': 'Manager', 'OTA_TITLE_L2': 'Менеджер', 'OTA_TITLE_L2_GEN': 'менеджера',
        'OTA_BANK_NAME': 'DEMO BANK PJSC', 'OTA_BANK_ADDR': '1 Demo Street, Business Bay, Dubai, UAE',
        'OTA_BANK_ACCOUNT': '1234567890123', 'OTA_BANK_IBAN': 'AE070331234567890123456', 'OTA_BANK_SWIFT': 'DEMOAEADXXX',
        'OTA_BANK_ACCOUNT_EUR': '9876543210987', 'OTA_BANK_IBAN_EUR': 'AE070339876543210987654',
        'OTA_EMAIL_OPS': 'ops@example.com', 'OTA_EMAIL_LEGAL': 'legal@example.com',
        'OTA_EMAIL_FIN': 'finance@example.com', 'OTA_EMAIL_PRIVACY': 'privacy@example.com', 'OTA_EMAIL_SUPPORT': None,
        'OTA_SUPPORT_HOURS': 'Mon–Fri 09:00–21:00 UTC+4; P1 24/7',
        'OTA_SUBPROC_EMAIL': None, 'OTA_SUBPROC_EMAIL_LOC': None,
        'P_CODE': 'ARV', 'CARD_DESCRIPTOR': 'OTA*ARVELOCONNECT',
    }
    ua = dict(CC='UA', CC_NAME_EN='Ukraine', CC_NAME_L2='Украина', CC_NAME_UPPER_EN='UKRAINE', CC_NAME_UPPER_L2='УКРАИНА',
              CC_NAME_FULL_EN='Ukraine', CC_NAME_FULL_L2='Украина', CC_NAME_LOC_L2='Украине',
              CC_EXCLUSION_EN='excluding the temporarily occupied territories',
              CC_EXCLUSION_L2='за исключением временно оккупированных территорий',
              OF_EXCEPTIONS_EN=None, OF_EXCEPTIONS_L2=None, LAUNCH_DATE=None,
              INIT_SIMS=1000, INIT_KEYS=1000, INIT_TOKENS=300, ANNUAL_TARGET=3000, FEE_PCT=None,
              DEVICES=[], DOC_NO='OTA-ARV-OF-UA-001-v1', CCY='USD', OTA_OSS_NO=None,
              OTA_VAT_LOCAL='DEMO-UA-VAT-000001', OTA_REP_LOCAL=None)   # fictional demo values (ТЗ 2.6: per country)
    ua.update(demo_prices(9.85, 75, 99, 1.2, 45.0564))
    kz = dict(CC='KZ', CC_NAME_EN='Kazakhstan', CC_NAME_L2='Казахстан', CC_NAME_UPPER_EN='KAZAKHSTAN', CC_NAME_UPPER_L2='КАЗАХСТАН',
              CC_NAME_FULL_EN='Republic of Kazakhstan', CC_NAME_FULL_L2='Республика Казахстан', CC_NAME_LOC_L2='Казахстане',
              CC_EXCLUSION_EN=None, CC_EXCLUSION_L2=None,
              OF_EXCEPTIONS_EN=None, OF_EXCEPTIONS_L2=None, LAUNCH_DATE=None,
              INIT_SIMS=1000, INIT_KEYS=1000, INIT_TOKENS=300, ANNUAL_TARGET=3000, FEE_PCT=None,
              DEVICES=[], DOC_NO='OTA-ARV-OF-KZ-001-v1', CCY='USD', OTA_OSS_NO=None,
              OTA_VAT_LOCAL=None, OTA_REP_LOCAL='Demo Representative LLP, 1 Demo Avenue, Almaty, Kazakhstan')
    kz.update(demo_prices(9.40, 990, 1290, 1.16, 441.77))
    # v12: Germany (02-DE) - EUR Order Form, EU OSS registration (fictional), EU representative for 08 cl. 1.3 (fictional)
    de = dict(CC='DE', CC_NAME_EN='Germany', CC_NAME_L2='Германия', CC_NAME_UPPER_EN='GERMANY', CC_NAME_UPPER_L2='ГЕРМАНИЯ',
              CC_NAME_FULL_EN='Federal Republic of Germany', CC_NAME_FULL_L2='Федеративная Республика Германия', CC_NAME_LOC_L2='Германии',
              CC_EXCLUSION_EN=None, CC_EXCLUSION_L2=None,
              OF_EXCEPTIONS_EN=None, OF_EXCEPTIONS_L2=None, LAUNCH_DATE=None,
              INIT_SIMS=1000, INIT_KEYS=1000, INIT_TOKENS=300, ANNUAL_TARGET=10000, FEE_PCT=None,
              DEVICES=[], DOC_NO='OTA-ARV-OF-DE-001-v1', CCY='EUR', OTA_OSS_NO='EU276DEMO01',
              OTA_VAT_LOCAL=None, OTA_REP_LOCAL='Demo EU Representative GmbH, 1 Demostraße, 10115 Berlin, Germany')
    de.update(demo_prices(8.90, 3.99, 4.99, 1.19, 1.0))
    system = {'LANG2_NAME_EN': 'Russian', 'LANG2_NAME_L2': 'русском', 'DOC_NO_MPA': 'OTA-ARV-MPA-001-v1',
              'DOC_NO': {'MPA': 'OTA-ARV-MPA-001-v1', 'TRT': 'OTA-ARV-TRT-001-v1', 'SLA': 'OTA-ARV-SLA-001-v1', 'BL': 'OTA-ARV-BL-001-v1',
                         'BOA': 'OTA-ARV-BOA-001', 'DPA': 'OTA-ARV-DPA-001-v1', 'SIM': 'OTA-ARV-SIM-001-v1', 'CHG': 'OTA-ARV-CHG-001'}}
    # fictional samples for the new v10 documents (CN 13A, E notice, PF ship-from, AED rate)
    samples = {
        'AED_RATE': '3.6725',
        'shipment': {'SHIP_FROM_NAME': 'Demo Logistics Warehouse', 'SHIP_FROM_ADDR': '10 Demostraat, 1000 AA Amsterdam', 'SHIP_FROM_COUNTRY': 'Netherlands',
                     'EXPORTER_EU': 'Demo Logistics B.V. (acting for OTA)', 'EXPORTER_EORI': 'NL000000000'},
        'CN': {'CN_NUMBER': 'OTA-CN-2026-000001', 'CN_DATE': '2026-11-20', 'CN_INV_NUMBER': 'OTA-INV-2026-000001', 'CN_INV_DATE': '2026-11-10',
               'CN_REASON': 'cancel_unpaid', 'AED_RATE': '3.6725', 'CN_SUBTOTAL': '9,850.00', 'CN_TOTAL': '9,850.00',
               'CN_LINES': [{'CN_LINE_NO': '1', 'CN_LINE_DESC_EN': 'Activation Keys – copies of the CONNECT computer program (licence activation keys) – Ukraine',
                             'CN_LINE_DESC_L2': 'Ключи активации – экземпляры компьютерной программы CONNECT (лицензионные ключи активации) – Украина',
                             'CN_LINE_QTY': '1,000', 'CN_LINE_PRICE': '9.85', 'CN_LINE_AMOUNT': '9,850.00'}]},
        'CHG': {'CHG_PARTY_NAME': partner['P_NAME'], 'CHG_EFFECTIVE_DATE': '2026-12-01',
                'CHG_LIST': [{'CHG_LABEL': 'Bank account / IBAN', 'CHG_OLD': partner['P_BANK_IBAN'], 'CHG_NEW': 'GB33DEMO00000000000000'}],
                'CHG_SIG_COMPANY': partner['P_NAME'], 'CHG_SIG_NAME': partner['P_SIGNATORY'], 'CHG_SIG_TITLE_EN': partner['P_TITLE_EN'], 'CHG_SIG_TITLE_L2': partner['P_TITLE_L2']},
        'OF_v2': {'OF_SUPERSEDES': 'OTA-ARV-OF-UA-001-v1', 'OF_EFFECTIVE': '2027-03-01', 'DOC_NO': 'OTA-ARV-OF-UA-001-v2'},
        # v12 (fictional): invoice / credit note for a UAE partner (VAT 5%, MPA 2.6) and for a EUR (DE) order
        'INV_AE': {'VAT_AE': True, 'INV_SUBTOTAL': '9,850.00', 'INV_VAT_AMOUNT': '492.50', 'INV_VAT_AED': '1,808.71',
                   'INV_TOTAL': '10,342.50', 'AED_RATE': '3.6725'},
        'CN_AE': {'VAT_AE': True, 'CN_VAT_AMOUNT': '492.50', 'CN_VAT_AED': '1,808.71', 'CN_TOTAL': '10,342.50'},
        'INV_DE': {'CC': 'DE', 'CCY': 'EUR', 'AED_RATE': '4.2600', 'DOC_NO_OF': 'OTA-ARV-OF-DE-001-v1'},
        'partner_AE': {'P_INC_COUNTRY': 'AE', 'P_TAX_COUNTRY': 'AE', 'P_VAT_REGS': 'AE 100000000000099 (demo TRN)', 'P_UAE_FE': True},
    }
    return {'partner': partner, 'status': status, 'ota': ota, 'countries': {'UA': ua, 'KZ': kz, 'DE': de}, 'system': system, 'samples': samples}


# Round-trip placeholders: what the v09 DOCX shows for each key (lookup: variant/lang, variant/*, */lang, */*)
RT_PLACEHOLDERS = {
    '*': {'*': {
        # v12 generic partner placeholders
        'P_NAME': '[Partner full legal name / Полное наименование Партнёра]', 'P_BANK_BENEFICIARY': '[Partner full legal name / Полное наименование Партнёра]',
        'P_FORM_EN': '[legal form and country of incorporation]', 'P_FORM_L2': '[организационно-правовая форма и страна регистрации]',
        'P_REGNO': '[Registration number / Рег. номер]', 'P_TAXNO': '[Tax / VAT number / Налоговый номер]',
        'P_ADDR_EN': '[Registered address]', 'P_ADDR_L2': '[Юридический адрес]',
        'P_TITLE_EN': '[Title]', 'P_TITLE_L2': '[Должность]', 'P_TITLE_L2_GEN': '[должности в родительном падеже]',
        'P_SIGNATORY': '[Full name of signatory / ФИО подписанта]', 'P_PROGRAMME': '[BRAND] CONNECT', 'P_DOMAIN': 'connect.[brand-domain]',
        'P_BRAND': '[BRAND]', 'P_CODE': '[PPP]', 'P_BANK_NAME': '[Bank]', 'P_BANK_ADDR': '[Bank address / Адрес банка]', 'P_BANK_SWIFT': '[SWIFT]',
        'P_BANK_INTERMEDIARY': '[Intermediary bank SWIFT, if any / SWIFT банка-посредника, если есть]',
        'P_BANK_IBAN': '[Account / IBAN]', 'P_BANK_IBAN_EUR': '[Partner EUR account / IBAN]',
        'P_EMAIL_OPS': '[ops e-mail]', 'P_EMAIL_LEGAL': '[legal e-mail]', 'P_EMAIL_FIN': '[finance e-mail]', 'P_EMAIL_SUPPORT': '[support e-mail]',
        'CCY': '[USD / EUR]', 'CCY_USD': True, 'CCY_EUR': None, 'CC_DE': None, 'VAT_ZERO': True, 'VAT_AE': None,
        'P_LOGO': B, 'P_BRAND_RULES': B, 'P_BRANDBOOK': '[attach file / приложить файл]',
        'P_TM_OWNER_NAME': '[Brand Owner legal name]', 'P_TM_OWNER_REGNO': B, 'P_TM_OWNER_ADDR': B,
        'P_TM_OWNER_COUNTRY_EN': '[country]', 'P_TM_OWNER_COUNTRY_L2': '[страна]',
        'P_TM_OWNER_RELATION_EN': '[distributor / licensee]', 'P_TM_OWNER_RELATION_L2': '[дистрибьютором / лицензиатом]',
        'P_TM_OWNER_TERRITORY_EN': '[countries]', 'P_TM_OWNER_TERRITORY_L2': '[страны]',
        'P_TM_OWNER_SIGNATORY': '[Name]', 'P_TM_OWNER_TITLE': '[Title / Должность]',
        'OTA_EMAIL_OPS': 'ops@example.com [confirm]', 'OTA_EMAIL_LEGAL': 'legal@example.com [confirm]',
        'OTA_EMAIL_FIN': 'finance@example.com [confirm]', 'OTA_EMAIL_PRIVACY': 'privacy@example.com [confirm]',
        'OTA_SUBPROC_EMAIL': '[Email service provider / Почтовый сервис]', 'OTA_SUBPROC_EMAIL_LOC': B,
        'CARD_DESCRIPTOR': '[OTA*ARVELOCONNECT]', 'DOC_NO_MPA': 'OTA-[PPP]-MPA-001-v1',
        'DOC_VER': '[1.0]', 'DATE': B, 'DUE_DATE': B, 'DOC_NO_OF': B, 'MPA_DATE': '[DATE / ДАТА]',
        'PRICE_KEY': B, 'INIT_TOKENS': '[300]', 'LAUNCH_DATE': '[DATE]', 'EFFECTIVE_DATE': '[DATE]',
        'EUT_LANGS': B, 'EUT_WITHDRAWAL': B, 'EUT_CONSUMER_AUTH': B, 'EUT_DP_AUTH': B, 'EUT_OTHER': B,
        'RS_MONTH': '[YYYY-MM]', 'RS_YYYYMM': '[YYYYMM]',
        'SHIP_FORM_FACTOR': '[form factor]', 'SHIP_ORIGIN': '[per manufacturer / по документам производителя]', 'SHIP_PLACE': '[named place / адрес]',
        'SR_CONDITION_EN': '[intact / damaged – description and photos attached]', 'SR_CONDITION_L2': '[целая / повреждена – описание и фото прилагаются]',
        'SR_RECEIVER_NAME': '[Name of person receiving]', 'SR_RECEIVER_TITLE': '[Title / Должность]',
        'INV_TOK_PLAN': '[Light / Standard / Premium]', 'INV_TOK_TERM': '[12/24/36/48/60]',
        'INV_OTHER_DESC': '[Other agreed service / Прочая согласованная услуга]',
        'CI_VAT_TREATMENT': "[treatment per Partner's tax adviser; for UAE recipient usually outside the scope of Partner's VAT, UAE reverse charge by OTA / режим по заключению налогового консультанта Партнёра; для получателя в ОАЭ обычно вне сферы НДС Партнёра, обратное начисление НДС в ОАЭ у OTA]",
        'DOC_SEQ': B,
    }, 'en': {'INIT_SIMS': '[1,000]', 'INIT_KEYS': '[1,000]', 'ANNUAL_TARGET': '[3,000]'},
       'ru': {'INIT_SIMS': '[1 000]', 'INIT_KEYS': '[1 000]', 'ANNUAL_TARGET': '[3 000]', 'LAUNCH_DATE': '[ДАТА]',
              'EFFECTIVE_DATE': '[ДАТА]', 'OTA_EMAIL_PRIVACY': 'privacy@example.com [подтвердить]', 'RS_MONTH': '[ГГГГ-ММ]', 'RS_YYYYMM': '[ГГГГММ]',
              'SHIP_FORM_FACTOR': '[форм-фактор]'}},
    'MPA': {'*': {'DATE': '[DATE / ДАТА]', 'DOC_NO': 'OTA-[PPP]-MPA-001-v1'}},
    'BOA': {'en': {'DATE': '[DATE]', 'P_TM_OWNER_NAME': '[Brand Owner legal name]'}, 'ru': {'DATE': '[ДАТА]', 'P_TM_OWNER_NAME': '[наименование правообладателя]'}},
    'RS': {'*': {'DATE': '[date, no later than the 10th / дата, не позднее 10-го числа]', 'DOC_NO_OF': '[OTA-OF-__-____-___]', 'RS_MONTH': '[YYYY-MM]'}},
    'PF': {'*': {'DOC_SEQ': '[YYYY-NNNN]', 'CC_NAME_EN': B, 'SHIP_FROM_COUNTRY': '[EU country / страна ЕС]'}},
    'CN': {'*': {'CN_NUMBER': 'OTA-CN-[YYYY-NNNNNN]', 'CN_INV_NUMBER': 'OTA-INV-[YYYY-NNNNNN]'}},
    'CHG': {'*': {'DOC_NO': 'OTA-[PPP]-MPA-001-v1', 'CHG_SIG_COMPANY': '[Partner full legal name / Полное наименование Партнёра]',
                  'CHG_SIG_NAME': '[Full name of signatory / ФИО подписанта]', 'CHG_SIG_TITLE_EN': '[Title]', 'CHG_SIG_TITLE_L2': '[Должность]'},
            'en': {'CHG_PARTY_NAME': '[Party name]', 'CHG_EFFECTIVE_DATE': '[DATE]'}, 'ru': {'CHG_PARTY_NAME': '[наименование Стороны]', 'CHG_EFFECTIVE_DATE': '[ДАТА]'}},
    'SR': {'*': {'DOC_SEQ': '[YYYY-NNNN]'}},
    'INV': {'*': {'DOC_SEQ': '[YYYY-NNNNNN]', 'CC_NAME_EN': '[Approved Country]', 'CC_NAME_L2': '[страна]'}},
    'CI': {'*': {'DOC_SEQ': '[YYYY-NNNN]', 'DUE_DATE': '[20th of the month / 20-е число]'}},
    'EUT': {'*': {'CC_NAME_EN': B}},
}
for v in ('OF-UA', 'OF-KZ', 'OF-DE'):
    RT_PLACEHOLDERS[v] = {'*': {kk: B for kk in K if kk.startswith(('TOK_', 'RET_'))}}
    RT_PLACEHOLDERS[v]['*'].update({'OF_EXCEPTIONS_EN': None, 'OF_EXCEPTIONS_L2': None, 'CCY': 'USD',
                                    'DOC_NO': 'OTA-[PPP]-OF-%s-001-v1' % v[3:]})
RT_PLACEHOLDERS['OF-DE']['*'].update({'CCY': 'EUR', 'CCY_USD': None, 'CCY_EUR': True, 'CC_DE': True})
RT_PLACEHOLDERS['OF-DE']['en'] = {'OTA_OSS_NO': '[OSS No.]', 'ANNUAL_TARGET': '[10,000]'}
RT_PLACEHOLDERS['OF-DE']['ru'] = {'OTA_OSS_NO': '[№ OSS]', 'ANNUAL_TARGET': '[10 000]'}
for t in ('TRT', 'SLA', 'BL', 'BOA', 'DPA', 'SIM'):
    RT_PLACEHOLDERS.setdefault(t, {}).setdefault('*', {})['DOC_NO'] = 'OTA-[PPP]-MPA-001-v1'   # v09 DOCX shows the MPA ref


def rt_lookup(values, variant, lang, key):
    for a, b in ((variant, lang), (variant, '*'), ('*', lang), ('*', '*')):
        d = RT_PLACEHOLDERS.get(a, {}).get(b, {})
        if key in d:
            return d[key]
    if variant.startswith('OF-'):
        cc = values['countries'][variant[3:]]
        if key in cc:
            return cc[key]
    if key in values['partner']:
        return values['partner'][key]
    if key in values['ota']:
        return values['ota'][key]
    s = values['system'].get(key)
    if isinstance(s, dict):
        return s.get(variant)
    if s is not None:
        return s
    if re.match(r'RS_[ABCD]_', key):
        return ''   # empty statement cells in the v09 DOCX
    if key in K:
        return B    # generic "[ ]" placeholder of the v09 DOCX (a wrong mapping still fails the comparison)
    raise KeyError(key)


TOKEN_RE = re.compile(r'\{\{([A-Z0-9_{}]+?)\}\}')
COND_RE = re.compile(r'\[\[([A-Z0-9_]+)\|((?:(?!\]\]).)*)\]\]', re.S)


def render(text, get):
    def cond(m):
        v = get(m.group(1))
        return m.group(2) if v not in (None, '', 0, '0') else ''
    text = COND_RE.sub(cond, text)
    def tok(m):
        v = get(m.group(1))
        return '' if v is None else str(v)
    return TOKEN_RE.sub(tok, text)


def norm(s):
    return re.sub(r'\s+', ' ', s).strip()

# --------------------------------------------------------------------------------------
# Variant merge (v12: one OF template for UA / KZ / DE). Blocks present only in a variant get cond CC_<CC>;
# inline differences (none expected - the rules above unify them) would be wrapped as [[CCY_USD|a]][[CCY_EUR|b]].
MERGE_LOG = []
ATOM_RE = re.compile(r'\[\[(?:(?!\]\]).)*\]\]|\{\{[^}]*\}\}|\s+|[^\s\[{]+|[\[{]', re.S)


def merge_text(a, b):
    if a == b:
        return a
    wa, wb = ATOM_RE.findall(a), ATOM_RE.findall(b)
    assert ''.join(wa) == a and ''.join(wb) == b
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, wa, wb, autojunk=False).get_opcodes():
        x, y = ''.join(wa[i1:i2]), ''.join(wb[j1:j2])
        if op == 'equal':
            out.append(x)
        else:
            if '[[' in x + y:
                raise SystemExit('cannot merge nested conditional: %r / %r' % (x, y))
            out.append(('[[CCY_USD|%s]]' % x if x else '') + ('[[CCY_EUR|%s]]' % y if y else ''))
    return ''.join(out)


def merge_variant(typ, variant, base, other):
    cc = variant.split('-')[1]
    ids_a, ids_b = [b['id'] for b in base], [b['id'] for b in other]
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, ids_a, ids_b, autojunk=False).get_opcodes():
        if op == 'equal':
            for a, b in zip(base[i1:i2], other[j1:j2]):
                if a == b:
                    out.append(a)
                    continue
                m = copy.deepcopy(a)
                if 'rows' in a:
                    if len(a['rows']) != len(b['rows']) or a.get('rowCond') != b.get('rowCond') or a.get('repeat') != b.get('repeat'):
                        raise SystemExit('%s: table %s differs in structure' % (variant, a['id']))
                    for ri, (ra, rb) in enumerate(zip(a['rows'], b['rows'])):
                        for ci, (ca, cb) in enumerate(zip(ra, rb)):
                            for lg in ('en', 'ru'):
                                m['rows'][ri][ci][lg] = merge_text(ca[lg], cb[lg])
                else:
                    for lg in ('en', 'ru'):
                        m[lg] = merge_text(a[lg], b[lg])
                MERGE_LOG.append((variant, a['id'], 'inline'))
                out.append(m)
        elif op == 'insert':
            for b in other[j1:j2]:
                if b.get('cond'):
                    raise SystemExit('%s: block %s already conditional' % (variant, b['id']))
                b = dict(b, cond='CC_' + cc)
                MERGE_LOG.append((variant, b['id'], 'only ' + cc))
                out.append(b)
        else:
            raise SystemExit('%s: blocks %s missing / replaced (%s)' % (variant, ids_a[i1:i2], op))
    return out


def main():
    check_only = '--check' in sys.argv
    form = read_form()
    values = make_values(form)
    templates, report = {}, collections.OrderedDict()
    rt_mismatch, single_lang = [], []
    of_variants = {}
    for typ, no, variants, cls, ten, tru in DOCS:
        built = {}
        for variant, path in variants.items():
            built[variant] = build(typ, variant, path)
        blocks = copy.deepcopy(built[list(variants)[0]][0])
        for variant in list(variants)[1:]:
            blocks = merge_variant(typ, variant, blocks, built[variant][0])
        templates[typ] = {'type': typ, 'docNo': no, 'title': {'en': ten, 'ru': tru}, 'ver': 'T-%s-%s' % (typ, TPL_VER),
                          'effective': EFFECTIVE, 'cls': cls, 'blocks': blocks}
        # round trip per variant
        for variant in variants:
            tb, rb, ob = built[variant]
            for bi_, (t, r, o) in enumerate(zip(tb, rb, ob)):
                if 'rows' in t:
                    rows_rt = []
                    for ri, row in enumerate(r['rows']):
                        if row is None and r['repeat']:
                            for item in r['items']:
                                rows_rt.append([item[i] for i in range(len(item))])
                            continue
                        if row is None:
                            continue
                        cells = []
                        for c in row:
                            gen = lambda lg: (lambda kk: rt_lookup(values, variant, lg, kk))
                            en = render(c['en'], gen('en'))
                            ru = render(c['ru'], gen('ru'))
                            cells.append(en + ' / ' + ru if c.get('bi') else en)
                        rows_rt.append(cells)
                    for ri, (a, b) in enumerate(zip(rows_rt, o['rows'])):
                        for ci, (x, y) in enumerate(zip(a, b)):
                            if norm(x) != norm(y):
                                rt_mismatch.append((variant, t['id'], 'r%dc%d' % (ri, ci), x, y))
                    if len(rows_rt) != len(o['rows']):
                        rt_mismatch.append((variant, t['id'], 'rowcount', len(rows_rt), len(o['rows'])))
                else:
                    for lg in ('en', 'ru'):
                        x = render(r[lg], lambda kk: rt_lookup(values, variant, lg, kk))
                        if norm(x) != norm(o[lg]):
                            rt_mismatch.append((variant, t['id'], lg, x, o[lg]))
                    if bool(norm(o['en'])) != bool(norm(o['ru'])):
                        single_lang.append((variant, t['id'], o['en'][:60], o['ru'][:60]))
        cnt = collections.Counter(b['kind'] for b in blocks)
        report[typ] = (len(blocks), dict(cnt))

    apply_additions(templates)
    # ---- verification: tokens vs catalogue, EN/L2 discipline, demo render ----
    used = collections.defaultdict(set)
    lang_viol = []
    def scan(typ, s, lang, bid):
        for m in TOKEN_RE.finditer(s):
            used[m.group(1)].add(typ)
            kk = m.group(1)
            if lang == 'en' and kk.endswith(('_L2', '_L2_GEN')):
                lang_viol.append((typ, bid, lang, kk))
            if lang == 'ru' and kk.endswith('_EN'):
                lang_viol.append((typ, bid, lang, kk))
        for m in COND_RE.finditer(s):
            used[m.group(1)].add(typ)
    for typ, t in templates.items():
        for b in t['blocks']:
            if 'rows' in b:
                for row in b['rows']:
                    for c in row:
                        scan(typ, c['en'], 'en' if c.get('bi') else 'neutral', b['id'])
                        scan(typ, c['ru'], 'ru' if c.get('bi') else 'neutral', b['id'])
                for kk in b.get('rowCond', {}).values():
                    used[kk].add(typ)
                if 'repeat' in b:
                    used[b['repeat']['list']].add(typ)
            else:
                scan(typ, b['en'], 'en', b['id'])
                scan(typ, b['ru'], 'ru', b['id'])
            if b.get('cond'):
                used[b['cond']].add(typ)
    missing = sorted(kk for kk in used if kk not in K)
    for kk in [kk for kk in K if kk.startswith('RS_') and kk not in used and kk not in ('RS_MONTH', 'RS_YYYYMM')]:
        del K[kk]
    # (b) independent check: no highlighted source string survives in the raw template text
    hl_left = []
    allow = set(t for _, _, t in LIT_LOG)
    allow |= CHOICE_TEXTS   # ТЗ 2.4 choice texts legitimately stay inside [[KEY|…]] fragments
    for typ, no, variants, cls, ten, tru in DOCS:
        raw = []
        for b in templates[typ]['blocks']:
            if 'rows' in b:
                raw += [c[lg] for row in b['rows'] for c in row for lg in ('en', 'ru')]
            else:
                raw += [b['en'], b['ru']]
        raw = TOKEN_RE.sub('', COND_RE.sub(lambda m: m.group(2), '\n'.join(raw)))
        for variant, path in variants.items():
            tables, _ = read_doc(os.path.join(PACK, path))
            hls = set()
            nonhl = []
            for rows in tables:
                for r in rows:
                    for c in r:
                        for segs in c['paras']:
                            nonhl.append(''.join(t if not h else '\x00' for t, h in segs))
                            for t, h in segs:
                                if h and t.strip() and t.strip() not in allow:
                                    hls.add(t.strip())
            nonhl = '\n'.join(nonhl)
            for h in sorted(hls):
                if raw.count(h) > nonhl.count(h):
                    hl_left.append((variant, h))
    for kk, meta in K.items():
        meta['used'] = sorted(used.get(kk, []))
    unused = sorted(kk for kk, m in K.items() if not m['used'])
    keys_list = list(K.values())

    # demo values (seed): partner + ota + countries + system
    demo = {'partner': values['partner'], 'status': values['status'], 'ota': values['ota'],
            'countries': values['countries'], 'system': values['system'], 'samples': values['samples']}

    reasons = {c: {'en': e, 'ru': r} for c, (e, r) in CN_REASON_TXT.items()}
    out_js = ('/* generated by tools/extract_templates.py from legal pack v12 - do not edit by hand */\n'
              'const LEGAL_PACK_VER=' + json.dumps(TPL_VER) + ';'
              'const LEGAL_TPL=' + json.dumps(templates, ensure_ascii=False, separators=(',', ':')) + ';'
              'const LEGAL_KEYS=' + json.dumps(keys_list, ensure_ascii=False, separators=(',', ':')) + ';'
              'const LEGAL_DEMO_VALUES=' + json.dumps(demo, ensure_ascii=False, separators=(',', ':')) + ';'
              'const LEGAL_CN_REASONS=' + json.dumps(reasons, ensure_ascii=False, separators=(',', ':')) + ';\n'
              '/* derived flags for a value map V (call before rendering): CN_REASON_<CODE>, FEE_NONE, OF_EXCEPTIONS_NONE,\n'
              '   v12: CCY (aliases CURRENCY / CUR accepted; default USD), CCY_USD / CCY_EUR, CC_<CC> (e.g. CC_DE -> OF clause 1.6),\n'
              '   VAT_AE (alias VAT_UAE accepted), VAT_ZERO (= not VAT_AE) */\n'
              'function legalDerive(V){if(!V)return V;const f=v=>v!=null&&v!==false&&v!==0&&String(v).trim()!==""&&String(v).trim()!=="0"&&String(v).trim().toUpperCase()!=="N/A";'
              'Object.keys(LEGAL_CN_REASONS).forEach(c=>{const k="CN_REASON_"+c.toUpperCase();if(V.CN_REASON===c)V[k]=true;else delete V[k];});'
              'if(!f(V.FEE_PCT))V.FEE_NONE=true;else delete V.FEE_NONE;if(!f(V.OF_EXCEPTIONS_EN))V.OF_EXCEPTIONS_NONE=true;else delete V.OF_EXCEPTIONS_NONE;'
              'if(!f(V.CCY))V.CCY=f(V.CURRENCY)?V.CURRENCY:(f(V.CUR)?V.CUR:"USD");V.CCY=String(V.CCY).trim().toUpperCase();if(!f(V.VAT_AE)&&f(V.VAT_UAE))V.VAT_AE=true;'
              'if(V.CCY==="EUR"){V.CCY_EUR=true;delete V.CCY_USD;}else{V.CCY_USD=true;delete V.CCY_EUR;}'
              'Object.keys(V).forEach(k=>{if(/^CC_[A-Z]{2}$/.test(k))delete V[k];});if(f(V.CC))V["CC_"+String(V.CC).trim().toUpperCase()]=true;'
              'if(f(V.VAT_AE))delete V.VAT_ZERO;else V.VAT_ZERO=true;return V;}\n'
              '/* boot: seed S.templates; replace stored templates of an older pack (ver number lower than the base) and add new types */\n'
              'HOOKS.onBoot.push(()=>{if(!S.templates||typeof S.templates!=="object")S.templates={};const n=v=>+String(v||"").replace(/^.*-v/,"")||0;'
              'Object.keys(LEGAL_TPL).forEach(tp=>{const cur=S.templates[tp];if(!cur||!Array.isArray(cur.blocks)||n(cur.ver)<n(LEGAL_TPL[tp].ver))S.templates[tp]=JSON.parse(JSON.stringify(LEGAL_TPL[tp]));});});\n')
    # safety: no real (private) value may reach any generated file
    leaks = sorted({f for f in FORBIDDEN if f and (f in out_js or f in json.dumps(RT_PLACEHOLDERS, ensure_ascii=False))})
    if leaks:
        print('!! REAL VALUES FOUND IN OUTPUT:', len(leaks), 'items (see private_values.json) - nothing written')
        return 2
    if not check_only:
        os.makedirs(OUT, exist_ok=True)
        for typ, t in templates.items():
            with open(os.path.join(OUT, typ + '.json'), 'w') as f:
                json.dump(t, f, ensure_ascii=False, indent=1)
        with open(os.path.join(OUT, 'keys.json'), 'w') as f:
            json.dump(keys_list, f, ensure_ascii=False, indent=1)
        gv = dict(demo)
        gv['roundtrip'] = RT_PLACEHOLDERS
        gv['_note'] = ('partner = fictional ARVELO demo values (v12 Data Form is generic; null = empty / N/A); '
                       'roundtrip = placeholders exactly as shown in the v12 DOCX (generic [ ] / [PPP] / [BRAND] …), used only by the round-trip test.')
        with open(os.path.join(OUT, 'demo_values.json'), 'w') as f:
            json.dump(gv, f, ensure_ascii=False, indent=1)
        with open(MODULE, 'w') as f:
            f.write(out_js)

    # ---- report ----
    print('== Blocks per template')
    for typ, (n, cnt) in report.items():
        print('  %-4s %3d  %s' % (typ, n, cnt))
    print('== Keys: catalogue %d, used in templates %d, missing from catalogue %s' % (len(K), len(used), missing))
    print('   catalogued but not used:', unused)
    print('== Highlight spans: %d resolved via rules/values, %d inside forced spans; unmapped: %d' % (HL_SEEN['hl'], HL_SEEN['forced'], len(UNMAPPED)))
    for u in UNMAPPED:
        print('   UNMAPPED', u)
    print('== Literal placeholders kept (allow-list):', sorted(set((v.split('-')[0], t) for v, l, t in LIT_LOG)))
    print('== Structured replacements (RT keeps source literal):')
    for s in sorted(set((v.split('-')[0], l, o, r) for v, l, o, r in STRUCT_LOG)):
        print('   ', s)
    print('== Additions (tpl only, hidden for ARVELO):', sorted(set(ADD_LOG)))
    print('== ТЗ v10 additions (not in DOCX; shown only when the key is set):')
    for x in ADDITION_LOG:
        print('   ', x)
    print('== Variant merge (blocks only in one country -> cond CC_<CC>; inline -> CCY_USD/CCY_EUR):', MERGE_LOG)
    print('== (b) highlighted source strings still present literally in templates:', hl_left)
    print('== EN/L2 token discipline violations:', lang_viol)
    print('== Round-trip mismatches: %d' % len(rt_mismatch))
    for m in rt_mismatch[:40]:
        print('   ', m)
    print('== Rows with text in one language only:', single_lang)
    print('== Module size: %d bytes' % len(out_js.encode()))
    ok = not rt_mismatch and not UNMAPPED and not missing and not lang_viol and not hl_left
    print('RESULT', 'OK' if ok else 'FAIL')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
