// In-app modal dialog queue. Replaces native `window.prompt` / `window.confirm`
// / `window.alert`, which in a KernelSU WebView render as system-chrome popups
// owned by the KernelSU host app — visually jarring, and on some vendor WebView
// builds they refuse to open at all.
//
// The App shell mounts a single <DialogStack/>; any module that needs user
// input imports `dialog` from here and awaits the returned promise.
//
// Only ONE dialog renders at a time (the first in the queue). Subsequent
// requests queue up and render in order after the active one resolves.

import { reactive } from 'vue';

export type DialogKind = 'alert' | 'confirm' | 'prompt' | 'select';

export interface DialogOption<T = string> {
  label: string;
  value: T;
  /** Optional second line shown under the label in the select list. */
  detail?: string;
}

export interface DialogItem {
  id: number;
  kind: DialogKind;
  title: string;
  /** Secondary descriptive text shown below the title. */
  detail?: string;
  okText: string;
  cancelText: string;
  /** Render the OK button in red (e.g. "delete" confirmations). */
  destructive: boolean;
  /** For `prompt`. */
  initialValue?: string;
  placeholder?: string;
  multiline?: boolean;
  /** For `select`. Stored as string; callers convert back via index if they
   * need non-string values. */
  options?: DialogOption<string>[];
  /** Resolve the awaited promise. The payload type depends on `kind`:
   *   alert   -> void
   *   confirm -> boolean
   *   prompt  -> string | null   (null === canceled)
   *   select  -> string | null
   */
  resolve: (result: unknown) => void;
}

const state = reactive({
  items: [] as DialogItem[],
});

let seq = 0;

export function useDialogs() {
  return state;
}

function enqueue<R>(partial: Omit<DialogItem, 'id' | 'resolve'>): Promise<R> {
  return new Promise<R>((resolve) => {
    state.items.push({
      ...partial,
      id: ++seq,
      resolve: resolve as (r: unknown) => void,
    });
  });
}

export function resolveDialog(id: number, result: unknown): void {
  const i = state.items.findIndex((d) => d.id === id);
  if (i < 0) return;
  const [item] = state.items.splice(i, 1);
  item.resolve(result);
}

export interface ConfirmOptions {
  detail?: string;
  okText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export interface PromptOptions {
  detail?: string;
  initialValue?: string;
  placeholder?: string;
  multiline?: boolean;
  okText?: string;
  cancelText?: string;
}

export interface SelectOptions {
  detail?: string;
  cancelText?: string;
}

export const dialog = {
  alert(title: string, detail?: string, okText = '知道了'): Promise<void> {
    return enqueue<void>({
      kind: 'alert',
      title,
      detail,
      okText,
      cancelText: '',
      destructive: false,
    });
  },

  confirm(title: string, opts: ConfirmOptions = {}): Promise<boolean> {
    return enqueue<boolean>({
      kind: 'confirm',
      title,
      detail: opts.detail,
      okText: opts.okText ?? '确认',
      cancelText: opts.cancelText ?? '取消',
      destructive: opts.destructive ?? false,
    });
  },

  prompt(title: string, opts: PromptOptions = {}): Promise<string | null> {
    return enqueue<string | null>({
      kind: 'prompt',
      title,
      detail: opts.detail,
      initialValue: opts.initialValue ?? '',
      placeholder: opts.placeholder,
      multiline: opts.multiline ?? false,
      okText: opts.okText ?? '确定',
      cancelText: opts.cancelText ?? '取消',
      destructive: false,
    });
  },

  select<T extends string>(
    title: string,
    options: DialogOption<T>[],
    opts: SelectOptions = {},
  ): Promise<T | null> {
    return enqueue<T | null>({
      kind: 'select',
      title,
      detail: opts.detail,
      options: options as DialogOption<string>[],
      okText: '',
      cancelText: opts.cancelText ?? '取消',
      destructive: false,
    });
  },
};
