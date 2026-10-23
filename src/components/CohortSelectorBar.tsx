import React from 'react';
import { CLINICAL_COHORT_PRESETS, PatientScenarioPreset } from '../utils/clinicalEngine';

interface CohortSelectorBarProps {
  selectedPresetId: string;
  onSelectPreset: (preset: PatientScenarioPreset) => void;
  onApplySafeCounterfactual: () => void;
  isQuarantined: boolean;
}

export const CohortSelectorBar: React.FC<CohortSelectorBarProps> = ({
  selectedPresetId,
  onSelectPreset,
  onApplySafeCounterfactual,
  isQuarantined,
}) => {
  return (
    <section
      aria-label="Clinical Cohort Scenarios"
      className="bg-[#F1F5F9] border-b border-[#E2E8F0] px-6 py-2.5 flex flex-wrap items-center justify-between gap-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[#475569] mr-1 whitespace-nowrap">
          Active Inpatient Cohort:
        </span>
        <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-lg border border-[#E2E8F0]">
          {CLINICAL_COHORT_PRESETS.map((preset) => {
            const active = preset.id === selectedPresetId;
            const shortLabel = preset.label.replace('MED-PATIENT-', 'PT-');
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#0F172A] text-white font-semibold'
                    : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                }`}
              >
                {shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-[#475569]">
        {isQuarantined && (
          <button
            type="button"
            onClick={onApplySafeCounterfactual}
            className="px-3 py-1.5 text-xs font-semibold text-[#007B83] bg-white border border-[#007B83]/40 rounded-md hover:bg-[#F0FDFA] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Substitute Renally-Adjusted Safe Regimen
          </button>
        )}
        <span className="font-mono text-[#475569] whitespace-nowrap">
          SLA Target: &lt;1.5s Triage · Zero-Trust DLP Enabled
        </span>
      </div>
    </section>
  );
};
