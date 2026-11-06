#!/usr/bin/env python3
"""Extract the CONNECT FOR BRANDS v09 DOCX templates into tokenised, paragraph-level
bilingual (EN | RU) JSON templates + key catalogue + GAZER demo values, generate
src/modules/60_legal_templates.js, and run the verification suite.

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
by a token; substituting GAZER's values (with the placeholders the DOCX shows, e.g. "[ ]")
must reproduce the DOCX cell text exactly. A short list of "structured" replacements
(choices / composite placeholders) and "additions" (ТЗ-mandated conditional fragments) is
reported separately; those are verified by checking the rest of the text is identical.
"""
import json, os, re, sys, copy, collections
import docx
from docx.oxml.ns import qn
from docx.text.run import Run
from docx.table import Table

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, 'legal_src', 'CONNECT_FOR_BRANDS_Legal_Pack_v09')
OUT = os.path.join(ROOT, 'legal_src', 'templates')
MODULE = os.path.join(ROOT, 'src', 'modules', '60_legal_templates.js')
EFFECTIVE = '2026-11-06'
CYR = re.compile('[Ѐ-ӿ]')

# --------------------------------------------------------------------------------------
# Document list
# --------------------------------------------------------------------------------------
P1, P2 = '1_Partner_Package/', '2_Templates_and_Tools/'
DOCS = [
    # type, docNo, variants {variant: file}, cls, title en, title ru
    ('MPA', '01', {'MPA': P1 + '01_Master_Partner_Agreement.docx'}, 'A', 'Master Partner Agreement', 'Рамочное партнёрское соглашение'),
    ('OF', '02', {'OF-UA': P1 + '02-UA_Order_Form_Ukraine.docx', 'OF-KZ': P1 + '02-KZ_Order_Form_Kazakhstan.docx'}, 'A', 'Order Form', 'Заказ'),
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
    ('CI', '14', {'CI': P2 + '14_Partner_Commission_Invoice_Template.docx'}, 'B', 'Partner Commission Invoice', 'Счёт Партнёра на вознаграждение'),
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
    return segs


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
    'GAZER LIMITED': '{{P_NAME}}',
    'a private limited company incorporated in England and Wales': '{{P_FORM_EN}}',
    'частная компания с ограниченной ответственностью, учреждённая в Англии и Уэльсе': '{{P_FORM_L2}}',
    '08778057': '{{P_REGNO}}',
    '17 Hanover Square, London, W1S 1BN, United Kingdom': '{{P_ADDR_EN}}',
    '17 Hanover Square, London, W1S 1BN, Великобритания': '{{P_ADDR_L2}}',
    'Director': '{{P_TITLE_EN}}',
    'Директор': '{{P_TITLE_L2}}',
    'директора': '{{P_TITLE_L2_GEN}}',
    'Serhii Boiar': '{{P_SIGNATORY}}',
    'GAZER CONNECT': '{{P_PROGRAMME}}',
    'connect.gazer.com': '{{P_DOMAIN}}',
    'GAZER': '{{P_BRAND}}',
    'GB76REVO00996952368216': '{{P_BANK_IBAN}}',
    'Revolut Ltd': '{{P_BANK_NAME}}',
    '7 Westferry Circus, London, E14 4HD, United Kingdom': '{{P_BANK_ADDR}}',
    'REVOGB21': '{{P_BANK_SWIFT}}',
    'CHASGB2L': '{{P_BANK_INTERMEDIARY}}',
    'GZR': '{{P_CODE}}',
    'OTA-GZR-OF-UA-001-v1': '{{DOC_NO}}',
    'OTA-GZR-OF-KZ-001-v1': '{{DOC_NO}}',
    '[OTA*GAZERCONNECT]': '{{CARD_DESCRIPTOR}}',
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
    R('MPA', 'OTA-GZR-MPA-001-v1', '{{DOC_NO}}'),
    R(PKG, 'OTA-GZR-MPA-001-v1', '{{DOC_NO}}', before=r'(Ref\. |№ )$', label=r'^Document \d'),
    R(ANY, 'OTA-GZR-MPA-001-v1', '{{DOC_NO_MPA}}'),
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
    R('OF', '[none / list of programmes, brands, device categories or countries]',
      '[[OF_EXCEPTIONS_EN|{{OF_EXCEPTIONS_EN}}]][[OF_EXCEPTIONS_NONE|none]]', kind='struct'),
    R('OF', '[нет / перечень программ, брендов, категорий устройств или стран]',
      '[[OF_EXCEPTIONS_L2|{{OF_EXCEPTIONS_L2}}]][[OF_EXCEPTIONS_NONE|нет]]', kind='struct'),
    R('OF', '[none / __% of payments received, not more than 3%]',
      '[[FEE_PCT|{{FEE_PCT}}% of payments received]][[FEE_NONE|none]]', kind='struct'),
    R('OF', '[не применяется / __% от полученных платежей, не более 3%]',
      '[[FEE_PCT|{{FEE_PCT}}% от полученных платежей]][[FEE_NONE|не применяется]]', kind='struct'),
    R('OF', B, '{{PRICE_KEY}}', before=r'(Activation Key|Ключ активации).*USD $'),
    R('OF', '[1,000]', '{{INIT_KEYS}}', before=r'Initial order: $'), R('OF', '[1 000]', '{{INIT_KEYS}}', before=r'Первый заказ: $'),
    R('OF', '[1,000]', '{{INIT_SIMS}}', before=r'shipment.*: $'), R('OF', '[1 000]', '{{INIT_SIMS}}', before=r'SIM.*: $'),
    R('OF', '[300]', '{{INIT_TOKENS}}'),
    R('OF', '[3,000]', '{{ANNUAL_TARGET}}'), R('OF', '[3 000]', '{{ANNUAL_TARGET}}'),
    R('OF', 'GAZER LIMITED', '{{P_BANK_BENEFICIARY}}', label=r'^Beneficiary'),
    R({'OF'}, B, '{{P_EMAIL_OPS}}', label=r'^Operations'),
    R({'OF'}, B, '{{P_EMAIL_LEGAL}}', label=r'^Legal notices'),
    R({'OF'}, B, '{{P_EMAIL_FIN}}', label=r'^Finance'),
    R('OF', '[confirm]', None),  # covered by forced OTA_EMAIL spans (never reached)
    # --- 03 packaging annex: recommended wording keeps its placeholders literally ---------
    R('TRT', '[12/24/36/48/60]', None, kind='lit'), R('TRT', '[date]', None, kind='lit'),
    R('TRT', '[country]', None, kind='lit'), R('TRT', '[дата]', None, kind='lit'), R('TRT', '[страна]', None, kind='lit'),
    # --- 05A Brand Licence --------------------------------------------------------------------
    R('BL', B, '{{P_LOGO}}', label=r'^Logo files'),
    R('BL', '[as listed in Annex 1 to each Order Form / согласно Приложению 1 к каждому Заказу]', None, kind='lit'),
    R('BL', '[attach file / приложить файл]', '{{P_BRANDBOOK}}'),
    R('BL', B, '{{P_BRAND_RULES}}', label=r'^Logo use'),
    R('BL', B, '{{P_BRAND_CONTACT}}', label=r'^Approval contact'),
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
    R('PF', B, '{{CC_NAME_EN}}', label=r'^Country of export'),
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
    R('INV', B, '{{P_TAXNO}}', before=r'Tax / VAT no\. $'),
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
    R('CI', 'GAZER LIMITED', '{{P_BANK_BENEFICIARY}}', label=r'^Beneficiary'),
]

