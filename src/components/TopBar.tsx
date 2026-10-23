import React from 'react';

export type ActiveTab = 'workbench' | 'pipeline' | 'pharmacology' | 'audit';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onRunTriage: () => void;
  isRunning: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onRunTriage,
  isRunning,
}) => {
  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'workbench', label: 'Clinical Workbench' },
    { id: 'pipeline', label: 'Agent Pipeline' },
    { id: 'pharmacology', label: 'Pharmacology Registry' },
    { id: 'audit', label: 'Audit Ledger' },
  ];

  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-[#E2E8F0]">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onSelectTab('workbench');
        }}
        className="text-lg font-bold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#0B57D0]"
      >
        AuraMed Sentinel
      </a>

      {/* Zone 2: 4 concise single-line navigation links */}
      <nav aria-label="Primary Workspace Navigation" className="flex items-center gap-6 text-sm font-medium text-[#475569] overflow-x-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                isActive
                  ? 'border-[#0B57D0] text-[#0B57D0] font-semibold'
                  : 'border-transparent text-[#475569] hover:text-[#0F172A] hover:border-[#CBD5E1]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onRunTriage}
          disabled={isRunning}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#0B57D0] rounded-lg hover:bg-[#0842A0] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isRunning ? 'Executing Multi-Agent Triage...' : 'Run Multi-Agent Triage'}
        </button>
      </div>
    </header>
  );
};
