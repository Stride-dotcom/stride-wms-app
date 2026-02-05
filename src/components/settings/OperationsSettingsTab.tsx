import { useState } from 'react';
import { cn } from '@/lib/utils';
import { PromptsSettingsTab } from './PromptsSettingsTab';
import { AuditLogTab } from './AuditLogTab';
import { LaborSettingsTab } from './LaborSettingsTab';

interface OperationsSettingsTabProps {
  usersContent: React.ReactNode;
}

const SUB_TABS = [
  { value: 'prompts', label: 'Prompts' },
  { value: 'users', label: 'Users' },
  { value: 'audit', label: 'Audit' },
  { value: 'labor', label: 'Labor' },
] as const;

export function OperationsSettingsTab({ usersContent }: OperationsSettingsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<string>('prompts');

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 border-b">
        {SUB_TABS.map(tab => (
          <button
            key={tab.value}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeSubTab === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveSubTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {activeSubTab === 'prompts' && <PromptsSettingsTab />}
      {activeSubTab === 'users' && usersContent}
      {activeSubTab === 'audit' && <AuditLogTab />}
      {activeSubTab === 'labor' && <LaborSettingsTab />}
    </div>
  );
}
