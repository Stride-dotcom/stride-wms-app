import { useState, useRef, useCallback, useEffect } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useSidebar } from '@/contexts/SidebarContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLocations } from '@/hooks/useLocations';
import { useStocktakeFreezeCheck } from '@/hooks/useStocktakes';
import { useServiceEvents, ServiceEventForScan } from '@/hooks/useServiceEvents';
import { usePermissions } from '@/hooks/usePermissions';
import { QRScanner } from '@/components/scan/QRScanner';
import { ItemSearchOverlay, LocationSearchOverlay } from '@/components/scan/SearchOverlays';
import {
  hapticLight,
  hapticMedium,
  hapticSuccess,
  hapticError,
} from '@/lib/haptics';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HelpButton } from '@/components/prompts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ScannedItem {
  id: string;
  item_code: string;
  description: string | null;
  current_location_code: string | null;
  warehouse_name: string | null;
}

interface ServiceScannedItem extends ScannedItem {
  class_code: string | null;
  account_id: string | null;
  account_name: string | null;
  sidemark_id: string | null;
}

interface ScannedLocation {
  id: string;
  code: string;
  name: string | null;
  type?: string;
}

type ScanMode = 'move' | 'batch' | 'lookup' | 'service' | null;
type ScanPhase = 'idle' | 'scanning-item' | 'scanning-location' | 'confirm';

