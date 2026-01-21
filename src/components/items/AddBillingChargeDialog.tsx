import { useState, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, DollarSign } from 'lucide-react';

interface ChargeTemplate {
  id: string;
  name: string;
  amount: number;
  description: string | null;
}

interface AddBillingChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemCode: string;
  accountId: string | null;
  onSuccess: () => void;
}

export function AddBillingChargeDialog({
  open,
  onOpenChange,
  itemId,
  itemCode,
  accountId,
  onSuccess,
}: AddBillingChargeDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<ChargeTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  const [formData, setFormData] = useState({
    charge_name: '',
    amount: '',
    description: '',
  });

  useEffect(() => {
    if (open && profile?.tenant_id) {
      fetchTemplates();
    }
  }, [open, profile?.tenant_id]);

  useEffect(() => {
    if (!open) {
      setFormData({ charge_name: '', amount: '', description: '' });
      setSelectedTemplate('');
    }
  }, [open]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('billing_charge_templates')
      .select('id, name, amount, description')
      .eq('is_active', true)
      .order('name');
    
    setTemplates(data || []);
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    
    if (templateId === 'custom') {
      setFormData({ charge_name: '', amount: '', description: '' });
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFormData({
        charge_name: template.name,
        amount: template.amount.toString(),
        description: template.description || '',
      });
    }
  };

  const handleSubmit = async () => {
    if (!profile?.tenant_id) return;
    
    if (!formData.charge_name.trim()) {
      toast({
        title: 'Charge name required',
        description: 'Please enter a charge name.',
        variant: 'destructive',
      });
      return;
    }
    
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Valid amount required',
        description: 'Please enter a valid positive amount.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('custom_billing_charges')
        .insert({
          tenant_id: profile.tenant_id,
          item_id: itemId,
          account_id: accountId,
          charge_name: formData.charge_name.trim(),
          amount: amount,
          description: formData.description.trim() || null,
          charge_date: new Date().toISOString(),
          created_by: profile.id,
        });

      if (error) throw error;

      toast({
        title: 'Billing Charge Added',
        description: `$${amount.toFixed(2)} charge for "${formData.charge_name}" added to ${itemCode}.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error adding billing charge:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add billing charge.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Add Billing Charge
          </DialogTitle>
          <DialogDescription>
            Add a billing charge to item {itemCode}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Charge Template</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template or enter custom..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom Charge</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} (${template.amount.toFixed(2)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Charge Name */}
          <div className="space-y-2">
            <Label>Charge Name *</Label>
            <Input
              value={formData.charge_name}
              onChange={(e) => setFormData(prev => ({ ...prev, charge_name: e.target.value }))}
              placeholder="Enter charge name"
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Amount *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                className="pl-9"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description (Optional)</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Add notes about this charge..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Charge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}