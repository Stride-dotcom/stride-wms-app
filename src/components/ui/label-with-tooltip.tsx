import { ReactNode, useState, useRef, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';

interface LabelWithTooltipProps {
  htmlFor?: string;
  children: ReactNode;
  tooltip: string;
  required?: boolean;
  className?: string;
  /** Key used for admin-editable help text persistence */
  fieldKey?: string;
}

/**
 * Get persisted help text override for a field.
 * Uses localStorage keyed by tenant ID for now — can be migrated to DB-backed storage.
 */
function getHelpTextOverride(tenantId: string, fieldKey: string): string | null {
  try {
    const stored = localStorage.getItem(`stride_help_text_${tenantId}`);
    if (!stored) return null;
    const overrides = JSON.parse(stored);
    return overrides[fieldKey] || null;
  } catch {
    return null;
  }
}

function setHelpTextOverride(tenantId: string, fieldKey: string, value: string): void {
  try {
    const stored = localStorage.getItem(`stride_help_text_${tenantId}`);
    const overrides = stored ? JSON.parse(stored) : {};
    overrides[fieldKey] = value;
    localStorage.setItem(`stride_help_text_${tenantId}`, JSON.stringify(overrides));
  } catch {
    // Silently fail on storage errors
  }
}

export function LabelWithTooltip({ htmlFor, children, tooltip, required, className, fieldKey }: LabelWithTooltipProps) {
  const { isAdmin } = usePermissions();
  const { profile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [displayText, setDisplayText] = useState(tooltip);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load override on mount
  useEffect(() => {
    if (fieldKey && profile?.tenant_id) {
      const override = getHelpTextOverride(profile.tenant_id, fieldKey);
      if (override) {
        setDisplayText(override);
      } else {
        setDisplayText(tooltip);
      }
    } else {
      setDisplayText(tooltip);
    }
  }, [fieldKey, profile?.tenant_id, tooltip]);

  const handleStartEdit = () => {
    if (!isAdmin || !fieldKey) return;
    setEditValue(displayText);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSave = () => {
    if (fieldKey && profile?.tenant_id) {
      setHelpTextOverride(profile.tenant_id, fieldKey, editValue);
      setDisplayText(editValue);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  return (
    <div className={`flex items-center gap-1 ${className || ''}`}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {children}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-muted-foreground text-[10px] font-bold hover:bg-muted/80 transition shrink-0 cursor-help"
            tabIndex={-1}
          >
            ?
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" className="max-w-[280px] text-xs leading-relaxed p-3">
          {editing ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full min-h-[60px] text-xs border rounded p-1.5 resize-y bg-background"
              />
              <div className="flex gap-1 justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-[10px] px-2 py-0.5 rounded border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div
              onDoubleClick={handleStartEdit}
              className={isAdmin && fieldKey ? 'cursor-text' : ''}
            >
              <p>{displayText}</p>
              {isAdmin && fieldKey && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
