// Central catalog of widget types: each widget module registers itself here
// (a side effect of importing its config.ts). Two consumers: DashboardGrid's
// resize clamping (min/max per type) and the "Add widget" picker, which
// lists whatever is registered — so new widget types don't require touching
// either of those, only adding their own registration call.

export type WidgetConstraints = {
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
  defaultW: number;
  defaultH: number;
};

export type WidgetRegistryEntry<TConfig = unknown> = WidgetConstraints & {
  type: string;
  label: string;
  description: string;
  createDefaultConfig: (seedInput: string) => TConfig;
};

const registry = new Map<string, WidgetRegistryEntry<unknown>>();

export function registerWidget<TConfig>(
  entry: WidgetRegistryEntry<TConfig>,
): void {
  registry.set(entry.type, entry as WidgetRegistryEntry<unknown>);
}

export function getWidgetRegistryEntry(
  type: string,
): WidgetRegistryEntry<unknown> | undefined {
  return registry.get(type);
}

export function listWidgetRegistryEntries(): WidgetRegistryEntry<unknown>[] {
  return Array.from(registry.values());
}