# Forced spans: matched on the original text (highlighted or not) before anything else.
FORCED = [
    # OTA e-mails with the drafting marker "[confirm]" -> one OTA_* token
    R(ANY, 'ops@example.com [confirm]', '{{OTA_EMAIL_OPS}}'),
    R(ANY, 'legal@example.com [confirm]', '{{OTA_EMAIL_LEGAL}}'),
    R(ANY, 'finance@example.com [confirm]', '{{OTA_EMAIL_FIN}}'),
    R(ANY, 'privacy@example.com [confirm]', '{{OTA_EMAIL_PRIVACY}}'),
    R(ANY, 'privacy@example.com [подтвердить]', '{{OTA_EMAIL_PRIVACY}}'),
    # composite references
    R('INV', 'OTA-GZR-OF-[CC-NNN-vN]', '{{DOC_NO_OF}}', kind='struct'),
    # OTA signatory / title in prose
    R('MPA', 'represented by its Manager, Anna Petrova', 'represented by its {{OTA_TITLE_EN}}, {{OTA_SIGNATORY}}'),
    R('MPA', 'в лице менеджера Анны Петровой', 'в лице {{OTA_TITLE_L2_GEN}} {{OTA_SIGNATORY_L2_GEN}}'),
    # OF country-specific literals (UA / KZ) -> country tokens
    R('OF', 'ORDER FORM – UKRAINE', 'ORDER FORM – {{CC_NAME_UPPER_EN}}'),
    R('OF', 'ORDER FORM – KAZAKHSTAN', 'ORDER FORM – {{CC_NAME_UPPER_EN}}'),
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
]
OTA_LIT_RE = re.compile('|'.join(re.escape(a) for a, _ in sorted(OTA_LIT, key=lambda x: -len(x[0]))))
OTA_LIT_MAP = dict(OTA_LIT)
# whole-cell literal in signature blocks
SIG_TITLE = {('en', 'Manager'): '{{OTA_TITLE_EN}}', ('ru', 'Менеджер'): '{{OTA_TITLE_L2}}'}

