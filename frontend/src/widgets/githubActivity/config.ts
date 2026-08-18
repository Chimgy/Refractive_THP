import { registerWidget } from '../registry';

export const WIDGET_TYPE = 'github_activity' as const;

export type GithubActivityConfig = Record<string, never>;

export function defaultGithubActivityConfig(): GithubActivityConfig {
  return {};
}

registerWidget<GithubActivityConfig>({
  type: WIDGET_TYPE,
  label: 'GitHub Activity',
  description: 'Real commit activity from the linked GitHub repo — by author, by day, and branches.',
  minW: 4,
  minH: 6,
  maxW: 8,
  maxH: 14,
  defaultW: 5,
  defaultH: 9,
  createDefaultConfig: defaultGithubActivityConfig,
});
