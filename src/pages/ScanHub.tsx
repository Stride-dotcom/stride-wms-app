import { useState, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLocations } from '@/hooks/useLocations';
import { QRScanner } from '@/components/scan/QRScanner';
import { ItemSearchOverlay, LocationSearchOverlay } from '@/components/scan/SearchOverlays';
import {
  hapticLight,
  hapticMedium,
  hapticSuccess,
  hapticError,
} from '@/lib/haptics';
import {
  Move,
  Layers,
  Search,
  ArrowRight,
  CheckCircle,
  Package,
  MapPin,
  Loader2,
  X,
  ArrowLeft,
  ChevronRight,
  Keyboard,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScannedItem {
  id: string;
  item_code: string;
  description: string | null;
  current_location_code: string | null;
  warehouse_name: string | null;
}

interface ScannedLocation {
  id: string;
  code: string;
  name: string | null;
}

type ScanMode = 'move' | 'batch' | 'lookup' | null;
type ScanPhase = 'idle' | 'scanning-item' | 'scanning-location' | 'confirm';

export default function ScanHub() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { locations } = useLocations();
  
  const [mode, setMode] = useState<ScanMode>(null);
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [processing, setProcessing] = useState(false);
  
  // Move mode state
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null);
  const [targetLocation, setTargetLocation] = useState<ScannedLocation | null>(null);
  
  // Batch move state
  const [batchItems, setBatchItems] = useState<ScannedItem[]>([]);
  
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

  const lookupLocation = async (input: string): Promise<ScannedLocation | null> => {
    const payload = parseQRPayload(input);
    if (!payload) return null;

    // Check if it's a location QR
    if (payload.type === 'location' && payload.id) {
      const loc = locations.find(l => l.id === payload.id);
      if (loc) {
        return { id: loc.id, code: loc.code, name: loc.name };
      }
    }
    
    // Try matching by code
    const loc = locations.find(l => 
      l.code.toLowerCase() === (payload.code || input).toLowerCase()
    );
    if (loc) {
      return { id: loc.id, code: loc.code, name: loc.name };
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
  const handleLocationSelect = (loc: ScannedLocation) => {
    setShowLocationSearch(false);
    hapticMedium(); // Location selected
    setTargetLocation(loc);
    setPhase('confirm');
  };

  const executeMove = async () => {
    if (!targetLocation) return;
    
    setProcessing(true);
    try {
      const items = mode === 'move' && scannedItem ? [scannedItem] : batchItems;
      let successCount = 0;

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
      toast({
        title: 'Move Complete',
        description: `Moved ${successCount} item${successCount !== 1 ? 's' : ''} to ${targetLocation.code}`,
      });

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
    setSwipeProgress(0);
    setShowItemSearch(false);
    setShowLocationSearch(false);
  };

  const selectMode = (selectedMode: ScanMode) => {
    hapticLight(); // Mode selection feedback
    setMode(selectedMode);
    setPhase('scanning-item');
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
    if (swipeProgress > 0.85) {
      executeMove();
    }
    setIsSwiping(false);
    setSwipeProgress(0);
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
          <PageHeader
            primaryText="Scan"
            accentText="Hub"
            description="High-speed warehouse operations hub"
          />
          
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
              {/* Background watermark icon */}
              <div className="absolute -top-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                <Move className="h-40 w-40 text-primary" />
              </div>
              
              {/* Large icon container */}
              <div className="w-24 h-28 rounded-3xl bg-primary flex items-center justify-center flex-shrink-0">
                <Move className="h-12 w-12 text-primary-foreground group-hover:scale-110 transition-transform duration-200" />
              </div>
              
              {/* Text on right */}
              <div className="flex flex-col items-start flex-1">
                <span className="text-2xl font-bold text-foreground">Move</span>
                <span className="text-sm text-muted-foreground mt-1">Scan item, then scan destination</span>
                <span className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wide mt-3">
                  LAUNCH SCANNER <ArrowRight className="h-4 w-4" />
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
              {/* Background watermark icon */}
              <div className="absolute -top-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                <Layers className="h-40 w-40 text-muted-foreground" />
              </div>
              
              {/* Large icon container */}
              <div className="w-24 h-28 rounded-3xl bg-secondary flex items-center justify-center flex-shrink-0">
                <Layers className="h-12 w-12 text-foreground group-hover:scale-110 transition-transform duration-200" />
              </div>
              
              {/* Text on right */}
              <div className="flex flex-col items-start flex-1">
                <span className="text-2xl font-bold text-foreground">Batch Move</span>
                <span className="text-sm text-muted-foreground mt-1">Scan multiple items, then scan destination</span>
                <span className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide mt-3">
                  LAUNCH SCANNER <ArrowRight className="h-4 w-4" />
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
              {/* Background watermark icon */}
              <div className="absolute -top-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                <Search className="h-40 w-40 text-info" />
              </div>
              
              {/* Large icon container */}
              <div className="w-24 h-28 rounded-3xl bg-info flex items-center justify-center flex-shrink-0">
                <Search className="h-12 w-12 text-info-foreground group-hover:scale-110 transition-transform duration-200" />
              </div>
              
              {/* Text on right */}
              <div className="flex flex-col items-start flex-1">
                <span className="text-2xl font-bold text-foreground">Look Up</span>
                <span className="text-sm text-muted-foreground mt-1">Scan to view item details</span>
                <span className="flex items-center gap-2 text-info text-xs font-semibold uppercase tracking-wide mt-3">
                  LAUNCH SCANNER <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </button>
          </div>
        </div>
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
            <ArrowLeft className="h-5 w-5" />
            Cancel
          </button>

          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center mb-8">
              <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Confirm Move</h2>
            </div>

            <Card className="w-full max-w-md mb-6">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {items.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-muted-foreground" />
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
                      <MapPin className="h-5 w-5 text-primary" />
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
              <div
                className="absolute inset-y-0 left-0 bg-primary/20 transition-all"
                style={{ width: `${swipeProgress * 100}%` }}
              />
              <div
                className={cn(
                  "absolute inset-y-1 left-1 w-14 h-14 rounded-full bg-primary flex items-center justify-center transition-all shadow-lg",
                  processing && "animate-pulse"
                )}
                style={{ transform: `translateX(${swipeProgress * (swipeContainerRef.current?.offsetWidth || 300 - 72)}px)` }}
              >
                {processing ? (
                  <Loader2 className="h-6 w-6 text-primary-foreground animate-spin" />
                ) : (
                  <ChevronRight className="h-6 w-6 text-primary-foreground" />
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className={cn(
                  "text-muted-foreground font-medium transition-opacity",
                  swipeProgress > 0.3 && "opacity-0"
                )}>
                  Swipe to confirm →
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
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>

        {/* Title and instructions */}
        <div className="text-center mb-4">
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

          {/* Processing indicator */}
          {processing && (
            <div className="flex items-center gap-2 text-primary mb-4">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Processing...</span>
            </div>
          )}

          {/* Manual Entry Button - Always visible */}
          <div className="w-full max-w-md space-y-3">
            {/* Item search button - show when scanning items */}
            {(phase === 'scanning-item' || mode === 'batch') && (
              <button
                onClick={() => setShowItemSearch(true)}
                className="w-full flex items-center justify-center gap-3 p-4 bg-muted hover:bg-muted/80 rounded-xl transition-colors"
              >
                <Keyboard className="h-5 w-5" />
                <span className="font-medium">
                  {mode === 'batch' ? 'Search & Add Item' : 'Search Item by Code'}
                </span>
              </button>
            )}

            {/* Location search button - show when scanning location */}
            {phase === 'scanning-location' && (
              <button
                onClick={() => setShowLocationSearch(true)}
                className="w-full flex items-center justify-center gap-3 p-4 bg-muted hover:bg-muted/80 rounded-xl transition-colors"
              >
                <MapPin className="h-5 w-5" />
                <span className="font-medium">Search Bay/Location</span>
              </button>
            )}

            {/* Batch: location search button when items added */}
            {mode === 'batch' && batchItems.length > 0 && (
              <button
                onClick={() => setShowLocationSearch(true)}
                className="w-full flex items-center justify-center gap-3 p-4 bg-primary text-primary-foreground rounded-xl transition-colors"
              >
                <MapPin className="h-5 w-5" />
                <span className="font-medium">Select Destination Bay</span>
              </button>
            )}
          </div>

          {/* Scanned item indicator for move mode */}
          {mode === 'move' && scannedItem && phase === 'scanning-location' && (
            <Card className="w-full max-w-md mt-4">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <Package className="h-6 w-6 text-primary" />
                  <div className="flex-1">
                    <p className="font-bold">{scannedItem.item_code}</p>
                    <p className="text-sm text-muted-foreground">{scannedItem.description || 'No description'}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <MapPin className="h-6 w-6 text-muted-foreground" />
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
                        <X className="h-3 w-3" />
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
