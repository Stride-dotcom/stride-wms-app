import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

type BannerType = 'success' | 'info' | 'warning' | 'error' | 'destructive';

interface BannerState {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  type: BannerType;
  navigateTo?: string;
  persistent?: boolean;
  senderAvatar?: string;
  messagePreview?: string;
  onDismiss?: () => void;
}

interface AppleBannerContextType {
  banner: BannerState | null;
  showBanner: (config: Omit<BannerState, 'id'>) => void;
  hideBanner: () => void;
}

const AppleBannerContext = createContext<AppleBannerContextType | undefined>(undefined);

export function AppleBannerProvider({ children }: { children: ReactNode }) {
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [bannerQueue, setBannerQueue] = useState<BannerState[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerRef = useRef<BannerState | null>(null);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    bannerRef.current = banner;
  }, [banner]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const hideBanner = useCallback(() => {
    clearTimers();

    // Call onDismiss callback if present
    if (bannerRef.current?.onDismiss) {
      bannerRef.current.onDismiss();
    }

    // Check queue for next persistent banner
    setBannerQueue(prev => {
      if (prev.length > 0) {
        const [next, ...rest] = prev;
        setBanner(next);
        if (!next.persistent) {
          timerRef.current = setTimeout(() => {
            setBanner(currentBanner => {
              if (currentBanner?.id === next.id) {
                return null;
              }
              return currentBanner;
            });
          }, 3000);
        }
        return rest;
      }
      setBanner(null);
      return prev;
    });
  }, [clearTimers]);

  const showBanner = useCallback((config: Omit<BannerState, 'id'>) => {
    clearTimers();

    const id = Date.now().toString() + Math.random().toString(36).slice(2, 9);
    const newBanner: BannerState = { ...config, id };

    // If a persistent banner is already showing and new one is also persistent, queue it
    if (config.persistent && bannerRef.current?.persistent) {
      setBannerQueue(prev => [...prev, newBanner]);
      return;
    }

    // Debounce rapid calls within 100ms for non-persistent banners
    if (!config.persistent) {
      debounceRef.current = setTimeout(() => {
        setBanner(newBanner);
        timerRef.current = setTimeout(() => {
          setBanner(currentBanner => {
            if (currentBanner?.id === newBanner.id) {
              return null;
            }
            return currentBanner;
          });
        }, 3000);
      }, 100);
    } else {
      // Persistent banners show immediately, no auto-dismiss
      setBanner(newBanner);
    }
  }, [clearTimers]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return (
    <AppleBannerContext.Provider value={{ banner, showBanner, hideBanner }}>
      {children}
    </AppleBannerContext.Provider>
  );
}

export function useAppleBanner(): AppleBannerContextType {
  const context = useContext(AppleBannerContext);
  if (context === undefined) {
    throw new Error('useAppleBanner must be used within an AppleBannerProvider');
  }
  return context;
}
