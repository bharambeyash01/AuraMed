import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCreatinineClearance,
  queryFdaDrugContraindications,
  calculateHemodynamicAndSepsisIndices,
  redactPhiWithCloudDlp,
  runDeterministicSentinelPipeline,
  CLINICAL_COHORT_PRESETS,
} from './clinicalEngine';

test('Cockcroft-Gault creatinine clearance matches clinical formula for male and female patients', () => {
  // Male: ((140 - 72) * 68) / (72 * 2.4) = 4624 / 172.8 = 26.76
  const maleCrCl = calculateCreatinineClearance(72, 68.0, 2.4, false);
  assert.equal(maleCrCl, 26.76);

  // Female: 26.76 * 0.85 = 22.75
  const femaleCrCl = calculateCreatinineClearance(72, 68.0, 2.4, true);
  assert.equal(femaleCrCl, 22.75);
});

test('FDA drug contraindication engine differentiates SEVERE vs MODERATE vs CLEAR drug-drug interactions', () => {
  const ciproTheo = queryFdaDrugContraindications('Ciprofloxacin', 'Theophylline');
  assert.equal(ciproTheo.status, 'CONTRAINDICATED');
  assert.equal(ciproTheo.risk_level, 'SEVERE');
  assert.ok(ciproTheo.interaction_detail.includes('CYP1A2'));

  const lisiSpiro = queryFdaDrugContraindications('spironolactone', 'lisinopril');
  assert.equal(lisiSpiro.status, 'CONTRAINDICATED');
  assert.equal(lisiSpiro.risk_level, 'SEVERE');
  assert.ok(lisiSpiro.interaction_detail.includes('hyperkalemia'));

  const ciproLisi = queryFdaDrugContraindications('Ciprofloxacin', 'Lisinopril');
  assert.equal(ciproLisi.status, 'MODERATE');
  assert.equal(ciproLisi.risk_level, 'MODERATE');

  const warfarinMetoprolol = queryFdaDrugContraindications('Warfarin', 'Metoprolol');
  assert.equal(warfarinMetoprolol.status, 'MODERATE');
  assert.equal(warfarinMetoprolol.risk_level, 'MODERATE');

  const safePair = queryFdaDrugContraindications('Cefepime', 'Norepinephrine');
  assert.equal(safePair.status, 'CLEAR');
  assert.equal(safePair.risk_level, 'NONE');
});

test('Hemodynamic & sepsis index calculator computes MAP, qSOFA, SIRS, and KDIGO AKI stage', () => {
  const vitals = {
    heart_rate: 118,
    systolic_bp: 88,
    diastolic_bp: 54,
    respiratory_rate: 24,
    temperature_celsius: 38.9,
    serum_creatinine: 2.4,
    estimated_gfr: 26.0,
  };
  const indices = calculateHemodynamicAndSepsisIndices(vitals, 1.1, true);
  assert.equal(indices.mean_arterial_pressure, 65.3);
  assert.equal(indices.qsofa_score, 3);
  assert.equal(indices.sirs_criteria_count, 3);
  assert.equal(indices.aki_kdigo_stage, 2);
});

test('Cloud DLP redaction strips SSN, MRN, and Patient Proper Names deterministically', () => {
  const raw = 'Patient Mr. Arthur Pendelton (MRN: 8831904, SSN 412-88-9012) admitted with fever.';
  const result = redactPhiWithCloudDlp(raw);
  assert.ok(!result.redacted_text.includes('412-88-9012'));
  assert.ok(!result.redacted_text.includes('8831904'));
  assert.ok(!result.redacted_text.includes('Arthur Pendelton'));
  assert.equal(result.redactions.length, 3);
});

test('End-to-end Sentinel pipeline populates both SEVERE and MODERATE drug-drug interactions and clears severe blocks on safe regimen', () => {
  const unsafePreset = CLINICAL_COHORT_PRESETS[0];
  const unsafePacket = runDeterministicSentinelPipeline(
    unsafePreset.unstructured_note,
    unsafePreset.vitals,
    unsafePreset.active_medications,
    unsafePreset.metadata,
    unsafePreset.proposed_medications
  );
  assert.equal(unsafePacket.safety_audit.passed_safety_checks, false);
  assert.equal(unsafePacket.dispatch_status, 'QUARANTINED_BLOCKED');

  const severeDdis = unsafePacket.safety_audit.detected_drug_interactions.filter(
    (d) => d.risk_level === 'SEVERE'
  );
  const moderateDdis = unsafePacket.safety_audit.detected_drug_interactions.filter(
    (d) => d.risk_level === 'MODERATE'
  );
  assert.equal(severeDdis.length, 2); // Ciprofloxacin+Theophylline and Lisinopril+Spironolactone
  assert.equal(moderateDdis.length, 2); // Ciprofloxacin+Lisinopril and Spironolactone+Theophylline

  const safePreset = CLINICAL_COHORT_PRESETS[3];
  const safePacket = runDeterministicSentinelPipeline(
    safePreset.unstructured_note,
    safePreset.vitals,
    safePreset.active_medications,
    safePreset.metadata,
    safePreset.proposed_medications
  );
  assert.equal(safePacket.safety_audit.passed_safety_checks, true);
  assert.equal(safePacket.dispatch_status, 'PENDING_PHYSICIAN_SIGNATURE');
  assert.equal(
    safePacket.safety_audit.detected_drug_interactions.filter((d) => d.risk_level === 'SEVERE').length,
    0
  );
  assert.equal(
    safePacket.safety_audit.detected_drug_interactions.filter((d) => d.risk_level === 'MODERATE').length,
    1 // Amlodipine + Norepinephrine moderate caution
  );
});
