import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { QRScanner } from '@/components/scan/QRScanner';
import { useManifestScan, ManifestScanResult } from '@/hooks/useManifests';
import { useManifests } from '@/hooks/useManifests';
import { useLocations } from '@/hooks/useLocations';
import { supabase } from '@/integrations/supabase/client';
import {
  hapticLight,
  hapticMedium,
  hapticSuccess,
  hapticError,
} from '@/lib/haptics';
import {
  ArrowLeft,
  MapPin,
  Package,
  CheckCircle,
  AlertTriangle,
  XCircle,
  AlertOctagon,
  Loader2,
  Keyboard,
  RefreshCw,
  BarChart3,
  Search,
  List,
  ScanLine,
  Clock,
  Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const scanResultConfig: Record<ManifestScanResult, {
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isError: boolean;
}> = {
  valid: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/20 border-green-500/30',
    icon: CheckCircle,
    label: 'Valid',
    isError: false,
  },
  not_on_manifest: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20 border-red-500/30',
    icon: Ban,
    label: 'NOT ON MANIFEST',
    isError: true,
  },
  duplicate: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20 border-yellow-500/30',
    icon: RefreshCw,
    label: 'Already Scanned',
    isError: true,
  },
  wrong_location: {
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20 border-orange-500/30',
    icon: AlertTriangle,
    label: 'Wrong Location',
    isError: false,
  },
  item_not_found: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20 border-red-500/30',
    icon: XCircle,
    label: 'Not Found',
    isError: true,
  },
};

interface LastScanResult {
  itemCode: string;
  result: ManifestScanResult;
  message: string;
  isError: boolean;
}

