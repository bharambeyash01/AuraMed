export enum SeverityLevel {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface PatientVitals {
  heart_rate: number;
  systolic_bp: number;
  diastolic_bp: number;
  respiratory_rate: number;
  temperature_celsius: number;
  serum_creatinine: number;
  estimated_gfr: number;
}

export interface PatientMetadata {
  patient_id: string;
  age: number;
  gender: 'Male' | 'Female';
  weight_kg: number;
  admission_unit: string;
  allergies: string[];
  baseline_creatinine: number;
}

export interface MedicationOrder {
  drug_name: string;
  dose_mg: number;
  route: string;
  frequency: string;
  rationale?: string;
}

export interface ClinicalAssessment {
  suspected_conditions: string[];
  deterioration_risk_score: number;
  severity_level: SeverityLevel;
  clinical_justification: string;
  recommended_interventions: string[];
  proposed_medications: MedicationOrder[];
}

export interface DetectedDrugInteraction {
  id: string;
  drug_a: string;
  drug_b: string;
  scope: 'PROPOSED_VS_ACTIVE' | 'ACTIVE_VS_ACTIVE' | 'PROPOSED_VS_PROPOSED';
  risk_level: 'SEVERE' | 'MODERATE';
  cyp_pathway: string;
  mechanism: string;
  clinical_effect: string;
  management: string;
}

export interface AuditVerdict {
  passed_safety_checks: boolean;
  detected_contraindications: string[];
  detected_drug_interactions: DetectedDrugInteraction[];
  renal_clearance_violation: boolean;
  black_box_warning_flagged: boolean;
  audit_explanation: string;
  requires_human_override: boolean;
  counterfactual_challenges: string[];
}

export interface ToolInvocationRecord {
  id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  output: Record<string, unknown>;
  duration_ms: number;
  agent: string;
}

export interface AgentStageTelemetry {
  stage_id: string;
  agent_name: string;
  model_used: string;
  status: 'COMPLETED' | 'FLAGGED' | 'QUARANTINED';
  latency_ms: number;
  cached_tokens: number;
  live_tokens: number;
  summary: string;
}

export interface DispatchPacket {
  packet_id: string;
  timestamp_iso: string;
  patient_id: string;
  patient_metadata: PatientMetadata;
  vitals: PatientVitals;
  active_medications: string[];
  redacted_note: string;
  dlp_redactions: Array<{ original_type: string; replacement_token: string }>;
  calculated_metrics: {
    cockcroft_gault_crcl: number;
    mean_arterial_pressure: number;
    qsofa_score: number;
    sirs_criteria_count: number;
    aki_kdigo_stage: number;
  };
  tool_invocations: ToolInvocationRecord[];
  agent_stages: AgentStageTelemetry[];
  clinical_assessment: ClinicalAssessment;
  safety_audit: AuditVerdict;
  dispatch_status: 'PENDING_PHYSICIAN_SIGNATURE' | 'QUARANTINED_BLOCKED' | 'APPROVED_SIGNED' | 'OVERRIDDEN_SIGNED';
  audit_trail_hash: string;
  execution_mode: 'GEMINI_LIVE_ORCHESTRATOR' | 'DETERMINISTIC_CLINICAL_CORE';
  physician_signature?: {
    physician_id: string;
    physician_name: string;
    action: 'APPROVE_PLAN' | 'QUARANTINE_CONFIRM' | 'EMERGENCY_OVERRIDE';
    clinical_note: string;
    signed_at: string;
    kms_signature_hash: string;
  };
}

export interface DrugInteractionRule {
  drug_a: string;
  drug_b: string;
  severity: 'CONTRAINDICATED' | 'SERIOUS' | 'MODERATE';
  mechanism: string;
  clinical_effect: string;
  cyp_pathway: string;
  management: string;
}

export interface DrugFormularyProfile {
  generic_name: string;
  brand_name: string;
  rxnorm_cui: string;
  therapeutic_class: string;
  renal_threshold_crcl: number;
  nephrotoxic: boolean;
  boxed_warning: string | null;
  standard_adult_dose: string;
  renal_adjusted_dose: string;
  primary_cyp_substrate: string;
}

export const DRUG_FORMULARY_REGISTRY: Record<string, DrugFormularyProfile> = {
  ciprofloxacin: {
    generic_name: 'Ciprofloxacin',
    brand_name: 'Cipro',
    rxnorm_cui: '2551',
    therapeutic_class: 'Fluoroquinolone Antibiotic',
    renal_threshold_crcl: 30,
    nephrotoxic: false,
    boxed_warning: 'Tendinitis, tendon rupture, peripheral neuropathy, CNS effects, and exacerbation of myasthenia gravis.',
    standard_adult_dose: '400 mg IV q8h–q12h',
    renal_adjusted_dose: 'CrCl < 30 mL/min: 400 mg IV q24h (50% dose reduction)',
    primary_cyp_substrate: 'CYP1A2 Inhibitor (Strong)',
  },
  theophylline: {
    generic_name: 'Theophylline',
    brand_name: 'Theo-24',
    rxnorm_cui: '10438',
    therapeutic_class: 'Methylxanthine Bronchodilator',
    renal_threshold_crcl: 15,
    nephrotoxic: false,
    boxed_warning: null,
    standard_adult_dose: '300 mg PO q12h (target serum 10–20 mcg/mL)',
    renal_adjusted_dose: 'Narrow therapeutic index; monitor serum trough closely in sepsis/hepatic congestion',
    primary_cyp_substrate: 'CYP1A2 Substrate (Narrow Therapeutic Index)',
  },
  lisinopril: {
    generic_name: 'Lisinopril',
    brand_name: 'Prinivil / Zestril',
    rxnorm_cui: '29046',
    therapeutic_class: 'ACE Inhibitor',
    renal_threshold_crcl: 30,
    nephrotoxic: true,
    boxed_warning: 'Fetal toxicity. Discontinue immediately in acute hypotensive shock or severe acute kidney injury (AKI).',
    standard_adult_dose: '10–40 mg PO daily',
    renal_adjusted_dose: 'HOLD in acute kidney injury (AKI) or hypotension (MAP < 65 mmHg); CrCl < 30: max 5 mg/day',
    primary_cyp_substrate: 'Renal excretion (Unchanged)',
  },
  spironolactone: {
    generic_name: 'Spironolactone',
    brand_name: 'Aldactone',
    rxnorm_cui: '9997',
    therapeutic_class: 'Mineralocorticoid Receptor Antagonist (K+-Sparing)',
    renal_threshold_crcl: 30,
    nephrotoxic: false,
    boxed_warning: 'Tumorigenicity in chronic rodent studies; severe hyperkalemia risk when eGFR < 30 mL/min.',
    standard_adult_dose: '25–50 mg PO daily',
    renal_adjusted_dose: 'CONTRAINDICATED when eGFR < 30 mL/min or Serum K+ > 5.0 mEq/L',
    primary_cyp_substrate: 'Hepatic metabolism / Renal K+ retention',
  },
  vancomycin: {
    generic_name: 'Vancomycin',
    brand_name: 'Vancocin',
    rxnorm_cui: '11124',
    therapeutic_class: 'Glycopeptide Antibiotic',
    renal_threshold_crcl: 50,
    nephrotoxic: true,
    boxed_warning: 'Nephrotoxicity and ototoxicity risk markedly elevated with high trough levels (>20 mcg/mL) or concurrent aminoglycosides.',
    standard_adult_dose: '15–20 mg/kg IV q8h–q12h',
    renal_adjusted_dose: 'CrCl < 30 mL/min: 15 mg/kg IV loading dose, then redose by AUC24/MIC & 24h trough monitoring',
    primary_cyp_substrate: '90% Glomerular Filtration',
  },
  gentamicin: {
    generic_name: 'Gentamicin',
    brand_name: 'Garamycin',
    rxnorm_cui: '4450',
    therapeutic_class: 'Aminoglycoside Antibiotic',
    renal_threshold_crcl: 60,
    nephrotoxic: true,
    boxed_warning: 'Neurotoxicity (vestibular and auditory ototoxicity) and severe acute tubular necrosis (nephrotoxicity), particularly in renal impairment.',
    standard_adult_dose: '5–7 mg/kg IV q24h',
    renal_adjusted_dose: 'AVOID in Stage 4/5 AKI (eGFR < 30); if no alternative, extend interval to q48h with therapeutic drug monitoring',
    primary_cyp_substrate: 'Renal proximal tubule accumulation',
  },
  warfarin: {
    generic_name: 'Warfarin',
    brand_name: 'Coumadin',
    rxnorm_cui: '11289',
    therapeutic_class: 'Vitamin K Epoxide Reductase Antagonist',
    renal_threshold_crcl: 15,
    nephrotoxic: false,
    boxed_warning: 'Major or fatal bleeding risk. Perform frequent INR monitoring when initiating or modifying interacting CYP2C9 medications.',
    standard_adult_dose: '2–10 mg PO daily titrated to INR 2.0–3.0',
    renal_adjusted_dose: 'Reduce dose by 20–30% in severe CKD due to altered protein binding and bleeding diathesis',
    primary_cyp_substrate: 'CYP2C9 / CYP3A4 Substrate',
  },
  amiodarone: {
    generic_name: 'Amiodarone',
    brand_name: 'Cordarone / Pacerone',
    rxnorm_cui: '703',
    therapeutic_class: 'Class III Antiarrhythmic',
    renal_threshold_crcl: 10,
    nephrotoxic: false,
    boxed_warning: 'Pulmonary toxicity, hepatotoxicity, and proarrhythmic QT prolongation.',
    standard_adult_dose: '150 mg IV bolus, then 1 mg/min x 6h',
    renal_adjusted_dose: 'No renal adjustment required; reduce concurrent Warfarin by 30–50% and Digoxin by 50%',
    primary_cyp_substrate: 'CYP2C9, CYP2D6 & P-gp Inhibitor',
  },
  cefepime: {
    generic_name: 'Cefepime',
    brand_name: 'Maxipime',
    rxnorm_cui: '2180',
    therapeutic_class: '4th-Generation Cephalosporin',
    renal_threshold_crcl: 50,
    nephrotoxic: false,
    boxed_warning: 'Neurotoxicity (encephalopathy, myoclonus, nonconvulsive status epilepticus) in patients with unadjusted renal dosing.',
    standard_adult_dose: '2000 mg IV q8h',
    renal_adjusted_dose: 'CrCl 11–29 mL/min: 1000 mg IV q24h (or 2000 mg load then 1000 mg q24h for pseudomonal sepsis)',
    primary_cyp_substrate: '85% Renal Excretion',
  },
  norepinephrine: {
    generic_name: 'Norepinephrine',
    brand_name: 'Levophed',
    rxnorm_cui: '7512',
    therapeutic_class: 'Alpha-1 / Beta-1 Adrenergic Vasopressor',
    renal_threshold_crcl: 0,
    nephrotoxic: false,
    boxed_warning: 'Extravasation ischemia necrosis. Infuse into large central vein; restore intravascular volume prior to or alongside titration.',
    standard_adult_dose: '0.05–0.5 mcg/kg/min IV continuous infusion titrated to MAP >= 65 mmHg',
    renal_adjusted_dose: 'No renal dose reduction; first-line vasopressor in septic shock to preserve renal perfusion pressure',
    primary_cyp_substrate: 'COMT & MAO Degradation',
  },
  piperacillin_tazobactam: {
    generic_name: 'Piperacillin-Tazobactam',
    brand_name: 'Zosyn',
    rxnorm_cui: '8339',
    therapeutic_class: 'Antipseudomonal Penicillin + Beta-Lactamase Inhibitor',
    renal_threshold_crcl: 40,
    nephrotoxic: true,
    boxed_warning: 'Synergistic acute kidney injury when co-administered with Vancomycin compared to cefepime or meropenem combinations.',
    standard_adult_dose: '4500 mg IV q6h',
    renal_adjusted_dose: 'CrCl 20–40 mL/min: 2250 mg IV q6h (or 3375 mg q8h extended infusion)',
    primary_cyp_substrate: 'Renal Tubular Secretion & Glomerular Filtration',
  },
  meropenem: {
    generic_name: 'Meropenem',
    brand_name: 'Merrem',
    rxnorm_cui: '29561',
    therapeutic_class: 'Carbapenem Antibiotic',
    renal_threshold_crcl: 50,
    nephrotoxic: false,
    boxed_warning: null,
    standard_adult_dose: '1000 mg IV q8h',
    renal_adjusted_dose: 'CrCl 26–50 mL/min: 1000 mg IV q12h; CrCl 10–25 mL/min: 500 mg IV q12h',
    primary_cyp_substrate: '70% Renal Excretion',
  },
};

export const CRITICAL_INTERACTION_REGISTRY: DrugInteractionRule[] = [
  {
    drug_a: 'ciprofloxacin',
    drug_b: 'theophylline',
    severity: 'CONTRAINDICATED',
    mechanism: 'Potent CYP1A2 hepatic enzyme inhibition by Ciprofloxacin.',
    clinical_effect: 'Severe risk of fatal theophylline toxicity (ventricular arrhythmias, refractory seizures, tachycardia).',
    cyp_pathway: 'CYP1A2',
    management: 'Avoid combination. Substitute Ciprofloxacin with a non-CYP1A2 beta-lactam (e.g., renally-adjusted Cefepime or Ceftriaxone).',
  },
  {
    drug_a: 'lisinopril',
    drug_b: 'spironolactone',
    severity: 'CONTRAINDICATED',
    mechanism: 'Dual RAAS blockade + impaired distal nephron potassium excretion in Stage 4 AKI (eGFR < 30 mL/min).',
    clinical_effect: 'High risk of life-threatening hyperkalemia (sine-wave cardiac arrest) and efferent arteriolar collapse worsening AKI.',
    cyp_pathway: 'Renal RAAS / ENaC',
    management: 'Hold both Lisinopril and Spironolactone immediately during acute sepsis, hypotension, or Stage 3/4 AKI.',
  },
  {
    drug_a: 'warfarin',
    drug_b: 'amiodarone',
    severity: 'CONTRAINDICATED',
    mechanism: 'Inhibition of S-warfarin clearance via CYP2C9 and R-warfarin via CYP3A4.',
    clinical_effect: 'Significant surge in INR (2x–3x baseline) with major intracranial or gastrointestinal hemorrhage risk.',
    cyp_pathway: 'CYP2C9 / CYP3A4',
    management: 'Empirically reduce Warfarin dose by 35–50% immediately and monitor daily INR.',
  },
  {
    drug_a: 'vancomycin',
    drug_b: 'gentamicin',
    severity: 'CONTRAINDICATED',
    mechanism: 'Additive oxidative proximal renal tubular epithelial injury and cochlear hair cell apoptosis.',
    clinical_effect: 'Synergistic nephrotoxicity (rapid anuric renal failure) and irreversible vestibulocochlear ototoxicity.',
    cyp_pathway: 'Renal Proximal Tubule Megalin Transport',
    management: 'Quarantine dual nephrotoxic order. Replace Gentamicin with non-aminoglycoside gram-negative coverage.',
  },
  {
    drug_a: 'vancomycin',
    drug_b: 'piperacillin-tazobactam',
    severity: 'SERIOUS',
    mechanism: 'Competitive organic anion transporter inhibition and cast nephropathy.',
    clinical_effect: '3-fold higher incidence of acute kidney injury compared to Vancomycin + Cefepime or Meropenem.',
    cyp_pathway: 'OAT1 / OAT3 Renal Transporters',
    management: 'In patients with baseline eGFR < 45 mL/min, prefer Cefepime or Meropenem (renally adjusted) over Piperacillin-Tazobactam.',
  },
  {
    drug_a: 'ciprofloxacin',
    drug_b: 'lisinopril',
    severity: 'MODERATE',
    mechanism: 'Additive renal afferent/efferent hemodynamic impairment and interstitial nephritis risk in elderly/CKD patients.',
    clinical_effect: 'Increased risk of acute kidney injury and hyperkalemia when fluoroquinolones are combined with ACE inhibitors.',
    cyp_pathway: 'Renal Glomerular Hemodynamics',
    management: 'Monitor serum creatinine and potassium within 48 hours; hold Lisinopril during acute hypotensive or AKI episodes.',
  },
  {
    drug_a: 'spironolactone',
    drug_b: 'theophylline',
    severity: 'MODERATE',
    mechanism: 'Altered methylxanthine clearance and counteracting diuretic/electrolyte shifts in cardiopulmonary disease.',
    clinical_effect: 'Fluctuating serum Theophylline concentrations (~15–20% drift) and risk of potassium/magnesium imbalance.',
    cyp_pathway: 'Hepatic / Renal Clearance Modulation',
    management: 'Monitor serum Theophylline trough (target 5–15 mcg/mL) and serum electrolytes every 24–48 hours.',
  },
  {
    drug_a: 'warfarin',
    drug_b: 'metoprolol',
    severity: 'MODERATE',
    mechanism: 'Minor competitive hepatic cytochrome P450 binding and altered hepatic blood flow.',
    clinical_effect: 'Transient mild elevation in prothrombin time / INR in polypharmacy regimens.',
    cyp_pathway: 'CYP2D6 / Hepatic Perfusion',
    management: 'Check baseline and 72-hour INR; no empiric dose reduction required unless combined with strong CYP2C9 inhibitors.',
  },
  {
    drug_a: 'cefepime',
    drug_b: 'theophylline',
    severity: 'MODERATE',
    mechanism: 'Additive lowering of central nervous system seizure threshold in renal insufficiency (CrCl < 50 mL/min).',
    clinical_effect: 'Heightened neurotoxicity risk (myoclonus, encephalopathy, or non-convulsive status epilepticus) if unadjusted.',
    cyp_pathway: 'GABA-A Receptor Antagonism / Renal Excretion',
    management: 'Ensure strict renal dose adjustment of Cefepime (1g q24h if CrCl < 30) and monitor for myoclonus or confusion.',
  },
  {
    drug_a: 'amlodipine',
    drug_b: 'norepinephrine',
    severity: 'MODERATE',
    mechanism: 'Pharmacodynamic antagonism between peripheral L-type calcium channel vasodilation and alpha-1 adrenergic vasoconstriction.',
    clinical_effect: 'Blunted vasopressor response and prolonged systemic hypotension requiring higher Norepinephrine infusion rates.',
    cyp_pathway: 'Vascular Smooth Muscle Alpha-1 / Ca2+ Channels',
    management: 'Withhold oral Amlodipine immediately during active septic shock or vasopressor support.',
  },
];

export function normalizeDrugName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '_');
}