# Conditional wraps applied to tpl AND rt (text exists in the source, depends on N/A-able key)
WRAPS = [
    (ANY, re.compile(r'\nTax / VAT no\. \{\{P_TAXNO\}\}'), '[[P_TAXNO|\nTax / VAT no. {{P_TAXNO}}]]'),
    (ANY, re.compile(r'\nIntermediary / банк-посредник: \{\{P_BANK_INTERMEDIARY\}\}'),
     '[[P_BANK_INTERMEDIARY|\nIntermediary / банк-посредник: {{P_BANK_INTERMEDIARY}}]]'),
]
# Additions to tpl only (ТЗ §4 example; hidden for GAZER because P_TAXNO is N/A there) -> lawyer check
ADDS = [
    ('MPA', 'en', 'company no. {{P_REGNO}}, address:', 'company no. {{P_REGNO}}[[P_TAXNO|, tax no. {{P_TAXNO}}]], address:'),
    ('MPA', 'ru', 'регистрационный № {{P_REGNO}}, адрес:', 'регистрационный № {{P_REGNO}}[[P_TAXNO|, налоговый № {{P_TAXNO}}]], адрес:'),
]

# Repeat rows (lists): (type, header-cell-0 prefix) -> list name, item keys
REPEATS = {
    ('OF', 'Brand / Бренд'): ('DEVICES', ['DEV_BRAND', 'DEV_MODEL', 'DEV_HW', 'DEV_FW', 'DEV_PLAN', 'DEV_MB', 'DEV_SIM']),
    ('BL', 'Mark / Знак'): ('P_TM_LIST', ['TM_MARK', 'TM_REGNO', 'TM_COUNTRIES', 'TM_CLASSES']),
    ('BOA', 'Mark / Знак'): ('P_TM_LIST', ['TM_MARK', 'TM_REGNO', 'TM_COUNTRIES', 'TM_CLASSES']),
}
# Row conditions: (type, row label prefix) -> key
ROW_COND = {
    ('CI', 'Intermediary bank'): 'P_BANK_INTERMEDIARY',
    ('DPA', '{{OTA_SUBPROC_EMAIL}}'): 'OTA_SUBPROC_EMAIL',
    ('INV', '3'): 'INV_OTHER_DESC',
}
NO_SPLIT = [re.compile(r'^\d+ months / мес\.$'), re.compile(r'^VAT / НДС ')]

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
                elif first and ri == 1 and oen.startswith('Document '):
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
                if ri > 0 and ci > 0 and len(r) > 2 and typ in ('INV', 'CI') and label == '':
                    ctx['label'] = '|' + cell_text(r[1])
                oc = cell_text(c)
                ocells.append(oc)
                if rep and ri > 0:
                    k = rep[1][ci]
                    tcells.append({'en': '{{%s}}' % k, 'ru': '{{%s}}' % k})
                    rcells.append(None)
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
            if rep and ri > 0:
                rep_items.append(dict(zip(rep[1], ocells)))
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
        rt_blocks.append({'rows': rtrows, 'repeat': rep, 'items': rep_items})
        orig_blocks.append({'rows': orows})
    return blocks, rt_blocks, orig_blocks

