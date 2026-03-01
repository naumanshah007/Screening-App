// ─── Decision Tree Types ──────────────────────────────────────────────────────

export type NodeType = 'start' | 'decision' | 'outcome' | 'process';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  sublabel?: string;      // e.g. recommendation code
  risk?: RiskLevel;       // for outcome nodes
  x: number;             // center x in SVG units
  y: number;             // center y in SVG units
  width?: number;        // default: 180
  height?: number;       // default: 60
  codes?: string[];      // recommendationCodes that activate this node
}

export interface FlowEdge {
  id: string;
  from: string;           // source node id
  to: string;             // target node id
  label?: string;         // edge label text
  labelPos?: 'start' | 'mid' | 'end'; // default: mid
  dashed?: boolean;
}

export interface FigureDef {
  id: string;             // e.g. 'FIGURE_1'
  title: string;
  subtitle: string;
  viewBox: string;        // SVG viewBox e.g. "0 0 800 500"
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// ─── Figure 1: HPV Transition ─────────────────────────────────────────────────

const FIGURE_1: FigureDef = {
  id: 'FIGURE_1',
  title: 'Figure 1 — HPV Transition',
  subtitle: 'First HPV Screen after Cytology',
  viewBox: '0 0 860 560',
  nodes: [
    { id: 'start',  type: 'start',    label: 'HPV Transition Pathway', sublabel: 'First HPV Screen',        x: 430, y: 44  },
    { id: 'hpv',    type: 'decision', label: 'HPV Result?',             x: 430, y: 160, width: 200, height: 90 },
    { id: 'neg',    type: 'outcome',  label: '5-Year Routine Recall',   sublabel: 'F1-NEG-5Y',               risk: 'LOW',    x: 100, y: 320, codes: ['F1-NEG-5Y'] },
    { id: 'inad',   type: 'outcome',  label: 'Repeat HPV — 3 Months',  sublabel: 'F1-INAD-3M',              risk: 'MEDIUM', x: 310, y: 320, codes: ['F1-INAD-3M'] },
    { id: 'cyt',    type: 'decision', label: 'Cytology?',               x: 530, y: 320, width: 160, height: 80 },
    { id: 'p2',     type: 'outcome',  label: 'Colposcopy — P2',         sublabel: 'F1-16-18-COLP',           risk: 'HIGH',   x: 760, y: 320, codes: ['F1-16-18-COLP'] },
    { id: 'neg12',  type: 'outcome',  label: 'Repeat Co-test — 12 Months', sublabel: 'F1-HPVO-NEG-12M',     risk: 'MEDIUM', x: 430, y: 460, codes: ['F1-HPVO-NEG-12M'] },
    { id: 'colp2',  type: 'outcome',  label: 'Colposcopy — P2',         sublabel: 'F1-HPVO-ABN-COLP',       risk: 'HIGH',   x: 640, y: 460, codes: ['F1-HPVO-ABN-COLP'] },
  ],
  edges: [
    { id: 'e1', from: 'start', to: 'hpv' },
    { id: 'e2', from: 'hpv',   to: 'neg',   label: 'Not Detected' },
    { id: 'e3', from: 'hpv',   to: 'inad',  label: 'Inadequate' },
    { id: 'e4', from: 'hpv',   to: 'cyt',   label: 'HPV Other' },
    { id: 'e5', from: 'hpv',   to: 'p2',    label: 'HPV 16/18' },
    { id: 'e6', from: 'cyt',   to: 'neg12', label: 'Negative' },
    { id: 'e7', from: 'cyt',   to: 'colp2', label: 'Abnormal Cytology' },
  ],
};

// ─── Figure 2: Module B — Ongoing Recall ─────────────────────────────────────

const FIGURE_2: FigureDef = {
  id: 'FIGURE_2',
  title: 'Figure 2 — Module B',
  subtitle: 'Prior Normal / Previous Screening',
  viewBox: '0 0 760 480',
  nodes: [
    { id: 'start', type: 'start',    label: 'Module B — Ongoing Recall',  sublabel: 'Prior screening with outcome', x: 380, y: 44  },
    { id: 'hpv',   type: 'decision', label: 'HPV Result?',                 x: 380, y: 160, width: 200, height: 90 },
    { id: 'neg5y', type: 'outcome',  label: '5-Year Routine Recall',       sublabel: 'F2-NEG-5Y',   risk: 'LOW',    x: 130, y: 320, codes: ['F2-NEG-5Y', 'F2-CONSEC-NEG-5Y'] },
    { id: 'inad',  type: 'outcome',  label: 'Repeat HPV — 6 Weeks',       sublabel: 'F2-INAD-6W',  risk: 'MEDIUM', x: 330, y: 320, codes: ['F2-INAD-6W', 'F2-2ND-INAD-COLP'] },
    { id: 'cyt',   type: 'decision', label: 'Cytology?',                   x: 530, y: 320, width: 160, height: 80 },
    { id: 'p2hi',  type: 'outcome',  label: 'Colposcopy — P2',            sublabel: 'F2-1618-COLP', risk: 'HIGH',   x: 680, y: 320, codes: ['F2-1618-COLP'] },
    { id: '12m',   type: 'outcome',  label: 'Repeat Co-test — 12 Months', sublabel: 'F2-HPVO-12M', risk: 'MEDIUM', x: 430, y: 460, codes: ['F2-HPVO-12M', 'F2-HPVO-2ND-COLP'] },
    { id: 'colp3', type: 'outcome',  label: 'Colposcopy — P3',            sublabel: 'F2-ABN-COLP', risk: 'HIGH',   x: 620, y: 460, codes: ['F2-ABN-COLP'] },
  ],
  edges: [
    { id: 'e1', from: 'start', to: 'hpv' },
    { id: 'e2', from: 'hpv',   to: 'neg5y', label: 'Not Detected' },
    { id: 'e3', from: 'hpv',   to: 'inad',  label: 'Inadequate' },
    { id: 'e4', from: 'hpv',   to: 'cyt',   label: 'HPV Other' },
    { id: 'e5', from: 'hpv',   to: 'p2hi',  label: 'HPV 16/18' },
    { id: 'e6', from: 'cyt',   to: '12m',   label: 'Negative' },
    { id: 'e7', from: 'cyt',   to: 'colp3', label: 'Abnormal' },
  ],
};

// ─── Figure 3: Primary HPV Screening ─────────────────────────────────────────

const FIGURE_3: FigureDef = {
  id: 'FIGURE_3',
  title: 'Figure 3 — Primary HPV Screening',
  subtitle: 'Standard recall pathway',
  viewBox: '0 0 1000 620',
  nodes: [
    { id: 'start',   type: 'start',    label: 'Primary HPV Screening',       sublabel: 'Standard recall pathway',      x: 500, y: 44  },
    { id: 'hpv',     type: 'decision', label: 'HPV Result?',                  x: 500, y: 160, width: 220, height: 90 },
    { id: 'neg5y',   type: 'outcome',  label: '5-Year Routine Recall',        sublabel: 'F3-NEG-5Y',    risk: 'LOW',    x: 100, y: 320, codes: ['F3-NEG-5Y', 'F3-IC-3Y'] },
    { id: 'inad',    type: 'outcome',  label: 'Repeat HPV — 6 Weeks',        sublabel: 'F3-INAD-6W',   risk: 'MEDIUM', x: 280, y: 320, codes: ['F3-INAD-6W', 'F3-2ND-INAD-COLP'] },
    { id: 'cytO',    type: 'decision', label: 'Cytology? (HPV Other)',        x: 490, y: 320, width: 180, height: 80 },
    { id: 'cyt1618', type: 'decision', label: 'Cytology? (HPV 16/18)',        x: 720, y: 320, width: 180, height: 80 },
    { id: 'lowO',    type: 'outcome',  label: 'Repeat Co-test — 12 Months',  sublabel: 'F3-HPVO-LOW-12M',  risk: 'MEDIUM', x: 390, y: 470, codes: ['F3-HPVO-LOW-12M', 'F3-HPVO-NEG-12M'] },
    { id: 'highO',   type: 'outcome',  label: 'Colposcopy — P2',             sublabel: 'F3-HPVO-HIGH-COLP', risk: 'HIGH',  x: 580, y: 470, codes: ['F3-HPVO-HIGH-COLP', 'F3-HIGH-COLP'] },
    { id: 'low16',   type: 'outcome',  label: 'Colposcopy — P2',             sublabel: 'F3-1618-LOW-COLP',  risk: 'HIGH',  x: 660, y: 470, codes: ['F3-1618-LOW-COLP', 'F3-1618-NEG-COLP'] },
    { id: 'high16',  type: 'outcome',  label: 'Colposcopy — P1/P2',          sublabel: 'F3-1618-HIGH-COLP', risk: 'URGENT',x: 860, y: 470, codes: ['F3-1618-HIGH-COLP', 'F3-HIGH-URGENTCOLP'] },
  ],
  edges: [
    { id: 'e1', from: 'start',   to: 'hpv' },
    { id: 'e2', from: 'hpv',     to: 'neg5y',   label: 'Not Detected' },
    { id: 'e3', from: 'hpv',     to: 'inad',    label: 'Inadequate' },
    { id: 'e4', from: 'hpv',     to: 'cytO',    label: 'HPV Other' },
    { id: 'e5', from: 'hpv',     to: 'cyt1618', label: 'HPV 16/18' },
    { id: 'e6', from: 'cytO',    to: 'lowO',    label: 'Neg / Low Grade' },
    { id: 'e7', from: 'cytO',    to: 'highO',   label: 'High Grade' },
    { id: 'e8', from: 'cyt1618', to: 'low16',   label: 'Negative / Low Grade' },
    { id: 'e9', from: 'cyt1618', to: 'high16',  label: 'High Grade' },
  ],
};

// ─── Figure 4: Colposcopy — Low Grade Referral ────────────────────────────────

const FIGURE_4: FigureDef = {
  id: 'FIGURE_4',
  title: 'Figure 4 — Colposcopy (Low Grade)',
  subtitle: 'Low-grade / initial assessment',
  viewBox: '0 0 860 560',
  nodes: [
    { id: 'start', type: 'start',    label: 'Colposcopy Referral',         sublabel: 'Low-grade / initial assessment', x: 430, y: 44  },
    { id: 'colp',  type: 'decision', label: 'Colposcopic Impression?',      x: 430, y: 160, width: 220, height: 90 },
    { id: 'norm',  type: 'outcome',  label: 'Repeat Co-test — 12 Months',  sublabel: 'F4-NORM-12M',    risk: 'LOW',    x: 100, y: 320, codes: ['F4-NORM-12M', 'F4-NORM-COLP-12M'] },
    { id: 'lsil',  type: 'process',  label: 'Biopsy? (Low-grade)',          x: 300, y: 320 },
    { id: 'hsil',  type: 'outcome',  label: 'Treatment / Excision',        sublabel: 'F4-HSIL-TREAT',  risk: 'HIGH',   x: 560, y: 320, codes: ['F4-HSIL-TREAT', 'F4-HSIL-COLP'] },
    { id: 'inv',   type: 'outcome',  label: 'MDM + Urgent Oncology',       sublabel: 'F4-INV-MDM',     risk: 'URGENT', x: 760, y: 320, codes: ['F4-INV-MDM', 'F4-INV-URGENT'] },
    { id: 'cin1',  type: 'outcome',  label: 'Repeat Co-test — 12 Months',  sublabel: 'F4-CIN1-12M',    risk: 'LOW',    x: 220, y: 470, codes: ['F4-CIN1-12M'] },
    { id: 'cin23', type: 'outcome',  label: 'Treatment Recommended',       sublabel: 'F4-CIN23-TREAT', risk: 'HIGH',   x: 400, y: 470, codes: ['F4-CIN23-TREAT', 'F4-CIN2-TREAT', 'F4-CIN3-TREAT'] },
  ],
  edges: [
    { id: 'e1', from: 'start', to: 'colp' },
    { id: 'e2', from: 'colp',  to: 'norm',  label: 'Normal' },
    { id: 'e3', from: 'colp',  to: 'lsil',  label: 'LSIL' },
    { id: 'e4', from: 'colp',  to: 'hsil',  label: 'HSIL' },
    { id: 'e5', from: 'colp',  to: 'inv',   label: 'Invasion' },
    { id: 'e6', from: 'lsil',  to: 'cin1',  label: 'CIN1 / Biopsy' },
    { id: 'e7', from: 'lsil',  to: 'cin23', label: 'CIN2/3' },
  ],
};

// ─── Figure 5: Colposcopy — High Grade / AIS / Glandular ─────────────────────

const FIGURE_5: FigureDef = {
  id: 'FIGURE_5',
  title: 'Figure 5 — Colposcopy (High Grade)',
  subtitle: 'AIS / glandular abnormality',
  viewBox: '0 0 860 500',
  nodes: [
    { id: 'start', type: 'start',    label: 'Colposcopy — High Grade',     sublabel: 'AIS / glandular abnormality',  x: 430, y: 44  },
    { id: 'colp',  type: 'decision', label: 'Colposcopic Impression?',      x: 430, y: 160, width: 220, height: 90 },
    { id: 'hsil',  type: 'outcome',  label: 'Excision / Treatment',        sublabel: 'F5-HSIL-EXC',  risk: 'HIGH',   x: 150, y: 320, codes: ['F5-HSIL-EXC', 'F5-CIN3-TREAT'] },
    { id: 'ais',   type: 'outcome',  label: 'Cone Biopsy + MDM',           sublabel: 'F5-AIS-CONE',  risk: 'HIGH',   x: 350, y: 320, codes: ['F5-AIS-CONE', 'F5-AIS-MDM'] },
    { id: 'inv',   type: 'outcome',  label: 'MDM — Urgent Oncology',       sublabel: 'F5-INV-MDM',   risk: 'URGENT', x: 560, y: 320, codes: ['F5-INV-MDM', 'F5-INV-URGENT'] },
    { id: 'mdm',   type: 'outcome',  label: 'MDM Review Required',         sublabel: 'F5-MDM',       risk: 'HIGH',   x: 760, y: 320, codes: ['F5-MDM', 'F5-DISCORDANT-MDM'] },
  ],
  edges: [
    { id: 'e1', from: 'start', to: 'colp' },
    { id: 'e2', from: 'colp',  to: 'hsil', label: 'HSIL / CIN3' },
    { id: 'e3', from: 'colp',  to: 'ais',  label: 'AIS / Glandular' },
    { id: 'e4', from: 'colp',  to: 'inv',  label: 'Invasion Suspected' },
    { id: 'e5', from: 'colp',  to: 'mdm',  label: 'Discordant / Unsatisfactory' },
  ],
};

// ─── Figure 6: Test of Cure (Post-Treatment) ─────────────────────────────────

const FIGURE_6: FigureDef = {
  id: 'FIGURE_6',
  title: 'Figure 6 — Test of Cure',
  subtitle: 'Post-treatment follow-up',
  viewBox: '0 0 860 560',
  nodes: [
    { id: 'start',   type: 'start',    label: 'Test of Cure',                sublabel: 'Post-treatment follow-up', x: 430, y: 44  },
    { id: 'hpv',     type: 'decision', label: 'HPV Result?',                  x: 430, y: 160, width: 200, height: 90 },
    { id: 'neg1st',  type: 'outcome',  label: 'Repeat Co-test — 12 Months',  sublabel: 'F6-TOC-6M-NEG',       risk: 'LOW',    x: 130, y: 320, codes: ['F6-TOC-6M-NEG'] },
    { id: 'dis',     type: 'outcome',  label: 'Discharge to 5-Year Recall',  sublabel: 'F6-TOC-DISCHARGE-5Y', risk: 'LOW',    x: 320, y: 320, codes: ['F6-TOC-DISCHARGE-5Y', 'F6-TOC-DISCHARGE-IC-3Y'] },
    { id: 'hpvoN',   type: 'outcome',  label: 'Repeat Co-test — 12 Months',  sublabel: 'F6-HPVO-12M',         risk: 'MEDIUM', x: 510, y: 320, codes: ['F6-HPVO-12M'] },
    { id: 'persist', type: 'outcome',  label: 'Colposcopy — P2',             sublabel: 'F6-PERSIST-COLP',     risk: 'HIGH',   x: 680, y: 320, codes: ['F6-PERSIST-COLP'] },
    { id: 'relapse', type: 'outcome',  label: 'Urgent Colposcopy — P1',      sublabel: 'F6-RELAPSE-URGCOLP',  risk: 'URGENT', x: 860, y: 220, codes: ['F6-RELAPSE-URGCOLP', 'F6-ABN-12M'] },
  ],
  edges: [
    { id: 'e1', from: 'start', to: 'hpv' },
    { id: 'e2', from: 'hpv',   to: 'neg1st',  label: 'Not Detected (1st)' },
    { id: 'e3', from: 'hpv',   to: 'dis',     label: 'Not Detected (2nd)' },
    { id: 'e4', from: 'hpv',   to: 'hpvoN',   label: 'HPV Other (1st)' },
    { id: 'e5', from: 'hpv',   to: 'persist', label: 'HPV Other (2nd)' },
    { id: 'e6', from: 'hpv',   to: 'relapse', label: 'HPV 16/18 / High Grade' },
  ],
};

// ─── Figure 7: Glandular Abnormalities ───────────────────────────────────────

const FIGURE_7: FigureDef = {
  id: 'FIGURE_7',
  title: 'Figure 7 — Glandular Abnormalities',
  subtitle: 'AG/AC cytology pathway',
  viewBox: '0 0 860 500',
  nodes: [
    { id: 'start', type: 'start',    label: 'Glandular Abnormalities',     sublabel: 'AG/AC cytology pathway', x: 430, y: 44  },
    { id: 'grade', type: 'decision', label: 'Glandular Grade?',             x: 430, y: 160, width: 200, height: 90 },
    { id: 'ag1',   type: 'outcome',  label: 'Colposcopy — P3',             sublabel: 'F7-AG1-COLP',  risk: 'MEDIUM', x: 130, y: 320, codes: ['F7-AG1-COLP', 'F7-AG1-AC1-COLP'] },
    { id: 'ag2',   type: 'outcome',  label: 'Gynaecology Referral',        sublabel: 'F7-AG2-GYN',   risk: 'HIGH',   x: 330, y: 320, codes: ['F7-AG2-GYN', 'F7-AG2-ATEND-GYN'] },
    { id: 'ag35',  type: 'outcome',  label: 'Colposcopy — P2',            sublabel: 'F7-AG3-COLP',  risk: 'HIGH',   x: 530, y: 320, codes: ['F7-AG3-COLP', 'F7-HIGH-COLP'] },
    { id: 'ac24',  type: 'outcome',  label: 'Gynaecology Referral — P2',  sublabel: 'F7-AC2-GYN',   risk: 'HIGH',   x: 730, y: 320, codes: ['F7-AC2-GYN', 'F7-AC-HIGH-GYN'] },
  ],
  edges: [
    { id: 'e1', from: 'start', to: 'grade' },
    { id: 'e2', from: 'grade', to: 'ag1',  label: 'AG1 / AC1 — Low' },
    { id: 'e3', from: 'grade', to: 'ag2',  label: 'AG2 — Atypical Endometrial' },
    { id: 'e4', from: 'grade', to: 'ag35', label: 'AG3–AG5 — High Grade' },
    { id: 'e5', from: 'grade', to: 'ac24', label: 'AC2–AC4 — Adenocarcinoma' },
  ],
};

// ─── Figure 8: Post-Hysterectomy Vault Screening ─────────────────────────────

const FIGURE_8: FigureDef = {
  id: 'FIGURE_8',
  title: 'Figure 8 — Post-Hysterectomy Vault',
  subtitle: 'Vault cytology pathway',
  viewBox: '0 0 760 480',
  nodes: [
    { id: 'start', type: 'start',    label: 'Post-Hysterectomy Vault',     sublabel: 'Vault cytology pathway', x: 380, y: 44  },
    { id: 'cyt',   type: 'decision', label: 'Vault Cytology Result?',       x: 380, y: 160, width: 200, height: 90 },
    { id: 'neg',   type: 'outcome',  label: 'No Further Recall Required',  sublabel: 'F8-VAULT-NEG',  risk: 'LOW',    x: 130, y: 320, codes: ['F8-VAULT-NEG'] },
    { id: 'sat',   type: 'outcome',  label: 'Repeat Vault Cytology',       sublabel: 'F8-VAULT-SAT',  risk: 'LOW',    x: 310, y: 320, codes: ['F8-VAULT-SAT', 'F8-VAULT-UNSAT'] },
    { id: 'abn',   type: 'outcome',  label: 'Colposcopy Referral — P3',   sublabel: 'F8-VAULT-ABN',  risk: 'MEDIUM', x: 490, y: 320, codes: ['F8-VAULT-ABN', 'F8-VAULT-LG'] },
    { id: 'high',  type: 'outcome',  label: 'Colposcopy — P2 / Urgent',   sublabel: 'F8-VAULT-HG',   risk: 'HIGH',   x: 660, y: 320, codes: ['F8-VAULT-HG', 'F8-VAULT-URGENT'] },
  ],
  edges: [
    { id: 'e1', from: 'start', to: 'cyt' },
    { id: 'e2', from: 'cyt',   to: 'neg',  label: 'Negative' },
    { id: 'e3', from: 'cyt',   to: 'sat',  label: 'Unsatisfactory — Repeat' },
    { id: 'e4', from: 'cyt',   to: 'abn',  label: 'Low-grade Abnormality' },
    { id: 'e5', from: 'cyt',   to: 'high', label: 'High-grade Abnormality' },
  ],
};

// ─── Figure 9: Pregnancy + High-Grade Cytology ───────────────────────────────

const FIGURE_9: FigureDef = {
  id: 'FIGURE_9',
  title: 'Figure 9 — Pregnancy + High-Grade Cytology',
  subtitle: 'Deferral until post-partum',
  viewBox: '0 0 760 480',
  nodes: [
    { id: 'start', type: 'start',    label: 'Pregnancy — High-Grade Cytology', sublabel: 'Deferral until post-partum', x: 380, y: 44  },
    { id: 'deg',   type: 'decision', label: 'Cytology Grade?',                  x: 380, y: 160, width: 200, height: 90 },
    { id: 'low',   type: 'outcome',  label: 'Defer to Post-Partum — 6 Weeks',  sublabel: 'F9-PREG-LOW-DEFER', risk: 'LOW',    x: 150, y: 320, codes: ['F9-PREG-LOW-DEFER', 'F9-PREG-DEFER'] },
    { id: 'high',  type: 'process',  label: 'Colposcopy During Pregnancy',       x: 380, y: 320 },
    { id: 'inv',   type: 'outcome',  label: 'MDM + Oncology — Urgent',          sublabel: 'F9-PREG-INV-MDM',   risk: 'URGENT', x: 620, y: 320, codes: ['F9-PREG-INV-MDM', 'F9-PREG-INVASION'] },
    { id: 'pp',    type: 'outcome',  label: 'Repeat Colposcopy Post-Partum',    sublabel: 'F9-PREG-PP-COLP',   risk: 'MEDIUM', x: 380, y: 460, codes: ['F9-PREG-PP-COLP', 'F9-PREG-HIGH-PP'] },
  ],
  edges: [
    { id: 'e1', from: 'start', to: 'deg' },
    { id: 'e2', from: 'deg',   to: 'low',  label: 'Low Grade / Negative' },
    { id: 'e3', from: 'deg',   to: 'high', label: 'High Grade (HSIL/CIN3)' },
    { id: 'e4', from: 'deg',   to: 'inv',  label: 'Invasion Suspected' },
    { id: 'e5', from: 'high',  to: 'pp',   label: 'Review at 6 Weeks Post-Partum' },
  ],
};

// ─── Figure 10: Abnormal Vaginal Bleeding ────────────────────────────────────

const FIGURE_10: FigureDef = {
  id: 'FIGURE_10',
  title: 'Figure 10 — Abnormal Vaginal Bleeding',
  subtitle: 'Initial assessment pathway',
  viewBox: '0 0 860 520',
  nodes: [
    { id: 'start',  type: 'start',    label: 'Abnormal Vaginal Bleeding',        sublabel: 'Initial assessment pathway', x: 430, y: 44  },
    { id: 'exam',   type: 'decision', label: 'Cervix Appearance?',                x: 430, y: 160, width: 200, height: 90 },
    { id: 'cancer', type: 'outcome',  label: 'Urgent Referral — Suspected Cancer', sublabel: 'F10-CANCEL-URGENT', risk: 'URGENT', x: 100, y: 320, codes: ['F10-CANCEL-URGENT', 'F10-CANCER-URGENT'] },
    { id: 'sti',    type: 'outcome',  label: 'Treat STI — Recall 3 Months',      sublabel: 'F10-STI-TREAT',  risk: 'MEDIUM', x: 300, y: 320, codes: ['F10-STI-TREAT'] },
    { id: 'oc',     type: 'outcome',  label: 'Adjust OC / Recall 3 Months',      sublabel: 'F10-OC-ADJUST',  risk: 'LOW',    x: 490, y: 320, codes: ['F10-OC-ADJUST'] },
    { id: 'res',    type: 'decision', label: 'Bleeding Resolved?',                x: 680, y: 320, width: 160, height: 80 },
    { id: 'screen', type: 'outcome',  label: 'Routine Cervical Screen',          sublabel: 'F10-ROUTINE-SCREEN', risk: 'LOW',  x: 600, y: 460, codes: ['F10-ROUTINE-SCREEN'] },
    { id: 'refer',  type: 'outcome',  label: 'Gynaecology Referral',             sublabel: 'F10-GYN-REFER',  risk: 'HIGH',   x: 780, y: 460, codes: ['F10-GYN-REFER'] },
  ],
  edges: [
    { id: 'e1', from: 'start',  to: 'exam' },
    { id: 'e2', from: 'exam',   to: 'cancer', label: 'Abnormal — Suspected Cancer' },
    { id: 'e3', from: 'exam',   to: 'sti',    label: 'STI Identified' },
    { id: 'e4', from: 'exam',   to: 'oc',     label: 'OC-Related / Benign' },
    { id: 'e5', from: 'exam',   to: 'res',    label: 'Normal Cervix' },
    { id: 'e6', from: 'res',    to: 'screen', label: 'Resolved — Screen' },
    { id: 'e7', from: 'res',    to: 'refer',  label: 'Not Resolved' },
  ],
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const ALL_FIGURES: FigureDef[] = [
  FIGURE_1,
  FIGURE_2,
  FIGURE_3,
  FIGURE_4,
  FIGURE_5,
  FIGURE_6,
  FIGURE_7,
  FIGURE_8,
  FIGURE_9,
  FIGURE_10,
];

export function getFigureById(id: string): FigureDef | undefined {
  return ALL_FIGURES.find(f => f.id === id);
}
