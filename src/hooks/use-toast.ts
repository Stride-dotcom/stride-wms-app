import { shimToast } from "@/lib/toastShim";

// Re-export a compatible useToast hook that routes through AppleBanner.
// All 100+ existing call sites import from this file and require no changes.

type ToastProps = {
  title?: string;
  description?: string;
  variant?: string;
  [key: string]: unknown;
};

function toast(props: ToastProps) {
  return shimToast(props);
}

function useToast() {
  return {
    toast,
    toasts: [] as ToastProps[],
    dismiss: () => {},
  };
}

export { useToast, toast };