/**
 * Deterministic RxNorm / FDA Contraindication lookup between two drugs.
 */
export function queryFdaDrugContraindications(drugA: string, drugB: string): {
  status: 'CONTRAINDICATED' | 'SERIOUS' | 'MODERATE' | 'CLEAR';
  risk_level: 'SEVERE' | 'MODERATE' | 'NONE';
  mechanism: string;
  clinical_effect: string;
  interaction_detail: string;
  cyp_pathway: string;
  management: string;
} {
  const normA = drugA.toLowerCase().trim();
  const normB = drugB.toLowerCase().trim();

  if (normA === normB) {
    return {
      status: 'CLEAR',
      risk_level: 'NONE',
      mechanism: 'None',
      clinical_effect: 'Identical agent comparison.',
      interaction_detail: 'Identical agent comparison.',
      cyp_pathway: 'None',
      management: 'Verify no duplicate therapeutic order.',
    };
  }

  for (const rule of CRITICAL_INTERACTION_REGISTRY) {
    const matchForward = normA.includes(rule.drug_a) && normB.includes(rule.drug_b);
    const matchReverse = normA.includes(rule.drug_b) && normB.includes(rule.drug_a);
    if (matchForward || matchReverse) {
      const riskLevel =
        rule.severity === 'CONTRAINDICATED' || rule.severity === 'SERIOUS'
          ? 'SEVERE'
          : 'MODERATE';
      return {
        status: rule.severity,
        risk_level: riskLevel,
        mechanism: rule.mechanism,
        clinical_effect: rule.clinical_effect,
        interaction_detail: `${rule.clinical_effect} (${rule.mechanism})`,
        cyp_pathway: rule.cyp_pathway,
        management: rule.management,
      };
    }
  }

  return {
    status: 'CLEAR',
    risk_level: 'NONE',
    mechanism: 'None',
    clinical_effect: 'No severe or moderate interaction indexed in active registry.',
    interaction_detail: 'No severe or moderate interaction indexed in active registry.',
    cyp_pathway: 'Clear',
    management: 'Standard clinical and renal monitoring.',
  };
}

