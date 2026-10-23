import React, { useState, useEffect } from 'react';
import { DispatchPacket, DetectedDrugInteraction } from '../utils/clinicalEngine';

interface ClinicalWorkbenchViewProps {
  packet: DispatchPacket;
  onApplySafeCounterfactual: () => void;
  onInspectDrugInRegistry: (drugName: string) => void;
  onSignDispatchPacket: (signature: {
    physician_id: string;
    physician_name: string;
    action: 'APPROVE_PLAN' | 'QUARANTINE_CONFIRM' | 'EMERGENCY_OVERRIDE';
    clinical_note: string;
  }) => void;
}

export const ClinicalWorkbenchView: React.FC<ClinicalWorkbenchViewProps> = ({
  packet,
  onApplySafeCounterfactual,
  onInspectDrugInRegistry,
  onSignDispatchPacket,
}) => {
  const [selectedStageIndex, setSelectedStageIndex] = useState<number>(4);
  const [ddiRiskFilter, setDdiRiskFilter] = useState<'ALL' | 'SEVERE' | 'MODERATE'>('ALL');
  const [physicianName, setPhysicianName] = useState('Dr. Helena Vance, MD (Attending Intensivist)');
  const [physicianId, setPhysicianId] = useState('NPI-99482014');
  const [signAction, setSignAction] = useState<
    'APPROVE_PLAN' | 'QUARANTINE_CONFIRM' | 'EMERGENCY_OVERRIDE'
  >(packet.safety_audit.passed_safety_checks ? 'APPROVE_PLAN' : 'QUARANTINE_CONFIRM');
  const [clinicalSignNote, setClinicalSignNote] = useState(
    packet.safety_audit.passed_safety_checks
      ? 'Reviewed Cockcroft-Gault CrCl and CYP450 interaction matrix. Approve renally-adjusted sepsis order set.'
      : 'Confirm quarantine of contraindicated Ciprofloxacin/RAAS regimen. Hold Lisinopril & Spironolactone and substitute renally-adjusted Cefepime.'
  );
  const [signValidationError, setSignValidationError] = useState('');

  useEffect(() => {
    setSignAction(packet.safety_audit.passed_safety_checks ? 'APPROVE_PLAN' : 'QUARANTINE_CONFIRM');
    setClinicalSignNote(
      packet.safety_audit.passed_safety_checks
        ? 'Reviewed Cockcroft-Gault CrCl and CYP450 interaction matrix. Approve renally-adjusted sepsis order set.'
        : 'Confirm quarantine of contraindicated Ciprofloxacin/RAAS regimen. Hold Lisinopril & Spironolactone and substitute renally-adjusted Cefepime.'
    );
  }, [packet.packet_id, packet.safety_audit.passed_safety_checks]);

  const { calculated_metrics, clinical_assessment, safety_audit, agent_stages, tool_invocations } =
    packet;

  const allInteractions: DetectedDrugInteraction[] = safety_audit.detected_drug_interactions || [];
  const severeInteractions = allInteractions.filter((d) => d.risk_level === 'SEVERE');
  const moderateInteractions = allInteractions.filter((d) => d.risk_level === 'MODERATE');
  const filteredInteractions =
    ddiRiskFilter === 'ALL'
      ? allInteractions
      : allInteractions.filter((d) => d.risk_level === ddiRiskFilter);

  const crClStatus =
    calculated_metrics.cockcroft_gault_crcl < 30
      ? { label: '✖ Critical (<30)', color: 'text-[#DC2626]' }
      : calculated_metrics.cockcroft_gault_crcl < 60
      ? { label: '▲ Impaired (<60)', color: 'text-[#D97706]' }
      : { label: '● Nominal', color: 'text-[#059669]' };

  const mapStatus =
    calculated_metrics.mean_arterial_pressure < 65
      ? { label: '✖ Hypotensive (<65)', color: 'text-[#DC2626]' }
      : calculated_metrics.mean_arterial_pressure < 70
      ? { label: '▲ Borderline', color: 'text-[#D97706]' }
      : { label: '● Nominal (>=65)', color: 'text-[#059669]' };

  const qsofaStatus =
    calculated_metrics.qsofa_score >= 2
      ? { label: '✖ High Sepsis Risk', color: 'text-[#DC2626]' }
      : calculated_metrics.qsofa_score === 1
      ? { label: '▲ Intermediate', color: 'text-[#D97706]' }
      : { label: '● Low Risk', color: 'text-[#059669]' };

  const riskPercent = Math.round(clinical_assessment.deterioration_risk_score * 100);

  const handleSignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!physicianName.trim() || !physicianId.trim() || !clinicalSignNote.trim()) {
      setSignValidationError(
        'Attending Physician Name, NPI ID, and Clinical Rationale are required for KMS cryptographic signing.'
      );
      return;
    }
    setSignValidationError('');
    onSignDispatchPacket({
      physician_id: physicianId.trim(),
      physician_name: physicianName.trim(),
      action: signAction,
      clinical_note: clinicalSignNote.trim(),
    });
  };

  const activeStage = agent_stages[selectedStageIndex] || agent_stages[0];

  const getScopeLabel = (scope: DetectedDrugInteraction['scope']) => {
    if (scope === 'PROPOSED_VS_ACTIVE') return 'Proposed Order vs Active Regimen';
    if (scope === 'ACTIVE_VS_ACTIVE') return 'Active Regimen Co-Prescription';
    return 'Proposed Order Pair';
  };

  return (
    <div className="p-6 space-y-6">
      {/* 1. Quantitative Clinical Telemetry Strip */}
      <section
        aria-label="Calculated Clinical Telemetry Metrics"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4"
      >
        {/* Metric 1: Cockcroft-Gault CrCl */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
          <div className="text-xs font-medium text-[#64748B]">
            Cockcroft-Gault CrCl
          </div>
          <div className="mt-1.5 flex items-baseline">
            <span className="text-2xl font-mono font-bold tabular-nums text-[#0F172A]">
              {calculated_metrics.cockcroft_gault_crcl.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-[#64748B] ml-1.5">mL/min</span>
          </div>
          <div className={`mt-1.5 text-xs font-mono font-medium ${crClStatus.color}`}>
            {crClStatus.label} · KDIGO AKI Stage {calculated_metrics.aki_kdigo_stage}
          </div>
        </div>

        {/* Metric 2: Mean Arterial Pressure */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
          <div className="text-xs font-medium text-[#64748B]">
            Mean Arterial Pressure (MAP)
          </div>
          <div className="mt-1.5 flex items-baseline">
            <span className="text-2xl font-mono font-bold tabular-nums text-[#0F172A]">
              {calculated_metrics.mean_arterial_pressure.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-[#64748B] ml-1.5">mmHg</span>
          </div>
          <div className={`mt-1.5 text-xs font-mono font-medium ${mapStatus.color}`}>
            {mapStatus.label} · BP {packet.vitals.systolic_bp}/{packet.vitals.diastolic_bp}
          </div>
        </div>

        {/* Metric 3: qSOFA & SIRS */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
          <div className="text-xs font-medium text-[#64748B]">
            qSOFA &amp; SIRS Sepsis Screen
          </div>
          <div className="mt-1.5 flex items-baseline">
            <span className="text-2xl font-mono font-bold tabular-nums text-[#0F172A]">
              {calculated_metrics.qsofa_score}/3
            </span>
            <span className="text-xs font-mono text-[#64748B] ml-1.5">
              qSOFA · {calculated_metrics.sirs_criteria_count}/3 SIRS
            </span>
          </div>
          <div className={`mt-1.5 text-xs font-mono font-medium ${qsofaStatus.color}`}>
            {qsofaStatus.label}
          </div>
        </div>

        {/* Metric 4: Deterioration Trajectory Score */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
          <div className="text-xs font-medium text-[#64748B]">
            Deterioration Risk Index
          </div>
          <div className="mt-1.5 flex items-baseline">
            <span className="text-2xl font-mono font-bold tabular-nums text-[#0F172A]">
              {riskPercent}%
            </span>
            <span className="text-xs font-mono text-[#64748B] ml-1.5">
              ({clinical_assessment.deterioration_risk_score.toFixed(2)})
            </span>
          </div>
          <div
            className={`mt-1.5 text-xs font-mono font-medium ${
              riskPercent >= 75
                ? 'text-[#DC2626]'
                : riskPercent >= 50
                ? 'text-[#D97706]'
                : 'text-[#059669]'
            }`}
          >
            {riskPercent >= 75 ? '✖ ' : riskPercent >= 50 ? '▲ ' : '● '}
            Severity: {clinical_assessment.severity_level}
          </div>
        </div>

        {/* Metric 5: Adversarial Safety Gate */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
          <div className="text-xs font-medium text-[#64748B]">
            Adversarial Audit Verdict
          </div>
          <div className="mt-1.5 flex items-baseline">
            <span
              className={`text-lg font-mono font-bold ${
                safety_audit.passed_safety_checks ? 'text-[#059669]' : 'text-[#DC2626]'
              }`}
            >
              {safety_audit.passed_safety_checks ? '● CLEARED' : '✖ QUARANTINED'}
            </span>
          </div>
          <div className="mt-1.5 text-xs font-mono text-[#475569] truncate">
            {severeInteractions.length} Severe · {moderateInteractions.length} Moderate DDI(s)
          </div>
        </div>
      </section>

      {/* 2. Highlighted Drug-Drug Interaction (DDI) Risk Warning Panel */}
      <section
        aria-label="Detected Drug-Drug Interaction Warnings"
        className={`rounded-lg border p-5 space-y-4 ${
          severeInteractions.length > 0
            ? 'bg-[#FEF2F2]/60 border-[#FECACA]'
            : moderateInteractions.length > 0
            ? 'bg-[#FFFBEB]/60 border-[#FDE68A]'
            : 'bg-white border-[#E2E8F0]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3.5 border-b border-[#E2E8F0]">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-bold text-[#0F172A]">
                Pharmacovigilance Drug-Drug Interaction (DDI) Risk Matrix
              </h2>
              <span className="text-xs font-mono font-semibold text-[#DC2626]">
                ✖ {severeInteractions.length} Severe Risk (Contraindicated)
              </span>
              <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
              <span className="text-xs font-mono font-semibold text-[#D97706]">
                ▲ {moderateInteractions.length} Moderate Risk (Clinical Caution)
              </span>
            </div>
            <p className="text-xs text-[#475569]">
              Deterministic CYP450, P-glycoprotein, and renal tubular interaction surveillance across active and candidate medications.
            </p>
          </div>

          {/* Interactive Risk Level Filter */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setDdiRiskFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                ddiRiskFilter === 'ALL'
                  ? 'bg-[#0F172A] text-white font-semibold'
                  : 'text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              All DDI Warnings ({allInteractions.length})
            </button>
            <button
              type="button"
              onClick={() => setDdiRiskFilter('SEVERE')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                ddiRiskFilter === 'SEVERE'
                  ? 'bg-[#DC2626] text-white font-semibold'
                  : 'text-[#991B1B] hover:bg-[#FEF2F2]'
              }`}
            >
              ✖ Severe Risk ({severeInteractions.length})
            </button>
            <button
              type="button"
              onClick={() => setDdiRiskFilter('MODERATE')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                ddiRiskFilter === 'MODERATE'
                  ? 'bg-[#D97706] text-white font-semibold'
                  : 'text-[#92400E] hover:bg-[#FFFBEB]'
              }`}
            >
              ▲ Moderate Risk ({moderateInteractions.length})
            </button>
          </div>
        </div>

        {filteredInteractions.length === 0 ? (
          <div className="p-4 bg-white border border-[#E2E8F0] rounded-lg flex items-center justify-between text-xs">
            <span className="font-mono font-semibold text-[#059669]">
              ● Zero {ddiRiskFilter === 'ALL' ? 'Severe or Moderate' : ddiRiskFilter.toLowerCase()} drug-drug interactions detected in current regimen.
            </span>
            {ddiRiskFilter !== 'ALL' && allInteractions.length > 0 && (
              <button
                type="button"
                onClick={() => setDdiRiskFilter('ALL')}
                className="text-xs font-semibold text-[#0B57D0] hover:underline cursor-pointer"
              >
                Show All {allInteractions.length} Interaction(s)
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredInteractions.map((ddi) => {
              const isSevere = ddi.risk_level === 'SEVERE';
              return (
                <div
                  key={ddi.id}
                  className={`p-4 rounded-lg border space-y-2.5 ${
                    isSevere
                      ? 'bg-[#FEF2F2] border-[#FECACA] text-[#7F1D1D]'
                      : 'bg-[#FFFBEB] border-[#FDE68A] text-[#78350F]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono font-bold uppercase tracking-tight ${
                          isSevere ? 'text-[#DC2626]' : 'text-[#D97706]'
                        }`}
                      >
                        {isSevere
                          ? '✖ SEVERE RISK · CONTRAINDICATED'
                          : '▲ MODERATE RISK · CLINICAL CAUTION'}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-[#475569]">
                      {getScopeLabel(ddi.scope)} · Pathway: {ddi.cyp_pathway}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-black/10">
                    <div className="text-sm font-bold text-[#0F172A] font-mono">
                      {ddi.drug_a} + {ddi.drug_b}
                    </div>
                    <button
                      type="button"
                      onClick={() => onInspectDrugInRegistry(ddi.drug_a)}
                      className="text-xs font-semibold text-[#0B57D0] hover:underline cursor-pointer whitespace-nowrap"
                    >
                      Inspect {ddi.drug_a} in FDA Registry →
                    </button>
                  </div>

                  <p className="text-xs leading-relaxed">
                    <span className="font-semibold">Clinical Effect &amp; Mechanism:</span>{' '}
                    {ddi.clinical_effect} ({ddi.mechanism})
                  </p>

                  <div className="p-2.5 bg-white/85 rounded border border-black/10 text-xs text-[#0F172A] leading-relaxed">
                    <span className="font-mono font-semibold">
                      {isSevere ? 'Mandatory Remediation:' : 'Monitoring Protocol:'}
                    </span>{' '}
                    {ddi.management}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Asynchronous Multi-Agent State Graph */}
      <section aria-label="Multi-Agent State Graph" className="bg-white border border-[#E2E8F0] rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">
              Multi-Agent State Graph &amp; Verification Pipeline
            </h2>
            <p className="text-xs text-[#64748B]">
              Select any autonomous micro-agent stage below to inspect execution boundaries, context caching savings, and deterministic tool telemetry.
            </p>
          </div>
          <div className="text-xs font-mono text-[#475569]">
            Packet {packet.packet_id} · Audit Hash {packet.audit_trail_hash.slice(0, 19)}...
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          {agent_stages.map((stage, idx) => {
            const isSelected = idx === selectedStageIndex;
            const isQuarantined = stage.status === 'QUARANTINED';
            return (
              <button
                key={stage.stage_id}
                type="button"
                onClick={() => setSelectedStageIndex(idx)}
                className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#F8FAFC] border-[#0B57D0] ring-1 ring-[#0B57D0]'
                    : 'bg-white border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#64748B]">Stage 0{idx + 1}</span>
                  <span
                    className={`font-semibold ${
                      isQuarantined ? 'text-[#DC2626]' : 'text-[#059669]'
                    }`}
                  >
                    {isQuarantined ? '✖ HALTED' : `● ${stage.latency_ms}ms`}
                  </span>
                </div>
                <div className="mt-1.5 text-xs font-bold text-[#0F172A] leading-snug">
                  {stage.agent_name}
                </div>
                <div className="mt-1 text-[11px] font-mono text-[#475569] truncate">
                  {stage.model_used}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Stage Inspector Bar */}
        {activeStage && (
          <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="text-[#334155]">
              <span className="font-semibold text-[#0F172A]">{activeStage.agent_name}:</span>{' '}
              {activeStage.summary}
            </div>
            <div className="font-mono text-[#475569] whitespace-nowrap">
              Cached EHR Tokens: {activeStage.cached_tokens.toLocaleString()} · Live Prompt Tokens:{' '}
              {activeStage.live_tokens.toLocaleString()} · Latency: {activeStage.latency_ms}ms
            </div>
          </div>
        )}
      </section>

      {/* 4. Split Diagnostic Synthesizer vs Adversarial Safety Auditor */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Clinical Synthesis, Proposed Orders & Tool Invocations */}
        <div className="xl:col-span-7 space-y-6">
          {/* Diagnostic Synthesizer Output */}
          <section className="bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  Agent 3: Diagnostic Trajectory Synthesis
                </h2>
                <p className="text-xs text-[#64748B]">
                  Context-cached longitudinal EHR synthesis · Grounded via Vertex AI Vector Search [Predicted by model]
                </p>
              </div>
              <span className="text-xs font-mono text-[#0B57D0] font-semibold shrink-0">
                Risk Score: {(clinical_assessment.deterioration_risk_score * 100).toFixed(0)}%
              </span>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[#475569]">
                Suspected Clinical Conditions (FHIR Condition Resource)
              </h3>
              <ul className="mt-2 space-y-1.5">
                {clinical_assessment.suspected_conditions.map((cond, i) => (
                  <li key={i} className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                    <span className="font-mono text-xs text-[#0B57D0]">0{i + 1}.</span>
                    <span>{cond}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[#475569]">
                Clinical Trajectory Justification
              </h3>
              <p className="mt-1.5 text-sm text-[#334155] leading-relaxed">
                {clinical_assessment.clinical_justification}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[#475569]">
                Recommended Clinical Interventions
              </h3>
              <ul className="mt-2 space-y-2">
                {clinical_assessment.recommended_interventions.map((item, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-[#1E293B] bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-2.5 leading-relaxed"
                  >
                    <span className="font-mono font-semibold text-[#0B57D0] mr-2">
                      [Action {idx + 1}]
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Candidate Medication Orders Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-[#475569]">
                  Candidate Medication Orders (Evaluated by Adversarial Auditor)
                </h3>
                {!safety_audit.passed_safety_checks && (
                  <button
                    type="button"
                    onClick={onApplySafeCounterfactual}
                    className="text-xs font-semibold text-[#007B83] hover:underline cursor-pointer"
                  >
                    Auto-Remediate Contraindicated Order →
                  </button>
                )}
              </div>

              <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475569]">
                      <th className="py-2.5 px-3 font-semibold">Medication</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Dose (mg)</th>
                      <th className="py-2.5 px-3 font-semibold">Route &amp; Frequency</th>
                      <th className="py-2.5 px-3 font-semibold">DDI Risk Level</th>
                      <th className="py-2.5 px-3 font-semibold">FDA / RxNorm Inspection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {clinical_assessment.proposed_medications.map((med, i) => {
                      const medDdis = allInteractions.filter(
                        (d) =>
                          d.drug_a.toLowerCase() === med.drug_name.toLowerCase() ||
                          d.drug_b.toLowerCase() === med.drug_name.toLowerCase()
                      );
                      const hasSevere = medDdis.some((d) => d.risk_level === 'SEVERE');
                      const hasModerate = medDdis.some((d) => d.risk_level === 'MODERATE');

                      return (
                        <tr
                          key={i}
                          className={
                            hasSevere
                              ? 'bg-[#FEF2F2]/50 hover:bg-[#FEF2F2]'
                              : hasModerate
                              ? 'bg-[#FFFBEB]/50 hover:bg-[#FFFBEB]'
                              : 'hover:bg-[#F8FAFC]'
                          }
                        >
                          <td className="py-2.5 px-3 font-semibold text-[#0F172A]">
                            {med.drug_name}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-right text-[#0F172A]">
                            {med.dose_mg.toFixed(0)} mg
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#334155]">
                            {med.route} · {med.frequency}
                          </td>
                          <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                            {hasSevere ? (
                              <span className="font-bold text-[#DC2626]">
                                ✖ Severe Risk
                              </span>
                            ) : hasModerate ? (
                              <span className="font-bold text-[#D97706]">
                                ▲ Moderate Risk
                              </span>
                            ) : (
                              <span className="font-semibold text-[#059669]">
                                ● Clear
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onInspectDrugInRegistry(med.drug_name)}
                              className="text-xs font-medium text-[#0B57D0] hover:underline cursor-pointer"
                            >
                              Inspect FDA Label →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Deterministic Tool Calling Trace */}
          <section className="bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  Deterministic Pharmacology &amp; Renal Tool Invocations
                </h2>
                <p className="text-xs text-[#64748B]">
                  Zero-hallucination function calling executed against Cockcroft-Gault and RxNorm registries [Literature curated]
                </p>
              </div>
              <span className="text-xs font-mono text-[#475569]">
                {tool_invocations.length} calls executed
              </span>
            </div>

            <div className="space-y-2.5">
              {tool_invocations.map((call) => {
                const isSevere =
                  call.output.status === 'CONTRAINDICATED' || call.output.status === 'SERIOUS';
                const isModerate = call.output.status === 'MODERATE';
                return (
                  <div
                    key={call.id}
                    className={`p-3 rounded-md border text-xs space-y-1.5 overflow-hidden ${
                      isSevere
                        ? 'bg-[#FEF2F2]/60 border-[#FECACA]'
                        : isModerate
                        ? 'bg-[#FFFBEB]/60 border-[#FDE68A]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 font-mono">
                      <span className="font-semibold text-[#0F172A] break-all">
                        {call.tool_name}({JSON.stringify(call.arguments)})
                      </span>
                      <span
                        className={`shrink-0 whitespace-nowrap font-semibold ${
                          isSevere
                            ? 'text-[#DC2626]'
                            : isModerate
                            ? 'text-[#D97706]'
                            : 'text-[#059669]'
                        }`}
                      >
                        {isSevere
                          ? '✖ SEVERE DDI'
                          : isModerate
                          ? '▲ MODERATE DDI'
                          : '● VERIFIED'}{' '}
                        · {call.duration_ms}ms
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-[#334155] break-words">
                      Output: {JSON.stringify(call.output)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column (5 cols): Adversarial Safety Auditor + HITL Cryptographic Gate */}
        <div className="xl:col-span-5 space-y-6">
          {/* Agent 4: Adversarial Safety & Pharmacovigilance Auditor */}
          <section className="bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  Agent 4: Adversarial Safety Auditor
                </h2>
                <p className="text-xs text-[#64748B]">
                  Zero-temperature (Temp = 0.0) counterfactual critic challenging proposed orders
                </p>
              </div>
              <span
                className={`text-xs font-mono font-bold shrink-0 ${
                  safety_audit.passed_safety_checks ? 'text-[#059669]' : 'text-[#DC2626]'
                }`}
              >
                {safety_audit.passed_safety_checks ? '● PASSED SAFETY GATE' : '✖ ORDER QUARANTINED'}
              </span>
            </div>

            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md text-xs text-[#0F172A] leading-relaxed">
              <div className="font-semibold mb-1">
                Auditor Verdict Summary:
              </div>
              {safety_audit.audit_explanation}
            </div>

            {/* Contraindication Flags */}
            <div>
              <h3 className="text-xs font-semibold text-[#475569]">
                Severe Contraindications &amp; Clearance Violations ({safety_audit.detected_contraindications.length})
              </h3>
              {safety_audit.detected_contraindications.length === 0 ? (
                <p className="mt-2 text-xs text-[#059669] bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-3 font-mono">
                  ● 0 Severe Contraindications detected across CYP1A2, CYP2C9, CYP3A4, and Cockcroft-Gault renal thresholds.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {safety_audit.detected_contraindications.map((flag, idx) => (
                    <li
                      key={idx}
                      className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-md text-xs text-[#991B1B] leading-relaxed"
                    >
                      <span className="font-mono font-bold mr-1.5">✖ [SEVERE 0{idx + 1}]</span>
                      {flag}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Moderate Drug-Drug Interaction Advisories inside Auditor */}
            {moderateInteractions.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-[#475569]">
                  Moderate Drug-Drug Interaction Cautions ({moderateInteractions.length})
                </h3>
                <ul className="mt-2 space-y-2">
                  {moderateInteractions.map((mod, idx) => (
                    <li
                      key={mod.id}
                      className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-md text-xs text-[#92400E] leading-relaxed"
                    >
                      <span className="font-mono font-bold mr-1.5">
                        ▲ [MODERATE 0{idx + 1}] {mod.drug_a} + {mod.drug_b}:
                      </span>
                      {mod.clinical_effect} — <span className="font-medium">{mod.management}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Counterfactual Attack Challenges */}
            <div>
              <h3 className="text-xs font-semibold text-[#475569]">
                Counterfactual Verification Challenges
              </h3>
              <ul className="mt-2 space-y-1.5">
                {safety_audit.counterfactual_challenges.map((challenge, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md text-xs text-[#334155] leading-relaxed"
                  >
                    <span className="font-mono font-semibold text-[#0F172A] mr-1.5">
                      Challenge {idx + 1}:
                    </span>
                    {challenge}
                  </li>
                ))}
              </ul>
            </div>

            {!safety_audit.passed_safety_checks && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onApplySafeCounterfactual}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#007B83] rounded-lg hover:bg-[#006269] transition-colors cursor-pointer"
                >
                  Apply Safe Counterfactual Regimen (Hold RAAS + Switch to Cefepime q24h)
                </button>
              </div>
            )}
          </section>

          {/* Agent 5: Human-in-the-Loop (HITL) Cryptographic Action Orchestrator */}
          <section className="bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  Agent 5: HITL Cryptographic Sign-Off Gate
                </h2>
                <p className="text-xs text-[#64748B]">
                  Cloud KMS hardware-backed clinician signature &amp; Firestore ACID state transition
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-[#0F172A] shrink-0">
                {packet.dispatch_status}
              </span>
            </div>

            {packet.physician_signature ? (
              <div className="p-4 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#059669]">
                    ● Cryptographically Signed &amp; Logged to Audit Ledger
                  </span>
                  <span className="font-mono text-[#64748B]">
                    {new Date(packet.physician_signature.signed_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-[#0F172A]">
                  <span className="font-semibold">Attending Physician:</span>{' '}
                  {packet.physician_signature.physician_name} ({packet.physician_signature.physician_id})
                </div>
                <div className="text-[#0F172A]">
                  <span className="font-semibold">Recorded Decision:</span>{' '}
                  <span className="font-mono">{packet.physician_signature.action}</span>
                </div>
                <div className="text-[#334155]">
                  <span className="font-semibold">Clinical Note:</span>{' '}
                  {packet.physician_signature.clinical_note}
                </div>
                <div className="pt-1 font-mono text-[11px] text-[#475569] break-all">
                  KMS Digest: {packet.physician_signature.kms_signature_hash}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSignSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="hitl-md-name" className="block text-xs font-medium text-[#334155]">
                      Attending Physician
                    </label>
                    <input
                      id="hitl-md-name"
                      type="text"
                      value={physicianName}
                      onChange={(e) => setPhysicianName(e.target.value)}
                      className="mt-1 w-full px-2.5 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
                    />
                  </div>
                  <div>
                    <label htmlFor="hitl-md-npi" className="block text-xs font-medium text-[#334155]">
                      Clinician NPI / Auth ID
                    </label>
                    <input
                      id="hitl-md-npi"
                      type="text"
                      value={physicianId}
                      onChange={(e) => setPhysicianId(e.target.value)}
                      className="mt-1 w-full px-2.5 py-1.5 text-xs font-mono bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="hitl-action-select" className="block text-xs font-medium text-[#334155]">
                    Disposition Action
                  </label>
                  <select
                    id="hitl-action-select"
                    value={signAction}
                    onChange={(e) =>
                      setSignAction(
                        e.target.value as 'APPROVE_PLAN' | 'QUARANTINE_CONFIRM' | 'EMERGENCY_OVERRIDE'
                      )
                    }
                    className="mt-1 w-full px-2.5 py-1.5 text-xs font-medium bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
                  >
                    <option value="QUARANTINE_CONFIRM">
                      Confirm Quarantine &amp; Hold Contraindicated Orders
                    </option>
                    <option value="APPROVE_PLAN">
                      Approve &amp; Dispatch Verified Clinical Order Set
                    </option>
                    <option value="EMERGENCY_OVERRIDE">
                      Attending Emergency Override (Requires Dual-Factor Justification)
                    </option>
                  </select>
                </div>

                <div>
                  <label htmlFor="hitl-rationale" className="block text-xs font-medium text-[#334155]">
                    Clinical Attestation &amp; Order Note
                  </label>
                  <textarea
                    id="hitl-rationale"
                    rows={2}
                    value={clinicalSignNote}
                    onChange={(e) => setClinicalSignNote(e.target.value)}
                    className="mt-1 w-full p-2.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
                  />
                </div>

                {signValidationError && (
                  <p role="alert" className="text-xs text-[#DC2626] font-medium">
                    {signValidationError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] transition-colors cursor-pointer"
                >
                  Issue Cloud KMS Cryptographic Signature
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
