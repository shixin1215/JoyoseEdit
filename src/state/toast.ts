// In-app toast / notification queue. Replaces native `alert()` which, in a
// WebView context, renders as a blocking, visually jarring system dialog.
// The App shell mounts a single <ToastStack/>; any module that needs to
// surface a message imports `toast` from here.

import { reactive } from 'vue';

export type ToastKind = 'info' | 'success' | 'warn' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  detail?: string;
}

const state = reactive({
  items: [] as Toast[],
});

let seq = 0;

export function useToasts() {
  return state;
}

export function pushToast(
  kind: ToastKind,
  message: string,
  detail?: string,
  ttlMs = 4000,
): number {
  const id = ++seq;
  state.items.push({ id, kind, message, detail });
  if (ttlMs > 0) {
    window.setTimeout(() => dismissToast(id), ttlMs);
  }
  return id;
}

export function dismissToast(id: number): void {
  const i = state.items.findIndex((t) => t.id === id);
  if (i >= 0) state.items.splice(i, 1);
}

/** Convenience namespace. Error / warn stay visible longer so stack traces
 * can be read; info / success auto-dismiss quickly. */
export const toast = {
  info: (msg: string, detail?: string) => pushToast('info', msg, detail, 3500),
  success: (msg: string, detail?: string) => pushToast('success', msg, detail, 3500),
  warn: (msg: string, detail?: string) => pushToast('warn', msg, detail, 6000),
  error: (msg: string, detail?: string) => pushToast('error', msg, detail, 9000),
  /** Extract a human message from an unknown thrown value. */
  fromError(err: unknown, fallback = '发生未知错误'): number {
    const message = (err as Error)?.message ?? String(err ?? fallback);
    return pushToast('error', fallback, message, 9000);
  },
};
