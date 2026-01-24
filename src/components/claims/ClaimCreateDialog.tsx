import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClaims, ClaimType, CLAIM_TYPE_LABELS } from '@/hooks/useClaims';
import { Loader2, Package, Truck, AlertTriangle, MapPin } from 'lucide-react';

interface ClaimCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Pre-filled context
  itemId?: string;
  shipmentId?: string;
  itemIds?: string[]; // For multi-select from inventory
  accountId?: string;
  sidemarkId?: string;
}

interface Account {
  id: string;
  account_name: string;
}

interface Sidemark {
  id: string;
  sidemark_name: string;
  account_id: string;
}

interface Item {
  id: string;
  item_code: string;
  description: string | null;
  account_id: string | null;
  sidemark_id: string | null;
}

interface Shipment {
  id: string;
  shipment_number: string;
  account_id: string | null;
  sidemark_id: string | null;
}

type ClaimContext = 'item' | 'shipment' | 'inventory' | 'property';

export function ClaimCreateDialog({
  open,
  onOpenChange,
  itemId: initialItemId,
  shipmentId: initialShipmentId,
  itemIds: initialItemIds,
  accountId: initialAccountId,
  sidemarkId: initialSidemarkId,
}: ClaimCreateDialogProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { createClaim } = useClaims();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [context, setContext] = useState<ClaimContext>('item');
  
  // Reference data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sidemarks, setSidemarks] = useState<Sidemark[]>([]);
  
  // Form state
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId || '');
  const [selectedSidemarkId, setSelectedSidemarkId] = useState<string>(initialSidemarkId || '');
  const [selectedItemId, setSelectedItemId] = useState<string>(initialItemId || '');
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(initialShipmentId || '');
  const [itemSearch, setItemSearch] = useState('');
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [searchedItems, setSearchedItems] = useState<Item[]>([]);
  const [searchedShipments, setSearchedShipments] = useState<Shipment[]>([]);
  
  // Property damage fields
  const [nonInventoryRef, setNonInventoryRef] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [incidentContactName, setIncidentContactName] = useState('');
  const [incidentContactPhone, setIncidentContactPhone] = useState('');
  const [incidentContactEmail, setIncidentContactEmail] = useState('');
  
  // Claim data
  const [claimType, setClaimType] = useState<ClaimType>('handling_damage');
  const [description, setDescription] = useState('');
  const [publicNotes, setPublicNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  useEffect(() => {
    if (open && profile?.tenant_id) {
      loadAccounts();
    }
  }, [open, profile?.tenant_id]);

  useEffect(() => {
    if (selectedAccountId) {
      loadSidemarks(selectedAccountId);
    }
  }, [selectedAccountId]);

  // Set initial context based on props
  useEffect(() => {
    if (initialItemId) setContext('item');
    else if (initialShipmentId) setContext('shipment');
    else if (initialItemIds?.length) setContext('inventory');
  }, [initialItemId, initialShipmentId, initialItemIds]);

  const loadAccounts = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('id, account_name')
      .eq('tenant_id', profile?.tenant_id)
      .eq('is_active', true)
      .order('account_name');
    setAccounts(data || []);
  };

  const loadSidemarks = async (accountId: string) => {
    const { data } = await supabase
      .from('sidemarks')
      .select('id, sidemark_name, account_id')
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .order('sidemark_name');
    setSidemarks(data || []);
  };

  const searchItems = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchedItems([]);
      return;
    }
    const { data } = await supabase
      .from('items')
      .select('id, item_code, description, account_id, sidemark_id')
      .eq('tenant_id', profile?.tenant_id)
      .is('deleted_at', null)
      .or(`item_code.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(20);
    setSearchedItems(data || []);
  };

  const searchShipments = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchedShipments([]);
      return;
    }
    const { data } = await supabase
      .from('shipments')
      .select('id, shipment_number, account_id, sidemark_id')
      .eq('tenant_id', profile?.tenant_id)
      .ilike('shipment_number', `%${query}%`)
      .limit(20);
    setSearchedShipments(data || []);
  };

  const handleItemSelect = (item: Item) => {
    setSelectedItemId(item.id);
    setItemSearch(item.item_code);
    if (item.account_id) setSelectedAccountId(item.account_id);
    if (item.sidemark_id) setSelectedSidemarkId(item.sidemark_id);
    setSearchedItems([]);
  };

  const handleShipmentSelect = (shipment: Shipment) => {
    setSelectedShipmentId(shipment.id);
    setShipmentSearch(shipment.shipment_number);
    if (shipment.account_id) setSelectedAccountId(shipment.account_id);
    if (shipment.sidemark_id) setSelectedSidemarkId(shipment.sidemark_id);
    setSearchedShipments([]);
  };

  const handleSubmit = async () => {
    if (!description.trim() || !selectedAccountId) return;

    setIsSubmitting(true);
    try {
      const claim = await createClaim({
        claim_type: claimType,
        account_id: selectedAccountId,
        sidemark_id: selectedSidemarkId || null,
        shipment_id: context === 'shipment' ? selectedShipmentId : null,
        item_id: context === 'item' ? selectedItemId : (initialItemIds?.[0] || null),
        non_inventory_ref: context === 'property' ? nonInventoryRef : null,
        incident_location: context === 'property' ? incidentLocation : null,
        incident_contact_name: context === 'property' ? incidentContactName : null,
        incident_contact_phone: context === 'property' ? incidentContactPhone : null,
        incident_contact_email: context === 'property' ? incidentContactEmail : null,
        description,
      });

      if (claim) {
        onOpenChange(false);
        navigate(`/claims/${claim.id}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setContext('item');
    setSelectedAccountId(initialAccountId || '');
    setSelectedSidemarkId(initialSidemarkId || '');
    setSelectedItemId(initialItemId || '');
    setSelectedShipmentId(initialShipmentId || '');
    setItemSearch('');
    setShipmentSearch('');
    setNonInventoryRef('');
    setIncidentLocation('');
    setIncidentContactName('');
    setIncidentContactPhone('');
    setIncidentContactEmail('');
    setClaimType('handling_damage');
    setDescription('');
    setPublicNotes('');
    setInternalNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>File New Claim</DialogTitle>
          <DialogDescription>
            Create a claim for damage, loss, or other incidents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Context Selector */}
          <div className="space-y-2">
            <Label>Claim Context</Label>
            <Tabs value={context} onValueChange={(v) => setContext(v as ClaimContext)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="item" className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  Item
                </TabsTrigger>
                <TabsTrigger value="shipment" className="flex items-center gap-1">
                  <Truck className="h-4 w-4" />
                  Shipment
                </TabsTrigger>
                <TabsTrigger value="inventory" className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  Multi-Item
                </TabsTrigger>
                <TabsTrigger value="property" className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Property
                </TabsTrigger>
              </TabsList>

              <TabsContent value="item" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Search Item</Label>
                  <Input
                    placeholder="Search by item code or description..."
                    value={itemSearch}
                    onChange={(e) => {
                      setItemSearch(e.target.value);
                      searchItems(e.target.value);
                    }}
                  />
                  {searchedItems.length > 0 && (
                    <div className="border rounded-md max-h-40 overflow-y-auto">
                      {searchedItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-2 hover:bg-muted cursor-pointer text-sm"
                          onClick={() => handleItemSelect(item)}
                        >
                          <span className="font-mono">{item.item_code}</span>
                          {item.description && (
                            <span className="text-muted-foreground ml-2">
                              - {item.description.slice(0, 50)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="shipment" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Search Shipment</Label>
                  <Input
                    placeholder="Search by shipment number..."
                    value={shipmentSearch}
                    onChange={(e) => {
                      setShipmentSearch(e.target.value);
                      searchShipments(e.target.value);
                    }}
                  />
                  {searchedShipments.length > 0 && (
                    <div className="border rounded-md max-h-40 overflow-y-auto">
                      {searchedShipments.map((shipment) => (
                        <div
                          key={shipment.id}
                          className="p-2 hover:bg-muted cursor-pointer text-sm font-mono"
                          onClick={() => handleShipmentSelect(shipment)}
                        >
                          {shipment.shipment_number}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="inventory" className="space-y-4 mt-4">
                <div className="p-4 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">
                    {initialItemIds?.length 
                      ? `${initialItemIds.length} items selected from inventory`
                      : 'Select items from the Inventory page to file a multi-item claim'}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="property" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Reference ID</Label>
                    <Input
                      placeholder="e.g., NINV-000123"
                      value={nonInventoryRef}
                      onChange={(e) => setNonInventoryRef(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Incident Location</Label>
                    <Input
                      placeholder="Address or location"
                      value={incidentLocation}
                      onChange={(e) => setIncidentLocation(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Name</Label>
                    <Input
                      value={incidentContactName}
                      onChange={(e) => setIncidentContactName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Phone</Label>
                    <Input
                      value={incidentContactPhone}
                      onChange={(e) => setIncidentContactPhone(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Contact Email</Label>
                    <Input
                      type="email"
                      value={incidentContactEmail}
                      onChange={(e) => setIncidentContactEmail(e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Claim Type */}
          <div className="space-y-2">
            <Label>Claim Type *</Label>
            <Select value={claimType} onValueChange={(v) => setClaimType(v as ClaimType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CLAIM_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Account & Sidemark */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sidemark / Project</Label>
              <Select value={selectedSidemarkId} onValueChange={setSelectedSidemarkId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sidemark" />
                </SelectTrigger>
                <SelectContent>
                  {sidemarks.map((sm) => (
                    <SelectItem key={sm.id} value={sm.id}>{sm.sidemark_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea
              placeholder="Describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Public Notes</Label>
              <Textarea
                placeholder="Notes visible to client..."
                value={publicNotes}
                onChange={(e) => setPublicNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <Textarea
                placeholder="Staff-only notes..."
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !description.trim()}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            File Claim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
