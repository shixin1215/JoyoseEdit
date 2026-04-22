// Global light / dark / auto theme preference. Applies `data-theme` to the
// document root so CSS variable overrides in main.css take effect. Persists
// the user's explicit choice in localStorage; "auto" means "follow OS"
// via prefers-color-scheme.
//
// In a KernelSU WebView, the host may or may not forward system theme
// changes to the embedded view — auto works on desktop dev (vite) and on
// most modern Android WebView builds; on old ones it'll simply stick to
// whatever was resolved at startup.

import { reactive } from 'vue';

export type ThemeMode = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'joyose-edit:theme';

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'auto') return v;
  } catch {
    /* localStorage blocked */
  }
  return 'auto';
}

function prefersLight(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: light)').matches;
}

export const theme = reactive({
  mode: readStored() as ThemeMode,
  /** Resolved value: the actual effect on the DOM. Never 'auto'. */
  effective: 'dark' as 'light' | 'dark',
});

function resolveEffective(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode;
  return prefersLight() ? 'light' : 'dark';
}

function apply(): void {
  theme.effective = resolveEffective(theme.mode);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme.effective);
  }
}

export function setTheme(mode: ThemeMode): void {
  theme.mode = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
  apply();
}

/** Cycle auto → light → dark → auto. Mirrors the toggle button in App.vue. */
export function cycleTheme(): void {
  setTheme(theme.mode === 'auto' ? 'light' : theme.mode === 'light' ? 'dark' : 'auto');
}

/** Apply the stored preference to the DOM + wire up OS-level change detection.
 * Call once at app boot. */
export function initTheme(): void {
  apply();

  // React to OS-level changes while we're in 'auto' mode.
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      if (theme.mode === 'auto') apply();
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if ((mq as any).addListener) (mq as any).addListener(onChange);
  }
}
