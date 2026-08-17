export type GridLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type WidgetInstance<TConfig = unknown> = {
  id: string;
  type: string;
  title: string;
  description?: string;
  layout: GridLayout;
  config: TConfig;
};
