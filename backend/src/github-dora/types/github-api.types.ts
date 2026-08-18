export type InstallationAccessTokenResponse = {
  token: string;
  expires_at: string;
};

export type GithubRepo = {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
};

export type GithubContributor = {
  login: string;
  id: number;
  contributions: number;
};

export type GithubPullRequest = {
  id: number;
  number: number;
  state: 'open' | 'closed';
  title: string;
  created_at: string;
  merged_at: string | null;
  closed_at: string | null;
};

export type GithubBranch = {
  name: string;
  commit: { sha: string };
};

export type GithubPushEventPayload = {
  ref: string;
  deleted: boolean;
  repository: { full_name: string };
  commits: {
    id: string;
    timestamp: string;
    author: { name: string; username?: string };
  }[];
};
