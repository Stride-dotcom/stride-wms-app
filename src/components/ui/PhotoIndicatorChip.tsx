import { cn } from '@/lib/utils';
import { AlertTriangle, Search, Star, Wrench } from 'lucide-react';

const indicatorConfig = {
  attention: {
    icon: AlertTriangle,
    label: 'Attention',
    textColor: 'text-red-600 dark:text-red-400',
    glowColor: 'shadow-red-500/30',
    borderColor: 'border-red-500/30',
  },
  inspection: {
    icon: Search,
    label: 'Inspection',
    textColor: 'text-blue-600 dark:text-blue-400',
    glowColor: 'shadow-blue-500/30',
    borderColor: 'border-blue-500/30',
  },
  primary: {
    icon: Star,
    label: 'Primary',
    textColor: 'text-amber-600 dark:text-amber-400',
    glowColor: 'shadow-amber-500/30',
    borderColor: 'border-amber-500/30',
  },
  repair: {
    icon: Wrench,
    label: 'Repair',
    textColor: 'text-purple-600 dark:text-purple-400',
    glowColor: 'shadow-purple-500/30',
    borderColor: 'border-purple-500/30',
  },
} as const;

interface PhotoIndicatorChipProps {
  type: keyof typeof indicatorConfig;
  className?: string;
  showLabel?: boolean;
}

export function PhotoIndicatorChip({
  type,
  className,
  showLabel = true,
}: PhotoIndicatorChipProps) {
  const config = indicatorConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1',
        'rounded-full border',
        'backdrop-blur-xl bg-white/60 dark:bg-black/40',
        'shadow-sm',
        config.textColor,
        config.borderColor,
        config.glowColor,
        'min-h-[32px]',
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      {showLabel && (
        <span className="text-xs font-semibold whitespace-nowrap">
          {config.label}
        </span>
      )}
    </div>
  );
}