export default function ScanHub() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { locations } = useLocations();
  const { checkFreeze } = useStocktakeFreezeCheck();
  const { scanServiceEvents, getServiceRate, createBillingEvents, loading: serviceEventsLoading } = useServiceEvents();
  const { collapseSidebar } = useSidebar();
  const { hasRole } = usePermissions();

  // Role-based visibility for billing features (managers and above)
  const canSeeBilling = hasRole('admin') || hasRole('tenant_admin') || hasRole('manager');

  const [mode, setMode] = useState<ScanMode>(null);
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [processing, setProcessing] = useState(false);

  // Move mode state
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null);
  const [targetLocation, setTargetLocation] = useState<ScannedLocation | null>(null);

  // Batch move state
  const [batchItems, setBatchItems] = useState<ScannedItem[]>([]);

  // Service event scan state
  const [serviceItems, setServiceItems] = useState<ServiceScannedItem[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceEventForScan[]>([]);
  const [serviceToAdd, setServiceToAdd] = useState<string>('');

  // Search overlay state
  const [showItemSearch, setShowItemSearch] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);

  // Swipe confirmation state
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const swipeStartX = useRef(0);
  const swipeContainerRef = useRef<HTMLDivElement>(null);

  const parseQRPayload = (input: string): { type: string; id: string; code?: string } | null => {
    try {
      const parsed = JSON.parse(input);
      if (parsed.type && parsed.id) {
        return parsed;
      }
    } catch {
      return { type: 'unknown', id: '', code: input.trim() };
    }
    return null;
  };

  const lookupItem = async (input: string): Promise<ScannedItem | null> => {
    const payload = parseQRPayload(input);
    if (!payload) return null;

    let query = supabase
      .from('v_items_with_location')
      .select('id, item_code, description, location_code, warehouse_name');

    if (payload.type === 'item' && payload.id) {
      query = query.eq('id', payload.id);
    } else if (payload.code) {
      query = query.eq('item_code', payload.code);
    } else {
      return null;
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      item_code: data.item_code,
      description: data.description,
      current_location_code: data.location_code,
      warehouse_name: data.warehouse_name,
    };
  };

  // Extended lookup for service events - includes class, account, sidemark
  const lookupItemForService = async (input: string): Promise<ServiceScannedItem | null> => {
    const payload = parseQRPayload(input);
    if (!payload) return null;

    // Query items table directly to get class (via class_id join), account_id, sidemark_id, account_name
    let query = supabase
      .from('items')
      .select(`
        id,
        item_code,
        description,
        account_id,
        sidemark_id,
        class:classes(code),
        account:accounts(account_name),
        location:locations!current_location_id(code),
        warehouse:warehouses(name)
      `);

    if (payload.type === 'item' && payload.id) {
      query = query.eq('id', payload.id);
    } else if (payload.code) {
      query = query.eq('item_code', payload.code);
    } else {
      return null;
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      item_code: data.item_code,
      description: data.description,
      current_location_code: (data.location as any)?.code || null,
      warehouse_name: (data.warehouse as any)?.name || null,
      class_code: (data.class as any)?.code || null,
      account_id: data.account_id || null,
      account_name: (data.account as any)?.account_name || null,
      sidemark_id: data.sidemark_id || null,
    };
  };

  const lookupLocation = async (input: string): Promise<ScannedLocation | null> => {
    const payload = parseQRPayload(input);
    if (!payload) return null;

    // Check if it's a location QR
    if (payload.type === 'location' && payload.id) {
      const loc = locations.find(l => l.id === payload.id);
      if (loc) {
        return { id: loc.id, code: loc.code, name: loc.name, type: loc.type };
      }
    }
    
    // Try matching by code
    const loc = locations.find(l => 
      l.code.toLowerCase() === (payload.code || input).toLowerCase()
    );
    if (loc) {
      return { id: loc.id, code: loc.code, name: loc.name, type: loc.type };
    }

    return null;
  };

  const handleScanResult = async (data: string) => {
    if (processing) return;

    setProcessing(true);
    const input = data.trim();
    
    try {
      if (mode === 'lookup') {
        const item = await lookupItem(input);
        if (item) {
          hapticMedium(); // Item found
          navigate(`/inventory/${item.id}`);
        } else {
          hapticError(); // Item not found
          toast({
            variant: 'destructive',
            title: 'Item Not Found',
            description: 'No item found with that code.',
          });
        }
        setProcessing(false);
        return;
      }

      if (mode === 'move') {
        if (phase === 'scanning-item') {
          const item = await lookupItem(input);
          if (item) {
            hapticMedium(); // Item found
            setScannedItem(item);
            setPhase('scanning-location');
            toast({
              title: `Found: ${item.item_code}`,
              description: 'Now scan the destination bay.',
            });
          } else {
            hapticError(); // Item not found
            toast({
              variant: 'destructive',
              title: 'Item Not Found',
              description: 'Scan a valid item QR code.',
            });
          }
        } else if (phase === 'scanning-location') {
          const loc = await lookupLocation(input);
          if (loc) {
            hapticMedium(); // Location found
            setTargetLocation(loc);
            setPhase('confirm');
          } else {
            hapticError(); // Location not found
            toast({
              variant: 'destructive',
              title: 'Location Not Found',
              description: 'Scan a valid bay/location QR code.',
            });
          }
        }
      }

      if (mode === 'batch') {
        // In batch mode, first try to parse as location
        const loc = await lookupLocation(input);
        if (loc && batchItems.length > 0) {
          hapticMedium(); // Location found
          setTargetLocation(loc);
          setPhase('confirm');
          setProcessing(false);
          return;
        }

        // Try as item
        const item = await lookupItem(input);
        if (item) {
          if (!batchItems.find(i => i.id === item.id)) {
            hapticLight(); // Item added to batch
            setBatchItems(prev => [...prev, item]);
            toast({
              title: `Added: ${item.item_code}`,
              description: `${batchItems.length + 1} items in batch. Scan location to finish.`,
            });
          } else {
            toast({
              title: 'Already in batch',
              description: `${item.item_code} is already added.`,
            });
          }
        } else if (!loc) {
          hapticError(); // Not found
          toast({
            variant: 'destructive',
            title: 'Not Found',
            description: 'Scan a valid item or location code.',
          });
        }
      }

      // Service Event Scan mode
      if (mode === 'service') {
        const item = await lookupItemForService(input);
        if (item) {
          if (!serviceItems.find(i => i.id === item.id)) {
            hapticLight();
            setServiceItems(prev => [...prev, item]);
            toast({
              title: `Added: ${item.item_code}`,
              description: item.class_code
                ? `Class: ${item.class_code}`
                : 'No class assigned - default rate will be used',
            });
          } else {
            toast({
              title: 'Already added',
              description: `${item.item_code} is already in the list.`,
            });
          }
        } else {
          hapticError();
          toast({
            variant: 'destructive',
            title: 'Item Not Found',
            description: 'Scan a valid item QR code.',
          });
        }
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast({
        variant: 'destructive',
        title: 'Scan Error',
        description: 'Failed to process scan.',
      });
    } finally {
      setProcessing(false);
    }
  };

  // Handle manual item selection from search
  const handleItemSelect = (item: { id: string; item_code: string; description: string | null; location_code: string | null; warehouse_name: string | null }) => {
    setShowItemSearch(false);
    hapticLight(); // Selection feedback
    
    const scannedItem: ScannedItem = {
      id: item.id,
      item_code: item.item_code,
      description: item.description,
      current_location_code: item.location_code,
      warehouse_name: item.warehouse_name,
    };

    if (mode === 'lookup') {
      navigate(`/inventory/${item.id}`);
      return;
    }

    if (mode === 'move') {
      setScannedItem(scannedItem);
      setPhase('scanning-location');
      toast({
        title: `Selected: ${item.item_code}`,
        description: 'Now scan or select the destination bay.',
      });
    }

    if (mode === 'batch') {
      if (!batchItems.find(i => i.id === item.id)) {
        setBatchItems(prev => [...prev, scannedItem]);
        toast({
          title: `Added: ${item.item_code}`,
          description: `${batchItems.length + 1} items in batch.`,
        });
      } else {
        toast({
          title: 'Already in batch',
          description: `${item.item_code} is already added.`,
        });
      }
    }
  };

  // Handle manual location selection from search
  const handleLocationSelect = (loc: { id: string; code: string; name: string | null }) => {
    setShowLocationSearch(false);
    hapticMedium(); // Location selected
    // Find full location data to get type
    const fullLoc = locations.find(l => l.id === loc.id);
    setTargetLocation({ ...loc, type: fullLoc?.type });
    setPhase('confirm');
  };

  const executeMove = async () => {
    if (!targetLocation) return;

    setProcessing(true);
    try {
      const items = mode === 'move' && scannedItem ? [scannedItem] : batchItems;
      let successCount = 0;

      // Check for freeze moves on all items
      for (const item of items) {
        const freezeStatus = await checkFreeze(item.id);
        if (freezeStatus.isFrozen) {
          hapticError();
          toast({
            variant: 'destructive',
            title: 'Movement Blocked',
            description: freezeStatus.message || `Item is frozen by stocktake ${freezeStatus.stocktakeNumber}`,
          });
          setProcessing(false);
          return;
        }
      }

      for (const item of items) {
        const { error } = await (supabase.from('items') as any)
          .update({ current_location_id: targetLocation.id })
          .eq('id', item.id);

        if (!error) {
          await (supabase.from('movements') as any).insert({
            item_id: item.id,
            to_location_id: targetLocation.id,
            action_type: 'move',
            moved_at: new Date().toISOString(),
          });
          successCount++;
        }
      }

      hapticSuccess(); // Move completed successfully
      
      // Show different toast for release locations
      if (targetLocation.type === 'release') {
        toast({
          title: 'Items Released',
          description: `Released ${successCount} item${successCount !== 1 ? 's' : ''} successfully`,
        });
      } else {
        toast({
          title: 'Move Complete',
          description: `Moved ${successCount} item${successCount !== 1 ? 's' : ''} to ${targetLocation.code}`,
        });
      }

      resetState();
    } catch (error) {
      console.error('Move error:', error);
      hapticError(); // Move failed
      toast({
        variant: 'destructive',
        title: 'Move Failed',
        description: 'Failed to move items.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const resetState = () => {
    setMode(null);
    setPhase('idle');
    setScannedItem(null);
    setTargetLocation(null);
    setBatchItems([]);
    setServiceItems([]);
    setSelectedServices([]);
    setServiceToAdd('');
    setSwipeProgress(0);
    setShowItemSearch(false);
    setShowLocationSearch(false);
  };

  // Service Event Scan functions
  const addServiceEvent = (serviceCode: string) => {
    const service = scanServiceEvents.find(s => s.service_code === serviceCode);
    if (service && !selectedServices.find(s => s.service_code === serviceCode)) {
      hapticLight();
      setSelectedServices(prev => [...prev, service]);
      setServiceToAdd('');
    }
  };

  const removeServiceEvent = (serviceCode: string) => {
    setSelectedServices(prev => prev.filter(s => s.service_code !== serviceCode));
  };

  const removeServiceItem = (itemId: string) => {
    setServiceItems(prev => prev.filter(i => i.id !== itemId));
  };

  const saveServiceEvents = async () => {
    if (serviceItems.length === 0 || selectedServices.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot Save',
        description: 'Select at least one item and one service.',
      });
      return;
    }

    setProcessing(true);

    try {
      const result = await createBillingEvents(
        serviceItems.map(item => ({
          id: item.id,
          item_code: item.item_code,
          class_code: item.class_code,
          account_id: item.account_id,
          account_name: item.account_name || undefined,
          sidemark_id: item.sidemark_id,
        })),
        selectedServices.map(s => s.service_code)
      );

      if (result.success) {
        hapticSuccess();
        resetState();
      } else {
        hapticError();
      }
    } catch (error) {
      console.error('Save error:', error);
      hapticError();
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create billing events.',
      });
    } finally {
      setProcessing(false);
    }
  };

  // Handle item selection from search for service mode
  const handleServiceItemSelect = async (item: { id: string; item_code: string; description: string | null; location_code: string | null; warehouse_name: string | null }) => {
    setShowItemSearch(false);

    // Fetch full item data including class_code
    const fullItem = await lookupItemForService(item.item_code);
    if (fullItem) {
      if (!serviceItems.find(i => i.id === fullItem.id)) {
        hapticLight();
        setServiceItems(prev => [...prev, fullItem]);
        toast({
          title: `Added: ${fullItem.item_code}`,
          description: fullItem.class_code
            ? `Class: ${fullItem.class_code}`
            : 'No class assigned - default rate will be used',
        });
      } else {
        toast({
          title: 'Already added',
          description: `${fullItem.item_code} is already in the list.`,
        });
      }
    }
  };

  const selectMode = (selectedMode: ScanMode) => {
    hapticLight(); // Mode selection feedback
    setMode(selectedMode);
    setPhase('scanning-item');
    // Auto-collapse sidebar when entering scan mode
    collapseSidebar();
  };

  // Swipe handlers
  const handleSwipeStart = useCallback((clientX: number) => {
    setIsSwiping(true);
    swipeStartX.current = clientX;
  }, []);

  const handleSwipeMove = useCallback((clientX: number) => {
    if (!isSwiping || !swipeContainerRef.current) return;
    
    const containerWidth = swipeContainerRef.current.offsetWidth;
    const swipeDistance = clientX - swipeStartX.current;
    const progress = Math.min(Math.max(swipeDistance / (containerWidth - 80), 0), 1);
    setSwipeProgress(progress);
  }, [isSwiping]);

  const handleSwipeEnd = useCallback(() => {
    if (swipeProgress > 0.70) {
      setSwipeProgress(1);
      setTimeout(() => executeMove(), 100);
    } else {
      setSwipeProgress(0); // Spring back
    }
    setIsSwiping(false);
  }, [swipeProgress]);

  const handleTouchStart = (e: React.TouchEvent) => {
    handleSwipeStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleSwipeMove(e.touches[0].clientX);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handleSwipeStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSwiping) {
      handleSwipeMove(e.clientX);
    }
  };

  const handleMouseUp = () => {
    if (isSwiping) {
      handleSwipeEnd();
    }
  };

  // Prepare location data for search
  const locationData = locations.map(l => ({ id: l.id, code: l.code, name: l.name }));

  // Mode Selection Screen
  if (mode === null) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <PageHeader
              primaryText="Scan"
              accentText="Hub"
              description="High-speed warehouse operations hub"
            />
            <HelpButton workflow="scan_hub" />
          </div>

          <div className="flex flex-col gap-6 w-full max-w-xl mx-auto">
            {/* Move Card */}
            <button
              onClick={() => selectMode('move')}
              className={cn(
                "group relative overflow-hidden flex items-center gap-6 p-6",
                "rounded-3xl bg-card border-2 border-transparent",
                "transition-all duration-300 text-left",
                "hover:border-primary hover:shadow-xl hover:shadow-primary/10"
              )}
            >
              {/* Background watermark emoji */}
              <div className="absolute -top-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300 text-[10rem]">
                ↔️
              </div>

              {/* Large emoji container */}
              <div className="w-24 h-28 rounded-3xl bg-primary flex items-center justify-center flex-shrink-0 text-5xl group-hover:scale-110 transition-transform duration-200">
                ↔️
              </div>

              {/* Text on right */}
              <div className="flex flex-col items-start flex-1">
                <span className="text-2xl font-bold text-foreground">Move</span>
                <span className="text-sm text-muted-foreground mt-1">Scan item, then scan destination</span>
                <span className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wide mt-3">
                  LAUNCH SCANNER ➡️
                </span>
              </div>
            </button>

            {/* Batch Move Card */}
            <button
              onClick={() => selectMode('batch')}
              className={cn(
                "group relative overflow-hidden flex items-center gap-6 p-6",
                "rounded-3xl bg-card border-2 border-transparent",
                "transition-all duration-300 text-left",
                "hover:border-muted-foreground/50 hover:shadow-xl hover:shadow-muted/20"
              )}
            >
              {/* Background watermark emoji */}
              <div className="absolute -top-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300 text-[10rem]">
                📚
              </div>

              {/* Large emoji container */}
              <div className="w-24 h-28 rounded-3xl bg-secondary flex items-center justify-center flex-shrink-0 text-5xl group-hover:scale-110 transition-transform duration-200">
                📚
              </div>

              {/* Text on right */}
              <div className="flex flex-col items-start flex-1">
                <span className="text-2xl font-bold text-foreground">Batch Move</span>
                <span className="text-sm text-muted-foreground mt-1">Scan multiple items, then scan destination</span>
                <span className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide mt-3">
                  LAUNCH SCANNER ➡️
                </span>
              </div>
            </button>

            {/* Look Up Card */}
            <button
              onClick={() => selectMode('lookup')}
              className={cn(
                "group relative overflow-hidden flex items-center gap-6 p-6",
                "rounded-3xl bg-card border-2 border-transparent",
                "transition-all duration-300 text-left",
                "hover:border-info hover:shadow-xl hover:shadow-info/10"
              )}
            >
              {/* Background watermark emoji */}
              <div className="absolute -top-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300 text-[10rem]">
                🔍
              </div>

              {/* Large emoji container */}
              <div className="w-24 h-28 rounded-3xl bg-info flex items-center justify-center flex-shrink-0 text-5xl group-hover:scale-110 transition-transform duration-200">
                🔍
              </div>

              {/* Text on right */}
              <div className="flex flex-col items-start flex-1">
                <span className="text-2xl font-bold text-foreground">Look Up</span>
                <span className="text-sm text-muted-foreground mt-1">Scan to view item details</span>
                <span className="flex items-center gap-2 text-info text-xs font-semibold uppercase tracking-wide mt-3">
                  LAUNCH SCANNER ➡️
                </span>
              </div>
            </button>

            {/* Service Event Scan Card */}
            <button
              onClick={() => selectMode('service')}
              className={cn(
                "group relative overflow-hidden flex items-center gap-6 p-6",
                "rounded-3xl bg-card border-2 border-transparent",
                "transition-all duration-300 text-left",
                "hover:border-success hover:shadow-xl hover:shadow-success/10"
              )}
            >
              {/* Background watermark emoji */}
              <div className="absolute -top-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300 text-[10rem]">
                ⚡
              </div>

              {/* Large emoji container */}
              <div className="w-24 h-28 rounded-3xl bg-success flex items-center justify-center flex-shrink-0 text-5xl group-hover:scale-110 transition-transform duration-200">
                ⚡
              </div>

              {/* Text on right */}
              <div className="flex flex-col items-start flex-1">
                <span className="text-2xl font-bold text-foreground">Service Event</span>
                <span className="text-sm text-muted-foreground mt-1">Scan items, select services, create billing</span>
                <span className="flex items-center gap-2 text-success text-xs font-semibold uppercase tracking-wide mt-3">
                  LAUNCH SCANNER ➡️
                </span>
              </div>
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Service Event Scan Screen
  if (mode === 'service') {
    const totalBillingEvents = serviceItems.length * selectedServices.length;

    // Calculate billing preview total
    let billingPreviewTotal = 0;
    let hasRateErrors = false;
    for (const item of serviceItems) {
      for (const service of selectedServices) {
        const rateInfo = getServiceRate(service.service_code, item.class_code);
        if (rateInfo.hasError) hasRateErrors = true;
        billingPreviewTotal += rateInfo.rate;
      }
    }

    return (
      <DashboardLayout>
        <div className="flex flex-col min-h-[70vh] px-4 pb-4">
          <button
            onClick={resetState}
            className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors"
          >
            <MaterialIcon name="arrow_back" size="md" />
            Back
          </button>

          <div className="text-center mb-4">
            <h2 className="text-xl font-bold">Service Event Scan</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Scan items and select services to create billing events
            </p>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT: Items List */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>📦</span>
                  Items ({serviceItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* QR Scanner */}
                <div className="mb-4">
                  <QRScanner
                    onScan={handleScanResult}
                    onError={(error) => console.error('Scanner error:', error)}
                    scanning={true}
                  />
                </div>


                {/* Items List */}
                <div className="flex-1 overflow-auto max-h-64">
                  {serviceItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="text-5xl mb-2 opacity-30">📦</div>
                      <p>No items scanned yet</p>
                      <p className="text-sm">Scan QR codes or search above</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {serviceItems.map((item) => {
                        const hasNoClass = !item.class_code;
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border",
                              hasNoClass ? "border-warning/50 bg-warning/5" : "border-border"
                            )}
                          >
                            <span className="text-xl flex-shrink-0">📦</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-mono font-medium text-sm truncate">{item.item_code}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {item.class_code ? (
                                  <Badge variant="secondary" className="text-xs">
                                    {item.class_code}
                                  </Badge>
                                ) : (
                                  <span className="flex items-center gap-1 text-warning">
                                    ⚠️ No class
                                  </span>
                                )}
                                {item.current_location_code && (
                                  <span>{item.current_location_code}</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => removeServiceItem(item.id)}
                              className="text-destructive hover:bg-destructive/10 p-1 rounded"
                            >
                              <MaterialIcon name="close" size="sm" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* RIGHT: Services Selection */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>💰</span>
                  Services ({selectedServices.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Service Dropdown */}
                <div className="flex gap-2 mb-4">
                  <Select value={serviceToAdd} onValueChange={setServiceToAdd}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a service..." />
                    </SelectTrigger>
                    <SelectContent>
                      {scanServiceEvents
                        .filter(s => !selectedServices.find(sel => sel.service_code === s.service_code))
                        .map((service) => (
                          <SelectItem key={service.service_code} value={service.service_code}>
                            <div className="flex items-center justify-between gap-4">
                              <span>{service.service_name}</span>
                              <span className="text-muted-foreground text-xs">
                                ${service.rate.toFixed(2)}/{service.billing_unit}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => addServiceEvent(serviceToAdd)}
                    disabled={!serviceToAdd}
                    size="icon"
                  >
                    <MaterialIcon name="add" size="sm" />
                  </Button>
                </div>

                {/* Selected Services List */}
                <div className="flex-1 overflow-auto max-h-64">
                  {selectedServices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="text-5xl mb-2 opacity-30">💰</div>
                      <p>No services selected</p>
                      <p className="text-sm">Select services from dropdown above</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedServices.map((service) => (
                        <div
                          key={service.service_code}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border"
                        >
                          <span className="text-xl text-success flex-shrink-0">⚡</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{service.service_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {service.uses_class_pricing ? (
                                <span className="text-info">Class-based pricing</span>
                              ) : (
                                <span>${service.rate.toFixed(2)} / {service.billing_unit}</span>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => removeServiceEvent(service.service_code)}
                            className="text-destructive hover:bg-destructive/10 p-1 rounded"
                          >
                            <MaterialIcon name="close" size="sm" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rate Preview for items without class */}
                {serviceItems.some(i => !i.class_code) && selectedServices.some(s => s.uses_class_pricing) && (
                  <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="text-xl text-warning flex-shrink-0">⚠️</span>
                      <div className="text-sm">
                        <p className="font-medium text-warning">Rate Warning</p>
                        <p className="text-muted-foreground">
                          Some items have no class assigned. Default rates will be used and flagged in billing.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary & Save */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Billing events to create:</p>
                <p className="text-2xl font-bold">
                  {totalBillingEvents}
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({serviceItems.length} items × {selectedServices.length} services)
                  </span>
                </p>
              </div>
              {/* Billing Preview - Manager/Admin Only */}
              {canSeeBilling && billingPreviewTotal > 0 && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Estimated Total</p>
                  <p className="text-2xl font-bold text-primary">
                    ${billingPreviewTotal.toFixed(2)}
                  </p>
                  {hasRateErrors && (
                    <p className="text-xs text-warning flex items-center gap-1 justify-end">
                      <span>⚠️</span> Some items missing class
                    </p>
                  )}
                </div>
              )}
            </div>

            <Button
              onClick={saveServiceEvents}
              disabled={serviceItems.length === 0 || selectedServices.length === 0 || processing}
              className="w-full h-14 text-lg"
              size="lg"
            >
              {processing ? (
                <>
                  <MaterialIcon name="progress_activity" size="md" className="mr-2 animate-spin" />
                  Creating Billing Events...
                </>
              ) : (
                <>
                  <span className="mr-2">💾</span>
                  Save Billing Events
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Item Search Overlay */}
        <ItemSearchOverlay
          open={showItemSearch}
          onClose={() => setShowItemSearch(false)}
          onSelect={handleServiceItemSelect}
          excludeIds={serviceItems.map(i => i.id)}
        />
      </DashboardLayout>
    );
  }

  // Confirmation Screen with Swipe
  if (phase === 'confirm') {
    const items = mode === 'move' && scannedItem ? [scannedItem] : batchItems;
    
    return (
      <DashboardLayout>
        <div className="flex flex-col min-h-[70vh] px-4">
          <button
            onClick={resetState}
            className="flex items-center gap-2 text-muted-foreground mb-6 hover:text-foreground transition-colors"
          >
            <MaterialIcon name="arrow_back" size="md" />
            Cancel
          </button>

          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold">Confirm Move</h2>
            </div>

            <Card className="w-full max-w-md mb-6">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {items.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <span className="text-xl">📦</span>
                      <div>
                        <p className="font-medium">{item.item_code}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.current_location_code || 'No location'} → {targetLocation?.code}
                        </p>
                      </div>
                    </div>
                  ))}
                  {items.length > 3 && (
                    <p className="text-sm text-muted-foreground text-center">
                      +{items.length - 3} more items
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-center gap-4 mt-6 py-4 border-t">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Moving to</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xl text-primary">📍</span>
                      <span className="text-xl font-bold">{targetLocation?.code}</span>
                    </div>
                    {targetLocation?.name && (
                      <p className="text-sm text-muted-foreground">{targetLocation.name}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Swipe to Confirm */}
            <div
              ref={swipeContainerRef}
              className="relative w-full max-w-md h-16 bg-muted rounded-full overflow-hidden cursor-pointer select-none"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleSwipeEnd}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Progress fill */}
              <div
                className={cn("absolute inset-y-0 left-0 bg-primary/20", !isSwiping && "transition-all duration-300")}
                style={{ width: `${swipeProgress * 100}%` }}
              />
              {/* Thumb */}
              <div
                className={cn(
                  "absolute inset-y-1 left-1 w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg",
                  !isSwiping && "transition-transform duration-300",
                  processing && "animate-pulse"
                )}
                style={{ transform: `translateX(${swipeProgress * (swipeContainerRef.current?.offsetWidth || 300 - 72)}px)` }}
              >
                {processing ? '⏳' : swipeProgress >= 1 ? '✅' : '➡️'}
              </div>
              {/* Label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className={cn(
                  "text-muted-foreground font-medium transition-opacity",
                  swipeProgress > 0.2 && "opacity-0"
                )}>
                  Swipe to confirm ➡️
                </span>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Scanning Screen with Camera + Manual Entry
  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-[70vh] px-4 pb-4">
        <button
          onClick={resetState}
          className="flex items-center gap-2 text-muted-foreground mb-4 hover:text-foreground transition-colors"
        >
          <MaterialIcon name="arrow_back" size="md" />
          Back
        </button>

        {/* Title and instructions */}
        <div className="text-center mb-4 relative">
          {/* Help button for movement workflow */}
          {(mode === 'move' || mode === 'batch') && (
            <div className="absolute right-0 top-0">
              <HelpButton workflow="movement" />
            </div>
          )}
          <h2 className="text-xl font-bold">
            {mode === 'lookup' && 'Scan Item'}
            {mode === 'move' && phase === 'scanning-item' && 'Scan Item'}
            {mode === 'move' && phase === 'scanning-location' && 'Scan Location'}
            {mode === 'batch' && 'Scan Items or Location'}
          </h2>
          
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'lookup' && 'Point camera at QR code or search below'}
            {mode === 'move' && phase === 'scanning-item' && 'Scan the item or search below'}
            {mode === 'move' && phase === 'scanning-location' && 'Scan the bay or search below'}
            {mode === 'batch' && 'Scan items continuously, then scan a bay to finish'}
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center">
          {/* Camera Scanner - smaller to fit with manual entry */}
          <div className="w-full max-w-sm mb-4">
            <QRScanner
              onScan={handleScanResult}
              onError={(error) => console.error('Scanner error:', error)}
              scanning={phase === 'scanning-item' || phase === 'scanning-location'}
            />
          </div>

          {/* Visual Verification Section - shows below scanner for Move/Batch modes */}
          {mode !== 'lookup' && (
            <Card className="w-full max-w-md mb-4">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  {/* Item Field */}
                  <button
                    onClick={() => setShowItemSearch(true)}
                    className={cn(
                      "flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-all",
                      scannedItem || (mode === 'batch' && batchItems.length > 0)
                        ? "border-primary bg-primary/5"
                        : "border-dashed border-muted-foreground/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <span className="text-xl flex-shrink-0">📦</span>
                    <div className="flex-1 text-left min-w-0">
                      {mode === 'move' && scannedItem ? (
                        <>
                          <p className="font-mono font-bold text-sm truncate">{scannedItem.item_code}</p>
                          <p className="text-xs text-muted-foreground truncate">{scannedItem.current_location_code || 'No location'}</p>
                        </>
                      ) : mode === 'batch' && batchItems.length > 0 ? (
                        <>
                          <p className="font-bold text-sm">{batchItems.length} items</p>
                          <p className="text-xs text-muted-foreground">Tap to add more</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">Item</p>
                          <p className="text-xs text-muted-foreground/60">Tap to search</p>
                        </>
                      )}
                    </div>
                    {(scannedItem || (mode === 'batch' && batchItems.length > 0)) && (
                      <MaterialIcon name="check" size="sm" className="text-primary flex-shrink-0" />
                    )}
                  </button>

                  {/* Swap Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 flex-shrink-0"
                    onClick={() => {
                      // Swap logic - clear item and start over with location
                      if (scannedItem && targetLocation) {
                        hapticLight();
                        setScannedItem(null);
                        setTargetLocation(null);
                        setPhase('scanning-item');
                        toast({
                          title: 'Cleared',
                          description: 'Scan a new item and location.',
                        });
                      }
                    }}
                    disabled={!scannedItem && batchItems.length === 0}
                    title="Swap / Clear"
                  >
                    <MaterialIcon name="swap_horiz" size="sm" />
                  </Button>

                  {/* Location Field */}
                  <button
                    onClick={() => {
                      if ((scannedItem || batchItems.length > 0)) {
                        setShowLocationSearch(true);
                      }
                    }}
                    disabled={!scannedItem && batchItems.length === 0}
                    className={cn(
                      "flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-all",
                      targetLocation
                        ? "border-primary bg-primary/5"
                        : scannedItem || batchItems.length > 0
                          ? "border-dashed border-primary/50 hover:border-primary animate-pulse"
                          : "border-dashed border-muted-foreground/30 opacity-50"
                    )}
                  >
                    <span className="text-xl flex-shrink-0">📍</span>
                    <div className="flex-1 text-left min-w-0">
                      {targetLocation ? (
                        <>
                          <p className="font-mono font-bold text-sm truncate">{targetLocation.code}</p>
                          <p className="text-xs text-muted-foreground truncate">{targetLocation.name || 'Location'}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">Location</p>
                          <p className="text-xs text-muted-foreground/60">
                            {scannedItem || batchItems.length > 0 ? 'Tap to select' : 'Scan item first'}
                          </p>
                        </>
                      )}
                    </div>
                    {targetLocation && (
                      <MaterialIcon name="check" size="sm" className="text-primary flex-shrink-0" />
                    )}
                  </button>
                </div>

                {/* Quick Proceed Button when both are filled */}
                {((scannedItem && targetLocation) || (batchItems.length > 0 && targetLocation)) && (
                  <Button
                    className="w-full mt-4"
                    onClick={() => setPhase('confirm')}
                  >
                    <MaterialIcon name="check" size="sm" className="mr-2" />
                    Proceed to Confirm
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Processing indicator */}
          {processing && (
            <div className="flex items-center gap-2 text-primary mb-4">
              <MaterialIcon name="progress_activity" size="md" className="animate-spin" />
              <span>Processing...</span>
            </div>
          )}

          {/* Batch: location search button when items added */}
          {mode === 'batch' && batchItems.length > 0 && (
            <div className="w-full max-w-md">
              <button
                onClick={() => setShowLocationSearch(true)}
                className="w-full flex items-center justify-center gap-3 p-4 bg-primary text-primary-foreground rounded-xl transition-colors"
              >
                <span>📍</span>
                <span className="font-medium">Select Destination Bay</span>
              </button>
            </div>
          )}

          {/* Scanned item indicator for move mode */}
          {mode === 'move' && scannedItem && phase === 'scanning-location' && (
            <Card className="w-full max-w-md mt-4">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📦</span>
                  <div className="flex-1">
                    <p className="font-bold">{scannedItem.item_code}</p>
                    <p className="text-sm text-muted-foreground">{scannedItem.description || 'No description'}</p>
                  </div>
                  <span className="text-xl text-muted-foreground">➡️</span>
                  <span className="text-2xl text-muted-foreground">📍</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Batch items list */}
          {mode === 'batch' && batchItems.length > 0 && (
            <Card className="w-full max-w-md mt-4">
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">Batch: {batchItems.length} items</span>
                  <button
                    onClick={() => setBatchItems([])}
                    className="text-sm text-destructive hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {batchItems.map((item) => (
                    <Badge key={item.id} variant="secondary" className="text-sm">
                      {item.item_code}
                      <button
                        onClick={() => setBatchItems(prev => prev.filter(i => i.id !== item.id))}
                        className="ml-1 hover:text-destructive"
                      >
                        <MaterialIcon name="close" size="sm" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Search Overlays */}
      <ItemSearchOverlay
        open={showItemSearch}
        onClose={() => setShowItemSearch(false)}
        onSelect={handleItemSelect}
        excludeIds={mode === 'batch' ? batchItems.map(i => i.id) : []}
      />

      <LocationSearchOverlay
        open={showLocationSearch}
        onClose={() => setShowLocationSearch(false)}
        onSelect={handleLocationSelect}
        locations={locationData}
      />
    </DashboardLayout>
  );
}