# --------------------------------------------------------------------------------------
# Partner Data Form (A) -> GAZER values
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
k('P_COUNTRY', 'Страна регистрации (ISO)', 'partner', note='не выводится в текстах; влияет на НДС в счёте 13')
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
k('P_BRAND_CONTACT', 'Контакт для согласования материалов бренда (05A, прил. 2)', 'partner', tz=False)
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
k('OTA_EMAIL_OPS', 'OTA: e-mail операций', 'ota')
k('OTA_EMAIL_LEGAL', 'OTA: e-mail юридических уведомлений', 'ota')
k('OTA_EMAIL_FIN', 'OTA: e-mail финансов', 'ota')
k('OTA_EMAIL_PRIVACY', 'OTA: e-mail по персональным данным', 'ota')
k('OTA_EMAIL_SUPPORT', 'OTA: e-mail поддержки (вторая линия)', 'ota', note='не выводится в текстах v09 (04 п. 7.1 ссылается на «адрес поддержки OTA» без значения)')
k('OTA_SUPPORT_HOURS', 'OTA: часы поддержки', 'ota', note='не выводится: 04 п. 7.1 содержит часы прозой (литерал)')
k('OTA_CUSTOMS_CODE', 'OTA: код Dubai Customs', 'ota', req='na', note='не используется в текстах v09 – нужна формулировка юриста (проформа 11)')
k('OTA_VAT_{CC}', 'OTA: регистрация по НДС в стране CC', 'ota', req='na', note='не используется в текстах v09 – нужна формулировка юриста')
k('OTA_REP_{CC}', 'OTA: представитель в стране CC (имя, адрес)', 'ota', req='na', note='не используется в текстах v09 – нужна формулировка юриста')
k('OTA_SUBPROC_EMAIL', 'OTA: почтовый сервис-субобработчик (06, прил. 1)', 'ota', req='na', tz=False)
k('OTA_SUBPROC_EMAIL_LOC', 'OTA: расположение почтового субобработчика', 'ota', req='na', tz=False)
k('CARD_DESCRIPTOR', 'Дескриптор в выписке по карте (OTA*БРЕНДCONNECT)', 'ota', tz=False)
# country / order-form params
k('CC', 'Код страны ISO 3166-1 alpha-2', 'country')
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
k('PRICE_KEY', 'Цена ключа активации, USD', 'commercial', fmt='usd')
for pl in ('LIGHT', 'STANDARD', 'PREMIUM'):
    for tm in (12, 24, 36, 48, 60):
        k('TOK_%s_%d' % (pl, tm), 'Цена токена %s, %d мес., USD' % (pl.title(), tm), 'commercial', fmt='usd')
    k('RET_%s' % pl, 'Удерживаемая OTA сумма %s за оплаченный месяц, USD' % pl.title(), 'commercial', fmt='usd')