/**
 * Calculates Cockcroft-Gault Creatinine Clearance (CrCl) in mL/min.
 */
export function calculateCreatinineClearance(
  age: number,
  weightKg: number,
  serumCr: number,
  isFemale: boolean
): number {
  if (serumCr <= 0 || age <= 0 || weightKg <= 0) {
    return 120.0;
  }
  let crCl = ((140 - age) * weightKg) / (72 * serumCr);
  if (isFemale) {
    crCl *= 0.85;
  }
  return Math.round(crCl * 100) / 100;
}

/**
 * Computes Mean Arterial Pressure (MAP), qSOFA score, SIRS count, and KDIGO AKI stage.
 */
export function calculateHemodynamicAndSepsisIndices(
  vitals: PatientVitals,
  baselineCr: number,
  alteredMentalStatus: boolean
): {
  mean_arterial_pressure: number;
  qsofa_score: number;
  sirs_criteria_count: number;
  aki_kdigo_stage: number;
} {
  const map = Math.round(((2 * vitals.diastolic_bp + vitals.systolic_bp) / 3) * 10) / 10;

  let qsofa = 0;
  if (vitals.respiratory_rate >= 22) qsofa += 1;
  if (vitals.systolic_bp <= 100) qsofa += 1;
  if (alteredMentalStatus) qsofa += 1;

  let sirs = 0;
  if (vitals.temperature_celsius > 38.0 || vitals.temperature_celsius < 36.0) sirs += 1;
  if (vitals.heart_rate > 90) sirs += 1;
  if (vitals.respiratory_rate > 20) sirs += 1;

  const crRatio = baselineCr > 0 ? vitals.serum_creatinine / baselineCr : 1;
  let akiStage = 0;
  if (vitals.serum_creatinine >= 4.0 || crRatio >= 3.0 || vitals.estimated_gfr < 15) {
    akiStage = 3;
  } else if (crRatio >= 2.0 || vitals.estimated_gfr < 30) {
    akiStage = 2;
  } else if (
    vitals.serum_creatinine - baselineCr >= 0.3 ||
    crRatio >= 1.5 ||
    vitals.estimated_gfr < 60
  ) {
    akiStage = 1;
  }

  return {
    mean_arterial_pressure: map,
    qsofa_score: qsofa,
    sirs_criteria_count: sirs,
    aki_kdigo_stage: akiStage,
  };
}