export default function ManifestScan() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [lastScan, setLastScan] = useState<LastScanResult | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualItemCode, setManualItemCode] = useState('');
  const [viewMode, setViewMode] = useState<'scan' | 'list'>('scan');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmComplete, setConfirmComplete] = useState(false);

  const lastScanTimeoutRef = useRef<NodeJS.Timeout>();
  const errorFlashRef = useRef<NodeJS.Timeout>();

  const {
    manifest,
    items,
    scans,
    stats,
    loading,
    recordScan,
    refetch,
  } = useManifestScan(id || '');

  const { completeManifest } = useManifests();
  const { locations } = useLocations(manifest?.warehouse_id);

  // Filter locations to only those in the manifest zone
  const manifestLocations = manifest?.location_ids
    ? locations.filter(l => (manifest.location_ids as string[]).includes(l.id))
    : locations;

  // Auto-select first location if none selected
  useEffect(() => {
    if (!activeLocationId && manifestLocations.length > 0) {
      setActiveLocationId(manifestLocations[0].id);
    }
  }, [activeLocationId, manifestLocations]);

  // Clear last scan after delay (longer for errors)
  useEffect(() => {
    if (lastScan) {
      const delay = lastScan.isError ? 5000 : 3000;
      lastScanTimeoutRef.current = setTimeout(() => {
        setLastScan(null);
      }, delay);

      return () => {
        if (lastScanTimeoutRef.current) {
          clearTimeout(lastScanTimeoutRef.current);
        }
      };
    }
  }, [lastScan]);

  // Play audio feedback
  const playAudio = useCallback((type: 'success' | 'error') => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      if (type === 'success') {
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      } else {
        // Error sound - two low tones
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);

        setTimeout(() => {
          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);
          osc2.frequency.setValueAtTime(150, audioContext.currentTime);
          gain2.gain.setValueAtTime(0.5, audioContext.currentTime);
          osc2.start(audioContext.currentTime);
          osc2.stop(audioContext.currentTime + 0.3);
        }, 200);
      }
    } catch (error) {
      console.error('Audio playback error:', error);
    }
  }, []);

  // Handle scan
  const handleScan = useCallback(async (itemCode: string) => {
    if (!activeLocationId || processing || !manifest) return;

    setProcessing(true);
    hapticLight();

    try {
      // Lookup item by code
      const { data: item } = await supabase
        .from('items')
        .select('id, item_code')
        .eq('item_code', itemCode.trim())
        .eq('tenant_id', manifest.tenant_id)
        .single();

      const itemId = item?.id || null;

      // Record the scan
      const result = await recordScan(activeLocationId, itemId || '', itemCode);

      // Update last scan result
      setLastScan({
        itemCode,
        result: result.result,
        message: result.message,
        isError: result.triggerErrorFeedback,
      });

      // Feedback based on result
      if (result.triggerErrorFeedback) {
        // ERROR: Item not on manifest or other error
        hapticError();
        playAudio('error');

        // Flash the screen red
        document.body.classList.add('error-flash');
        if (errorFlashRef.current) clearTimeout(errorFlashRef.current);
        errorFlashRef.current = setTimeout(() => {
          document.body.classList.remove('error-flash');
        }, 500);
      } else {
        // Success
        hapticSuccess();
        playAudio('success');
      }

    } catch (error: any) {
      console.error('Scan error:', error);
      setLastScan({
        itemCode,
        result: 'item_not_found',
        message: error.message || 'Failed to process scan',
        isError: true,
      });
      hapticError();
      playAudio('error');
    } finally {
      setProcessing(false);
    }
  }, [activeLocationId, processing, manifest, recordScan, playAudio]);

  // Handle manual entry
  const handleManualEntry = () => {
    if (!manualItemCode.trim()) return;
    handleScan(manualItemCode.trim());
    setManualItemCode('');
    setShowManualEntry(false);
  };

  // Handle complete
  const handleComplete = async () => {
    await completeManifest(id!);
    setConfirmComplete(false);
    navigate(`/manifests/${id}`);
  };

  // Filter items for list view
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      i => i.item_code.toLowerCase().includes(query) ||
           i.item_description?.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  // Progress calculation
  const progressPercent = stats?.progress_percent || 0;
  const scannedCount = manifest?.scanned_item_count || 0;
  const totalCount = manifest?.expected_item_count || 0;
  const remainingCount = totalCount - scannedCount;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!manifest) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Manifest not found</h2>
          <Button variant="link" onClick={() => navigate('/manifests')}>
            Back to Manifests
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isActive = manifest.status === 'active' || manifest.status === 'in_progress';

  return (
    <DashboardLayout>
      {/* Add error flash CSS */}
      <style>{`
        .error-flash {
          animation: error-flash 0.5s ease-out;
        }
        @keyframes error-flash {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(239, 68, 68, 0.3); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/manifests/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{manifest.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">{manifest.manifest_number}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'scan' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('scan')}
          >
            <ScanLine className="h-4 w-4 mr-1" />
            Scan
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-1" />
            List
          </Button>
        </div>
      </div>

      {/* Progress Card */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-6">
              <div>
                <span className="text-sm text-muted-foreground">Scanned</span>
                <p className="text-2xl font-bold text-green-400">{scannedCount}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Remaining</span>
                <p className="text-2xl font-bold text-yellow-400">{remainingCount}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Total</span>
                <p className="text-2xl font-bold">{totalCount}</p>
              </div>
            </div>
            {isActive && (
              <Button onClick={() => setConfirmComplete(true)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete
              </Button>
            )}
          </div>
          <Progress value={progressPercent} className="h-3" />
          <p className="text-sm text-muted-foreground mt-1 text-right">{progressPercent}% complete</p>
        </CardContent>
      </Card>

      {viewMode === 'scan' ? (
        <>
          {/* Location Selector */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <label className="text-sm font-medium">Current Location</label>
                  <Select
                    value={activeLocationId || ''}
                    onValueChange={setActiveLocationId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {manifestLocations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.code} {loc.name && `- ${loc.name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Last Scan Feedback */}
          {lastScan && (
            <Card
              className={cn(
                'mb-4 border-2 transition-all',
                scanResultConfig[lastScan.result]?.bgColor,
                lastScan.isError && 'animate-pulse'
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {(() => {
                    const config = scanResultConfig[lastScan.result];
                    const Icon = config?.icon || AlertTriangle;
                    return (
                      <Icon className={cn('h-8 w-8', config?.color || 'text-muted-foreground')} />
                    );
                  })()}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg">{lastScan.itemCode}</span>
                      <Badge className={scanResultConfig[lastScan.result]?.bgColor}>
                        {scanResultConfig[lastScan.result]?.label}
                      </Badge>
                    </div>
                    <p className={cn(
                      'text-sm mt-1',
                      lastScan.isError ? 'text-red-400 font-semibold' : 'text-muted-foreground'
                    )}>
                      {lastScan.message}
                    </p>
                    {lastScan.isError && lastScan.result === 'not_on_manifest' && (
                      <p className="text-red-400 font-bold mt-2 text-lg">
                        THIS ITEM IS NOT ON THE MANIFEST!
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scanner */}
          <Card className="mb-4">
            <CardContent className="p-4">
              {!showManualEntry ? (
                <div className="space-y-4">
                  <QRScanner
                    onScan={handleScan}
                    disabled={!activeLocationId || processing || !isActive}
                  />
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setShowManualEntry(true)}
                      disabled={!activeLocationId || !isActive}
                    >
                      <Keyboard className="h-4 w-4 mr-2" />
                      Manual Entry
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter item code"
                      value={manualItemCode}
                      onChange={(e) => setManualItemCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleManualEntry()}
                      autoFocus
                      className="font-mono"
                    />
                    <Button onClick={handleManualEntry} disabled={processing || !isActive}>
                      {processing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowManualEntry(false);
                        setManualItemCode('');
                      }}
                    >
                      <ScanLine className="h-4 w-4 mr-2" />
                      Use Scanner
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Scans */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Scans
              </h3>
              {scans.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No scans yet. Start scanning items.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {scans.slice(0, 10).map((scan) => {
                    const config = scanResultConfig[scan.scan_result as ManifestScanResult];
                    const Icon = config?.icon || AlertTriangle;
                    return (
                      <div
                        key={scan.id}
                        className={cn(
                          'flex items-center gap-3 p-2 rounded border',
                          config?.bgColor
                        )}
                      >
                        <Icon className={cn('h-4 w-4', config?.color)} />
                        <span className="font-mono flex-1">{scan.item_code}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(scan.scanned_at), 'h:mm a')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        /* List View */
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {filteredItems.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No items found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.scanned ? (
                            <Badge className="bg-green-500/20 text-green-400">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Scanned
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono font-medium">
                          {item.item_code}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {item.item_description || '-'}
                        </TableCell>
                        <TableCell>
                          {item.expected_location?.code || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Complete Confirmation */}
      <AlertDialog open={confirmComplete} onOpenChange={setConfirmComplete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Manifest?</AlertDialogTitle>
            <AlertDialogDescription>
              {remainingCount > 0 ? (
                <>
                  There are still <strong>{remainingCount} items</strong> that haven't been scanned.
                  Are you sure you want to complete this manifest?
                </>
              ) : (
                'All items have been scanned. Complete this manifest?'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete}>
              Complete Manifest
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