k('FEE_PCT', 'Сбор на соблюдение страновых требований, % (0–3)', 'commercial', req='na', fmt='pct')
k('FEE_NONE', 'Флаг: сбора нет', 'system', req='auto', tz=False, note='= FEE_PCT пусто/0/N/A')
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
k('LANG2_NAME_EN', 'Название второго языка по-английски (строка о языке)', 'system', req='auto', tz=False)
k('LANG2_NAME_L2', 'Название второго языка на нём самом, форма для строки о языке («русском»)', 'system', req='auto', tz=False)
# public docs (07) country schedule
for kk, lab in [('EUT_LANGS', 'Языки публикации'), ('EUT_WITHDRAWAL', 'Правила отказа и возврата для потребителей'), ('EUT_CONSUMER_AUTH', 'Орган по защите прав потребителей'), ('EUT_DP_AUTH', 'Орган по защите персональных данных'), ('EUT_OTHER', 'Иная обязательная информация')]:
    k(kk, '07 страновое приложение: ' + lab, 'country', req='optional' if kk in ('EUT_WITHDRAWAL', 'EUT_OTHER') else 'required', tz=False)
# shipments (PF 11 / SR 12)
for kk, lab in [('SHIP_CONSIGNEE', 'Грузополучатель и адрес доставки'), ('SHIP_IMPORTER', 'Импортёр и налоговый номер'), ('SHIP_PLACE', 'Место поставки DAP'), ('SHIP_WAYBILL', 'Перевозчик и накладная'), ('SHIP_FORM_FACTOR', 'Форм-фактор SIM'), ('SHIP_ORIGIN', 'Происхождение SIM'), ('SHIP_QTY', 'Количество SIM'), ('SHIP_UNIT_VALUE', 'Таможенная стоимость за ед., USD'), ('SHIP_TOTAL_VALUE', 'Итого таможенная стоимость, USD'), ('SHIP_CARTONS', 'Количество коробок'), ('SHIP_GROSS_KG', 'Вес брутто, кг'), ('SHIP_NET_KG', 'Вес нетто, кг'), ('SHIP_ICCID_REF', 'Ссылка на перечень ICCID'), ('SHIP_ICCID_RANGE', 'Диапазон ICCID')]:
    k(kk, 'Отгрузка: ' + lab, 'shipment', tz=False)
for kk, lab in [('SR_DELIVERY', 'дата и адрес доставки'), ('SR_IMPORTER_DECL', 'импортёр и № таможенной декларации'), ('SR_STORAGE', 'место хранения и ответственное лицо'), ('SR_SIM_TYPE', 'тип SIM'), ('SR_RECEIVED', 'получено, шт.'), ('SR_DIFF', 'расхождение, шт.'), ('SR_RECEIVER_NAME', 'ФИО принявшего'), ('SR_RECEIVER_TITLE', 'должность принявшего')]:
    k(kk, 'Акт приёмки SIM: ' + lab, 'shipment', tz=False)
k('SR_CONDITION_EN', 'Акт приёмки: состояние упаковки (англ.)', 'shipment', tz=False, pair='SR_CONDITION')
k('SR_CONDITION_L2', 'Акт приёмки: состояние упаковки (второй язык)', 'shipment', tz=False, pair='SR_CONDITION')
# invoice 13
for kk, lab in [('INV_KEY_QTY', 'ключи: кол-во'), ('INV_KEY_PRICE', 'ключи: цена USD'), ('INV_KEY_AMOUNT', 'ключи: сумма USD'), ('INV_TOK_PLAN', 'токены: тариф'), ('INV_TOK_TERM', 'токены: срок, мес.'), ('INV_TOK_QTY', 'токены: кол-во'), ('INV_TOK_PRICE', 'токены: цена USD'), ('INV_TOK_AMOUNT', 'токены: сумма USD'), ('INV_OTHER_DESC', 'прочая услуга: описание'), ('INV_OTHER_QTY', 'прочая услуга: кол-во'), ('INV_OTHER_PRICE', 'прочая услуга: цена USD'), ('INV_OTHER_AMOUNT', 'прочая услуга: сумма USD'), ('INV_SUBTOTAL', 'итого без НДС, USD'), ('INV_TOTAL', 'итого к оплате, USD')]:
    k(kk, 'Счёт OTA: ' + lab, 'invoice', req='na' if kk.startswith('INV_OTHER') else 'auto', tz=False)
