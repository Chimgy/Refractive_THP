import { request } from './client';

export type CommitByAuthor = { author: string; count: number };
export type CommitByDay = { day: string; count: number };
export type GithubBranch = { name: string; commit: { sha: string } };

export function getCommitsByAuthor(projectId: string): Promise<CommitByAuthor[]> {
  return request<CommitByAuthor[]>(
    `/tenant/projects/${encodeURIComponent(projectId)}/github-link/commits/by-author`,
  );
}

export function getCommitsByDay(projectId: string): Promise<CommitByDay[]> {
  return request<CommitByDay[]>(
    `/tenant/projects/${encodeURIComponent(projectId)}/github-link/commits/by-day`,
  );
}

export function getBranches(projectId: string): Promise<GithubBranch[]> {
  return request<GithubBranch[]>(
    `/tenant/projects/${encodeURIComponent(projectId)}/github-link/branches`,
  );
}