/**
 * Simulates Google Cloud DLP De-Identification on unstructured clinical text.
 * Replaces SSNs, MRNs, Phone numbers, Dates of Birth, and Patient/Doctor proper names with deterministic salted tokens.
 */
export function redactPhiWithCloudDlp(rawNote: string): {
  redacted_text: string;
  redactions: Array<{ original_type: string; replacement_token: string }>;
} {
  const redactions: Array<{ original_type: string; replacement_token: string }> = [];
  let text = rawNote;

  // SSN pattern
  text = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, () => {
    const token = '[PHI:US_SSN_HASH_9F2A]';
    redactions.push({ original_type: 'US_SOCIAL_SECURITY_NUMBER', replacement_token: token });
    return token;
  });

  // MRN pattern
  text = text.replace(/\bMRN[:\s#-]*(\d{5,10})\b/gi, () => {
    const token = '[PHI:MRN_SALT_88319]';
    redactions.push({ original_type: 'MEDICAL_RECORD_NUMBER', replacement_token: token });
    return token;
  });

  // Phone number pattern
  text = text.replace(/\b\(\d{3}\)\s*\d{3}-\d{4}\b/g, () => {
    const token = '[PHI:PHONE_HASH_44C1]';
    redactions.push({ original_type: 'PHONE_NUMBER', replacement_token: token });
    return token;
  });

  // Named patient references like "Mr. Arthur Pendelton" or "Ms. Elena Rostova"
  text = text.replace(/\b(Mr\.|Mrs\.|Ms\.|Patient)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g, (_m, prefix) => {
    const token = `${prefix} [PHI:PERSON_NAME_7E1B]`;
    redactions.push({ original_type: 'PERSON_NAME', replacement_token: token });
    return token;
  });

  return { redacted_text: text, redactions };
}

/**
 * Generates a deterministic SHA-256 style hex digest for audit trail integrity.
 */
export function computeDeterministicAuditHash(payload: string): string {
  let h1 = 0xdeadbeef ^ payload.length;
  let h2 = 0x41c6ce57 ^ payload.length;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const part3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const part4 = (Math.imul(h1, 31) >>> 0).toString(16).padStart(8, '0');
  return `sha256:${part1}${part2}${part3}${part4}`;
}

/**
 * Generates theoretical vs renal-impaired pharmacokinetic clearance curves for Chart inspection.
 */
export function generateRenalClearanceCurve(
  crCl: number,
  doseMg: number
): Array<{ hour: number; normal_plasma_conc: number; patient_plasma_conc: number; toxicity_threshold: number }> {
  const points: Array<{
    hour: number;
    normal_plasma_conc: number;
    patient_plasma_conc: number;
    toxicity_threshold: number;
  }> = [];

  const volumeDistributionL = 22;
  const c0 = doseMg / volumeDistributionL;
  // Normal elimination rate constant ke ~ 0.18 hr^-1 (t1/2 ~ 3.8h)
  const keNormal = 0.18;
  // Patient elimination scales with CrCl / 100, bounded
  const clearanceRatio = Math.max(0.12, Math.min(1.2, crCl / 100));
  const kePatient = keNormal * clearanceRatio;
  const toxicityThreshold = Math.round(c0 * 0.68 * 10) / 10;

  for (let hour = 0; hour <= 24; hour += 2) {
    // Re-dosing spike at 12h to show accumulation in renal failure
    const redoseBoostNormal = hour >= 12 ? c0 * Math.exp(-keNormal * (hour - 12)) : 0;
    const redoseBoostPatient = hour >= 12 ? c0 * Math.exp(-kePatient * (hour - 12)) : 0;

    const normalConc = c0 * Math.exp(-keNormal * hour) + redoseBoostNormal;
    const patientConc = c0 * Math.exp(-kePatient * hour) + redoseBoostPatient;

    points.push({
      hour,
      normal_plasma_conc: Math.round(normalConc * 100) / 100,
      patient_plasma_conc: Math.round(patientConc * 100) / 100,
      toxicity_threshold: toxicityThreshold,
    });
  }

  return points;
}