# commission invoice 14
for kk, lab in [('CI_AMOUNT', 'сумма вознаграждения, USD'), ('CI_VAT_TREATMENT', 'режим НДС (по заключению консультанта партнёра)'), ('CI_VAT_AMOUNT', 'сумма НДС'), ('CI_TOTAL', 'итого к оплате')]:
    k(kk, 'Счёт партнёра: ' + lab, 'invoice', tz=False)
# statement 10
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
# Values: GAZER (partner form), OTA seed, countries + round-trip placeholders
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
    partner = {}
    for key, meta in K.items():
        if meta['src'] != 'partner' or meta.get('format') == 'item':
            continue
        v = form.get(key)
        if v is not None and v.startswith('['):
            v = None
        partner[key] = v
    partner['P_ADDR_L2'] = '17 Hanover Square, London, W1S 1BN, Великобритания'   # from Doc 01 RU (form has EN only)
    partner['P_TITLE_L2_GEN'] = 'директора'                                        # from Doc 01 RU
    partner['P_BANK_BENEFICIARY'] = partner['P_NAME']
    partner['P_COUNTRY'] = 'GB'                                                    # England and Wales
    partner['LANG2'] = 'ru' if form.get('LANG2') == 'Russian' else form.get('LANG2')
    partner['P_TM_OWNER_IS_PARTNER'] = None
    partner['P_TM_LIST'] = [{'TM_MARK': 'GAZER (word / словесный)', 'TM_REGNO': None, 'TM_COUNTRIES': None, 'TM_CLASSES': None},
                            {'TM_MARK': 'GAZER (logo / логотип)', 'TM_REGNO': None, 'TM_COUNTRIES': None, 'TM_CLASSES': None}]
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
        'OTA_EMAIL_OPS': 'ops@example.com', 'OTA_EMAIL_LEGAL': 'legal@example.com',
        'OTA_EMAIL_FIN': 'finance@example.com', 'OTA_EMAIL_PRIVACY': 'privacy@example.com', 'OTA_EMAIL_SUPPORT': None,
        'OTA_SUPPORT_HOURS': 'Mon–Fri 09:00–21:00 UTC+4; P1 24/7',
        'OTA_CUSTOMS_CODE': None, 'OTA_VAT_UA': None, 'OTA_VAT_KZ': None, 'OTA_REP_UA': None, 'OTA_REP_KZ': None,
        'OTA_SUBPROC_EMAIL': None, 'OTA_SUBPROC_EMAIL_LOC': None,
        'P_CODE': 'GZR', 'CARD_DESCRIPTOR': 'OTA*GAZERCONNECT',
    }
    ua = dict(CC='UA', CC_NAME_EN='Ukraine', CC_NAME_L2='Украина', CC_NAME_UPPER_EN='UKRAINE', CC_NAME_UPPER_L2='УКРАИНА',
              CC_NAME_FULL_EN='Ukraine', CC_NAME_FULL_L2='Украина', CC_NAME_LOC_L2='Украине',
              CC_EXCLUSION_EN='excluding the temporarily occupied territories',
              CC_EXCLUSION_L2='за исключением временно оккупированных территорий',
              OF_EXCEPTIONS_EN=None, OF_EXCEPTIONS_L2=None, LAUNCH_DATE=None,
              INIT_SIMS=1000, INIT_KEYS=1000, INIT_TOKENS=300, ANNUAL_TARGET=3000, FEE_PCT=None,
              DEVICES=[], DOC_NO='OTA-GZR-OF-UA-001-v1')
    ua.update(demo_prices(9.85, 75, 99, 1.2, 45.0564))
    kz = dict(CC='KZ', CC_NAME_EN='Kazakhstan', CC_NAME_L2='Казахстан', CC_NAME_UPPER_EN='KAZAKHSTAN', CC_NAME_UPPER_L2='КАЗАХСТАН',
              CC_NAME_FULL_EN='Republic of Kazakhstan', CC_NAME_FULL_L2='Республика Казахстан', CC_NAME_LOC_L2='Казахстане',
              CC_EXCLUSION_EN=None, CC_EXCLUSION_L2=None,
              OF_EXCEPTIONS_EN=None, OF_EXCEPTIONS_L2=None, LAUNCH_DATE=None,
              INIT_SIMS=1000, INIT_KEYS=1000, INIT_TOKENS=300, ANNUAL_TARGET=3000, FEE_PCT=None,
              DEVICES=[], DOC_NO='OTA-GZR-OF-KZ-001-v1')
    kz.update(demo_prices(9.40, 990, 1290, 1.16, 441.77))
    system = {'LANG2_NAME_EN': 'Russian', 'LANG2_NAME_L2': 'русском', 'DOC_NO_MPA': 'OTA-GZR-MPA-001-v1',
              'DOC_NO': {'MPA': 'OTA-GZR-MPA-001-v1', 'TRT': 'OTA-GZR-TRT-001-v1', 'SLA': 'OTA-GZR-SLA-001-v1', 'BL': 'OTA-GZR-BL-001-v1',
                         'BOA': 'OTA-GZR-BOA-001', 'DPA': 'OTA-GZR-DPA-001-v1', 'SIM': 'OTA-GZR-SIM-001-v1'}}
    return {'partner': partner, 'status': status, 'ota': ota, 'countries': {'UA': ua, 'KZ': kz}, 'system': system}


