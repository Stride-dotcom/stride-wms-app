import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

type BannerType = 'success' | 'info' | 'warning' | 'error' | 'destructive';

interface BannerState {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  type: BannerType;
  navigateTo?: string;
}

interface AppleBannerContextType {
  banner: BannerState | null;
  showBanner: (config: Omit<BannerState, 'id'>) => void;
  hideBanner: () => void;
}

const AppleBannerContext = createContext<AppleBannerContextType | undefined>(undefined);

export function AppleBannerProvider({ children }: { children: ReactNode }) {
  const [banner, setBanner] = useState<BannerState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setBanner(null);
  }, [clearTimers]);

  const showBanner = useCallback((config: Omit<BannerState, 'id'>) => {
    clearTimers();

    // Debounce rapid calls within 100ms
    debounceRef.current = setTimeout(() => {
      const id = Date.now().toString() + Math.random().toString(36).slice(2, 9);
      const newBanner: BannerState = { ...config, id };
      setBanner(newBanner);

      // Auto-dismiss after 3000ms
      timerRef.current = setTimeout(() => {
        setBanner(null);
      }, 3000);
    }, 100);
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
