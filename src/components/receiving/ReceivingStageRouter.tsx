import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Stage1DockIntake } from './Stage1DockIntake';
import type { MatchingParamsUpdate } from './Stage1DockIntake';
import { ConfirmationGuard } from './ConfirmationGuard';
import { Stage2DetailedReceiving } from './Stage2DetailedReceiving';
import type { ItemMatchingParams } from './Stage2DetailedReceiving';
import { IssuesTab } from './IssuesTab';
import { useReceivingDiscrepancies } from '@/hooks/useReceivingDiscrepancies';
import DockIntakeMatchingPanel from '@/components/incoming/DockIntakeMatchingPanel';
import type { CandidateParams } from '@/hooks/useInboundCandidates';
import { downloadReceivingPdf, storeReceivingPdf, type ReceivingPdfData } from '@/lib/receivingPdf';
import { queueReceivingDiscrepancyAlert } from '@/lib/alertQueue';

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
  const isMobile = useIsMobile();
  const [shipment, setShipment] = useState<ShipmentData | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('receiving');
  const [mobileMatchingOpen, setMobileMatchingOpen] = useState(false);
  const [pdfRetrying, setPdfRetrying] = useState(false);
  const { openCount } = useReceivingDiscrepancies(shipmentId);

  // Live matching params from Stage 1 fields (updated as user types)
  const [liveMatchingParams, setLiveMatchingParams] = useState<MatchingParamsUpdate | null>(null);

  // Item-level matching params from Stage 2 (updated as user enters item details)
  const [itemMatchingParams, setItemMatchingParams] = useState<ItemMatchingParams | null>(null);

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
    // Reset item-level params when transitioning stages
    setItemMatchingParams(null);
    fetchShipment();
  };

  // Handle live matching param updates from Stage 1
  const handleMatchingParamsChange = useCallback((params: MatchingParamsUpdate) => {
    setLiveMatchingParams(params);
  }, []);

  // Handle item-level matching param updates from Stage 2
  const handleItemMatchingParamsChange = useCallback((params: ItemMatchingParams) => {
    setItemMatchingParams(params);
  }, []);

  const buildPdfData = async (s: ShipmentData): Promise<ReceivingPdfData> => {
    // Fetch company info for PDF
    const { data: company } = await supabase
      .from('tenant_company_settings')
      .select('company_name, address, phone, email, logo_url')
      .eq('tenant_id', profile!.tenant_id)
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

    // Fetch discrepancies for summary
    const { data: discrepancies } = await (supabase as any)
      .from('receiving_discrepancies')
      .select('type, details, status')
      .eq('shipment_id', shipmentId);

    return {
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
  };

  const handleReceivingComplete = async () => {
    // Generate + store PDF (non-blocking)
    if (shipment && profile?.tenant_id) {
      try {
        const pdfData = await buildPdfData(shipment);
        await storeReceivingPdf(pdfData, shipmentId, profile.tenant_id, profile.id);
      } catch {
        console.warn('[ReceivingStageRouter] PDF generation failed (non-blocking)');
      }

      // Fire alerts (non-blocking)
      try {
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

  // PDF download for closed shipments
  const handleDownloadPdf = async () => {
    if (!shipment || !profile?.tenant_id) return;

    // Check if PDF exists in metadata
    const meta = shipment.metadata as Record<string, unknown> | null;
    const pdfKey = meta?.receiving_pdf_key as string | undefined;

    if (pdfKey) {
      // Download from storage
      const { data, error } = await supabase.storage
        .from('documents-private')
        .createSignedUrl(pdfKey, 300);

      if (!error && data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
        return;
      }
    }

    // Fallback: generate + download directly
    try {
      const pdfData = await buildPdfData(shipment);
      downloadReceivingPdf(pdfData);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'PDF Error',
        description: err?.message || 'Failed to generate PDF',
      });
    }
  };

  // Retry PDF generation for closed shipments
  const handleRetryPdf = async () => {
    if (!shipment || !profile?.tenant_id) return;
    setPdfRetrying(true);
    try {
      const pdfData = await buildPdfData(shipment);
      const result = await storeReceivingPdf(pdfData, shipmentId, profile.tenant_id, profile.id);
      if (result.success) {
        toast({ title: 'PDF Generated', description: 'Receiving PDF has been stored.' });
        fetchShipment(); // Refresh metadata
      } else {
        throw new Error('Storage failed');
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'PDF Retry Failed',
        description: err?.message || 'Could not generate PDF. Try again later.',
      });
    } finally {
      setPdfRetrying(false);
    }
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

  // Build matching params: use live values from Stage 1 form when available, fallback to persisted shipment data
  const matchingParams: CandidateParams = {
    accountId: liveMatchingParams?.accountId ?? shipment.account_id,
    vendorName: liveMatchingParams?.vendorName ?? shipment.vendor_name,
    pieces: liveMatchingParams?.pieces ?? shipment.signed_pieces,
    // Item-level params from Stage 2
    itemDescription: itemMatchingParams?.itemDescription || null,
    itemVendor: itemMatchingParams?.itemVendor || null,
  };

  const hasPdf = !!(shipment.metadata as Record<string, unknown> | null)?.receiving_pdf_key;

  // Should we show the matching panel? Yes for draft (Stage 1) and receiving (Stage 2)
  const showMatchingPanel = status === 'draft' || status === 'receiving';

  // Shared matching panel component
  const matchingPanelContent = showMatchingPanel ? (
    <DockIntakeMatchingPanel
      dockIntakeId={shipmentId}
      params={matchingParams}
      onLinked={fetchShipment}
      showItemRefinement={status === 'receiving'}
    />
  ) : null;

  // Render based on inbound_status
  const renderStageContent = () => {
    switch (status) {
      case 'draft':
        return (
          <Stage1DockIntake
            shipmentId={shipmentId}
            shipmentNumber={shipment.shipment_number}
            shipment={shipment as any}
            onComplete={handleStageChange}
            onRefresh={fetchShipment}
            onMatchingParamsChange={handleMatchingParamsChange}
          />
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
            onItemMatchingParamsChange={handleItemMatchingParamsChange}
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
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button variant="outline" onClick={handleDownloadPdf}>
                <MaterialIcon name="picture_as_pdf" size="sm" className="mr-2" />
                {hasPdf ? 'Download PDF' : 'Generate PDF'}
              </Button>
              {!hasPdf && (
                <Button variant="outline" onClick={handleRetryPdf} disabled={pdfRetrying}>
                  {pdfRetrying ? (
                    <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  ) : (
                    <MaterialIcon name="refresh" size="sm" className="mr-2" />
                  )}
                  Retry PDF
                </Button>
              )}
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
        {showMatchingPanel ? (
          <>
            <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
              {renderStageContent()}
              {/* Desktop: inline matching panel */}
              <div className="hidden lg:block">
                <div className="sticky top-4">
                  {matchingPanelContent}
                </div>
              </div>
            </div>

            {/* Mobile: FAB to open matching panel */}
            <div className="fixed bottom-6 right-6 lg:hidden z-40">
              <Button
                size="lg"
                className="rounded-full h-14 w-14 shadow-lg"
                onClick={() => setMobileMatchingOpen(true)}
              >
                <MaterialIcon name="search" size="md" />
              </Button>
            </div>

            {/* Mobile: matching bottom sheet */}
            <Sheet open={mobileMatchingOpen} onOpenChange={setMobileMatchingOpen}>
              <SheetContent
                side="bottom"
                className="h-auto max-h-[85vh] rounded-t-xl"
              >
                <SheetHeader>
                  <SheetTitle>Matching Candidates</SheetTitle>
                </SheetHeader>
                <div className="mt-4 overflow-y-auto max-h-[calc(85vh-80px)]">
                  <DockIntakeMatchingPanel
                    dockIntakeId={shipmentId}
                    params={matchingParams}
                    onLinked={() => {
                      fetchShipment();
                      setMobileMatchingOpen(false);
                    }}
                    showItemRefinement={status === 'receiving'}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </>
        ) : (
          renderStageContent()
        )}
      </TabsContent>

      <TabsContent value="issues">
        <IssuesTab shipmentId={shipmentId} />
      </TabsContent>
    </Tabs>
  );
}
