import { Injectable } from "@nestjs/common";
import { GithubInstallationTokenService } from "./github-installation-token.service";
import type { GithubBranch, GithubContributor, GithubPullRequest, GithubRepo } from "./types/github-api.types";

@Injectable()
export class GithubRestClientService {
    constructor(private tokenService: GithubInstallationTokenService) {}

    private async request<T>(installationId: string, path: string, params?: Record<string, string>): Promise<T> {
        const token = await this.tokenService.getToken(installationId);
        const url = new URL(`https://api.github.com${path}`);
        // map search params from <string, string> as [k,v] to url.searchParams.set
        if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'X-Github-Api-Version': '2022-11-28'
            },
        });

        if (!res.ok) throw new Error(`Github API error: ${res.status} ${await res.text()}`);
        return res.json() as Promise<T>;
    }

    // quick class methods -- have to verify against Gits API url params
    // installationId needed on each fetch -- change later to have a client object that
    // you pass around for these requests
    getRepo(installationId: string, owner: string, repo: string) {
        return this.request<GithubRepo>(installationId, `/repos/${owner}/${repo}`);
    }

    getContributors(installationId: string, owner: string, repo: string) {
        return this.request<GithubContributor[]>(installationId, `/repos/${owner}/${repo}/contributors`);
    }

    // api also takes state as filter (default to all for proof of concept)
    // NEED TO INCORP PAGINATION -- def github paginates 30/page up to 100/page with
    // per_page and page params with ?per_page=100&page=1 with  rel="next" and rel="last" linked lists
    getPulls(installationId: string, owner: string, repo: string) {
        return this.request<GithubPullRequest[]>(installationId, `/repos/${owner}/${repo}/pulls`, { state: 'all'});
    }

    getBranches(installationId: string, owner: string, repo: string) {
        return this.request<GithubBranch[]>(installationId, `/repos/${owner}/${repo}/branches`);
    }

}