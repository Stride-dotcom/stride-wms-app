import { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { cn } from '@/lib/utils';

interface InlineEditableCellProps {
  value: string | null;
  suggestions: string[];
  onSave: (newValue: string) => Promise<void>;
  placeholder?: string;
}

export function InlineEditableCell({ value, suggestions, onSave, placeholder = '-' }: InlineEditableCellProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInputValue(value || '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, value]);

  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim()) return suggestions.slice(0, 20);
    const lower = inputValue.toLowerCase();
    return suggestions.filter(s => s.toLowerCase().includes(lower)).slice(0, 20);
  }, [inputValue, suggestions]);

  const isNewValue = inputValue.trim() && !suggestions.some(s => s.toLowerCase() === inputValue.trim().toLowerCase());

  const handleSelect = async (val: string) => {
    setSaving(true);
    try {
      await onSave(val);
      setOpen(false);
    } catch (e) {
      console.error('Failed to save:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      handleSelect(inputValue.trim());
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className="group flex items-center gap-1 cursor-pointer min-h-[24px] px-1 -mx-1 rounded hover:bg-muted/80 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <span className={cn("text-sm truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <MaterialIcon name="edit" className="text-[12px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-2"
        align="start"
        side="bottom"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type to search or add..."
          className="h-8 text-sm mb-1"
          disabled={saving}
        />
        <div className="max-h-40 overflow-y-auto">
          {isNewValue && (
            <button
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-left rounded hover:bg-muted/80 text-primary"
              onClick={() => handleSelect(inputValue.trim())}
              disabled={saving}
            >
              <MaterialIcon name="add" className="text-[12px]" />
              Add "{inputValue.trim()}"
            </button>
          )}
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-left rounded hover:bg-muted/80"
              onClick={() => handleSelect(suggestion)}
              disabled={saving}
            >
              {suggestion === value && <MaterialIcon name="check" className="text-[12px] text-primary" />}
              {suggestion !== value && <span className="w-3" />}
              <span className="truncate">{suggestion}</span>
            </button>
          ))}
          {filteredSuggestions.length === 0 && !isNewValue && (
            <p className="text-xs text-muted-foreground px-2 py-2">No matches found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
