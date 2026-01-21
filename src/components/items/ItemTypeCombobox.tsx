import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ItemType {
  id: string;
  name: string;
}

interface ItemTypeComboboxProps {
  itemTypes: ItemType[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ItemTypeCombobox({
  itemTypes,
  value,
  onChange,
  placeholder = 'Select type...',
  disabled = false,
}: ItemTypeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredTypes = useMemo(() => {
    if (!search) return itemTypes;
    const lower = search.toLowerCase();
    return itemTypes.filter((type) =>
      type.name.toLowerCase().includes(lower)
    );
  }, [itemTypes, search]);

  const selectedType = itemTypes.find((type) => type.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selectedType?.name || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search types..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="!max-h-[200px] overflow-y-auto">
            <CommandEmpty>No item type found.</CommandEmpty>
            <CommandGroup>
              {filteredTypes.map((type) => (
                <CommandItem
                  key={type.id}
                  value={type.id}
                  onSelect={() => {
                    onChange(type.id === value ? '' : type.id);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === type.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {type.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
