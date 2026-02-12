import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Stage1DockIntake } from './Stage1DockIntake';
import { ConfirmationGuard } from './ConfirmationGuard';
import { Stage2DetailedReceiving } from './Stage2DetailedReceiving';
import { IssuesTab } from './IssuesTab';
import { useReceivingDiscrepancies } from '@/hooks/useReceivingDiscrepancies';
import DockIntakeMatchingPanel from '@/components/incoming/DockIntakeMatchingPanel';
import type { CandidateParams } from '@/hooks/useInboundCandidates';
import { generateReceivingPdf, storeReceivingPdf, type ReceivingPdfData } from '@/lib/receivingPdf';
import { queueReceivingDiscrepancyAlert, queueReceivingExceptionAlert } from '@/lib/alertQueue';

interface ShipmentData {
  id: string;
  shipment_number: string;
  inbound_status: string | null;
  inbound_kind: string | null;
  account_id: string | null;
  vendor_name: string | null;
  signed_pieces: number | null;
  received_pieces: number | null;
  driver_name: string | null;
  signature_data: string | null;
  signature_name: string | null;
  dock_intake_breakdown: Record<string, unknown> | null;
  notes: string | null;
  warehouse_id: string | null;
  sidemark_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface ReceivingStageRouterProps {
  shipmentId: string;
}

type InboundStatus = 'draft' | 'stage1_complete' | 'receiving' | 'closed';

export function ReceivingStageRouter({ shipmentId }: ReceivingStageRouterProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [shipment, setShipment] = useState<ShipmentData | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('receiving');
  const { openCount } = useReceivingDiscrepancies(shipmentId);

  const fetchShipment = useCallback(async () => {
    if (!shipmentId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', shipmentId)
        .single();

      if (error) throw error;
      setShipment(data as any);

      // Fetch account name
      if ((data as any).account_id) {
        const { data: account } = await supabase
          .from('accounts')
          .select('name')
          .eq('id', (data as any).account_id)
          .single();
        setAccountName(account?.name || null);
      }
    } catch (err) {
      console.error('[ReceivingStageRouter] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    fetchShipment();
  }, [fetchShipment]);

  const handleStageChange = () => {
    fetchShipment();
  };

  const handleReceivingComplete = async () => {
    // Generate PDF (non-blocking)
    if (shipment && profile?.tenant_id) {
      try {
        await generateAndStoreReceivingPdf(shipment);
      } catch {
        // PDF failure is non-blocking
        console.warn('[ReceivingStageRouter] PDF generation failed (non-blocking)');
      }

      // Fire alerts (non-blocking)
      try {
        // Check if there were discrepancies
        const { data: discrepancies } = await (supabase as any)
          .from('receiving_discrepancies')
          .select('type')
          .eq('shipment_id', shipmentId)
          .eq('tenant_id', profile.tenant_id);

        if (discrepancies && discrepancies.length > 0) {
          queueReceivingDiscrepancyAlert(
            profile.tenant_id,
            shipmentId,
            shipment.shipment_number,
            discrepancies.length
          );
        }
      } catch {
        // Alert failure is non-blocking
      }
    }

    fetchShipment();
  };

  const generateAndStoreReceivingPdf = async (s: ShipmentData) => {
    if (!profile?.tenant_id) return;

    // Fetch company info for PDF
    const { data: company } = await supabase
      .from('tenant_company_settings')
      .select('company_name, address, phone, email, logo_url')
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle();

    // Fetch warehouse name
    let warehouseName: string | null = null;
    if (s.warehouse_id) {
      const { data: wh } = await supabase
        .from('warehouses')
        .select('name')
        .eq('id', s.warehouse_id)
        .single();
      warehouseName = wh?.name || null;
    }

    // Fetch items
    const { data: items } = await (supabase as any)
      .from('shipment_items')
      .select('expected_description, actual_quantity, expected_vendor, expected_sidemark')
      .eq('shipment_id', shipmentId)
      .eq('status', 'received');

    const pdfData: ReceivingPdfData = {
      shipmentNumber: s.shipment_number,
      vendorName: s.vendor_name,
      accountName: accountName,
      signedPieces: s.signed_pieces,
      receivedPieces: s.received_pieces,
      driverName: s.driver_name,
      companyName: company?.company_name || 'Stride WMS',
      companyAddress: company?.address || null,
      companyPhone: company?.phone || null,
      companyEmail: company?.email || null,
      warehouseName,
      signatureData: s.signature_data,
      signatureName: s.signature_name || null,
      items: (items || []).map((i: any) => ({
        description: i.expected_description || '-',
        quantity: i.actual_quantity || 0,
        vendor: i.expected_vendor || null,
        sidemark: i.expected_sidemark || null,
      })),
      receivedAt: new Date().toISOString(),
    };

    await storeReceivingPdf(pdfData, shipmentId, profile.tenant_id, profile.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-primary" />
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MaterialIcon name="error" size="xl" className="mb-2 opacity-40" />
        <p>Shipment not found.</p>
      </div>
    );
  }

  const status = (shipment.inbound_status || 'draft') as InboundStatus;

  // Matching panel params for Stage 1
  const matchingParams: CandidateParams = {
    accountId: shipment.account_id,
    vendorName: shipment.vendor_name,
    pieces: shipment.signed_pieces,
  };

  // Render based on inbound_status
  const renderStageContent = () => {
    switch (status) {
      case 'draft':
        return (
          <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
            <Stage1DockIntake
              shipmentId={shipmentId}
              shipmentNumber={shipment.shipment_number}
              shipment={shipment as any}
              onComplete={handleStageChange}
              onRefresh={fetchShipment}
            />
            <div className="hidden lg:block">
              <div className="sticky top-4">
                <DockIntakeMatchingPanel
                  dockIntakeId={shipmentId}
                  params={matchingParams}
                  onLinked={fetchShipment}
                />
              </div>
            </div>
          </div>
        );

      case 'stage1_complete':
        return (
          <ConfirmationGuard
            shipmentId={shipmentId}
            shipmentNumber={shipment.shipment_number}
            shipment={shipment as any}
            accountName={accountName}
            onConfirm={handleStageChange}
            onGoBack={handleStageChange}
          />
        );

      case 'receiving':
        return (
          <Stage2DetailedReceiving
            shipmentId={shipmentId}
            shipmentNumber={shipment.shipment_number}
            shipment={shipment as any}
            onComplete={handleReceivingComplete}
            onRefresh={fetchShipment}
          />
        );

      case 'closed':
        return (
          <div className="text-center py-12">
            <MaterialIcon name="check_circle" size="xl" className="mb-3 text-green-500" />
            <h3 className="text-lg font-medium mb-1">Receiving Complete</h3>
            <p className="text-sm text-muted-foreground">
              This dock intake has been fully received and closed.
            </p>
            <div className="flex items-center justify-center gap-4 mt-4 text-sm">
              <span>Signed: {shipment.signed_pieces ?? '-'}</span>
              <span>Received: {shipment.received_pieces ?? '-'}</span>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-12 text-muted-foreground">
            <p>Unknown status: {status}</p>
          </div>
        );
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="flex-wrap h-auto gap-1 mb-4">
        <TabsTrigger value="receiving" className="gap-2">
          <MaterialIcon name="inventory_2" size="sm" />
          Receiving
        </TabsTrigger>
        <TabsTrigger value="issues" className="gap-2">
          <MaterialIcon name="report_problem" size="sm" />
          Issues
          {openCount > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 min-w-5 text-xs">
              {openCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="receiving">
        {renderStageContent()}
      </TabsContent>

      <TabsContent value="issues">
        <IssuesTab shipmentId={shipmentId} />
      </TabsContent>
    </Tabs>
  );
}
