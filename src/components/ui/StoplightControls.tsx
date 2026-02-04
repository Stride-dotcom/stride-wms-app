import { cn } from '@/lib/utils';

interface StoplightControlsProps {
  onClose: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  showMinimize?: boolean;
  showMaximize?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: { dotClass: 'stoplight-sm', gap: 'gap-1.5', svgScale: 0.8 },
  md: { dotClass: 'stoplight-md', gap: 'gap-2', svgScale: 1 },
  lg: { dotClass: 'stoplight-lg', gap: 'gap-2', svgScale: 1.15 },
} as const;

export function StoplightControls({
  onClose,
  onMinimize,
  onMaximize,
  showMinimize = true,
  showMaximize = true,
  size = 'md',
  className,
}: StoplightControlsProps) {
  const config = sizeConfig[size];
  const scale = config.svgScale;

  return (
    <div
      className={cn('group flex items-center', config.gap, className)}
      role="group"
      aria-label="Window controls"
    >
      {/* Close — Red */}
      <button
        onClick={onClose}
        className={cn('stoplight-dot stoplight-close relative', config.dotClass)}
        aria-label="Close"
        type="button"
      >
        <svg
          className="absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          width={6 * scale}
          height={6 * scale}
          viewBox="0 0 6 6"
          fill="none"
          stroke="#4D0000"
          strokeWidth="1.2"
          strokeLinecap="round"
        >
          <line x1="0.5" y1="0.5" x2="5.5" y2="5.5" />
          <line x1="5.5" y1="0.5" x2="0.5" y2="5.5" />
        </svg>
      </button>

      {/* Minimize — Yellow */}
      {showMinimize && (
        <button
          onClick={onMinimize}
          disabled={!onMinimize}
          aria-disabled={!onMinimize}
          className={cn(
            'stoplight-dot stoplight-minimize relative',
            config.dotClass,
            !onMinimize && 'opacity-35 cursor-default'
          )}
          aria-label="Minimize"
          type="button"
        >
          <svg
            className="absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            width={6 * scale}
            height={2 * scale}
            viewBox="0 0 6 2"
            fill="none"
            stroke="#995700"
            strokeWidth="1.2"
            strokeLinecap="round"
          >
            <line x1="0.5" y1="1" x2="5.5" y2="1" />
          </svg>
        </button>
      )}

      {/* Maximize — Green */}
      {showMaximize && (
        <button
          onClick={onMaximize}
          disabled={!onMaximize}
          aria-disabled={!onMaximize}
          className={cn(
            'stoplight-dot stoplight-maximize relative',
            config.dotClass,
            !onMaximize && 'opacity-35 cursor-default'
          )}
          aria-label="Maximize"
          type="button"
        >
          <svg
            className="absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            width={6 * scale}
            height={6 * scale}
            viewBox="0 0 6 6"
            fill="none"
            stroke="#006500"
            strokeWidth="1.2"
            strokeLinecap="round"
          >
            <polyline points="1,5 1,1 5,1" />
            <polyline points="5,1 5,5 1,5" />
          </svg>
        </button>
      )}
    </div>
  );
}
