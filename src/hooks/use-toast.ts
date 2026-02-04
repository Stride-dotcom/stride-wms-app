import { shimToast } from "@/lib/toastShim";
import React from "react";

// Re-export a compatible useToast hook that routes through AppleBanner.
// All 100+ existing call sites import from this file and require no changes.

export type ToastProps = {
  id?: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  action?: React.ReactNode;
  duration?: number;
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
