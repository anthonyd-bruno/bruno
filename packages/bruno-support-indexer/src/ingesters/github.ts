import { createHash } from 'crypto';

import { type SourceDocument } from '../types/source-document';
import { TrustTier } from '../types/trust-tier';

const GITHUB_API_BASE = 'https://api.github.com';
const DEFAULT_OWNER = 'usebruno';
const DEFAULT_REPO = 'bruno';
const DEFAULT_MAX_RELEASES = 50;
const DEFAULT_MAX_ISSUES = 100;
const ISSUE_COMMENT_PAGE_SIZE = 10;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 50;
const TRANSIENT_STATUS_CODES = new Set([403, 500, 502, 503]);
const QUALIFYING_ISSUE_LABELS = new Set(['bug', 'question', 'answered']);

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

interface GitHubLabel {
  name?: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  comments: number;
  labels: Array<GitHubLabel | string>;
  created_at: string;
  updated_at: string;
  pull_request?: Record<string, unknown>;
}

interface GitHubIssueComment {
  body: string | null;
  user?: {
    login?: string;
  };
}

export interface GitHubIngesterConfig {
  owner?: string;
  repo?: string;
  apiToken?: string;
  maxReleases?: number;
  maxIssues?: number;
  maxDiscussions?: number;
}

export class GitHubIngester {
  private readonly owner: string;
  private readonly repo: string;
  private readonly apiToken?: string;
  private readonly maxReleases: number;
  private readonly maxIssues: number;

  constructor(config: GitHubIngesterConfig = {}) {
    this.owner = config.owner ?? DEFAULT_OWNER;
    this.repo = config.repo ?? DEFAULT_REPO;
    this.apiToken = config.apiToken ?? process.env.GITHUB_TOKEN;
    this.maxReleases = config.maxReleases ?? DEFAULT_MAX_RELEASES;
    this.maxIssues = config.maxIssues ?? DEFAULT_MAX_ISSUES;
  }

  async ingest(): Promise<SourceDocument[]> {
    const [releases, issues] = await Promise.all([this.fetchReleases(), this.fetchIssues()]);
    const lastSeen = new Date();
    const releaseDocuments = releases.map((release) => this.toReleaseDocument(release, lastSeen));
    const issueDocuments = await Promise.all(
      issues.map(async (issue) => {
        const comments = await this.fetchIssueComments(issue.number, issue.comments);

        return this.toIssueDocument(issue, comments, lastSeen);
      })
    );

    return [...releaseDocuments, ...issueDocuments];
  }

  private async fetchReleases(): Promise<GitHubRelease[]> {
    if (this.maxReleases <= 0) {
      return [];
    }

    const url = new URL(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/releases`
    );

    url.searchParams.set('per_page', String(Math.min(this.maxReleases, 100)));

    return this.fetchJson<GitHubRelease[]>(url.toString());
  }

  private async fetchIssues(): Promise<GitHubIssue[]> {
    if (this.maxIssues <= 0) {
      return [];
    }

    const url = new URL(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/issues`
    );

    url.searchParams.set('state', 'closed');
    url.searchParams.set('sort', 'comments');
    url.searchParams.set('direction', 'desc');
    url.searchParams.set('per_page', String(Math.min(this.maxIssues, 100)));

    const issues = await this.fetchJson<GitHubIssue[]>(url.toString());

    return issues.filter((issue) => !issue.pull_request && this.shouldIncludeIssue(issue));
  }

  private async fetchIssueComments(issueNumber: number, commentCount: number): Promise<GitHubIssueComment[]> {
    if (commentCount <= 0) {
      return [];
    }

    const url = new URL(
      `${GITHUB_API_BASE}/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/issues/${issueNumber}/comments`
    );

    url.searchParams.set('per_page', String(Math.min(commentCount, ISSUE_COMMENT_PAGE_SIZE)));

    return this.fetchJson<GitHubIssueComment[]>(url.toString());
  }

  private shouldIncludeIssue(issue: GitHubIssue): boolean {
    if (issue.comments > 5) {
      return true;
    }

    return this.getLabelNames(issue.labels).some((label) => QUALIFYING_ISSUE_LABELS.has(label.toLowerCase()));
  }

  private getLabelNames(labels: Array<GitHubLabel | string>): string[] {
    return labels
      .map((label) => (typeof label === 'string' ? label : label.name ?? ''))
      .filter((label) => label.length > 0);
  }

  private async fetchJson<T>(url: string): Promise<T> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      const response = await fetch(url, { headers: this.buildHeaders() });

      if (response.ok) {
        return (await response.json()) as T;
      }

      if (TRANSIENT_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
        await this.delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }

      throw new Error(`GitHub API request failed with status ${response.status} for ${url}`);
    }

    throw new Error(`GitHub API request failed after ${MAX_RETRIES} attempts for ${url}`);
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json'
    };

    if (this.apiToken) {
      headers.Authorization = `Bearer ${this.apiToken}`;
    }

    return headers;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private toReleaseDocument(release: GitHubRelease, lastSeen: Date): SourceDocument {
    const content = this.buildReleaseContent(release);

    return {
      id: `gh-release-${release.tag_name}`,
      sourceType: 'github',
      url: release.html_url,
      title: release.name?.trim() || release.tag_name,
      content,
      contentHash: createHash('sha256').update(content).digest('hex'),
      trustTier: TrustTier.Repo,
      lastModified: new Date(release.updated_at || release.published_at || release.created_at),
      lastSeen,
      metadata: {
        github_type: 'release',
        tag_name: release.tag_name,
        comment_count: 0,
        created_at: release.created_at || release.published_at,
        updated_at: release.updated_at
      }
    };
  }

  private toIssueDocument(issue: GitHubIssue, comments: GitHubIssueComment[], lastSeen: Date): SourceDocument {
    const labels = this.getLabelNames(issue.labels);
    const content = this.buildIssueContent(issue, comments);

    return {
      id: `gh-issue-${issue.number}`,
      sourceType: 'github',
      url: issue.html_url,
      title: issue.title,
      content,
      contentHash: createHash('sha256').update(content).digest('hex'),
      trustTier: TrustTier.Community,
      lastModified: new Date(issue.updated_at),
      lastSeen,
      metadata: {
        github_type: 'issue',
        issue_number: issue.number,
        labels,
        comment_count: issue.comments,
        created_at: issue.created_at,
        updated_at: issue.updated_at
      }
    };
  }

  private buildReleaseContent(release: GitHubRelease): string {
    return [`Release ${release.tag_name}`, release.name?.trim() ?? '', release.body?.trim() ?? '']
      .filter((value) => value.length > 0)
      .join('\n\n');
  }

  private buildIssueContent(issue: GitHubIssue, comments: GitHubIssueComment[]): string {
    const parts = [`Issue #${issue.number}: ${issue.title}`];
    const issueBody = issue.body?.trim();

    if (issueBody) {
      parts.push(issueBody);
    }

    const commentSummaries = comments
      .map((comment, index) => {
        const body = comment.body?.trim();

        if (!body) {
          return null;
        }

        const author = comment.user?.login ? `@${comment.user.login}` : 'unknown';

        return `Comment ${index + 1} by ${author}:\n${body}`;
      })
      .filter((comment): comment is string => Boolean(comment));

    if (commentSummaries.length > 0) {
      parts.push(commentSummaries.join('\n\n'));
    }

    return parts.join('\n\n');
  }
}