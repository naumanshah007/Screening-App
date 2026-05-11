export type ExtractedFactDraft = {
  factType: string;
  label: string;
  valueText: string;
  valueNumber?: number;
  confidence: number;
  sourceQuote?: string;
};

function normalizeText(text: string) {
  return text.replace(/\u0000/g, " ").replace(/\r\n/g, "\n").trim();
}

function buildExcerpt(text: string, index: number, radius = 90) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);

  return text
    .slice(start, end)
    .replace(/\s+/g, " ")
    .trim();
}

function addFact(
  facts: ExtractedFactDraft[],
  seen: Set<string>,
  fact: ExtractedFactDraft
) {
  const key = `${fact.factType}|${fact.label}|${fact.valueText}`;
  if (seen.has(key)) return;
  seen.add(key);
  facts.push(fact);
}

function parseMeasurementValue(rawValue: string, unit?: string) {
  const parsedValue = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return {
    value: parsedValue,
    unit: unit?.trim().toLowerCase() ?? "",
  };
}

export function extractFactsFromText(text: string) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    return [] as ExtractedFactDraft[];
  }

  const facts: ExtractedFactDraft[] = [];
  const seen = new Set<string>();

  const keywordFacts = [
    { regex: /\bpostmenopausal bleeding\b/i, factType: "SYMPTOM", label: "Postmenopausal bleeding", valueText: "Present", confidence: 0.8 },
    { regex: /\brecurrent PMB\b|\bmultiple episodes of PMB\b|\bmultiple episodes of postmenopausal bleeding\b|\brecurrent postmenopausal bleeding\b/i, factType: "SYMPTOM", label: "Multiple PMB episodes", valueText: "Present", confidence: 0.82 },
    { regex: /\babnormal uterine bleeding\b|\bAUB\b/i, factType: "SYMPTOM", label: "Abnormal uterine bleeding", valueText: "Present", confidence: 0.8 },
    { regex: /\bcontinuous bleeding\b.{0,20}\b3\/12\b|\bintermenstrual bleeding\b.{0,40}\b3 months\b|\bbleeding\b.{0,40}\bmore than 3 months\b|\bIMB\b/i, factType: "SYMPTOM", label: "Persistent bleeding >3 months", valueText: "Present", confidence: 0.72 },
    { regex: /\bMirena\b|\bProvera\b|\bTranexamic acid\b|\bTXA\b|\bcombined oral contraceptive\b|\bCOC\b|\bprogesterone oral contraceptive\b|\bPOP\b|\bOxybutynin\b|\bSolifenacin\b/i, factType: "MANAGEMENT", label: "Medical management trialled", valueText: "Present", confidence: 0.72 },
    { regex: /\bpelvic pain\b/i, factType: "SYMPTOM", label: "Pelvic pain", valueText: "Present", confidence: 0.76 },
    { regex: /\bUSS\b|\bultrasound(?: scan)?\b/i, factType: "IMAGING", label: "Ultrasound scan", valueText: "Available", confidence: 0.72 },
    { regex: /\bmass symptoms\b|\bpressure symptoms\b|\bhydronephrosis\b|\burinary symptoms\b|\bbowel symptoms\b/i, factType: "SYMPTOM", label: "Mass symptoms", valueText: "Present", confidence: 0.72 },
    { regex: /\burogyn(?:aecology|ae)\b/i, factType: "CATEGORY", label: "Urogynaecology", valueText: "Referenced", confidence: 0.7 },
    { regex: /\bprocidentia\b/i, factType: "CONDITION", label: "Procidentia", valueText: "Present", confidence: 0.78 },
    { regex: /\brecurrent symptoms\b|\brecurrent prolapse\b|\brecurrent incontinence\b/i, factType: "SYMPTOM", label: "Recurrent symptoms", valueText: "Present", confidence: 0.74 },
    { regex: /\bmesh related\b|\bmesh complication\b|\bvaginal mesh\b|\bvisible exposure\b|\bgroin pain\b/i, factType: "CONDITION", label: "Mesh related problem", valueText: "Present", confidence: 0.76 },
    { regex: /\basymptomatic prolapse\b|\bprolapse\b.{0,30}\basymptomatic\b|\basymptomatic\b.{0,30}\bprolapse\b/i, factType: "CONDITION", label: "Asymptomatic prolapse", valueText: "Present", confidence: 0.74 },
    { regex: /\bprolapse stage 1\b|\bstage 1 prolapse\b/i, factType: "CONDITION", label: "Prolapse stage 1", valueText: "Present", confidence: 0.74 },
    { regex: /\bprolapse stage 2\b|\bstage 2 prolapse\b/i, factType: "CONDITION", label: "Prolapse stage 2", valueText: "Present", confidence: 0.74 },
    { regex: /\bprolapse stage 3\b|\bstage 3 prolapse\b/i, factType: "CONDITION", label: "Prolapse stage 3", valueText: "Present", confidence: 0.74 },
    { regex: /\bsymptomatic prolapse\b/i, factType: "CONDITION", label: "Symptomatic prolapse", valueText: "Present", confidence: 0.74 },
    { regex: /\burinary retention\b/i, factType: "SYMPTOM", label: "Urinary retention", valueText: "Present", confidence: 0.76 },
    { regex: /\bhydronephrosis\b/i, factType: "IMAGING", label: "Hydronephrosis", valueText: "Present", confidence: 0.78 },
    { regex: /\bprolapse\b.{0,30}\bretention\b|\bretention\b.{0,30}\bprolapse\b/i, factType: "CONDITION", label: "Prolapse with retention", valueText: "Present", confidence: 0.74 },
    { regex: /\bstress urinary incontinence\b|\bSUI\b/i, factType: "SYMPTOM", label: "Stress urinary incontinence", valueText: "Present", confidence: 0.8 },
    { regex: /\burge incontinence\b|\boveractive bladder\b|\bOAB\b/i, factType: "SYMPTOM", label: "Urge incontinence", valueText: "Present", confidence: 0.78 },
    { regex: /\bpelvic floor physiotherapy\b|\bPFMT\b/i, factType: "MANAGEMENT", label: "Pelvic floor physiotherapy", valueText: "Present", confidence: 0.72 },
    { regex: /\bconservative management\b|\bconservative measures\b/i, factType: "MANAGEMENT", label: "Prior conservative management", valueText: "Present", confidence: 0.72 },
    { regex: /\bbladder training\b/i, factType: "MANAGEMENT", label: "Bladder training", valueText: "Present", confidence: 0.76 },
    { regex: /\banticholinergic\b|\boxybutynin\b|\bsolifenacin\b|\btolterodine\b/i, factType: "MANAGEMENT", label: "Anticholinergic medication", valueText: "Present", confidence: 0.76 },
    { regex: /\bfertility\b/i, factType: "CATEGORY", label: "Fertility", valueText: "Referenced", confidence: 0.7 },
    { regex: /\btubal ligation\b|\bsterilisation\b|\bsterilization\b/i, factType: "CATEGORY", label: "Tubal ligation", valueText: "Requested", confidence: 0.76 },
    { regex: /\bPCOS\b|\bpolycystic ovarian syndrome\b/i, factType: "CONDITION", label: "PCOS", valueText: "Referenced", confidence: 0.75 },
    { regex: /\bcervical polyp\b/i, factType: "CONDITION", label: "Cervical polyp", valueText: "Referenced", confidence: 0.78 },
    { regex: /\bpost[- ]?coital bleeding\b|\bPCB\b/i, factType: "SYMPTOM", label: "Post-coital bleeding", valueText: "Present", confidence: 0.78 },
    { regex: /\binter[- ]?menstrual bleeding\b|\bIMB\b/i, factType: "SYMPTOM", label: "Intermenstrual bleeding", valueText: "Present", confidence: 0.76 },
    { regex: /\bnormal smear\b|\bnegative smear\b|\bsmear normal\b|\bNILM\b|\bno intraepithelial lesion or malignancy\b/i, factType: "SCREENING", label: "Normal smear", valueText: "Present", confidence: 0.78 },
    { regex: /\bfibroid(?:s)?\b/i, factType: "CONDITION", label: "Fibroids", valueText: "Referenced", confidence: 0.74 },
    { regex: /\bovarian cyst\b|\badnexal cyst\b/i, factType: "CONDITION", label: "Ovarian cyst", valueText: "Referenced", confidence: 0.78 },
    { regex: /\bcomplex adnexal mass\b|\bcomplex ovarian cyst\b/i, factType: "CONDITION", label: "Complex adnexal mass", valueText: "Present", confidence: 0.82 },
    { regex: /\bsuspicious ovarian mass\b|\bsuspicious adnexal mass\b/i, factType: "CONDITION", label: "Suspicious ovarian mass", valueText: "Present", confidence: 0.82 },
    { regex: /\bsolid component\b/i, factType: "CONDITION", label: "Adnexal mass with solid component", valueText: "Present", confidence: 0.78 },
    { regex: /\bendometrioma\b/i, factType: "CONDITION", label: "Endometrioma", valueText: "Present", confidence: 0.8 },
    { regex: /\bdeep infiltrating endometriosis\b|\bDIE confirmed on imaging\b|\bDIE\b/i, factType: "CONDITION", label: "Deep infiltrating endometriosis", valueText: "Present", confidence: 0.82 },
    { regex: /\bprevious endometriosis\b/i, factType: "CONDITION", label: "Previous endometriosis", valueText: "Present", confidence: 0.76 },
    { regex: /\brecurrent endometriosis\b/i, factType: "CONDITION", label: "Recurrent endometriosis", valueText: "Present", confidence: 0.76 },
    { regex: /\bendometriosis\b/i, factType: "CONDITION", label: "Endometriosis", valueText: "Referenced", confidence: 0.76 },
    { regex: /\buterine polyp\b|\bendometrial polyp\b/i, factType: "IMAGING", label: "Uterine polyp on USS", valueText: "Present", confidence: 0.8 },
    { regex: /\bpositive test of cure\b|\bTOC positive\b|\bAIS TOC\b/i, factType: "CERVICAL_RESULT", label: "Positive test of cure", valueText: "Detected", confidence: 0.84 },
    { regex: /\bimmune deficient\b|\bimmunodeficient\b|\bimmunosuppressed\b|\bimmune suppressed\b/i, factType: "RISK_FACTOR", label: "Immune deficient", valueText: "Present", confidence: 0.74 },
    { regex: /\babnormal appearance\b|\babnormal cervix\b/i, factType: "REFERRAL_REASON", label: "Abnormal appearance", valueText: "Present", confidence: 0.78 },
    { regex: /\bHPV[- ]?16\/18\b|\b16\/18 positive\b|\bHPV 16 18\b/i, factType: "CERVICAL_RESULT", label: "HPV 16/18", valueText: "Positive", confidence: 0.9 },
    { regex: /\bother high risk HPV\b|\bHPV other\b/i, factType: "CERVICAL_RESULT", label: "HPV Other", valueText: "Positive", confidence: 0.82 },
    { regex: /\bASC-US\b/i, factType: "CERVICAL_RESULT", label: "ASC-US", valueText: "Detected", confidence: 0.84 },
    { regex: /\bLSIL\b/i, factType: "CERVICAL_RESULT", label: "LSIL", valueText: "Detected", confidence: 0.88 },
    { regex: /\bHSIL\b/i, factType: "CERVICAL_RESULT", label: "HSIL", valueText: "Detected", confidence: 0.9 },
    { regex: /\bASC-H\b/i, factType: "CERVICAL_RESULT", label: "ASC-H", valueText: "Detected", confidence: 0.88 },
    { regex: /\bborderline cytology\b|\bborderline changes\b/i, factType: "CERVICAL_RESULT", label: "Borderline cytology", valueText: "Detected", confidence: 0.8 },
    { regex: /\bglandular abnormalit(?:y|ies)\b|\bAGC\b|\bAGUS\b/i, factType: "CERVICAL_RESULT", label: "Glandular abnormality", valueText: "Detected", confidence: 0.82 },
    { regex: /\bsuspicious(?: for)? cancer\b|\bdefinite cancer\b|\binvasive cancer\b|\bSCC\b/i, factType: "CERVICAL_RESULT", label: "Cancer suspicion cytology", valueText: "Detected", confidence: 0.86 },
    { regex: /\bCIN2\b/i, factType: "HISTOLOGY", label: "CIN2", valueText: "Referenced", confidence: 0.88 },
    { regex: /\bCIN3\b/i, factType: "HISTOLOGY", label: "CIN3", valueText: "Referenced", confidence: 0.9 },
    { regex: /\bpost-treatment assessment\b|\bpost[- ]?LLETZ\b|\bafter treatment for CIN\b|\bpost cone biopsy\b|\bpost treatment follow[- ]?up\b/i, factType: "REFERRAL_REASON", label: "Post-treatment assessment", valueText: "Referenced", confidence: 0.78 },
    { regex: /\bHPV surveillance\b|\bsurveillance colposcopy\b|\bfollow[- ]?up colposcopy\b|\bcolposcopy surveillance\b/i, factType: "REFERRAL_REASON", label: "HPV surveillance", valueText: "Referenced", confidence: 0.78 },
    { regex: /\bsecond HPV positive result\b|\bpersistent HPV other\b/i, factType: "REFERRAL_REASON", label: "Second HPV positive result", valueText: "Referenced", confidence: 0.76 },
    { regex: /\bendorsed referred on colposcopy\b|\bendorsed referral on colposcopy\b/i, factType: "REFERRAL_REASON", label: "Endorsed referral on colposcopy", valueText: "Referenced", confidence: 0.78 },
    { regex: /\bother clinical assessment\b/i, factType: "REFERRAL_REASON", label: "Other clinical assessment", valueText: "Referenced", confidence: 0.74 },
    { regex: /\bpaediatric gynaecology\b|\bpediatric gynecology\b|\badolescent gynaecology\b|\badolescent gynecology\b/i, factType: "CATEGORY", label: "Paediatric gynaecology", valueText: "Referenced", confidence: 0.8 },
    { regex: /\b(?:1[0-5]|[1-9])\s*(?:yo|y\/o|year old)\b/i, factType: "DEMOGRAPHIC", label: "Patient under 16", valueText: "Present", confidence: 0.68 },
    { regex: /\bperineal tear 3B\b|\bgrade 3B tear\b|\b3B tear\b/i, factType: "OBSTETRIC", label: "Perineal tear 3B", valueText: "Present", confidence: 0.84 },
    { regex: /\bperineal tear 3C\b|\bgrade 3C tear\b|\b3C tear\b/i, factType: "OBSTETRIC", label: "Perineal tear 3C", valueText: "Present", confidence: 0.84 },
    { regex: /\bperineal tear 4th degree\b|\bfourth degree tear\b|\bgrade 4 tear\b|\b4th degree tear\b/i, factType: "OBSTETRIC", label: "Perineal tear 4th degree", valueText: "Present", confidence: 0.84 },
    { regex: /\bobstetric anal sphincter injury\b|\bOASI\b/i, factType: "OBSTETRIC", label: "Obstetric anal sphincter injury", valueText: "Present", confidence: 0.84 },
  ] as const;

  for (const keywordFact of keywordFacts) {
    const match = keywordFact.regex.exec(normalizedText);
    if (!match) continue;
    addFact(facts, seen, {
      factType: keywordFact.factType,
      label: keywordFact.label,
      valueText: keywordFact.valueText,
      confidence: keywordFact.confidence,
      sourceQuote: buildExcerpt(normalizedText, match.index),
    });
  }

  const numericPatterns = [
    {
      regex: /\bCA[-\s]?125\b[^\d]{0,12}(\d+(?:\.\d+)?)/gi,
      factType: "LAB_RESULT",
      label: "CA-125",
      formatter: (value: number) => `${value}`,
      confidence: 0.86,
    },
    {
      regex: /\b(?:endometrial thickness|endometrium(?:\s+(?:measures?|thickness|stripe))?|ET)\b[^\d]{0,20}(\d+(?:\.\d+)?)\s*(mm|cm)\b/gi,
      factType: "IMAGING",
      label: "Endometrial thickness",
      formatter: (value: number) => `${value} mm`,
      confidence: 0.88,
    },
    {
      regex: /\bfibroid(?:s)?\b.{0,60}?(\d+(?:\.\d+)?)\s*(mm|cm)\b/gi,
      factType: "IMAGING",
      label: "Fibroid size",
      formatter: (value: number) => `${value} cm`,
      confidence: 0.78,
    },
    {
      regex: /\b(?:ovarian|adnexal)\s+(?:cyst|mass)\b.{0,60}?(\d+(?:\.\d+)?)\s*(mm|cm)\b/gi,
      factType: "IMAGING",
      label: "Ovarian cyst size",
      formatter: (value: number) => `${value} cm`,
      confidence: 0.8,
    },
    {
      regex: /\bcervical polyp\b.{0,60}?(\d+(?:\.\d+)?)\s*(mm|cm)\b/gi,
      factType: "EXAM",
      label: "Cervical polyp size",
      formatter: (value: number) => `${value} cm`,
      confidence: 0.76,
    },
    {
      regex: /\bendometrioma\b.{0,60}?(\d+(?:\.\d+)?)\s*(mm|cm)\b/gi,
      factType: "IMAGING",
      label: "Endometrioma size",
      formatter: (value: number) => `${value} cm`,
      confidence: 0.8,
    },
  ] as const;

  for (const pattern of numericPatterns) {
    for (const match of normalizedText.matchAll(pattern.regex)) {
      const rawNumber = match[1];
      const measurement = parseMeasurementValue(rawNumber, match[2]);
      if (!measurement) continue;

      let parsedNumber = measurement.value;
      if (pattern.label === "Endometrial thickness") {
        parsedNumber =
          measurement.unit === "cm" ? measurement.value * 10 : measurement.value;
      } else if (measurement.unit === "mm") {
        parsedNumber = measurement.value / 10;
      }

      addFact(facts, seen, {
        factType: pattern.factType,
        label: pattern.label,
        valueText: pattern.formatter(parsedNumber),
        valueNumber: parsedNumber,
        confidence: pattern.confidence,
        sourceQuote: buildExcerpt(normalizedText, match.index ?? 0),
      });
    }
  }

  return facts;
}
