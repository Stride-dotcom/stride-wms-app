import { ReactNode } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface HelpTipProps {
  /** The help text to display in the popover */
  tooltip: string;
  /** Optional children to render alongside the help icon */
  children?: ReactNode;
  /** Side for the popover placement */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Additional CSS classes for the wrapper */
  className?: string;
}

/**
 * HelpTip — contextual help icon for non-label contexts (headers, buttons, settings).
 * Wraps/extends the same popover pattern used in LabelWithTooltip.
 * Works on touch devices (tap to view).
 */
export function HelpTip({ tooltip, children, side = 'top', className }: HelpTipProps) {
  return (
    <span className={`inline-flex items-center gap-1 ${className || ''}`}>
      {children}
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
        <PopoverContent side={side} className="max-w-[280px] text-xs leading-relaxed p-3">
          <p>{tooltip}</p>
        </PopoverContent>
      </Popover>
    </span>
  );
}
