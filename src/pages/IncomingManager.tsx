import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { IncomingContent } from '@/components/shipments/IncomingContent';

export default function IncomingManager() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            primaryText="Incoming"
            accentText="Manager"
            description="Plan, track, and allocate inbound shipments"
          />
        </div>
        <IncomingContent />
      </div>
    </DashboardLayout>
  );
}
