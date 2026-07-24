import { useRef, useState } from 'react';
import type { Tone } from '@/types';

export type ToastKind = 'success' | 'warning' | 'danger' | 'info';

export interface ToastState {
  msg: string;
  kind: ToastKind;
}

const KIND_TONE: Record<ToastKind, Tone> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
};

const KIND_ICON: Record<ToastKind, string> = {
  success: 'check',
  warning: 'alert',
  danger: 'alert',
  info: 'api',
};

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, kind: ToastKind = 'success') => {
    setToast({ msg, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2200);
  };

  return {
    toast,
    showToast,
    toastTone: toast ? KIND_TONE[toast.kind] : ('neutral' as Tone),
    toastIconName: toast ? KIND_ICON[toast.kind] : 'check',
  };
}
