import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLocations } from '@/hooks/useLocations';
import { useWarehouses } from '@/hooks/useWarehouses';
import {
  QrCode,
  Move,
  Layers,
  Search,
  ArrowRight,
  CheckCircle,
  Package,
  MapPin,
  Loader2,
  X,
  Camera,
} from 'lucide-react';

interface ScannedItem {
  id: string;
  item_code: string;
  description: string | null;
  current_location_code: string | null;
  warehouse_name: string | null;
}

type ScanMode = 'move' | 'batch' | 'lookup';

export default function ScanHub() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { locations } = useLocations();
  const { warehouses } = useWarehouses();
  
  const [mode, setMode] = useState<ScanMode>('move');
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  
  // Move mode state
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null);
  const [targetLocation, setTargetLocation] = useState('');
  const [moving, setMoving] = useState(false);
  
  // Batch move state
  const [batchItems, setBatchItems] = useState<ScannedItem[]>([]);
  const [batchTargetLocation, setBatchTargetLocation] = useState('');
  const [batchMoving, setBatchMoving] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [movedCount, setMovedCount] = useState(0);

  // Focus input on mode change
  useEffect(() => {
    scanInputRef.current?.focus();
  }, [mode]);

  const parseQRPayload = (input: string): { type: string; id: string; code?: string } | null => {
    try {
      // Try parsing as JSON (our QR format)
      const parsed = JSON.parse(input);
      if (parsed.type && parsed.id) {
        return parsed;
      }
    } catch {
      // Not JSON, treat as item code
      return { type: 'item', id: '', code: input.trim() };
    }
    return null;
  };

  const lookupItem = async (input: string): Promise<ScannedItem | null> => {
    const payload = parseQRPayload(input);
    if (!payload) return null;

    let query = supabase
      .from('v_items_with_location')
      .select('id, item_code, description, location_code, warehouse_name');

    if (payload.id) {
      query = query.eq('id', payload.id);
    } else if (payload.code) {
      query = query.eq('item_code', payload.code);
    } else {
      return null;
    }

    const { data, error } = await query.single();
    
    if (error || !data) return null;
    
    return {
      id: data.id,
      item_code: data.item_code,
      description: data.description,
      current_location_code: data.location_code,
      warehouse_name: data.warehouse_name,
    };
  };

  const handleScan = async () => {
    if (!scanInput.trim()) return;

    setScanning(true);
    
    try {
      const item = await lookupItem(scanInput);
      
      if (!item) {
        toast({
          variant: 'destructive',
          title: 'Item Not Found',
          description: 'No item found with that code or QR data.',
        });
        setScanInput('');
        scanInputRef.current?.focus();
        return;
      }

      if (mode === 'lookup') {
        // Navigate directly to item detail page
        navigate(`/inventory/${item.id}`);
      } else if (mode === 'move') {
        setScannedItem(item);
        setScanInput('');
      } else if (mode === 'batch') {
        // Add to batch if not already present
        if (!batchItems.find(i => i.id === item.id)) {
          setBatchItems(prev => [...prev, item]);
        } else {
          toast({
            title: 'Already Added',
            description: `${item.item_code} is already in the batch.`,
          });
        }
        setScanInput('');
        scanInputRef.current?.focus();
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast({
        variant: 'destructive',
        title: 'Scan Error',
        description: 'Failed to process scan.',
      });
    } finally {
      setScanning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  const handleMoveItem = async () => {
    if (!scannedItem || !targetLocation) return;

    setMoving(true);
    try {
      const { error } = await (supabase.from('items') as any)
        .update({ current_location_id: targetLocation })
        .eq('id', scannedItem.id);

      if (error) throw error;

      // Record movement
      await (supabase.from('movements') as any).insert({
        item_id: scannedItem.id,
        to_location_id: targetLocation,
        action_type: 'move',
        moved_at: new Date().toISOString(),
      });

      toast({
        title: 'Item Moved',
        description: `${scannedItem.item_code} has been moved successfully.`,
      });

      setScannedItem(null);
      setTargetLocation('');
      scanInputRef.current?.focus();
    } catch (error) {
      console.error('Move error:', error);
      toast({
        variant: 'destructive',
        title: 'Move Failed',
        description: 'Failed to move item.',
      });
    } finally {
      setMoving(false);
    }
  };

  const handleBatchMove = async () => {
    if (batchItems.length === 0 || !batchTargetLocation) return;

    setBatchMoving(true);
    let successCount = 0;

    try {
      for (const item of batchItems) {
        const { error } = await (supabase.from('items') as any)
          .update({ current_location_id: batchTargetLocation })
          .eq('id', item.id);

        if (!error) {
          await (supabase.from('movements') as any).insert({
            item_id: item.id,
            to_location_id: batchTargetLocation,
            action_type: 'move',
            moved_at: new Date().toISOString(),
          });
          successCount++;
        }
      }

      setMovedCount(successCount);
      setSuccessDialogOpen(true);
      setBatchItems([]);
      setBatchTargetLocation('');
    } catch (error) {
      console.error('Batch move error:', error);
      toast({
        variant: 'destructive',
        title: 'Batch Move Failed',
        description: `Moved ${successCount} of ${batchItems.length} items.`,
      });
    } finally {
      setBatchMoving(false);
    }
  };

  const removeFromBatch = (itemId: string) => {
    setBatchItems(prev => prev.filter(i => i.id !== itemId));
  };

  const cancelMove = () => {
    setScannedItem(null);
    setTargetLocation('');
    scanInputRef.current?.focus();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight flex items-center justify-center gap-2">
            <QrCode className="h-8 w-8" />
            Scan Hub
          </h1>
          <p className="text-muted-foreground mt-2">
            Scan QR codes to move items or look up details
          </p>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as ScanMode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="move" className="flex items-center gap-2">
              <Move className="h-4 w-4" />
              Move
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Batch Move
            </TabsTrigger>
            <TabsTrigger value="lookup" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Look Up
            </TabsTrigger>
          </TabsList>

          {/* Shared scan input */}
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Scan Item
              </CardTitle>
              <CardDescription>
                {mode === 'lookup' 
                  ? 'Scan a QR code to view item details'
                  : mode === 'batch'
                  ? 'Scan items to add them to the batch'
                  : 'Scan an item QR code to move it'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  ref={scanInputRef}
                  placeholder="Scan QR code or enter item code..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={scanning}
                  className="font-mono"
                  autoFocus
                />
                <Button onClick={handleScan} disabled={scanning || !scanInput.trim()}>
                  {scanning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <QrCode className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Move Mode */}
          <TabsContent value="move" className="mt-0">
            {scannedItem && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Move Item
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-lg">{scannedItem.item_code}</p>
                        <p className="text-sm text-muted-foreground">{scannedItem.description || 'No description'}</p>
                      </div>
                      <Badge variant="outline">
                        <MapPin className="h-3 w-3 mr-1" />
                        {scannedItem.current_location_code || 'No location'}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 text-center">
                      <p className="text-sm text-muted-foreground">Current</p>
                      <p className="font-medium">{scannedItem.current_location_code || 'None'}</p>
                    </div>
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                    <div className="flex-1">
                      <Label className="text-sm text-muted-foreground">New Location</Label>
                      <Select value={targetLocation} onValueChange={setTargetLocation}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bay..." />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.code} {loc.name && `- ${loc.name}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={cancelMove} className="flex-1">
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleMoveItem} 
                      disabled={!targetLocation || moving}
                      className="flex-1"
                    >
                      {moving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      )}
                      Confirm Move
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Batch Move Mode */}
          <TabsContent value="batch" className="mt-0 space-y-4">
            {batchItems.length > 0 && (
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      Batch Items ({batchItems.length})
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setBatchItems([])}
                    >
                      Clear All
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {batchItems.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between bg-muted rounded-lg px-3 py-2"
                      >
                        <div>
                          <p className="font-medium">{item.item_code}</p>
                          <p className="text-xs text-muted-foreground">{item.current_location_code || 'No location'}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFromBatch(item.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div>
                    <Label>Move All To</Label>
                    <Select value={batchTargetLocation} onValueChange={setBatchTargetLocation}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select target bay..." />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.code} {loc.name && `- ${loc.name}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleBatchMove} 
                    disabled={!batchTargetLocation || batchMoving}
                    className="w-full"
                  >
                    {batchMoving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    Move {batchItems.length} Items
                  </Button>
                </CardContent>
              </Card>
            )}

            {batchItems.length === 0 && (
              <Card className="mt-4">
                <CardContent className="py-12 text-center">
                  <Layers className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-muted-foreground">
                    Scan items to add them to the batch
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Lookup Mode */}
          <TabsContent value="lookup" className="mt-0">
            <Card className="mt-4">
              <CardContent className="py-12 text-center">
                <Search className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  Scan an item QR code to view its details
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Success Dialog */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Batch Move Complete
            </DialogTitle>
            <DialogDescription>
              Successfully moved {movedCount} items to the new location.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => {
              setSuccessDialogOpen(false);
              scanInputRef.current?.focus();
            }}>
              Continue Scanning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
