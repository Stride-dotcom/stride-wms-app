import * as React from "react";
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Mobile-safe SearchableSelect (Combobox)
 * - Type-to-filter immediately
 * - Keyboard-friendly on mobile
 * - Portal-based dropdown (never clipped)
 * - Auto-scrolls field into view when opened
 * - Supports async data loading
 * - Supports recent selections (localStorage)
 */

export interface SelectOption {
  value: string;
  label: string;
  /** Optional group for categorization */
  group?: string;
}

export interface SearchableSelectProps {
  /** Array of options to display */
  options: SelectOption[];
  /** Currently selected value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Placeholder when no value selected */
  placeholder?: string;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Text when no results found */
  emptyText?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state for async data */
  loading?: boolean;
  /** Error message */
  error?: string;
  /** Enable recent selections (localStorage key) */
  recentKey?: string;
  /** Max recent items to show */
  maxRecent?: number;
  /** Additional className for trigger button */
  className?: string;
  /** Name for form association */
  name?: string;
  /** Required field */
  required?: boolean;
  /** Allow clearing selection */
  clearable?: boolean;
}

// Local storage helpers for recent selections
const RECENT_PREFIX = "searchable-select-recent-";
const MAX_RECENT_DEFAULT = 5;

function getRecentSelections(key: string): string[] {
  try {
    const stored = localStorage.getItem(`${RECENT_PREFIX}${key}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSelection(key: string, value: string, maxItems: number): void {
  try {
    const recent = getRecentSelections(key);
    // Remove if already exists, add to front
    const filtered = recent.filter((v) => v !== value);
    const updated = [value, ...filtered].slice(0, maxItems);
    localStorage.setItem(`${RECENT_PREFIX}${key}`, JSON.stringify(updated));
  } catch {
    // Silently fail if localStorage is not available
  }
}

export const SearchableSelect = React.forwardRef<HTMLDivElement, SearchableSelectProps>(({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled = false,
  loading = false,
  error,
  recentKey,
  maxRecent = MAX_RECENT_DEFAULT,
  className,
  name,
  required,
  clearable = false,
}, ref) => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Get recent selections if key provided
  // Track open state changes to trigger refresh only when opening
  const [recentRefreshKey, setRecentRefreshKey] = React.useState(0);
  const wasOpenRef = React.useRef(false);
  
  React.useEffect(() => {
    // Only increment key when transitioning from closed to open
    if (open && !wasOpenRef.current) {
      setRecentRefreshKey(k => k + 1);
    }
    wasOpenRef.current = open;
  }, [open]);
  
  const recentValues = React.useMemo(() => {
    if (!recentKey) return [];
    return getRecentSelections(recentKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentKey, recentRefreshKey]);

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lower) ||
        opt.value.toLowerCase().includes(lower)
    );
  }, [options, search]);

  // Get recent options that exist in current options
  const recentOptions = React.useMemo(() => {
    if (!recentKey || search) return []; // Don't show recent when searching
    return recentValues
      .map((v) => options.find((opt) => opt.value === v))
      .filter((opt): opt is SelectOption => !!opt);
  }, [recentValues, options, recentKey, search]);

  // Selected option label
  const selectedOption = options.find((opt) => opt.value === value);

  // Auto-scroll trigger into view when opening on mobile
  React.useEffect(() => {
    if (open && triggerRef.current) {
      // Small delay to let the popover render
      setTimeout(() => {
        triggerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [open]);

  const handleSelect = (selectedValue: string) => {
    // If same value and clearable, clear it
    if (selectedValue === value && clearable) {
      onChange("");
    } else {
      onChange(selectedValue);
      // Save to recent if key provided
      if (recentKey && selectedValue) {
        saveRecentSelection(recentKey, selectedValue, maxRecent);
      }
    }
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-required={required}
            aria-invalid={!!error}
            disabled={disabled || loading}
            className={cn(
              // Mobile-first: proper touch target
              "w-full min-h-[44px] justify-between font-normal",
              // Text size prevents iOS zoom
              "text-base",
              // Error state
              error && "border-destructive focus:ring-destructive",
              className
            )}
          >
            <span className="truncate">
              {loading ? (
                <span className="flex items-center gap-2">
                  <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                  Loading...
                </span>
              ) : (
                selectedOption?.label || (
                  <span className="text-muted-foreground">{placeholder}</span>
                )
              )}
            </span>
            <MaterialIcon name="unfold_more" size="sm" className="ml-2 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        {/* Portal-based content - never clipped */}
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0"
          align="start"
          sideOffset={4}
          // Ensure high z-index for modals
          style={{ zIndex: 100 }}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={setSearch}
              className="text-base" // Prevent iOS zoom
            />
            <CommandList className="max-h-[280px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <CommandEmpty>{emptyText}</CommandEmpty>

                  {/* Recent selections */}
                  {recentOptions.length > 0 && (
                    <CommandGroup heading="Recent">
                      {recentOptions.map((opt) => (
                        <CommandItem
                          key={`recent-${opt.value}`}
                          value={opt.value}
                          onSelect={() => handleSelect(opt.value)}
                          className="min-h-[44px]" // Touch target
                        >
                          <MaterialIcon
                            name="check"
                            size="sm"
                            className={cn(
                              "mr-2 shrink-0",
                              value === opt.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate">{opt.label}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {/* All options */}
                  <CommandGroup heading={recentOptions.length > 0 ? "All" : undefined}>
                    {filteredOptions.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.value}
                        onSelect={() => handleSelect(opt.value)}
                        className="min-h-[44px]" // Touch target
                      >
                        <MaterialIcon
                          name="check"
                          size="sm"
                          className={cn(
                            "mr-2 shrink-0",
                            value === opt.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="truncate">{opt.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  {/* Clear option if clearable and has value */}
                  {clearable && value && (
                    <CommandGroup>
                      <CommandItem
                        value="__clear__"
                        onSelect={() => handleSelect("")}
                        className="min-h-[44px] text-muted-foreground"
                      >
                        Clear selection
                      </CommandItem>
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Hidden input for form association */}
      {name && (
        <input type="hidden" name={name} value={value} required={required} />
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>
      )}
    </div>
  );
});

SearchableSelect.displayName = "SearchableSelect";

export { SearchableSelect as default };
