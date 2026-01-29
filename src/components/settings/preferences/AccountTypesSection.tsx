import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_ACCOUNT_TYPES = [
  'Retail',
  'Retail w/NO Warehousing',
  'Wholesale',
  'Designer',
  'Manufacturer',
  'Other',
];

// Hook to manage account types with localStorage (tenant-scoped)
export function useAccountTypes() {
  const { profile } = useAuth();
  const [types, setTypes] = useState<string[]>(DEFAULT_ACCOUNT_TYPES);

  useEffect(() => {
    if (profile?.tenant_id) {
      const storageKey = `account-types-${profile.tenant_id}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTypes(parsed);
          }
        } catch {
          // Use defaults
        }
      }
    }
  }, [profile?.tenant_id]);

  const saveTypes = (newTypes: string[]) => {
    if (profile?.tenant_id) {
      const storageKey = `account-types-${profile.tenant_id}`;
      localStorage.setItem(storageKey, JSON.stringify(newTypes));
      setTypes(newTypes);
    }
  };

  return { types, saveTypes, isDefault: JSON.stringify(types) === JSON.stringify(DEFAULT_ACCOUNT_TYPES) };
}

export function AccountTypesSection() {
  const { toast } = useToast();
  const { types, saveTypes, isDefault } = useAccountTypes();
  const [localTypes, setLocalTypes] = useState<string[]>([]);
  const [newType, setNewType] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    setLocalTypes(types);
  }, [types]);

  const handleAdd = () => {
    const trimmed = newType.trim();
    if (!trimmed) return;
    if (localTypes.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      toast({ variant: 'destructive', title: 'Duplicate', description: 'This account type already exists.' });
      return;
    }
    const updated = [...localTypes, trimmed];
    setLocalTypes(updated);
    saveTypes(updated);
    setNewType('');
    toast({ title: 'Account Type Added', description: `"${trimmed}" has been added.` });
  };

  const handleRemove = (index: number) => {
    const updated = localTypes.filter((_, i) => i !== index);
    setLocalTypes(updated);
    saveTypes(updated);
    toast({ title: 'Account Type Removed' });
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(localTypes[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (!trimmed) return;

    // Check for duplicates (excluding current item)
    if (localTypes.some((t, i) => i !== editingIndex && t.toLowerCase() === trimmed.toLowerCase())) {
      toast({ variant: 'destructive', title: 'Duplicate', description: 'This account type already exists.' });
      return;
    }

    const updated = [...localTypes];
    updated[editingIndex] = trimmed;
    setLocalTypes(updated);
    saveTypes(updated);
    setEditingIndex(null);
    setEditValue('');
    toast({ title: 'Account Type Updated' });
  };

  const handleReset = () => {
    setLocalTypes(DEFAULT_ACCOUNT_TYPES);
    saveTypes(DEFAULT_ACCOUNT_TYPES);
    toast({ title: 'Reset to Defaults', description: 'Account types have been reset to default values.' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MaterialIcon name="apartment" size="sm" />
              Account Types
            </CardTitle>
            <CardDescription>
              Customize the account types available when creating accounts.
            </CardDescription>
          </div>
          {!isDefault && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset to Defaults
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Types */}
        <div className="flex flex-wrap gap-2">
          {localTypes.map((type, index) => (
            <div key={index} className="group">
              {editingIndex === index ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-7 w-40 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') setEditingIndex(null);
                    }}
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit}>
                    <MaterialIcon name="check" size="sm" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingIndex(null)}>
                    <MaterialIcon name="close" size="sm" />
                  </Button>
                </div>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1 pr-1">
                  {type}
                  <button
                    onClick={() => handleEdit(index)}
                    className="ml-1 p-0.5 rounded hover:bg-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MaterialIcon name="edit" size="sm" />
                  </button>
                  <button
                    onClick={() => handleRemove(index)}
                    className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MaterialIcon name="close" size="sm" />
                  </button>
                </Badge>
              )}
            </div>
          ))}
        </div>

        {/* Add New Type */}
        <div className="flex gap-2">
          <Input
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="New account type..."
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <Button onClick={handleAdd} disabled={!newType.trim()}>
            <MaterialIcon name="add" size="sm" className="mr-2" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