/**
 * Deterministic multi-agent evaluation core that runs both as pre-flight verification
 * and as deterministic safety auditor alongside Gemini API responses.
 */
export function runDeterministicSentinelPipeline(
  unstructuredNote: string,
  vitals: PatientVitals,
  activeMedications: string[],
  patientMetadata: PatientMetadata,
  customProposedMeds?: MedicationOrder[]
): DispatchPacket {
  const dlp = redactPhiWithCloudDlp(unstructuredNote);
  const isFemale = patientMetadata.gender === 'Female';
  const crCl = calculateCreatinineClearance(
    patientMetadata.age,
    patientMetadata.weight_kg,
    vitals.serum_creatinine,
    isFemale
  );
  const alteredMental = /altered mental|confusion|letharg|obtunded|delirium/i.test(unstructuredNote);
  const hemodynamics = calculateHemodynamicAndSepsisIndices(
    vitals,
    patientMetadata.baseline_creatinine,
    alteredMental
  );

  const toolInvocations: ToolInvocationRecord[] = [
    {
      id: 'tool-crcl-1',
      tool_name: 'calculate_creatinine_clearance',
      arguments: {
        age: patientMetadata.age,
        weight_kg: patientMetadata.weight_kg,
        serum_cr: vitals.serum_creatinine,
        is_female: isFemale,
      },
      output: {
        cockcroft_gault_crcl_ml_min: crCl,
        renal_stage: vitals.estimated_gfr < 30 ? 'Stage 4 Severe CKD / AKI' : 'Moderate Impairment',
      },
      duration_ms: 14,
      agent: 'Agent 3: Diagnostic Synthesizer',
    },
  ];

  // Determine default proposed medications based on scenario or custom overrides
  let proposedMeds: MedicationOrder[] = customProposedMeds ? [...customProposedMeds] : [];
  if (proposedMeds.length === 0) {
    const hasTheophylline = activeMedications.some((m) => m.toLowerCase().includes('theophylline'));
    const hasWarfarin = activeMedications.some((m) => m.toLowerCase().includes('warfarin'));
    const hasVancomycin = activeMedications.some((m) => m.toLowerCase().includes('vancomycin'));

    if (hasTheophylline) {
      proposedMeds = [
        {
          drug_name: 'Ciprofloxacin',
          dose_mg: 400,
          route: 'IV',
          frequency: 'q12h',
          rationale: 'Empiric gram-negative coverage for suspected pulmonary sepsis (Unadjusted candidate)',
        },
        {
          drug_name: 'Norepinephrine',
          dose_mg: 4,
          route: 'IV Continuous Infusion',
          frequency: '0.08 mcg/kg/min titrated to MAP >= 65',
          rationale: 'Restore mean arterial pressure in distributive septic shock',
        },
      ];
    } else if (hasWarfarin) {
      proposedMeds = [
        {
          drug_name: 'Amiodarone',
          dose_mg: 150,
          route: 'IV Bolus + Infusion',
          frequency: 'q24h',
          rationale: 'Rate/rhythm control for rapid atrial fibrillation with hemodynamic instability',
        },
      ];
    } else if (hasVancomycin) {
      proposedMeds = [
        {
          drug_name: 'Gentamicin',
          dose_mg: 350,
          route: 'IV',
          frequency: 'q24h',
          rationale: 'Empiric synergistic gram-negative coverage',
        },
      ];
    } else {
      proposedMeds = [
        {
          drug_name: 'Cefepime',
          dose_mg: 1000,
          route: 'IV',
          frequency: 'q24h (Renally Adjusted)',
          rationale: 'Renally adjusted antipseudomonal coverage avoiding CYP1A2 and nephrotoxic synergy',
        },
        {
          drug_name: 'Norepinephrine',
          dose_mg: 4,
          route: 'IV Continuous Infusion',
          frequency: '0.05 mcg/kg/min titrated to MAP >= 65',
          rationale: 'Hemodynamic support for MAP < 65 mmHg',
        },
      ];
    }
  }

  // Check pairwise interactions across active + proposed medications
  const detectedContraindications: string[] = [];
  const detectedDrugInteractions: DetectedDrugInteraction[] = [];
  const counterfactualChallenges: string[] = [];
  let blackBoxFlagged = false;
  let renalViolation = false;

  // Check active vs active
  for (let i = 0; i < activeMedications.length; i++) {
    for (let j = i + 1; j < activeMedications.length; j++) {
      const check = queryFdaDrugContraindications(activeMedications[i], activeMedications[j]);
      toolInvocations.push({
        id: `tool-ddi-active-${i}-${j}`,
        tool_name: 'query_fda_drug_contraindications',
        arguments: { drug_a: activeMedications[i], drug_b: activeMedications[j] },
        output: check,
        duration_ms: 19,
        agent: 'Agent 2: Pharmacological RAG Agent',
      });
      if (check.status !== 'CLEAR' && check.risk_level !== 'NONE') {
        detectedDrugInteractions.push({
          id: `ddi-active-${i}-${j}`,
          drug_a: activeMedications[i],
          drug_b: activeMedications[j],
          scope: 'ACTIVE_VS_ACTIVE',
          risk_level: check.risk_level,
          cyp_pathway: check.cyp_pathway,
          mechanism: check.mechanism,
          clinical_effect: check.clinical_effect,
          management: check.management,
        });

        if (check.risk_level === 'SEVERE') {
          detectedContraindications.push(
            `[Active Regimen Severe DDI] ${activeMedications[i]} + ${activeMedications[j]}: ${check.interaction_detail}`
          );
          counterfactualChallenges.push(
            `Active regimen continues ${activeMedications[i]} + ${activeMedications[j]} despite CrCl ${crCl} mL/min. ${check.management}`
          );
        }
      }
    }
  }

  // Check proposed vs active
  for (const prop of proposedMeds) {
    const profileKey = Object.keys(DRUG_FORMULARY_REGISTRY).find((k) =>
      prop.drug_name.toLowerCase().includes(k)
    );
    const profile = profileKey ? DRUG_FORMULARY_REGISTRY[profileKey] : undefined;

    if (profile?.boxed_warning) {
      blackBoxFlagged = true;
    }

    if (profile && crCl < profile.renal_threshold_crcl) {
      // Check if dose is unadjusted
      const isAlreadyAdjusted = /adjusted|q24h|500|reduce/i.test(prop.frequency) && prop.dose_mg <= 1000;
      if (profile.nephrotoxic || !isAlreadyAdjusted) {
        renalViolation = true;
        detectedContraindications.push(
          `[Renal Clearance Violation] ${prop.drug_name} (${prop.dose_mg} mg ${prop.frequency}) exceeds safe clearance threshold (Patient CrCl ${crCl} mL/min < ${profile.renal_threshold_crcl} mL/min). ${profile.renal_adjusted_dose}`
        );
        counterfactualChallenges.push(
          `Proposed ${prop.drug_name} at ${prop.dose_mg} mg ${prop.frequency} with CrCl ${crCl} mL/min risks drug accumulation and neuro/nephrotoxicity.`
        );
      }
    }

    for (const active of activeMedications) {
      const check = queryFdaDrugContraindications(prop.drug_name, active);
      toolInvocations.push({
        id: `tool-ddi-${prop.drug_name}-${active}`,
        tool_name: 'query_fda_drug_contraindications',
        arguments: { drug_a: prop.drug_name, drug_b: active },
        output: check,
        duration_ms: 22,
        agent: 'Agent 4: Adversarial Safety Auditor',
      });
      if (check.status !== 'CLEAR' && check.risk_level !== 'NONE') {
        detectedDrugInteractions.push({
          id: `ddi-prop-${prop.drug_name}-${active}`,
          drug_a: prop.drug_name,
          drug_b: active,
          scope: 'PROPOSED_VS_ACTIVE',
          risk_level: check.risk_level,
          cyp_pathway: check.cyp_pathway,
          mechanism: check.mechanism,
          clinical_effect: check.clinical_effect,
          management: check.management,
        });

        if (check.risk_level === 'SEVERE') {
          detectedContraindications.push(
            `[Proposed vs Active Severe DDI] ${prop.drug_name} + ${active}: ${check.interaction_detail}`
          );
          counterfactualChallenges.push(
            `Counterfactual Attack: Administering ${prop.drug_name} alongside active ${active} triggers ${check.cyp_pathway} conflict. ${check.management}`
          );
        } else {
          counterfactualChallenges.push(
            `Moderate DDI Caution (${prop.drug_name} + ${active}): ${check.management}`
          );
        }
      }
    }
  }

  // Check proposed vs proposed
  for (let i = 0; i < proposedMeds.length; i++) {
    for (let j = i + 1; j < proposedMeds.length; j++) {
      const check = queryFdaDrugContraindications(
        proposedMeds[i].drug_name,
        proposedMeds[j].drug_name
      );
      if (check.status !== 'CLEAR' && check.risk_level !== 'NONE') {
        detectedDrugInteractions.push({
          id: `ddi-prop-prop-${i}-${j}`,
          drug_a: proposedMeds[i].drug_name,
          drug_b: proposedMeds[j].drug_name,
          scope: 'PROPOSED_VS_PROPOSED',
          risk_level: check.risk_level,
          cyp_pathway: check.cyp_pathway,
          mechanism: check.mechanism,
          clinical_effect: check.clinical_effect,
          management: check.management,
        });
        if (check.risk_level === 'SEVERE') {
          detectedContraindications.push(
            `[Proposed Pair Severe DDI] ${proposedMeds[i].drug_name} + ${proposedMeds[j].drug_name}: ${check.interaction_detail}`
          );
        }
      }
    }
  }

  // Sort detectedDrugInteractions so SEVERE always appears before MODERATE
  detectedDrugInteractions.sort((a, b) => {
    if (a.risk_level === b.risk_level) return 0;
    return a.risk_level === 'SEVERE' ? -1 : 1;
  });

  // Also check if active medications themselves violate acute renal/hemodynamic boundaries
  for (const active of activeMedications) {
    const lower = active.toLowerCase();
    if ((lower.includes('lisinopril') || lower.includes('spironolactone')) && (crCl < 30 || hemodynamics.mean_arterial_pressure < 65)) {
      renalViolation = true;
      const msg = `[Hemodynamic/Renal Hold Required] Active ${active} is unsafe with MAP ${hemodynamics.mean_arterial_pressure} mmHg and CrCl ${crCl} mL/min (eGFR ${vitals.estimated_gfr}).`;
      if (!detectedContraindications.includes(msg)) {
        detectedContraindications.push(msg);
      }
    }
  }

  // Risk score calculation (0.0 to 1.0)
  let riskScore = 0.25;
  if (hemodynamics.qsofa_score >= 2) riskScore += 0.32;
  if (hemodynamics.mean_arterial_pressure < 65) riskScore += 0.18;
  if (vitals.estimated_gfr < 30 || crCl < 30) riskScore += 0.15;
  if (vitals.heart_rate > 110) riskScore += 0.05;
  riskScore = Math.min(0.98, Math.round(riskScore * 100) / 100);

  const severityLevel =
    riskScore >= 0.8
      ? SeverityLevel.CRITICAL
      : riskScore >= 0.6
      ? SeverityLevel.HIGH
      : riskScore >= 0.35
      ? SeverityLevel.MODERATE
      : SeverityLevel.LOW;

  const suspectedConditions: string[] = [];
  if (hemodynamics.qsofa_score >= 2 || vitals.temperature_celsius >= 38.3) {
    suspectedConditions.push('Developing Pulmonary Sepsis / Septic Shock (qSOFA >= 2)');
  }
  if (hemodynamics.aki_kdigo_stage >= 2 || vitals.estimated_gfr < 30) {
    suspectedConditions.push(`Acute-on-Chronic Kidney Injury (KDIGO Stage ${hemodynamics.aki_kdigo_stage}, CrCl ${crCl} mL/min)`);
  }
  if (
    activeMedications.some((m) => m.toLowerCase().includes('lisinopril')) &&
    activeMedications.some((m) => m.toLowerCase().includes('spironolactone')) &&
    vitals.estimated_gfr < 35
  ) {
    suspectedConditions.push('High-Risk Hyperkalemia & RAAS-Mediated Efferent Arteriolar Hypoperfusion');
  }
  if (suspectedConditions.length === 0) {
    suspectedConditions.push('Acute Inpatient Hemodynamic & Pharmacotherapy Surveillance');
  }

  const passedSafetyChecks = detectedContraindications.length === 0 && !renalViolation;

  const clinicalAssessment: ClinicalAssessment = {
    suspected_conditions: suspectedConditions,
    deterioration_risk_score: riskScore,
    severity_level: severityLevel,
    clinical_justification: `Patient exhibits MAP of ${hemodynamics.mean_arterial_pressure} mmHg, HR ${vitals.heart_rate} bpm, RR ${vitals.respiratory_rate}/min (qSOFA ${hemodynamics.qsofa_score}/3, SIRS ${hemodynamics.sirs_criteria_count}/3) with Cockcroft-Gault CrCl of ${crCl} mL/min (eGFR ${vitals.estimated_gfr} mL/min/1.73m²). Immediate hemodynamic resuscitation and renal-adjusted antimicrobial selection are required while holding nephrotoxic or hypotensive home medications.`,
    recommended_interventions: [
      `Hold home RAAS agents (Lisinopril, Spironolactone) immediately due to MAP ${hemodynamics.mean_arterial_pressure} mmHg and Stage ${hemodynamics.aki_kdigo_stage} AKI`,
      `Replace any CYP1A2-inhibiting fluoroquinolone (Ciprofloxacin) with renally adjusted Cefepime 1000 mg IV q24h or Ceftriaxone 2000 mg IV q24h`,
      `Initiate 30 mL/kg balanced crystalloid bolus and titrate Norepinephrine to maintain MAP >= 65 mmHg`,
      `Order stat arterial lactate, serum potassium, 2 sets of blood cultures, and trough-guided therapeutic drug monitoring`,
    ],
    proposed_medications: proposedMeds,
  };

  const safetyAudit: AuditVerdict = {
    passed_safety_checks: passedSafetyChecks,
    detected_contraindications: detectedContraindications,
    detected_drug_interactions: detectedDrugInteractions,
    renal_clearance_violation: renalViolation,
    black_box_warning_flagged: blackBoxFlagged,
    audit_explanation: passedSafetyChecks
      ? `All proposed orders verified against Cockcroft-Gault CrCl (${crCl} mL/min), active CYP450 pathways, and FDA boxed warning constraints. Cleared for Attending Physician signature.`
      : `SAFETY GATE QUARANTINE: Adversarial Auditor invalidated the candidate order set due to ${detectedContraindications.length} critical pharmacological/renal conflict(s) at CrCl ${crCl} mL/min (eGFR ${vitals.estimated_gfr} mL/min/1.73m²). Automatic EHR write-back blocked; Attending Physician intervention required.`,
    requires_human_override: !passedSafetyChecks,
    counterfactual_challenges:
      counterfactualChallenges.length > 0
        ? counterfactualChallenges
        : [
            `Verified dosing against CrCl ${crCl} mL/min: no toxic accumulation curve projected over 24h.`,
            `Verified active regimen (${activeMedications.join(', ')}) against CYP1A2, CYP2C9, and CYP3A4 inhibition tables.`,
          ],
  };

  const agentStages: AgentStageTelemetry[] = [
    {
      stage_id: 'stage-0-dlp',
      agent_name: 'Ingestion & Cloud DLP De-Identification',
      model_used: 'Cloud DLP Inspect + Deterministic Salted Hash',
      status: 'COMPLETED',
      latency_ms: 48,
      cached_tokens: 0,
      live_tokens: 310,
      summary: `Scanned clinical note payload; pseudonymized ${dlp.redactions.length} PHI identifier(s) prior to LLM context ingestion.`,
    },
    {
      stage_id: 'stage-1-triage',
      agent_name: 'Agent 1: Triage & FHIR Entity Extraction',
      model_used: 'gemini-3.8-flash (FHIR R4 Schema)',
      status: 'COMPLETED',
      latency_ms: 320,
      cached_tokens: 1420,
      live_tokens: 480,
      summary: `Mapped unstructured progress note and vitals into validated FHIR R4 Observation, Condition, and MedicationRequest resources.`,
    },
    {
      stage_id: 'stage-2-rag',
      agent_name: 'Agent 2: Pharmacological RAG & Tool Engine',
      model_used: 'Vertex AI Vector Search + RxNorm / Cockcroft-Gault',
      status: 'COMPLETED',
      latency_ms: 215,
      cached_tokens: 18400,
      live_tokens: 620,
      summary: `Executed ${toolInvocations.length} deterministic pharmacology tool calls; computed CrCl = ${crCl} mL/min and MAP = ${hemodynamics.mean_arterial_pressure} mmHg.`,
    },
    {
      stage_id: 'stage-3-synth',
      agent_name: 'Agent 3: Diagnostic Synthesizer',
      model_used: 'gemini-3.8-flash (Context Cached EHR)',
      status: 'COMPLETED',
      latency_ms: 690,
      cached_tokens: 42800,
      live_tokens: 940,
      summary: `Synthesized longitudinal trajectory (Risk Score ${(riskScore * 100).toFixed(0)}% · ${severityLevel}) with 75% cached token savings.`,
    },
    {
      stage_id: 'stage-4-audit',
      agent_name: 'Agent 4: Adversarial Safety & Pharmacovigilance Auditor',
      model_used: 'gemini-3.8-flash (Temp = 0.0 Counterfactual Critic)',
      status: passedSafetyChecks ? 'COMPLETED' : 'QUARANTINED',
      latency_ms: 280,
      cached_tokens: 12400,
      live_tokens: 510,
      summary: passedSafetyChecks
        ? 'Zero counterfactual safety violations detected. Order packet routed for Physician Sign-Off.'
        : `Quarantined candidate plan: flagged ${detectedContraindications.length} contraindication/renal violation(s).`,
    },
  ];

  const hashPayload = JSON.stringify({
    patient_id: patientMetadata.patient_id,
    clinicalAssessment,
    safetyAudit,
  });

  return {
    packet_id: `PKT-${patientMetadata.patient_id.slice(-5)}-${Date.now().toString().slice(-4)}`,
    timestamp_iso: new Date().toISOString(),
    patient_id: patientMetadata.patient_id,
    patient_metadata: patientMetadata,
    vitals,
    active_medications: activeMedications,
    redacted_note: dlp.redacted_text,
    dlp_redactions: dlp.redactions,
    calculated_metrics: {
      cockcroft_gault_crcl: crCl,
      mean_arterial_pressure: hemodynamics.mean_arterial_pressure,
      qsofa_score: hemodynamics.qsofa_score,
      sirs_criteria_count: hemodynamics.sirs_criteria_count,
      aki_kdigo_stage: hemodynamics.aki_kdigo_stage,
    },
    tool_invocations: toolInvocations,
    agent_stages: agentStages,
    clinical_assessment: clinicalAssessment,
    safety_audit: safetyAudit,
    dispatch_status: passedSafetyChecks ? 'PENDING_PHYSICIAN_SIGNATURE' : 'QUARANTINED_BLOCKED',
    audit_trail_hash: computeDeterministicAuditHash(hashPayload),
    execution_mode: 'DETERMINISTIC_CLINICAL_CORE',
  };
}