# Round-trip placeholders: what the v09 DOCX shows for each key (lookup: variant/lang, variant/*, */lang, */*)
RT_PLACEHOLDERS = {
    '*': {'*': {
        'P_TAXNO': B, 'P_EMAIL_OPS': B, 'P_EMAIL_LEGAL': B, 'P_EMAIL_FIN': B, 'P_EMAIL_SUPPORT': B, 'P_LOGO': B,
        'P_BRAND_RULES': B, 'P_BRAND_CONTACT': B, 'P_BRANDBOOK': '[attach file / приложить файл]',
        'P_TM_OWNER_NAME': '[Brand Owner legal name]', 'P_TM_OWNER_REGNO': B, 'P_TM_OWNER_ADDR': B,
        'P_TM_OWNER_COUNTRY_EN': '[country]', 'P_TM_OWNER_COUNTRY_L2': '[страна]',
        'P_TM_OWNER_RELATION_EN': '[distributor / licensee]', 'P_TM_OWNER_RELATION_L2': '[дистрибьютором / лицензиатом]',
        'P_TM_OWNER_TERRITORY_EN': '[countries]', 'P_TM_OWNER_TERRITORY_L2': '[страны]',
        'P_TM_OWNER_SIGNATORY': '[Name]', 'P_TM_OWNER_TITLE': '[Title / Должность]',
        'OTA_EMAIL_OPS': 'ops@example.com [confirm]', 'OTA_EMAIL_LEGAL': 'legal@example.com [confirm]',
        'OTA_EMAIL_FIN': 'finance@example.com [confirm]', 'OTA_EMAIL_PRIVACY': 'privacy@example.com [confirm]',
        'OTA_SUBPROC_EMAIL': '[Email service provider / Почтовый сервис]', 'OTA_SUBPROC_EMAIL_LOC': B,
        'CARD_DESCRIPTOR': '[OTA*GAZERCONNECT]', 'DOC_NO_MPA': 'OTA-GZR-MPA-001-v1', 'P_BANK_BENEFICIARY': 'GAZER LIMITED',
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
    'MPA': {'*': {'DATE': '[DATE / ДАТА]'}},
    'BOA': {'en': {'DATE': '[DATE]', 'P_TM_OWNER_NAME': '[Brand Owner legal name]'}, 'ru': {'DATE': '[ДАТА]', 'P_TM_OWNER_NAME': '[наименование правообладателя]'}},
    'RS': {'*': {'DATE': '[date, no later than the 10th / дата, не позднее 10-го числа]', 'DOC_NO_OF': '[OTA-OF-__-____-___]', 'RS_MONTH': '[YYYY-MM]'}},
    'PF': {'*': {'DOC_SEQ': '[YYYY-NNNN]', 'CC_NAME_EN': B}},
    'SR': {'*': {'DOC_SEQ': '[YYYY-NNNN]'}},
    'INV': {'*': {'DOC_SEQ': '[YYYY-NNNNNN]', 'CC_NAME_EN': '[Approved Country]', 'CC_NAME_L2': '[страна]'}},
    'CI': {'*': {'DOC_SEQ': '[YYYY-NNNN]', 'DUE_DATE': '[20th of the month / 20-е число]'}},
    'EUT': {'*': {'CC_NAME_EN': B}},
}
for v in ('OF-UA', 'OF-KZ'):
    RT_PLACEHOLDERS[v] = {'*': {kk: B for kk in K if kk.startswith(('TOK_', 'RET_'))}}
    RT_PLACEHOLDERS[v]['*'].update({'OF_EXCEPTIONS_EN': None, 'OF_EXCEPTIONS_L2': None})
for t in ('TRT', 'SLA', 'BL', 'BOA', 'DPA', 'SIM'):
    RT_PLACEHOLDERS.setdefault(t, {}).setdefault('*', {})['DOC_NO'] = 'OTA-GZR-MPA-001-v1'   # v09 DOCX shows the MPA ref


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
        blocks = built[list(variants)[0]][0]
        for variant in variants:
            if built[variant][0] != blocks:
                for a, b in zip(built[variant][0], blocks):
                    if a != b:
                        print('VARIANT DIFF', variant, json.dumps(a, ensure_ascii=False)[:300], '\n   vs', json.dumps(b, ensure_ascii=False)[:300])
                raise SystemExit('variants of %s do not produce one template' % typ)
        templates[typ] = {'type': typ, 'docNo': no, 'title': {'en': ten, 'ru': tru}, 'ver': 'T-%s-v3' % typ,
                          'effective': EFFECTIVE, 'cls': cls, 'blocks': blocks}
        # round trip per variant
        for variant in variants:
            tb, rb, ob = built[variant]
            for bi_, (t, r, o) in enumerate(zip(tb, rb, ob)):
                if 'rows' in t:
                    rows_rt = []
                    for ri, row in enumerate(r['rows']):
                        if row is None and r['repeat']:
                            lst, keys = r['repeat']
                            for item in r['items']:
                                rows_rt.append([item[kk] for kk in keys])
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
            'countries': values['countries'], 'system': values['system']}

    out_js = ('const LEGAL_TPL=' + json.dumps(templates, ensure_ascii=False, separators=(',', ':')) + ';'
              'const LEGAL_KEYS=' + json.dumps(keys_list, ensure_ascii=False, separators=(',', ':')) + ';'
              'const LEGAL_DEMO_VALUES=' + json.dumps(demo, ensure_ascii=False, separators=(',', ':')) + ';'
              'HOOKS.onBoot.push(()=>{if(!S.templates||!Object.keys(S.templates).length){S.templates=JSON.parse(JSON.stringify(LEGAL_TPL));}});\n')
    if not check_only:
        os.makedirs(OUT, exist_ok=True)
        for typ, t in templates.items():
            with open(os.path.join(OUT, typ + '.json'), 'w') as f:
                json.dump(t, f, ensure_ascii=False, indent=1)
        with open(os.path.join(OUT, 'keys.json'), 'w') as f:
            json.dump(keys_list, f, ensure_ascii=False, indent=1)
        gv = dict(demo)
        gv['roundtrip'] = RT_PLACEHOLDERS
        gv['_note'] = ('partner = GAZER values from A_Partner_Data_Form (null = "[ ]" in the form); '
                       'roundtrip = placeholders exactly as shown in the v09 DOCX, used only by the round-trip test.')
        with open(os.path.join(OUT, 'gazer_values.json'), 'w') as f:
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
    print('== Additions (tpl only, hidden for GAZER):', sorted(set(ADD_LOG)))
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
