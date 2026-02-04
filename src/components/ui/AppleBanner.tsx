import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppleBanner } from '@/contexts/AppleBannerContext';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { cn } from '@/lib/utils';

const typeConfig = {
  success: {
    gradient: 'linear-gradient(135deg, rgba(52, 211, 153, 0.75), rgba(16, 185, 129, 0.75))',
    gradientDark: 'linear-gradient(135deg, rgba(52, 211, 153, 0.85), rgba(16, 185, 129, 0.85))',
    icon: 'check_circle',
    borderClass: 'border-green-500/30',
  },
  info: {
    gradient: 'linear-gradient(135deg, rgba(96, 165, 250, 0.75), rgba(59, 130, 246, 0.75))',
    gradientDark: 'linear-gradient(135deg, rgba(96, 165, 250, 0.85), rgba(59, 130, 246, 0.85))',
    icon: 'info',
    borderClass: 'border-blue-500/30',
  },
  warning: {
    gradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.75), rgba(245, 158, 11, 0.75))',
    gradientDark: 'linear-gradient(135deg, rgba(251, 191, 36, 0.85), rgba(245, 158, 11, 0.85))',
    icon: 'warning',
    borderClass: 'border-amber-500/30',
  },
  error: {
    gradient: 'linear-gradient(135deg, rgba(248, 113, 113, 0.75), rgba(239, 68, 68, 0.75))',
    gradientDark: 'linear-gradient(135deg, rgba(248, 113, 113, 0.85), rgba(239, 68, 68, 0.85))',
    icon: 'error',
    borderClass: 'border-red-500/30',
  },
  destructive: {
    gradient: 'linear-gradient(135deg, rgba(220, 38, 38, 0.85), rgba(185, 28, 28, 0.85))',
    gradientDark: 'linear-gradient(135deg, rgba(220, 38, 38, 0.95), rgba(185, 28, 28, 0.95))',
    icon: 'dangerous',
    borderClass: 'border-red-700/40',
  },
} as const;

export function AppleBanner() {
  const { banner, hideBanner } = useAppleBanner();
  const navigate = useNavigate();
  const [isDismissing, setIsDismissing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const [touchDeltaY, setTouchDeltaY] = useState(0);
  const bannerRef = useRef<HTMLDivElement>(null);

  const handleDismiss = useCallback(() => {
    setIsDismissing(true);
    setTimeout(() => {
      hideBanner();
      setIsDismissing(false);
    }, 250);
  }, [hideBanner]);

  const handleBannerClick = useCallback(() => {
    if (banner?.navigateTo) {
      navigate(banner.navigateTo);
      hideBanner();
    }
  }, [banner, navigate, hideBanner]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    // Only allow upward swipe (negative delta)
    if (deltaY < 0) {
      setTouchDeltaY(deltaY);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (Math.abs(touchDeltaY) > 40) {
      handleDismiss();
    }
    setTouchDeltaY(0);
    touchStartY.current = null;
  }, [touchDeltaY, handleDismiss]);

  if (!banner) return null;

  const config = typeConfig[banner.type];
  const isDark = document.documentElement.classList.contains('dark');
  const backgroundGradient = isDark ? config.gradientDark : config.gradient;

  return (
    <div
      ref={bannerRef}
      role="alert"
      aria-live="polite"
      className={cn(
        'absolute top-full left-1/2 -translate-x-1/2 z-[35] max-w-md w-[calc(100%-2rem)] mt-2',
        'backdrop-blur-xl backdrop-saturate-[180%] rounded-2xl border border-white/20',
        config.borderClass,
        isDismissing ? 'animate-banner-roll-up' : 'animate-banner-roll-down',
        banner.navigateTo && 'cursor-pointer'
      )}
      style={{
        background: backgroundGradient,
        boxShadow:
          '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.05)',
        transform: touchDeltaY < 0
          ? `translateX(-50%) translateY(${touchDeltaY}px)`
          : 'translateX(-50%)',
        willChange: touchDeltaY !== 0 ? 'transform' : 'auto',
      }}
      onClick={handleBannerClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <MaterialIcon
          name={banner.icon || config.icon}
          size="md"
          className="text-white shrink-0 mt-0.5"
          filled
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-white leading-tight">
            {banner.title}
          </p>
          {banner.subtitle && (
            <p className="text-xs text-white/90 mt-0.5 leading-tight">
              {banner.subtitle}
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          className="shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 -mt-1"
          aria-label="Dismiss notification"
        >
          <MaterialIcon name="close" size="sm" className="text-white" />
        </button>
      </div>
    </div>
  );
}
