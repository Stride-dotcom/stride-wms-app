import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { CommunicationAlert, TRIGGER_EVENTS } from '@/hooks/useCommunications';

interface CreateAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateAlert: (alert: Omit<CommunicationAlert, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => Promise<CommunicationAlert | null>;
}

export function CreateAlertDialog({
  open,
  onOpenChange,
  onCreateAlert,
}: CreateAlertDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    key: '',
    description: '',
    trigger_event: '',
    is_enabled: true,
    channels: { email: true, sms: true },
    timing_rule: 'immediate',
  });

  const generateKey = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      key: generateKey(name),
    }));
  };

  const handleCreateAlert = async () => {
    if (!formData.name || !formData.trigger_event) return;
    
    setIsSubmitting(true);
    const result = await onCreateAlert(formData);
    setIsSubmitting(false);
    
    if (result) {
      onOpenChange(false);
      setFormData({
        name: '',
        key: '',
        description: '',
        trigger_event: '',
        is_enabled: true,
        channels: { email: true, sms: true },
        timing_rule: 'immediate',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Alert</DialogTitle>
          <DialogDescription>
            Configure a new notification alert. Default templates will be created for enabled channels.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Alert Name</Label>
            <Input
              id="name"
              placeholder="e.g., Shipment Received Notification"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="key">Alert Key</Label>
            <Input
              id="key"
              placeholder="e.g., shipment_received"
              value={formData.key}
              onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier used in code. Auto-generated from name.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe when this alert is triggered..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trigger">Trigger Event</Label>
            <Select
              value={formData.trigger_event}
              onValueChange={(value) => setFormData(prev => ({ ...prev, trigger_event: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select trigger event" />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_EVENTS.map((event) => (
                  <SelectItem key={event.value} value={event.value}>
                    {event.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Channels</Label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={formData.channels.email}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, channels: { ...prev.channels, email: checked } }))
                  }
                />
                <MaterialIcon name="mail" size="sm" />
                <span>Email</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={formData.channels.sms}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, channels: { ...prev.channels, sms: checked } }))
                  }
                />
                <MaterialIcon name="chat" size="sm" />
                <span>SMS</span>
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateAlert} 
            disabled={!formData.name || !formData.trigger_event || isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Alert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
