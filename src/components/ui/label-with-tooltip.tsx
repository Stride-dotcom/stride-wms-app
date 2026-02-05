import { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LabelWithTooltipProps {
  htmlFor?: string;
  children: ReactNode;
  tooltip: string;
  required?: boolean;
  className?: string;
}

export function LabelWithTooltip({ htmlFor, children, tooltip, required, className }: LabelWithTooltipProps) {
  return (
    <div className={`flex items-center gap-1 ${className || ''}`}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {children}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-muted-foreground text-[10px] font-bold hover:bg-muted/80 transition shrink-0 cursor-help" tabIndex={-1}>
              ?
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
