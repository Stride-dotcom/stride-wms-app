import { ICON_IMAGES, IconName } from '@/lib/icon-assets';
import { cn } from '@/lib/utils';

export interface AppIconProps {
  /**
   * The name of the icon to display
   */
  name: IconName;
  /**
   * Size of the icon in pixels (default: 24)
   */
  size?: number;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Alt text for accessibility (defaults to icon name)
   */
  alt?: string;
  /**
   * Optional click handler
   */
  onClick?: () => void;
}

/**
 * AppIcon - Renders icons from the icon-assets library
 *
 * Usage:
 * ```tsx
 * <AppIcon name="tasks" size={32} />
 * <AppIcon name="scan" className="opacity-80" />
 * <AppIcon name="damagedPackage" size={48} alt="Damaged package indicator" />
 * ```
 */
export function AppIcon({
  name,
  size = 24,
  className,
  alt,
  onClick,
}: AppIconProps) {
  const src = ICON_IMAGES[name];

  if (!src) {
    console.warn(`[AppIcon] Unknown icon name: ${name}`);
    return null;
  }

  return (
    <img
      src={src}
      alt={alt || name}
      width={size}
      height={size}
      className={cn('inline-block flex-shrink-0', className)}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined }}
    />
  );
}

/**
 * Preload icons to prevent flashing
 * Call this early in app initialization if needed
 */
export function preloadAppIcons(): void {
  Object.values(ICON_IMAGES).forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}

export default AppIcon;
