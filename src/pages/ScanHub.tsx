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
import { useAuth } from '@/contexts/AuthContext';
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
import { logItemActivity } from '@/lib/activity/logItemActivity';
import { ScanModeIcon } from '@/components/scan/ScanModeIcon';
import { HelpButton } from '@/components/prompts';
import { SOPValidationDialog, SOPBlocker } from '@/components/common/SOPValidationDialog';
import { useLocationSuggestions, type LocationSuggestion } from '@/hooks/useLocationSuggestions';
import { SuggestionPanel } from '@/components/scanhub/SuggestionPanel';
import { CrossWarehouseBanner } from '@/components/scanhub/CrossWarehouseBanner';
import { OverrideConfirmModal, type OverrideReason } from '@/components/scanhub/OverrideConfirmModal';
import { useSelectedWarehouse } from '@/contexts/WarehouseContext';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  const { profile } = useAuth();
  const { locations } = useLocations();
  const { checkFreeze } = useStocktakeFreezeCheck();
  const { scanServiceEvents, getServiceRate, createBillingEvents, loading: serviceEventsLoading } = useServiceEvents();
  const { collapseSidebar } = useSidebar();
  const { hasRole } = usePermissions();
  const { selectedWarehouseId, warehouses: contextWarehouses } = useSelectedWarehouse();

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

  // SOP Validation state
  const [sopValidationOpen, setSopValidationOpen] = useState(false);
  const [sopBlockers, setSopBlockers] = useState<SOPBlocker[]>([]);

  // Quarantine warning state
  const [quarantineWarningOpen, setQuarantineWarningOpen] = useState(false);
  const [quarantineItem, setQuarantineItem] = useState<ScannedItem | null>(null);
  const [quarantinePendingAction, setQuarantinePendingAction] = useState<(() => void) | null>(null);

  // Location suggestions state
  const [suggestionsWarehouseId, setSuggestionsWarehouseId] = useState<string | undefined>();
  const [suggestionsWarning, setSuggestionsWarning] = useState<string | null>(null);

  // Cross-warehouse mismatch state
  const [crossWarehouseInfo, setCrossWarehouseInfo] = useState<{
    itemWarehouse: string;
    destWarehouse: string;
    isMixedBatch?: boolean;
  } | null>(null);

  // Override modal state
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideBlockingReasons, setOverrideBlockingReasons] = useState<OverrideReason[]>([]);
  const [overrideAllReasons, setOverrideAllReasons] = useState<OverrideReason[]>([]);
  const [overrideResolve, setOverrideResolve] = useState<((confirmed: boolean) => void) | null>(null);

  // Swipe confirmation state
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const swipeStartX = useRef(0);
  const swipeContainerRef = useRef<HTMLDivElement>(null);

  // Derive warehouse_id for suggestions.
  // Precedence: item-derived (authoritative) → selectedWarehouseId (fallback) → disabled.
  useEffect(() => {
    setSuggestionsWarning(null);

    if (mode === 'move' && scannedItem) {
      if (scannedItem.current_location_code) {
        const loc = locations.find(l => l.code === scannedItem.current_location_code);
        if (loc) {
          // Item warehouse is authoritative
          setSuggestionsWarehouseId(loc.warehouse_id);
          return;
        }
      }
      // Can't derive from item — fall back to shared selection
      if (selectedWarehouseId) {
        setSuggestionsWarehouseId(selectedWarehouseId);
        return;
      }
      setSuggestionsWarehouseId(undefined);
      return;
    }

    if (mode === 'batch' && batchItems.length > 0) {
      const warehouseIds = new Set<string>();
      for (const item of batchItems) {
        if (item.current_location_code) {
          const loc = locations.find(l => l.code === item.current_location_code);
          if (loc) warehouseIds.add(loc.warehouse_id);
        }
      }

      if (warehouseIds.size === 1) {
        setSuggestionsWarehouseId([...warehouseIds][0]);
        return;
      }

      if (warehouseIds.size > 1) {
        setSuggestionsWarning('Items span multiple warehouses. Suggestions unavailable \u2014 select a single-warehouse batch.');
        setSuggestionsWarehouseId(undefined);
        return;
      }

      // No items had a resolvable warehouse
      setSuggestionsWarehouseId(undefined);
      return;
    }

    // No items scanned yet — use shared selection if available
    if (selectedWarehouseId) {
      setSuggestionsWarehouseId(selectedWarehouseId);
    } else {
      setSuggestionsWarehouseId(undefined);
    }
  }, [scannedItem, batchItems, locations, mode, selectedWarehouseId]);

  // Location suggestions hook
  const suggestionsEnabled =
    (mode === 'move' && !!scannedItem) || (mode === 'batch' && batchItems.length > 0);

  const {
    suggestions,
    loading: suggestionsLoading,
    error: suggestionsError,
    refetch: refetchSuggestions,
  } = useLocationSuggestions({
    tenantId: profile?.tenant_id,
    warehouseId: suggestionsWarehouseId,
    mode: mode === 'batch' ? 'batch' : 'single',
    itemId: mode === 'move' ? scannedItem?.id : undefined,
    itemIds: mode === 'batch' ? batchItems.map(i => i.id) : undefined,
    enabled: suggestionsEnabled,
  });

  // Cross-warehouse mismatch detection
  useEffect(() => {
    if (!targetLocation) {
      setCrossWarehouseInfo(null);
      return;
    }

    const destLoc = locations.find(l => l.id === targetLocation.id);
    if (!destLoc?.warehouse_id) {
      setCrossWarehouseInfo(null);
      return;
    }

    // Determine item warehouse
    let itemWarehouseId: string | undefined;
    let itemWarehouseName: string | undefined;
    let isMixedBatch = false;

    if (mode === 'move' && scannedItem) {
      const itemLoc = locations.find(l => l.code === scannedItem.current_location_code);
      itemWarehouseId = itemLoc?.warehouse_id;
      itemWarehouseName = scannedItem.warehouse_name || undefined;
    } else if (mode === 'batch' && batchItems.length > 0) {
      const warehouseIds = new Set<string>();
      for (const item of batchItems) {
        if (item.current_location_code) {
          const loc = locations.find(l => l.code === item.current_location_code);
          if (loc) warehouseIds.add(loc.warehouse_id);
        }
      }
      if (warehouseIds.size === 1) {
        itemWarehouseId = [...warehouseIds][0];
      } else if (warehouseIds.size > 1) {
        isMixedBatch = true;
      }
    }

    if (isMixedBatch) {
      const destWh = contextWarehouses.find(w => w.id === destLoc.warehouse_id);
      setCrossWarehouseInfo({
        itemWarehouse: 'multiple warehouses',
        destWarehouse: destWh?.name || 'Unknown',
        isMixedBatch: true,
      });
      return;
    }

    if (itemWarehouseId && destLoc.warehouse_id !== itemWarehouseId) {
      const destWh = contextWarehouses.find(w => w.id === destLoc.warehouse_id);
      const itemWh = contextWarehouses.find(w => w.id === itemWarehouseId);
      setCrossWarehouseInfo({
        itemWarehouse: itemWarehouseName || itemWh?.name || 'Unknown',
        destWarehouse: destWh?.name || 'Unknown',
      });
    } else {
      setCrossWarehouseInfo(null);
    }
  }, [targetLocation, scannedItem, batchItems, locations, mode, contextWarehouses]);

  // Override modal helpers
  const openOverrideModalAndAwait = (
    blockingReasons: OverrideReason[],
    allReasons: OverrideReason[],
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setOverrideBlockingReasons(blockingReasons);
      setOverrideAllReasons(allReasons);
      setOverrideResolve(() => resolve);
      setOverrideModalOpen(true);
    });
  };

  const handleOverrideConfirm = () => {
    setOverrideModalOpen(false);
    if (overrideResolve) overrideResolve(true);
    setOverrideResolve(null);
  };

  const handleOverrideCancel = () => {
    setOverrideModalOpen(false);
    if (overrideResolve) overrideResolve(false);
    setOverrideResolve(null);
  };

  // Evaluate override reasons for a destination location
  const evaluateOverrideReasons = async (
    destLocationId: string,
    items: ScannedItem[],
  ): Promise<{
    allReasons: OverrideReason[];
    blockingReasons: OverrideReason[];
    requiredVolume: number;
    preUtilization: number;
    postUtilization: number;
    itemDataForAudit: Array<{ id: string; current_location_id: string | null }>;
  }> => {
    const allReasons: OverrideReason[] = [];
    const blockingReasons: OverrideReason[] = [];

    // Fetch item sizes and current location IDs
    const itemIds = items.map(i => i.id);
    const { data: itemData } = await (supabase as any)
      .from('items')
      .select('id, size, current_location_id')
      .in('id', itemIds);

    const requiredVolume = (itemData || []).reduce(
      (sum: number, i: { size: number | null }) => sum + (i.size || 0),
      0,
    );

    // Check if destination is in the suggestions
    const destSuggestion = suggestions.find((s: LocationSuggestion) => s.location_id === destLocationId);

    let destCapacity = 0;
    let destUsed = 0;
    let destAvailable = 0;
    let destUtilPct = 0;
    let destFlagCompliant = true;

    if (destSuggestion) {
      destCapacity = destSuggestion.capacity_cuft;
      destUsed = destSuggestion.used_cuft;
      destAvailable = destSuggestion.available_cuft;
      destUtilPct = destSuggestion.utilization_pct;
      destFlagCompliant = destSuggestion.flag_compliant;
    } else {
      // Strategy (b): Query location_capacity_cache + locations for non-suggested destination
      const { data: cacheData } = await (supabase
        .from('location_capacity_cache') as any)
        .select('used_cuft, available_cuft, utilization_pct')
        .eq('location_id', destLocationId)
        .maybeSingle();

      const { data: locData } = await (supabase
        .from('locations') as any)
        .select('capacity_cuft')
        .eq('id', destLocationId)
        .maybeSingle();

      destCapacity = locData?.capacity_cuft ? Number(locData.capacity_cuft) : 0;
      destUsed = cacheData?.used_cuft ? Number(cacheData.used_cuft) : 0;
      destAvailable = cacheData?.available_cuft != null ? Number(cacheData.available_cuft) : destCapacity;
      destUtilPct = cacheData?.utilization_pct ? Number(cacheData.utilization_pct) : 0;

      // Flag compliance check for non-suggested destination
      if (profile?.tenant_id && itemData && itemData.length > 0) {
        try {
          const { data: itemFlags } = await (supabase as any)
            .from('item_flags')
            .select('service_code')
            .eq('item_id', itemData[0].id)
            .eq('tenant_id', profile.tenant_id);

          if (itemFlags && itemFlags.length > 0) {
            const { data: locFlags } = await (supabase as any)
              .from('location_flag_links')
              .select('service_code')
              .eq('location_id', destLocationId)
              .eq('tenant_id', profile.tenant_id);

            const locFlagCodes = new Set(
              (locFlags || []).map((f: { service_code: string }) => f.service_code),
            );
            destFlagCompliant = (itemFlags as Array<{ service_code: string }>).every(
              f => locFlagCodes.has(f.service_code),
            );
          }
        } catch {
          // If flag check fails, default to compliant (non-blocking)
          destFlagCompliant = true;
        }
      }
    }

    // Compute predicted utilization
    if (destCapacity > 0) {
      const predictedUsed = destUsed + requiredVolume;
      const predictedUtil = predictedUsed / destCapacity;

      if (predictedUtil >= 0.90) {
        allReasons.push('OVER_UTILIZATION');
        blockingReasons.push('OVER_UTILIZATION');
      }

      if (requiredVolume > destAvailable) {
        allReasons.push('OVERFLOW');
        blockingReasons.push('OVERFLOW');
      }
    }

    if (!destFlagCompliant) {
      allReasons.push('FLAG_MISMATCH');
      blockingReasons.push('FLAG_MISMATCH');
    }

    // MIXED_SOURCE_BATCH (informational only)
    if (items.length > 1 && itemData) {
      const distinctLocations = new Set(
        (itemData as Array<{ current_location_id: string | null }>)
          .map(i => i.current_location_id)
          .filter(Boolean),
      );
      if (distinctLocations.size > 1) {
        allReasons.push('MIXED_SOURCE_BATCH');
      }
    }

    const postUtilization = destCapacity > 0
      ? (destUsed + requiredVolume) / destCapacity
      : 0;

    return {
      allReasons,
      blockingReasons,
      requiredVolume,
      preUtilization: destUtilPct,
      postUtilization,
      itemDataForAudit: (itemData || []).map((i: { id: string; current_location_id: string | null }) => ({
        id: i.id,
        current_location_id: i.current_location_id,
      })),
    };
  };

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

  // Check if an item has a quarantine flag
  const checkQuarantine = async (itemId: string): Promise<boolean> => {
    if (!profile?.tenant_id) return false;
    try {
      // Look up the quarantine flag charge type
      const { data: quarantineFlag } = await (supabase
        .from('charge_types') as any)
        .select('charge_code')
        .eq('tenant_id', profile.tenant_id)
        .eq('add_flag', true)
        .eq('flag_is_indicator', true)
        .ilike('charge_name', '%quarantine%')
        .maybeSingle();

      if (!quarantineFlag) return false;

      const { data: flag } = await (supabase
        .from('item_flags') as any)
        .select('id')
        .eq('item_id', itemId)
        .eq('service_code', quarantineFlag.charge_code)
        .maybeSingle();

      return !!flag;
    } catch {
      return false;
    }
  };

  // Handle quarantine override - log to activity history
  const handleQuarantineOverride = () => {
    if (!quarantineItem || !profile?.tenant_id || !profile?.id) return;

    // Log the override
    logItemActivity({
      tenantId: profile.tenant_id,
      itemId: quarantineItem.id,
      actorUserId: profile.id,
      eventType: 'quarantine_override',
      eventLabel: `Quarantine warning overridden during scan (${mode} mode)`,
      details: { scan_mode: mode, item_code: quarantineItem.item_code },
    });

    // Execute the pending action
    if (quarantinePendingAction) {
      quarantinePendingAction();
    }

    setQuarantineWarningOpen(false);
    setQuarantineItem(null);
    setQuarantinePendingAction(null);
  };

  // Dismiss quarantine warning (go back)
  const handleQuarantineDismiss = () => {
    setQuarantineWarningOpen(false);
    setQuarantineItem(null);
    setQuarantinePendingAction(null);
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

          // Check for quarantine
          const isQuarantined = await checkQuarantine(item.id);
          if (isQuarantined) {
            hapticError();
            setQuarantineItem(item);
            setQuarantinePendingAction(() => () => navigate(`/inventory/${item.id}`));
            setQuarantineWarningOpen(true);
            setProcessing(false);
            return;
          }

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

            // Check for quarantine
            const isQuarantined = await checkQuarantine(item.id);
            if (isQuarantined) {
              hapticError();
              setQuarantineItem(item);
              setQuarantinePendingAction(() => () => {
                setScannedItem(item);
                setPhase('scanning-location');
                toast({
                  title: `Found: ${item.item_code}`,
                  description: 'Now scan the destination bay.',
                });
              });
              setQuarantineWarningOpen(true);
              setProcessing(false);
              return;
            }

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
      const itemIds = items.map(i => i.id);

      // === Override evaluation gate ===
      let overrideResult: {
        allReasons: OverrideReason[];
        blockingReasons: OverrideReason[];
        requiredVolume: number;
        preUtilization: number;
        postUtilization: number;
        itemDataForAudit: Array<{ id: string; current_location_id: string | null }>;
      } | null = null;

      try {
        overrideResult = await evaluateOverrideReasons(targetLocation.id, items);
      } catch (evalErr) {
        // Override evaluation failures must NEVER block moves
        console.error('[ScanHub] Override evaluation failed (non-blocking):', evalErr);
      }

      if (overrideResult && overrideResult.blockingReasons.length > 0) {
        const confirmed = await openOverrideModalAndAwait(
          overrideResult.blockingReasons,
          overrideResult.allReasons,
        );
        if (!confirmed) {
          setProcessing(false);
          return;
        }
      }
      // === End override evaluation gate ===

      // Call SOP validator RPC first
      const { data: validationResult, error: rpcError } = await (supabase as any).rpc(
        'validate_movement_event',
        { 
          p_item_ids: itemIds,
          p_destination_location_id: targetLocation.id
        }
      );

      if (rpcError) {
        console.error('Validation RPC error:', rpcError);
        hapticError();
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Failed to validate movement. Please try again.',
        });
        setProcessing(false);
        return;
      }

      const result = validationResult as { ok: boolean; blockers: SOPBlocker[] };
      const blockers = (result?.blockers || []).filter(
        (b: SOPBlocker) => b.severity === 'blocking' || !b.severity
      );

      if (!result?.ok && blockers.length > 0) {
        setSopBlockers(result.blockers);
        setSopValidationOpen(true);
        hapticError();
        setProcessing(false);
        return;
      }

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

      // Log activity per item
      if (profile?.tenant_id) {
        for (const item of items) {
          logItemActivity({
            tenantId: profile.tenant_id,
            itemId: item.id,
            actorUserId: profile.id,
            eventType: 'item_moved',
            eventLabel: `Moved to ${targetLocation.code}`,
            details: { from_location: item.current_location_code, to_location: targetLocation.code, to_location_id: targetLocation.id },
          });
        }
      }

      // Log override audit if an override was confirmed
      if (overrideResult && overrideResult.blockingReasons.length > 0 && profile?.tenant_id) {
        for (const item of items) {
          const itemAudit = overrideResult.itemDataForAudit.find(d => d.id === item.id);
          logItemActivity({
            tenantId: profile.tenant_id,
            itemId: item.id,
            actorUserId: profile.id,
            eventType: 'location_override',
            eventLabel: `Override: moved to ${targetLocation.code}`,
            details: {
              type: 'LOCATION_OVERRIDE',
              from_location_id: itemAudit?.current_location_id || null,
              to_location_id: targetLocation.id,
              reasons: overrideResult.allReasons,
              required_volume: overrideResult.requiredVolume,
              pre_utilization: overrideResult.preUtilization,
              post_utilization: overrideResult.postUtilization,
              metadata: {
                mode: mode === 'move' ? 'single' : 'batch',
                scanned_location_code: targetLocation.code,
                suggestions_present: suggestions.length > 0,
                overflow: suggestions.some(s => s.overflow),
              },
            },
          });
        }
      }

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

    // Pre-validate: block if any class-based services selected for items without class
    const classBasedServiceCodes = selectedServices.filter(s => s.uses_class_pricing);
    if (classBasedServiceCodes.length > 0) {
      const itemsWithoutClass = serviceItems.filter(i => !i.class_code);
      if (itemsWithoutClass.length > 0) {
        hapticError();
        const itemCodes = itemsWithoutClass.map(i => i.item_code).join(', ');
        const serviceCodes = classBasedServiceCodes.map(s => s.service_name).join(', ');
        toast({
          variant: 'destructive',
          title: 'Item class required',
          description: `Cannot apply class-based service${classBasedServiceCodes.length > 1 ? 's' : ''} (${serviceCodes}) to item${itemsWithoutClass.length > 1 ? 's' : ''} without a class: ${itemCodes}. Assign a class or remove these items first.`,
        });
        return;
      }
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
              {/* Large icon container */}
              <div className="w-24 h-28 rounded-3xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                <ScanModeIcon mode="move" size={64} />
              </div>

              {/* Text on right */}
              <div className="flex flex-col items-start flex-1">
                <span className="text-2xl font-bold text-foreground">Move</span>
                <span className="text-sm text-muted-foreground mt-1">Scan item, then scan destination</span>
                <span className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wide mt-3">
                  LAUNCH SCANNER
                  <MaterialIcon name="arrow_forward" size="sm" />
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
                "hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10"
              )}
            >
              {/* Large icon container */}
              <div className="w-24 h-28 rounded-3xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                <ScanModeIcon mode="batch-move" size={64} />
              </div>

              {/* Text on right */}
              <div className="flex flex-col items-start flex-1">
                <span className="text-2xl font-bold text-foreground">Batch Move</span>
                <span className="text-sm text-muted-foreground mt-1">Scan multiple items, then scan destination</span>
                <span className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-xs font-semibold uppercase tracking-wide mt-3">
                  LAUNCH SCANNER
                  <MaterialIcon name="arrow_forward" size="sm" />
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
                "hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10"
              )}
            >
              {/* Large icon container */}
              <div className="w-24 h-28 rounded-3xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                <ScanModeIcon mode="lookup" size={64} />
              </div>

              {/* Text on right */}
              <div className="flex flex-col items-start flex-1">
                <span className="text-2xl font-bold text-foreground">Look Up</span>
                <span className="text-sm text-muted-foreground mt-1">Scan to view item details</span>
                <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wide mt-3">
                  LAUNCH SCANNER
                  <MaterialIcon name="arrow_forward" size="sm" />
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
                "hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10"
              )}
            >
              {/* Large icon container */}
              <div className="w-24 h-28 rounded-3xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                <ScanModeIcon mode="service-event" size={64} />
              </div>

              {/* Text on right */}
              <div className="flex flex-col items-start flex-1">
                <span className="text-2xl font-bold text-foreground">Service Event</span>
                <span className="text-sm text-muted-foreground mt-1">Scan items, select services, create billing</span>
                <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wide mt-3">
                  LAUNCH SCANNER
                  <MaterialIcon name="arrow_forward" size="sm" />
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
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <MaterialIcon name="error" size="sm" className="text-destructive flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-destructive">Item class required</p>
                        <p className="text-muted-foreground">
                          Some items have no class assigned. Saving is blocked until these items are removed or a class is assigned.
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

          {/* Cross-warehouse mismatch banner */}
          {crossWarehouseInfo && (
            <CrossWarehouseBanner
              itemWarehouse={crossWarehouseInfo.itemWarehouse}
              destWarehouse={crossWarehouseInfo.destWarehouse}
              isMixedBatch={crossWarehouseInfo.isMixedBatch}
            />
          )}

          {/* Location Suggestions Panel */}
          {(mode === 'move' || mode === 'batch') && suggestionsWarning && (
            <div className="w-full max-w-md mt-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 flex items-center gap-2">
              <MaterialIcon name="warning" size="sm" />
              {suggestionsWarning}
            </div>
          )}
          {(mode === 'move' || mode === 'batch') && suggestionsEnabled && !suggestionsWarning && (
            <SuggestionPanel
              suggestions={suggestions}
              loading={suggestionsLoading}
              error={suggestionsError}
              mode={mode === 'batch' ? 'batch' : 'single'}
              onRefresh={refetchSuggestions}
              matchChipLabel={scannedItem?.item_code ? 'SKU match' : 'Item match'}
            />
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
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Batch: {batchItems.length} items</span>
                    {/* Add item button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowItemSearch(true)}
                      className="h-7 w-7 p-0 rounded-full bg-primary/10 hover:bg-primary/20"
                    >
                      <MaterialIcon name="add" size="sm" className="text-primary" />
                    </Button>
                  </div>
                  <button
                    onClick={() => setBatchItems([])}
                    className="text-sm text-destructive hover:underline"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {batchItems.map((item) => (
                    <Badge key={item.id} variant="secondary" className="text-sm pl-2.5 pr-1 py-1 gap-1">
                      {item.item_code}
                      <button
                        onClick={() => setBatchItems(prev => prev.filter(i => i.id !== item.id))}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-destructive/20 hover:text-destructive transition-colors"
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

      {/* SOP Validation Dialog */}
      <SOPValidationDialog
        open={sopValidationOpen}
        onOpenChange={setSopValidationOpen}
        blockers={sopBlockers}
      />

      {/* Override Confirmation Modal */}
      <OverrideConfirmModal
        open={overrideModalOpen}
        onOpenChange={(open) => { if (!open) handleOverrideCancel(); }}
        blockingReasons={overrideBlockingReasons}
        allReasons={overrideAllReasons}
        onConfirm={handleOverrideConfirm}
        onCancel={handleOverrideCancel}
      />

      {/* Quarantine Warning Dialog */}
      <AlertDialog open={quarantineWarningOpen} onOpenChange={handleQuarantineDismiss}>
        <AlertDialogContent className="border-red-300 dark:border-red-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <MaterialIcon name="warning" size="md" />
              Item Quarantined
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="text-base font-medium text-foreground">
                {quarantineItem?.item_code} is under quarantine due to reported damage.
              </p>
              <p>
                This item should not be moved, released, or processed until the issue is resolved.
                Proceeding will log an override in the activity history.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={handleQuarantineDismiss}>
              Go Back
            </Button>
            <Button variant="destructive" onClick={handleQuarantineOverride}>
              Override &amp; Continue
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
