// src/lib/toastShim.ts
//
// This module re-exports a "toast" function that matches the API of the
// original toast library but routes everything through AppleBanner.
//
// The existing use-toast hook delegates to this shim so all 100+ call sites
// automatically use the AppleBanner system without changing imports.

type BannerType = 'success' | 'info' | 'warning' | 'error' | 'destructive';

interface ShowBannerConfig {
  title: string;
  subtitle?: string;
  type: BannerType;
  navigateTo?: string;
  persistent?: boolean;
}

// This will be set by the AppleBannerProvider on mount
let _showBanner: ((config: ShowBannerConfig) => void) | null = null;

export function registerBannerFunction(fn: typeof _showBanner) {
  _showBanner = fn;
}

function showOrFallback(type: BannerType, title: string, subtitle?: string) {
  if (_showBanner) {
    _showBanner({ title, subtitle, type });
  }
}

// Handles the shadcn toast({ title, description, variant }) pattern
export function shimToast(props: {
  title?: string;
  description?: string;
  variant?: string;
  [key: string]: unknown;
}) {
  const title = (typeof props.title === 'string' ? props.title : '') || 'Notification';
  const subtitle = typeof props.description === 'string' ? props.description : undefined;

  let type: BannerType = 'success';
  if (props.variant === 'destructive') {
    type = 'error';
  }

  showOrFallback(type, title, subtitle);

  // Return a compatible shape for any code expecting { id, dismiss, update }
  return {
    id: Date.now().toString(),
    dismiss: () => {},
    update: () => {},
  };
}

// Direct API for explicit type calls (sonner-compatible)
// Second param accepts string description or options object (options are ignored)
export const toast = Object.assign(
  (message: string) => showOrFallback('info', message),
  {
    success: (message: string, _opts?: string | Record<string, unknown>) =>
      showOrFallback('success', message, typeof _opts === 'string' ? _opts : undefined),
    error: (message: string, _opts?: string | Record<string, unknown>) =>
      showOrFallback('error', message, typeof _opts === 'string' ? _opts : undefined),
    warning: (message: string, _opts?: string | Record<string, unknown>) =>
      showOrFallback('warning', message, typeof _opts === 'string' ? _opts : undefined),
    info: (message: string, _opts?: string | Record<string, unknown>) =>
      showOrFallback('info', message, typeof _opts === 'string' ? _opts : undefined),
  }
);
