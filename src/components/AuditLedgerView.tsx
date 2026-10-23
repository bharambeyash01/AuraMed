import React, { useState } from 'react';
import { DispatchPacket } from '../utils/clinicalEngine';

interface AuditLedgerViewProps {
  ledger: DispatchPacket[];
  onSelectPacket: (packet: DispatchPacket) => void;
}

export const AuditLedgerView: React.FC<AuditLedgerViewProps> = ({
  ledger,
  onSelectPacket,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filtered = ledger.filter((pkt) => {
    const matchesStatus =
      statusFilter === 'ALL' || pkt.dispatch_status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      pkt.patient_id.toLowerCase().includes(q) ||
      pkt.packet_id.toLowerCase().includes(q) ||
      pkt.audit_trail_hash.toLowerCase().includes(q) ||
      pkt.clinical_assessment.proposed_medications.some((m) =>
        m.drug_name.toLowerCase().includes(q)
      );
    return matchesStatus && matchesSearch;
  });

  const handleExportCsv = () => {
    const headers = [
      'Packet ID',
      'Timestamp',
      'Patient ID',
      'CrCl (mL/min)',
      'MAP (mmHg)',
      'qSOFA',
      'Dispatch Status',
      'Audit SHA-256 Digest',
    ];
    const rows = filtered.map((p) => [
      p.packet_id,
      p.timestamp_iso,
      p.patient_id,
      p.calculated_metrics.cockcroft_gault_crcl,
      p.calculated_metrics.mean_arterial_pressure,
      p.calculated_metrics.qsofa_score,
      p.dispatch_status,
      p.audit_trail_hash,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `auramed_sentinel_audit_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      <section className="bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">
              Append-Only BigQuery &amp; Cloud KMS Cryptographic Audit Ledger
            </h2>
            <p className="text-xs text-[#64748B]">
              Zero-trust immutable log of every multi-agent clinical decision packet, deterministic tool call, and physician KMS signature.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 text-xs font-semibold text-[#0F172A] bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
          >
            Download Audit CSV ({filtered.length})
          </button>
        </div>

        {/* Search & Status Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-[#F1F5F9] p-1 rounded-lg">
            {[
              { id: 'ALL', label: 'All Decisions' },
              { id: 'QUARANTINED_BLOCKED', label: 'Quarantined' },
              { id: 'PENDING_PHYSICIAN_SIGNATURE', label: 'Pending Signature' },
              { id: 'APPROVED_SIGNED', label: 'Signed & Approved' },
              { id: 'OVERRIDDEN_SIGNED', label: 'Emergency Override' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-[#0F172A] font-semibold shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-72">
            <input
              type="search"
              aria-label="Filter audit ledger by patient ID, drug, or hash"
              placeholder="Search Patient ID, Drug, or SHA-256..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-md"
            />
          </div>
        </div>

        {/* High-Density Audit Table */}
        {filtered.length === 0 ? (
          <div className="p-8 text-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-2">
            <div className="text-sm font-semibold text-[#0F172A]">
              No matching audit packets found
            </div>
            <p className="text-xs text-[#64748B]">
              Clear your search filter or execute a new Multi-Agent Triage run to append a verified decision packet.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
              }}
              className="mt-2 px-3 py-1.5 text-xs font-semibold text-white bg-[#0B57D0] rounded-md cursor-pointer"
            >
              Reset Ledger Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475569]">
                  <th className="py-2.5 px-3 font-semibold">Packet ID</th>
                  <th className="py-2.5 px-3 font-semibold">Patient ID</th>
                  <th className="py-2.5 px-3 font-semibold text-right">CrCl (mL/min)</th>
                  <th className="py-2.5 px-3 font-semibold">Candidate Orders</th>
                  <th className="py-2.5 px-3 font-semibold">Disposition Status</th>
                  <th className="py-2.5 px-3 font-semibold">Attending Signature</th>
                  <th className="py-2.5 px-3 font-semibold">SHA-256 Digest</th>
                  <th className="py-2.5 px-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filtered.map((pkt) => {
                  const isQuarantined = pkt.dispatch_status === 'QUARANTINED_BLOCKED';
                  const isSigned =
                    pkt.dispatch_status === 'APPROVED_SIGNED' ||
                    pkt.dispatch_status === 'OVERRIDDEN_SIGNED';
                  return (
                    <tr key={pkt.packet_id} className="hover:bg-[#F8FAFC]">
                      <td className="py-2.5 px-3 font-mono font-semibold text-[#0F172A] whitespace-nowrap">
                        {pkt.packet_id}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#334155] whitespace-nowrap">
                        {pkt.patient_id}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right text-[#0F172A]">
                        {pkt.calculated_metrics.cockcroft_gault_crcl.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-[#334155]">
                        {pkt.clinical_assessment.proposed_medications
                          .map((m) => `${m.drug_name} ${m.dose_mg}mg`)
                          .join(', ')}
                      </td>
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            isQuarantined
                              ? 'text-[#DC2626]'
                              : isSigned
                              ? 'text-[#059669]'
                              : 'text-[#D97706]'
                          }`}
                        >
                          {isQuarantined ? '✖ ' : isSigned ? '● ' : '▲ '}
                          {pkt.dispatch_status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#334155]">
                        {pkt.physician_signature
                          ? `${pkt.physician_signature.physician_name} (${pkt.physician_signature.physician_id})`
                          : 'Awaiting Attending MD'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#64748B]">
                        {pkt.audit_trail_hash.slice(0, 22)}...
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectPacket(pkt)}
                          className="text-xs font-semibold text-[#0B57D0] hover:underline cursor-pointer"
                        >
                          Load in Workbench →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
