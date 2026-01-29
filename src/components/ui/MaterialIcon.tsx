import { cn } from '@/lib/utils';

interface MaterialIconProps {
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  filled?: boolean;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
}

const sizeMap = {
  sm: 'text-base', // 16px
  md: 'text-xl',   // 20px
  lg: 'text-2xl',  // 24px
  xl: 'text-4xl',  // 36px
};

export function MaterialIcon({
  name,
  className,
  size = 'md',
  filled = false,
  weight = 400
}: MaterialIconProps) {
  return (
    <span
      className={cn(
        'material-symbols-outlined select-none',
        sizeMap[size],
        className
      )}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 24`
      }}
    >
      {name}
    </span>
  );
}
