import { useCallback, useEffect, useState } from 'react';
import type { WidgetInstance } from './types';

// Loads a widget layout array from localStorage (falling back to the given
// defaults the first time), and keeps it saved on every change. Framework-
// light on purpose — internal-frontend can reuse this verbatim later, it
// doesn't touch anything frontend-app-specific.
export function usePersistedWidgets<TInstance extends WidgetInstance<unknown>>(
  storageKey: string,
  defaults: TInstance[],
): [TInstance[], (next: TInstance[]) => void] {
  const [widgets, setWidgets] = useState<TInstance[]>(() => {
    if (typeof window === 'undefined') return defaults;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return defaults;
      const parsed = JSON.parse(stored) as TInstance[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaults;
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(widgets));
  }, [storageKey, widgets]);

  const update = useCallback((next: TInstance[]) => {
    setWidgets(next);
  }, []);

  return [widgets, update];
}
