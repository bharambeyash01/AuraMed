import React, { useState } from 'react';
import {
  PatientVitals,
  PatientMetadata,
  MedicationOrder,
  DRUG_FORMULARY_REGISTRY,
  redactPhiWithCloudDlp,
} from '../utils/clinicalEngine';

interface PatientTelemetryPanelProps {
  metadata: PatientMetadata;
  vitals: PatientVitals;
  activeMedications: string[];
  proposedMedications: MedicationOrder[];
  unstructuredNote: string;
  onChangeMetadata: (meta: PatientMetadata) => void;
  onChangeVitals: (vitals: PatientVitals) => void;
  onChangeActiveMedications: (meds: string[]) => void;
  onChangeProposedMedications: (orders: MedicationOrder[]) => void;
  onChangeNote: (note: string) => void;
  onRunTriage: () => void;
  isRunning: boolean;
}

export const PatientTelemetryPanel: React.FC<PatientTelemetryPanelProps> = ({
  metadata,
  vitals,
  activeMedications,
  proposedMedications,
  unstructuredNote,
  onChangeMetadata,
  onChangeVitals,
  onChangeActiveMedications,
  onChangeProposedMedications,
  onChangeNote,
  onRunTriage,
  isRunning,
}) => {
  const [newActiveDrug, setNewActiveDrug] = useState('');
  const [newProposedDrug, setNewProposedDrug] = useState('Cefepime');
  const [newProposedDose, setNewProposedDose] = useState('1000');
  const [newProposedFreq, setNewProposedFreq] = useState('q24h (Renally Adjusted)');
  const [showDlpPreview, setShowDlpPreview] = useState(false);

  const dlpPreview = redactPhiWithCloudDlp(unstructuredNote);

  const handleAddActiveMed = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newActiveDrug.trim();
    if (!trimmed) return;
    if (!activeMedications.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
      onChangeActiveMedications([...activeMedications, trimmed]);
    }
    setNewActiveDrug('');
  };

  const handleRemoveActiveMed = (med: string) => {
    onChangeActiveMedications(activeMedications.filter((m) => m !== med));
  };

  const handleAddProposedMed = (e: React.FormEvent) => {
    e.preventDefault();
    const drug = newProposedDrug.trim();
    const dose = Number(newProposedDose);
    if (!drug || Number.isNaN(dose) || dose <= 0) return;

    const updated: MedicationOrder = {
      drug_name: drug,
      dose_mg: dose,
      route: 'IV',
      frequency: newProposedFreq.trim() || 'q12h',
      rationale: 'Clinician-configured candidate order',
    };
    onChangeProposedMedications([...proposedMedications, updated]);
  };

  const handleRemoveProposedMed = (index: number) => {
    onChangeProposedMedications(proposedMedications.filter((_, idx) => idx !== index));
  };

  const formularyNames = Object.values(DRUG_FORMULARY_REGISTRY).map((d) => d.generic_name);

  return (
    <aside
      aria-label="Patient Telemetry and Parameter Controls"
      className="w-full lg:w-[360px] shrink-0 bg-white border-r border-[#E2E8F0] flex flex-col justify-between"
    >
      <div className="p-5 space-y-6 overflow-y-auto">
        {/* Patient Demographics Header */}
        <div className="pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">
              01. Patient Telemetry Input
            </h2>
            <span className="text-xs font-mono text-[#475569]">
              {metadata.patient_id}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">
            {metadata.admission_unit} · Baseline Cr {metadata.baseline_creatinine.toFixed(1)} mg/dL · Allergies: {metadata.allergies.join(', ')}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <div>
              <label htmlFor="patient-age" className="block text-xs font-medium text-[#475569]">
                Age (yr)
              </label>
              <input
                id="patient-age"
                type="number"
                min={18}
                max={105}
                value={metadata.age}
                onChange={(e) =>
                  onChangeMetadata({ ...metadata, age: Math.max(18, Number(e.target.value) || 18) })
                }
                className="mt-1 w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-[#0F172A]"
              />
            </div>

            <div>
              <label htmlFor="patient-weight" className="block text-xs font-medium text-[#475569]">
                Weight (kg)
              </label>
              <input
                id="patient-weight"
                type="number"
                min={30}
                max={220}
                step={0.5}
                value={metadata.weight_kg}
                onChange={(e) =>
                  onChangeMetadata({
                    ...metadata,
                    weight_kg: Math.max(30, Number(e.target.value) || 30),
                  })
                }
                className="mt-1 w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-[#0F172A]"
              />
            </div>

            <div>
              <label htmlFor="patient-gender" className="block text-xs font-medium text-[#475569]">
                Sex (CrCl)
              </label>
              <select
                id="patient-gender"
                value={metadata.gender}
                onChange={(e) =>
                  onChangeMetadata({
                    ...metadata,
                    gender: e.target.value === 'Female' ? 'Female' : 'Male',
                  })
                }
                className="mt-1 w-full px-2 py-1.5 text-xs font-medium bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-[#0F172A]"
              >
                <option value="Male">Male</option>
                <option value="Female">Female (×0.85)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Real-Time Vitals & Renal Clearance Sliders */}
        <div className="pb-4 border-b border-[#E2E8F0] space-y-3">
          <h3 className="text-xs font-semibold text-[#0F172A]">
            02. Hemodynamic &amp; Renal Parameters
          </h3>

          {/* Serum Creatinine */}
          <div>
            <div className="flex justify-between text-xs">
              <label htmlFor="vital-cr" className="font-medium text-[#334155]">
                Serum Creatinine
              </label>
              <span className="font-mono tabular-nums font-semibold text-[#0F172A]">
                {vitals.serum_creatinine.toFixed(2)} <span className="text-[#64748B] font-normal">mg/dL</span>
              </span>
            </div>
            <input
              id="vital-cr"
              type="range"
              min={0.5}
              max={6.0}
              step={0.1}
              value={vitals.serum_creatinine}
              onChange={(e) => {
                const cr = Number(e.target.value);
                const estGfr = Math.max(8, Math.min(110, Math.round(68 / cr)));
                onChangeVitals({
                  ...vitals,
                  serum_creatinine: cr,
                  estimated_gfr: estGfr,
                });
              }}
              className="mt-1 w-full accent-[#0B57D0] cursor-pointer"
            />
          </div>

          {/* Estimated GFR */}
          <div>
            <div className="flex justify-between text-xs">
              <label htmlFor="vital-egfr" className="font-medium text-[#334155]">
                Estimated GFR
              </label>
              <span className="font-mono tabular-nums font-semibold text-[#0F172A]">
                {vitals.estimated_gfr.toFixed(0)} <span className="text-[#64748B] font-normal">mL/min/1.73m²</span>
              </span>
            </div>
            <input
              id="vital-egfr"
              type="range"
              min={8}
              max={110}
              step={1}
              value={vitals.estimated_gfr}
              onChange={(e) =>
                onChangeVitals({ ...vitals, estimated_gfr: Number(e.target.value) })
              }
              className="mt-1 w-full accent-[#0B57D0] cursor-pointer"
            />
          </div>

          {/* Blood Pressure */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div>
              <label htmlFor="vital-sbp" className="block text-xs font-medium text-[#334155]">
                Systolic BP (mmHg)
              </label>
              <input
                id="vital-sbp"
                type="number"
                min={60}
                max={220}
                value={vitals.systolic_bp}
                onChange={(e) =>
                  onChangeVitals({ ...vitals, systolic_bp: Number(e.target.value) || 88 })
                }
                className="mt-1 w-full px-2.5 py-1 text-xs font-mono tabular-nums bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
              />
            </div>
            <div>
              <label htmlFor="vital-dbp" className="block text-xs font-medium text-[#334155]">
                Diastolic BP (mmHg)
              </label>
              <input
                id="vital-dbp"
                type="number"
                min={30}
                max={140}
                value={vitals.diastolic_bp}
                onChange={(e) =>
                  onChangeVitals({ ...vitals, diastolic_bp: Number(e.target.value) || 54 })
                }
                className="mt-1 w-full px-2.5 py-1 text-xs font-mono tabular-nums bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
              />
            </div>
          </div>

          {/* HR, RR, Temp */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div>
              <label htmlFor="vital-hr" className="block text-xs font-medium text-[#334155]">
                HR (bpm)
              </label>
              <input
                id="vital-hr"
                type="number"
                min={40}
                max={200}
                value={vitals.heart_rate}
                onChange={(e) =>
                  onChangeVitals({ ...vitals, heart_rate: Number(e.target.value) || 100 })
                }
                className="mt-1 w-full px-2 py-1 text-xs font-mono tabular-nums bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
              />
            </div>
            <div>
              <label htmlFor="vital-rr" className="block text-xs font-medium text-[#334155]">
                RR (/min)
              </label>
              <input
                id="vital-rr"
                type="number"
                min={8}
                max={50}
                value={vitals.respiratory_rate}
                onChange={(e) =>
                  onChangeVitals({ ...vitals, respiratory_rate: Number(e.target.value) || 20 })
                }
                className="mt-1 w-full px-2 py-1 text-xs font-mono tabular-nums bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
              />
            </div>
            <div>
              <label htmlFor="vital-temp" className="block text-xs font-medium text-[#334155]">
                Temp (°C)
              </label>
              <input
                id="vital-temp"
                type="number"
                step={0.1}
                min={34}
                max={42}
                value={vitals.temperature_celsius}
                onChange={(e) =>
                  onChangeVitals({
                    ...vitals,
                    temperature_celsius: Number(e.target.value) || 37.0,
                  })
                }
                className="mt-1 w-full px-2 py-1 text-xs font-mono tabular-nums bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Active Inpatient Medications */}
        <div className="pb-4 border-b border-[#E2E8F0] space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#0F172A]">
              03. Active Medication Regimen
            </h3>
            <span className="text-xs font-mono text-[#64748B]">
              {activeMedications.length} active
            </span>
          </div>

          <div className="space-y-1.5">
            {activeMedications.map((med) => (
              <div
                key={med}
                className="flex items-center justify-between px-2.5 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md text-xs"
              >
                <span className="font-medium text-[#0F172A]">{med}</span>
                <button
                  type="button"
                  aria-label={`Remove active medication ${med}`}
                  onClick={() => handleRemoveActiveMed(med)}
                  className="text-xs text-[#64748B] hover:text-[#DC2626] font-mono px-1 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddActiveMed} className="flex gap-1.5">
            <input
              type="text"
              list="formulary-drugs"
              aria-label="Add active medication"
              placeholder="Add active drug (e.g. Warfarin)..."
              value={newActiveDrug}
              onChange={(e) => setNewActiveDrug(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
            />
            <datalist id="formulary-drugs">
              {formularyNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-[#F1F5F9] border border-[#CBD5E1] rounded-md hover:bg-[#E2E8F0] whitespace-nowrap cursor-pointer"
            >
              Add Drug
            </button>
          </form>
        </div>

        {/* Candidate Proposed Orders */}
        <div className="pb-4 border-b border-[#E2E8F0] space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#0F172A]">
              04. Proposed Candidate Orders
            </h3>
            <span className="text-xs font-mono text-[#64748B]">
              {proposedMedications.length} queued
            </span>
          </div>

          <div className="space-y-1.5">
            {proposedMedications.map((order, idx) => (
              <div
                key={`${order.drug_name}-${idx}`}
                className="flex items-center justify-between px-2.5 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md text-xs"
              >
                <div className="truncate pr-2">
                  <span className="font-semibold text-[#0F172A]">{order.drug_name}</span>
                  <span className="text-[#64748B] font-mono ml-1.5">
                    {order.dose_mg}mg · {order.frequency}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={`Remove proposed order ${order.drug_name}`}
                  onClick={() => handleRemoveProposedMed(idx)}
                  className="text-xs text-[#64748B] hover:text-[#DC2626] font-mono px-1 shrink-0 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddProposedMed} className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-1.5">
              <select
                aria-label="Select proposed medication"
                value={newProposedDrug}
                onChange={(e) => setNewProposedDrug(e.target.value)}
                className="px-2 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
              >
                {formularyNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                aria-label="Proposed medication dose in mg"
                placeholder="Dose (mg)"
                value={newProposedDose}
                onChange={(e) => setNewProposedDose(e.target.value)}
                className="px-2 py-1.5 text-xs font-mono tabular-nums bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
              />
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                aria-label="Proposed dosing frequency"
                placeholder="Frequency (e.g. q12h)"
                value={newProposedFreq}
                onChange={(e) => setNewProposedFreq(e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold text-[#0F172A] bg-[#F1F5F9] border border-[#CBD5E1] rounded-md hover:bg-[#E2E8F0] whitespace-nowrap cursor-pointer"
              >
                Queue Order
              </button>
            </div>
          </form>
        </div>

        {/* Unstructured Clinical Progress Note + Cloud DLP Redaction */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="clinical-note-input" className="text-xs font-semibold text-[#0F172A]">
              05. Unstructured Progress Note
            </label>
            <button
              type="button"
              onClick={() => setShowDlpPreview(!showDlpPreview)}
              className="text-xs font-medium text-[#0B57D0] hover:underline cursor-pointer"
            >
              {showDlpPreview ? 'Edit Raw Note' : `Preview DLP Redaction (${dlpPreview.redactions.length})`}
            </button>
          </div>

          {showDlpPreview ? (
            <div className="p-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-xs font-mono text-[#334155] leading-relaxed">
              <div className="text-[11px] font-semibold text-[#007B83] mb-1">
                Google Cloud DLP De-Identified Payload:
              </div>
              {dlpPreview.redacted_text}
            </div>
          ) : (
            <textarea
              id="clinical-note-input"
              rows={4}
              value={unstructuredNote}
              onChange={(e) => onChangeNote(e.target.value)}
              className="w-full p-2.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-[#0F172A] leading-relaxed resize-y"
            />
          )}
        </div>
      </div>

      {/* Bottom Execution Trigger */}
      <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0]">
        <button
          type="button"
          onClick={onRunTriage}
          disabled={isRunning}
          className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0B57D0] rounded-lg hover:bg-[#0842A0] disabled:opacity-60 transition-colors cursor-pointer"
        >
          {isRunning ? 'Synthesizing & Auditing...' : 'Execute Multi-Agent Safety Audit'}
        </button>
      </div>
    </aside>
  );
};
