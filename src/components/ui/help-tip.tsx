import { ReactNode } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useFieldHelpTooltip } from '@/hooks/useFieldHelpContent';

interface HelpTipProps {
  /** The help text to display in the popover */
  tooltip: string;
  /** Optional page key for centralized help overrides */
  pageKey?: string;
  /** Optional field key for centralized help overrides */
  fieldKey?: string;
  /** Optional children to render alongside the help icon */
  children?: ReactNode;
  /** Side for the popover placement */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Additional CSS classes for the wrapper */
  className?: string;
}

/**
 * HelpTip — contextual help icon for non-label contexts (headers, buttons, settings).
 *
 * Desktop: hover shows tooltip; click opens popover for longer reading.
 * Mobile/Tablet: tap opens popover (no hover available).
 */
export function HelpTip({ tooltip, pageKey, fieldKey, children, side = 'top', className }: HelpTipProps) {
  const { helpText } = useFieldHelpTooltip(pageKey, fieldKey);
  const displayText = helpText || tooltip;

  return (
    <span className={`inline-flex items-center gap-1 ${className || ''}`}>
      {children}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <Popover>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-muted-foreground text-[10px] font-bold hover:bg-muted/80 transition shrink-0 cursor-help"
                  tabIndex={-1}
                >
                  ?
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side={side} className="max-w-[260px] text-xs">
              <p>{displayText}</p>
            </TooltipContent>
            <PopoverContent side={side} className="max-w-[280px] text-xs leading-relaxed p-3">
              <p>{displayText}</p>
            </PopoverContent>
          </Popover>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}
