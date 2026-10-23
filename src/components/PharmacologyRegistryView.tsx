import React, { useState, useEffect } from 'react';
import {
  DRUG_FORMULARY_REGISTRY,
  CRITICAL_INTERACTION_REGISTRY,
  generateRenalClearanceCurve,
  queryFdaDrugContraindications,
} from '../utils/clinicalEngine';

interface PharmacologyRegistryViewProps {
  initialDrug: string;
  patientCrCl: number;
  patientEgfr: number;
}

interface OpenFdaResponse {
  query_drug: string;
  live_fda_fetched: boolean;
  formulary_profile: {
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
  } | null;
  fda_spl_label: {
    boxed_warning?: string | null;
    contraindications?: string | null;
    drug_interactions?: string | null;
    indications_and_usage?: string | null;
    dosage_and_administration?: string | null;
  } | null;
  faers_top_reactions: Array<{ term: string; count: number }>;
  source_urls: {
    openfda_label: string;
    openfda_faers: string;
  };
}

export const PharmacologyRegistryView: React.FC<PharmacologyRegistryViewProps> = ({
  initialDrug,
  patientCrCl,
  patientEgfr,
}) => {
  const [selectedDrug, setSelectedDrug] = useState(initialDrug || 'Ciprofloxacin');
  const [fdaData, setFdaData] = useState<OpenFdaResponse | null>(null);
  const [loadingFda, setLoadingFda] = useState(false);
  const [hoverHourIndex, setHoverHourIndex] = useState<number | null>(6);

  // Pairwise checker state
  const [pairDrugA, setPairDrugA] = useState('Ciprofloxacin');
  const [pairDrugB, setPairDrugB] = useState('Theophylline');

  useEffect(() => {
    if (initialDrug) {
      setSelectedDrug(initialDrug);
    }
  }, [initialDrug]);

  useEffect(() => {
    let cancelled = false;
    async function loadFdaProfile() {
      setLoadingFda(true);
      try {
        const res = await fetch(
          `/api/openfda/drug-profile?drug=${encodeURIComponent(selectedDrug)}`
        );
        if (res.ok && !cancelled) {
          const data = (await res.json()) as OpenFdaResponse;
          setFdaData(data);
        }
      } catch (_err) {
        // Ignore network errors; local formulary fallback still renders
      } finally {
        if (!cancelled) {
          setLoadingFda(false);
        }
      }
    }
    loadFdaProfile();
    return () => {
      cancelled = true;
    };
  }, [selectedDrug]);

  const curvePoints = generateRenalClearanceCurve(patientCrCl, 400);
  const maxConc = Math.max(
    ...curvePoints.map((p) => Math.max(p.patient_plasma_conc, p.normal_plasma_conc)),
    25
  );

  const pairCheckResult = queryFdaDrugContraindications(pairDrugA, pairDrugB);
  const quickDrugs = Object.values(DRUG_FORMULARY_REGISTRY).map((d) => d.generic_name);
  const inspectedPoint =
    hoverHourIndex !== null && curvePoints[hoverHourIndex]
      ? curvePoints[hoverHourIndex]
      : curvePoints[6];

  const maxFaersCount = Math.max(
    ...(fdaData?.faers_top_reactions.map((r) => r.count) || [1000]),
    1
  );

  return (
    <div className="p-6 space-y-6">
      {/* Quick-Try Example Drug Bar */}
      <section className="bg-white border border-[#E2E8F0] rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-[#475569] mr-2">
            Inspect Formulary &amp; openFDA Compound:
          </span>
          {quickDrugs.map((drug) => {
            const active = selectedDrug.toLowerCase() === drug.toLowerCase();
            return (
              <button
                key={drug}
                type="button"
                onClick={() => setSelectedDrug(drug)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#0B57D0] text-white font-semibold'
                    : 'bg-[#F8FAFC] text-[#334155] border border-[#E2E8F0] hover:bg-[#F1F5F9]'
                }`}
              >
                {drug}
              </button>
            );
          })}
        </div>
        <div className="text-xs font-mono text-[#475569]">
          Active Patient CrCl: <span className="font-bold text-[#0F172A]">{patientCrCl.toFixed(1)} mL/min</span> · eGFR: {patientEgfr.toFixed(0)}
        </div>
      </section>

      {/* Split Pharmacokinetic Clearance Chart + openFDA Drug Profile */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 6 cols: Dual-Axis Pharmacokinetic Clearance & Accumulation Curve */}
        <section className="xl:col-span-6 bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">
                Renal Clearance &amp; 24-Hour Plasma Accumulation Curve
              </h2>
              <p className="text-xs text-[#64748B]">
                One-compartment redosing simulation (q12h) comparing Normal Clearance (100 mL/min) vs Patient CrCl ({patientCrCl.toFixed(1)} mL/min) [Predicted by model]
              </p>
            </div>
            <span
              className={`text-xs font-mono font-semibold ${
                patientCrCl < 35 ? 'text-[#DC2626]' : 'text-[#059669]'
              }`}
            >
              {patientCrCl < 35 ? '✖ Supratherapeutic Accumulation' : '● Safe Clearance Envelope'}
            </span>
          </div>

          {/* SVG Line Chart with Interactive Crosshair */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs font-mono">
              <div className="flex items-center gap-4">
                <span className="text-[#0B57D0] font-semibold">
                  ── Patient CrCl ({patientCrCl.toFixed(1)} mL/min)
                </span>
                <span className="text-[#64748B]">
                  -- Theoretical Normal (100 mL/min)
                </span>
                <span className="text-[#DC2626]">
                  ·· Toxicity Ceiling ({inspectedPoint.toxicity_threshold} mg/L)
                </span>
              </div>
              <div className="text-[#0F172A] bg-white px-2.5 py-1 rounded border border-[#E2E8F0]">
                T+{inspectedPoint.hour}h: Patient {inspectedPoint.patient_plasma_conc.toFixed(1)} mg/L · Normal {inspectedPoint.normal_plasma_conc.toFixed(1)} mg/L
              </div>
            </div>

            <svg
              viewBox="0 0 600 240"
              className="w-full h-56 overflow-visible cursor-crosshair select-none"
              role="img"
              aria-label="24-hour renal pharmacokinetic plasma concentration curve"
            >
              {/* Horizontal Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = 200 - ratio * 170;
                const val = (ratio * maxConc).toFixed(0);
                return (
                  <g key={idx}>
                    <line
                      x1={44}
                      y1={y}
                      x2={580}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                    />
                    <text
                      x={38}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-[#64748B] text-[10px] font-mono"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Toxicity Threshold Line */}
              {(() => {
                const toxY = 200 - (inspectedPoint.toxicity_threshold / maxConc) * 170;
                return (
                  <line
                    x1={44}
                    y1={toxY}
                    x2={580}
                    y2={toxY}
                    stroke="#DC2626"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                );
              })()}

              {/* Normal Clearance Curve (Dashed) */}
              <polyline
                fill="none"
                stroke="#64748B"
                strokeWidth="2"
                strokeDasharray="5 4"
                points={curvePoints
                  .map((p, i) => {
                    const x = 44 + (i / (curvePoints.length - 1)) * 536;
                    const y = 200 - (p.normal_plasma_conc / maxConc) * 170;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />

              {/* Patient Renal-Impaired Curve (Solid) */}
              <polyline
                fill="none"
                stroke="#0B57D0"
                strokeWidth="2.5"
                points={curvePoints
                  .map((p, i) => {
                    const x = 44 + (i / (curvePoints.length - 1)) * 536;
                    const y = 200 - (p.patient_plasma_conc / maxConc) * 170;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />

              {/* Interactive Data Points */}
              {curvePoints.map((p, i) => {
                const x = 44 + (i / (curvePoints.length - 1)) * 536;
                const yPatient = 200 - (p.patient_plasma_conc / maxConc) * 170;
                const isHovered = hoverHourIndex === i;
                return (
                  <g
                    key={p.hour}
                    onMouseEnter={() => setHoverHourIndex(i)}
                    onClick={() => setHoverHourIndex(i)}
                  >
                    {isHovered && (
                      <line
                        x1={x}
                        y1={25}
                        x2={x}
                        y2={200}
                        stroke="#94A3B8"
                        strokeWidth="1"
                      />
                    )}
                    <circle
                      cx={x}
                      cy={yPatient}
                      r={isHovered ? 5 : 3.5}
                      fill={p.patient_plasma_conc > p.toxicity_threshold ? '#DC2626' : '#0B57D0'}
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                    <text
                      x={x}
                      y={218}
                      textAnchor="middle"
                      className="fill-[#64748B] text-[10px] font-mono"
                    >
                      {p.hour}h
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Interactive Pairwise Drug-Drug Contraindication Matrix */}
          <div className="pt-2 border-t border-[#E2E8F0] space-y-3">
            <h3 className="text-sm font-bold text-[#0F172A]">
              Deterministic RxNorm / CYP450 Contraindication Verifier
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="pair-drug-a" className="block text-xs font-medium text-[#475569]">
                  Medication A
                </label>
                <select
                  id="pair-drug-a"
                  value={pairDrugA}
                  onChange={(e) => setPairDrugA(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
                >
                  {quickDrugs.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pair-drug-b" className="block text-xs font-medium text-[#475569]">
                  Medication B
                </label>
                <select
                  id="pair-drug-b"
                  value={pairDrugB}
                  onChange={(e) => setPairDrugB(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
                >
                  {quickDrugs.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              className={`p-3.5 rounded-lg border text-xs space-y-1 ${
                pairCheckResult.risk_level === 'SEVERE'
                  ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                  : pairCheckResult.risk_level === 'MODERATE'
                  ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
                  : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]'
              }`}
            >
              <div className="flex items-center justify-between font-mono font-bold">
                <span>
                  {pairDrugA} + {pairDrugB}
                </span>
                <span>
                  {pairCheckResult.risk_level === 'SEVERE'
                    ? '✖ SEVERE RISK (CONTRAINDICATED)'
                    : pairCheckResult.risk_level === 'MODERATE'
                    ? '▲ MODERATE RISK (MONITOR)'
                    : '● CLEAR'}
                </span>
              </div>
              <p className="leading-relaxed">{pairCheckResult.interaction_detail}</p>
              <p className="font-mono text-[11px] pt-1">
                Pathway: {pairCheckResult.cyp_pathway} · Clinical Action: {pairCheckResult.management}
              </p>
            </div>
          </div>
        </section>

        {/* Right 6 cols: Live openFDA Labeling & FAERS Adverse Event Profile */}
        <section className="xl:col-span-6 bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">
                {selectedDrug} — Institutional Formulary &amp; openFDA Profile
              </h2>
              <p className="text-xs text-[#64748B]">
                [Literature curated] · RxNorm CUI:{' '}
                <span className="font-mono">
                  {fdaData?.formulary_profile?.rxnorm_cui || 'Indexed'}
                </span>{' '}
                · {fdaData?.live_fda_fetched ? 'Live openFDA API Connected' : 'Institutional Formulary Active'}
              </p>
            </div>
            {fdaData?.source_urls && (
              <div className="flex items-center gap-3 text-xs font-medium">
                <a
                  href={fdaData.source_urls.openfda_label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0B57D0] hover:underline"
                >
                  openFDA SPL JSON ↗
                </a>
                <a
                  href={fdaData.source_urls.openfda_faers}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0B57D0] hover:underline"
                >
                  FAERS Events ↗
                </a>
              </div>
            )}
          </div>

          {loadingFda ? (
            <div className="space-y-3 py-6">
              <div className="h-5 bg-[#F1F5F9] rounded w-1/2 animate-pulse" />
              <div className="h-20 bg-[#F1F5F9] rounded w-full animate-pulse" />
              <div className="h-28 bg-[#F1F5F9] rounded w-full animate-pulse" />
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Dosing & CYP450 Summary Grid */}
              {fdaData?.formulary_profile && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md">
                    <div className="text-[#64748B] font-medium">Standard Adult Regimen</div>
                    <div className="mt-1 font-mono font-semibold text-[#0F172A]">
                      {fdaData.formulary_profile.standard_adult_dose}
                    </div>
                  </div>
                  <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md">
                    <div className="text-[#64748B] font-medium">Renal Impairment Adjustment</div>
                    <div className="mt-1 font-mono font-semibold text-[#007B83]">
                      {fdaData.formulary_profile.renal_adjusted_dose}
                    </div>
                  </div>
                </div>
              )}

              {/* Boxed Warning */}
              {(fdaData?.formulary_profile?.boxed_warning ||
                fdaData?.fda_spl_label?.boxed_warning) && (
                <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-md text-[#991B1B] space-y-1">
                  <div className="font-mono font-bold">
                    ✖ FDA BOXED WARNING (SPL)
                  </div>
                  <p className="leading-relaxed line-clamp-4">
                    {fdaData?.formulary_profile?.boxed_warning ||
                      String(fdaData?.fda_spl_label?.boxed_warning)}
                  </p>
                </div>
              )}

              {/* FAERS Top Adverse Reactions Bar Distribution */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-[#0F172A]">
                    FDA FAERS Top Reported MedDRA Adverse Reactions [Experimentally determined]
                  </h3>
                  <span className="font-mono text-[#64748B]">Report Counts</span>
                </div>
                <div className="space-y-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-3">
                  {(fdaData?.faers_top_reactions || []).map((reaction) => {
                    const pct = Math.max(8, Math.round((reaction.count / maxFaersCount) * 100));
                    return (
                      <div key={reaction.term} className="space-y-1">
                        <div className="flex justify-between font-mono text-[11px]">
                          <span className="font-medium text-[#0F172A]">{reaction.term}</span>
                          <span className="tabular-nums text-[#475569]">
                            {reaction.count.toLocaleString()} reports
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#E2E8F0] rounded-sm overflow-hidden">
                          <div
                            className="h-full bg-[#0B57D0]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Institutional Interaction Rules Table */}
              <div>
                <h3 className="font-semibold text-[#0F172A] mb-2">
                  Indexed High-Severity Contraindication Rules
                </h3>
                <div className="overflow-x-auto border border-[#E2E8F0] rounded-md">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475569]">
                        <th className="py-2 px-2.5 font-semibold">Drug Pair</th>
                        <th className="py-2 px-2.5 font-semibold">Pathway</th>
                        <th className="py-2 px-2.5 font-semibold">Clinical Management</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {CRITICAL_INTERACTION_REGISTRY.map((rule, i) => (
                        <tr key={i} className="hover:bg-[#F8FAFC]">
                          <td className="py-2 px-2.5 font-mono font-semibold text-[#0F172A] whitespace-nowrap">
                            {rule.drug_a} + {rule.drug_b}
                          </td>
                          <td className="py-2 px-2.5 font-mono text-[#334155] whitespace-nowrap">
                            {rule.cyp_pathway}
                          </td>
                          <td className="py-2 px-2.5 text-[#334155]">{rule.management}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