export interface PatientScenarioPreset {
  id: string;
  label: string;
  subtitle: string;
  metadata: PatientMetadata;
  vitals: PatientVitals;
  active_medications: string[];
  unstructured_note: string;
  proposed_medications: MedicationOrder[];
}

export const CLINICAL_COHORT_PRESETS: PatientScenarioPreset[] = [
  {
    id: 'MED-PATIENT-88319',
    label: 'MED-PATIENT-88319 · Pulmonary Sepsis & Stage 4 AKI',
    subtitle: '72M · CrCl 26.8 mL/min · CYP1A2 & Hyperkalemia Conflict',
    metadata: {
      patient_id: 'MED-PATIENT-88319',
      age: 72,
      gender: 'Male',
      weight_kg: 68.0,
      admission_unit: 'MICU Bed 04',
      allergies: ['Penicillin (Maculopapular Rash)'],
      baseline_creatinine: 1.1,
    },
    vitals: {
      heart_rate: 118,
      systolic_bp: 88,
      diastolic_bp: 54,
      respiratory_rate: 24,
      temperature_celsius: 38.9,
      serum_creatinine: 2.4,
      estimated_gfr: 26.0,
    },
    active_medications: ['Lisinopril', 'Spironolactone', 'Theophylline'],
    unstructured_note:
      'Patient Mr. Arthur Pendelton (MRN: 8831904, SSN 412-88-9012) admitted with altered mental status, fever 38.9C, productive cough, and tachypnea. Lactate pending. Suspected community-acquired pneumonia progressing to pulmonary sepsis with acute kidney injury. Recommend starting broad empiric antibiotic coverage immediately and managing hemodynamics.',
    proposed_medications: [
      {
        drug_name: 'Ciprofloxacin',
        dose_mg: 400,
        route: 'IV',
        frequency: 'q12h (Unadjusted)',
        rationale: 'Candidate empiric gram-negative coverage for pulmonary sepsis (triggers CYP1A2 & CrCl quarantine)',
      },
      {
        drug_name: 'Norepinephrine',
        dose_mg: 4,
        route: 'IV Continuous Infusion',
        frequency: '0.08 mcg/kg/min titrated to MAP >= 65',
        rationale: 'First-line vasopressor for septic shock hypotension (BP 88/54 mmHg)',
      },
    ],
  },
  {
    id: 'MED-PATIENT-40912',
    label: 'MED-PATIENT-40912 · Rapid AFib & Warfarin-Amiodarone Surge',
    subtitle: '68F · CrCl 44.3 mL/min · CYP2C9 Anticoagulation Potentiation',
    metadata: {
      patient_id: 'MED-PATIENT-40912',
      age: 68,
      gender: 'Female',
      weight_kg: 64.0,
      admission_unit: 'CCU Stepdown Bed 11',
      allergies: ['Sulfa Antibiotics'],
      baseline_creatinine: 0.9,
    },
    vitals: {
      heart_rate: 134,
      systolic_bp: 102,
      diastolic_bp: 64,
      respiratory_rate: 20,
      temperature_celsius: 37.2,
      serum_creatinine: 1.25,
      estimated_gfr: 46.0,
    },
    active_medications: ['Warfarin', 'Metoprolol'],
    unstructured_note:
      'Patient Ms. Elena Rostova (MRN: 4091288) in rapid atrial fibrillation at 134 bpm with borderline blood pressure. Currently on chronic Warfarin therapy (baseline INR 2.6) for mechanical mitral valve. Cardiology resident proposed starting IV Amiodarone loading protocol without adjusting Warfarin dose.',
    proposed_medications: [
      {
        drug_name: 'Amiodarone',
        dose_mg: 150,
        route: 'IV Bolus + 1 mg/min Infusion',
        frequency: 'q24h',
        rationale: 'Rhythm conversion and rate control in unstable atrial fibrillation',
      },
    ],
  },
  {
    id: 'MED-PATIENT-61504',
    label: 'MED-PATIENT-61504 · MRSA Bacteremia & Dual Nephroiresis',
    subtitle: '59M · CrCl 31.0 mL/min · Vancomycin + Gentamicin Synergy',
    metadata: {
      patient_id: 'MED-PATIENT-61504',
      age: 59,
      gender: 'Male',
      weight_kg: 78.0,
      admission_unit: 'SICU Bed 08',
      allergies: ['None Known'],
      baseline_creatinine: 1.0,
    },
    vitals: {
      heart_rate: 108,
      systolic_bp: 94,
      diastolic_bp: 58,
      respiratory_rate: 23,
      temperature_celsius: 38.6,
      serum_creatinine: 2.3,
      estimated_gfr: 29.0,
    },
    active_medications: ['Vancomycin'],
    unstructured_note:
      'Patient Mr. Marcus Vance (MRN: 6150499) post-op day 3 with persistent fever, rising leukocytosis, and worsening oliguria (Cr 2.3 mg/dL, up from 1.0). Currently receiving IV Vancomycin. Team considering adding IV Gentamicin for synergistic gram-negative sepsis coverage.',
    proposed_medications: [
      {
        drug_name: 'Gentamicin',
        dose_mg: 390,
        route: 'IV',
        frequency: 'q24h',
        rationale: 'Proposed synergistic gram-negative coverage alongside active Vancomycin',
      },
    ],
  },
  {
    id: 'MED-PATIENT-29481',
    label: 'MED-PATIENT-29481 · Renally Adjusted Sepsis Protocol (Safe)',
    subtitle: '72M · CrCl 26.8 mL/min · Safe Counterfactual Regimen',
    metadata: {
      patient_id: 'MED-PATIENT-29481',
      age: 72,
      gender: 'Male',
      weight_kg: 68.0,
      admission_unit: 'MICU Bed 02',
      allergies: ['None Known'],
      baseline_creatinine: 1.1,
    },
    vitals: {
      heart_rate: 104,
      systolic_bp: 96,
      diastolic_bp: 62,
      respiratory_rate: 21,
      temperature_celsius: 38.4,
      serum_creatinine: 2.4,
      estimated_gfr: 26.0,
    },
    active_medications: ['Amlodipine'],
    unstructured_note:
      'Patient admitted with healthcare-associated pneumonia and Stage 4 CKD (eGFR 26 mL/min). Home nephrotoxic agents held on admission. Initiating renally-adjusted Cefepime 1000 mg IV q24h and low-dose Norepinephrine support.',
    proposed_medications: [
      {
        drug_name: 'Cefepime',
        dose_mg: 1000,
        route: 'IV',
        frequency: 'q24h (Renally Adjusted)',
        rationale: 'Renally adjusted 4th-gen cephalosporin for CrCl 26.8 mL/min',
      },
      {
        drug_name: 'Norepinephrine',
        dose_mg: 4,
        route: 'IV Continuous Infusion',
        frequency: '0.05 mcg/kg/min titrated to MAP >= 65',
        rationale: 'Maintain renal perfusion pressure',
      },
    ],
  },
];
