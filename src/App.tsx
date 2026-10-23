import React, { useState, useCallback } from 'react';
import { TopBar, ActiveTab } from './components/TopBar';
import { CohortSelectorBar } from './components/CohortSelectorBar';
import { PatientTelemetryPanel } from './components/PatientTelemetryPanel';
import { ClinicalWorkbenchView } from './components/ClinicalWorkbenchView';
import { AgentPipelineView } from './components/AgentPipelineView';
import { PharmacologyRegistryView } from './components/PharmacologyRegistryView';
import { AuditLedgerView } from './components/AuditLedgerView';
import {
  CLINICAL_COHORT_PRESETS,
  PatientScenarioPreset,
  PatientMetadata,
  PatientVitals,
  MedicationOrder,
  DispatchPacket,
  runDeterministicSentinelPipeline,
  computeDeterministicAuditHash,
} from './utils/clinicalEngine';

export function App() {
  const initialPreset = CLINICAL_COHORT_PRESETS[0];

  const [activeTab, setActiveTab] = useState<ActiveTab>('workbench');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(initialPreset.id);
  const [metadata, setMetadata] = useState<PatientMetadata>(initialPreset.metadata);
  const [vitals, setVitals] = useState<PatientVitals>(initialPreset.vitals);
  const [activeMedications, setActiveMedications] = useState<string[]>(
    initialPreset.active_medications
  );
  const [proposedMedications, setProposedMedications] = useState<MedicationOrder[]>(
    initialPreset.proposed_medications
  );
  const [unstructuredNote, setUnstructuredNote] = useState<string>(
    initialPreset.unstructured_note
  );
  const [inspectedDrug, setInspectedDrug] = useState<string>('Ciprofloxacin');
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Pre-seed ledger with all 4 clinical cohort baseline runs so Audit Ledger is immediately rich
  const [auditLedger, setAuditLedger] = useState<DispatchPacket[]>(() =>
    CLINICAL_COHORT_PRESETS.map((preset) =>
      runDeterministicSentinelPipeline(
        preset.unstructured_note,
        preset.vitals,
        preset.active_medications,
        preset.metadata,
        preset.proposed_medications
      )
    )
  );

  const [currentPacket, setCurrentPacket] = useState<DispatchPacket>(() =>
    runDeterministicSentinelPipeline(
      initialPreset.unstructured_note,
      initialPreset.vitals,
      initialPreset.active_medications,
      initialPreset.metadata,
      initialPreset.proposed_medications
    )
  );

  const executePipeline = useCallback(
    async (
      noteArg: string,
      vitalsArg: PatientVitals,
      activeMedsArg: string[],
      metaArg: PatientMetadata,
      proposedMedsArg: MedicationOrder[]
    ) => {
      setIsRunning(true);
      // Immediate deterministic update for responsive feedback
      const localPacket = runDeterministicSentinelPipeline(
        noteArg,
        vitalsArg,
        activeMedsArg,
        metaArg,
        proposedMedsArg
      );
      setCurrentPacket(localPacket);

      try {
        const response = await fetch('/api/sentinel/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unstructured_note: noteArg,
            vitals: vitalsArg,
            active_medications: activeMedsArg,
            patient_metadata: metaArg,
            proposed_medications: proposedMedsArg,
          }),
        });
        if (response.ok) {
          const serverPacket = (await response.json()) as DispatchPacket;
          setCurrentPacket((prev) => {
            if (prev.physician_signature) {
              return prev;
            }
            return serverPacket;
          });
          setAuditLedger((prev) => [
            serverPacket,
            ...prev.filter((p) => p.packet_id !== serverPacket.packet_id),
          ]);
        } else {
          setAuditLedger((prev) => [localPacket, ...prev]);
        }
      } catch (_err) {
        setAuditLedger((prev) => [localPacket, ...prev]);
      } finally {
        setIsRunning(false);
      }
    },
    []
  );

  const handleSelectPreset = (preset: PatientScenarioPreset) => {
    setSelectedPresetId(preset.id);
    setMetadata(preset.metadata);
    setVitals(preset.vitals);
    setActiveMedications(preset.active_medications);
    setProposedMedications(preset.proposed_medications);
    setUnstructuredNote(preset.unstructured_note);
    executePipeline(
      preset.unstructured_note,
      preset.vitals,
      preset.active_medications,
      preset.metadata,
      preset.proposed_medications
    );
  };

  const handleApplySafeCounterfactual = () => {
    // Hold RAAS agents / nephrotoxins and substitute renally adjusted Cefepime + Norepinephrine
    const safeActive = activeMedications.filter(
      (m) =>
        !m.toLowerCase().includes('lisinopril') &&
        !m.toLowerCase().includes('spironolactone')
    );
    const safeProposed: MedicationOrder[] = [
      {
        drug_name: 'Cefepime',
        dose_mg: 1000,
        route: 'IV',
        frequency: 'q24h (Renally Adjusted)',
        rationale:
          'Safe counterfactual substitute: avoids CYP1A2 Theophylline interaction and respects CrCl < 30 mL/min',
      },
      {
        drug_name: 'Norepinephrine',
        dose_mg: 4,
        route: 'IV Continuous Infusion',
        frequency: '0.05 mcg/kg/min titrated to MAP >= 65',
        rationale: 'Maintain mean arterial perfusion pressure >= 65 mmHg',
      },
    ];
    setActiveMedications(safeActive);
    setProposedMedications(safeProposed);
    executePipeline(unstructuredNote, vitals, safeActive, metadata, safeProposed);
  };

  const handleSignDispatchPacket = (sig: {
    physician_id: string;
    physician_name: string;
    action: 'APPROVE_PLAN' | 'QUARANTINE_CONFIRM' | 'EMERGENCY_OVERRIDE';
    clinical_note: string;
  }) => {
    const signedAt = new Date().toISOString();
    const kmsHash = computeDeterministicAuditHash(
      `${currentPacket.packet_id}:${sig.physician_id}:${sig.action}:${signedAt}`
    );

    const newStatus: DispatchPacket['dispatch_status'] =
      sig.action === 'APPROVE_PLAN'
        ? 'APPROVED_SIGNED'
        : sig.action === 'EMERGENCY_OVERRIDE'
        ? 'OVERRIDDEN_SIGNED'
        : 'QUARANTINED_BLOCKED';

    const updatedPacket: DispatchPacket = {
      ...currentPacket,
      dispatch_status: newStatus,
      physician_signature: {
        ...sig,
        signed_at: signedAt,
        kms_signature_hash: kmsHash,
      },
    };

    setCurrentPacket(updatedPacket);
    setAuditLedger((prev) => [
      updatedPacket,
      ...prev.filter((p) => p.packet_id !== updatedPacket.packet_id),
    ]);
  };

  const handleInspectDrugInRegistry = (drugName: string) => {
    setInspectedDrug(drugName);
    setActiveTab('pharmacology');
  };

  const handleSelectPacketFromLedger = (pkt: DispatchPacket) => {
    setCurrentPacket(pkt);
    setMetadata(pkt.patient_metadata);
    setVitals(pkt.vitals);
    setActiveMedications(pkt.active_medications);
    setProposedMedications(pkt.clinical_assessment.proposed_medications);
    setActiveTab('workbench');
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Strict 3-Zone Top Bar */}
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onRunTriage={() =>
          executePipeline(
            unstructuredNote,
            vitals,
            activeMedications,
            metadata,
            proposedMedications
          )
        }
        isRunning={isRunning}
      />

      {/* Pre-Loaded Clinical Cohort Bar */}
      <CohortSelectorBar
        selectedPresetId={selectedPresetId}
        onSelectPreset={handleSelectPreset}
        onApplySafeCounterfactual={handleApplySafeCounterfactual}
        isQuarantined={!currentPacket.safety_audit.passed_safety_checks}
      />

      {/* Asymmetric Split Console Layout */}
      <div className="flex-1 flex flex-col lg:flex-row">
        <PatientTelemetryPanel
          metadata={metadata}
          vitals={vitals}
          activeMedications={activeMedications}
          proposedMedications={proposedMedications}
          unstructuredNote={unstructuredNote}
          onChangeMetadata={(newMeta) => {
            setMetadata(newMeta);
            executePipeline(
              unstructuredNote,
              vitals,
              activeMedications,
              newMeta,
              proposedMedications
            );
          }}
          onChangeVitals={(newVitals) => {
            setVitals(newVitals);
            executePipeline(
              unstructuredNote,
              newVitals,
              activeMedications,
              metadata,
              proposedMedications
            );
          }}
          onChangeActiveMedications={(newMeds) => {
            setActiveMedications(newMeds);
            executePipeline(
              unstructuredNote,
              vitals,
              newMeds,
              metadata,
              proposedMedications
            );
          }}
          onChangeProposedMedications={(newOrders) => {
            setProposedMedications(newOrders);
            executePipeline(
              unstructuredNote,
              vitals,
              activeMedications,
              metadata,
              newOrders
            );
          }}
          onChangeNote={setUnstructuredNote}
          onRunTriage={() =>
            executePipeline(
              unstructuredNote,
              vitals,
              activeMedications,
              metadata,
              proposedMedications
            )
          }
          isRunning={isRunning}
        />

        <main className="flex-1 min-w-0">
          {activeTab === 'workbench' && (
            <ClinicalWorkbenchView
              packet={currentPacket}
              onApplySafeCounterfactual={handleApplySafeCounterfactual}
              onInspectDrugInRegistry={handleInspectDrugInRegistry}
              onSignDispatchPacket={handleSignDispatchPacket}
            />
          )}

          {activeTab === 'pipeline' && <AgentPipelineView packet={currentPacket} />}

          {activeTab === 'pharmacology' && (
            <PharmacologyRegistryView
              initialDrug={inspectedDrug}
              patientCrCl={currentPacket.calculated_metrics.cockcroft_gault_crcl}
              patientEgfr={vitals.estimated_gfr}
            />
          )}

          {activeTab === 'audit' && (
            <AuditLedgerView
              ledger={auditLedger}
              onSelectPacket={handleSelectPacketFromLedger}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
