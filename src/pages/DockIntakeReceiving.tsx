import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { ReceivingStageRouter } from '@/components/receiving/ReceivingStageRouter';

export default function DockIntakeReceiving() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-muted-foreground">
          <p>No shipment ID provided.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/incoming')}
            className="gap-1"
          >
            <MaterialIcon name="arrow_back" size="sm" />
            Back
          </Button>
          <PageHeader
            primaryText="Dock"
            accentText="Intake"
            description="Stage-based receiving workflow"
          />
        </div>

        <ReceivingStageRouter shipmentId={id} />
      </div>
    </DashboardLayout>
  );
}
