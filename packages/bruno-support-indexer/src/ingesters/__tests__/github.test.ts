import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'crypto';

import { GitHubIngester } from '../github';
import { sourceDocumentSchema } from '../../types/source-document';
import { TrustTier } from '../../types/trust-tier';

const originalFetch = global.fetch;

function createJsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  } as Response;
}

function createRelease(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tag_name: 'v1.2.3',
    name: 'Bruno 1.2.3',
    body: 'Release highlights',
    html_url: 'https://github.com/usebruno/bruno/releases/tag/v1.2.3',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    published_at: '2024-01-02T00:00:00Z',
    ...overrides
  };
}

function createIssue(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    number: 42,
    title: 'How do I import a collection?',
    body: 'Issue body',
    html_url: 'https://github.com/usebruno/bruno/issues/42',
    comments: 2,
    labels: [{ name: 'question' }],
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-02T00:00:00Z',
    ...overrides
  };
}

function createComment(body: string, login = 'maintainer') {
  return {
    body,
    user: {
      login
    }
  };
}

function createDiscussion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    number: 7,
    title: 'Best practices for syncing support sources?',
    body: 'What sources should we refresh most often?',
    url: 'https://github.com/usebruno/bruno/discussions/7',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-02T00:00:00Z',
    isAnswered: true,
    category: {
      name: 'Q&A'
    },
    answer: {
      body: 'Refresh changelog-style content more frequently than docs.',
      author: {
        login: 'core-maintainer'
      }
    },
    comments: {
      nodes: [
        {
          body: 'We run docs daily and changelog every few hours.',
          author: {
            login: 'community-user'
          },
          replies: {
            nodes: [
              {
                body: 'That matches our current expectation.',
                author: {
                  login: 'maintainer'
                }
              }
            ]
          }
        }
      ]
    },
    ...overrides
  };
}

describe('GitHubIngester', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    delete process.env.GITHUB_TOKEN;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    delete process.env.GITHUB_TOKEN;
  });

  it('fetches releases and maps them correctly', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(createJsonResponse([createRelease()]))
      .mockResolvedValueOnce(createJsonResponse([]));

    const ingester = new GitHubIngester();
    const documents = await ingester.ingest();
    const expectedContent = 'Release v1.2.3\n\nBruno 1.2.3\n\nRelease highlights';

    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      id: 'gh-release-v1.2.3',
      sourceType: 'github',
      url: 'https://github.com/usebruno/bruno/releases/tag/v1.2.3',
      title: 'Bruno 1.2.3',
      content: expectedContent,
      trustTier: TrustTier.Repo,
      metadata: {
        github_type: 'release',
        tag_name: 'v1.2.3',
        comment_count: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      }
    });
    expect(documents[0].contentHash).toBe(createHash('sha256').update(expectedContent).digest('hex'));
  });

  it('filters issues by labels or comment count and fetches comments for qualifying issues', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(createJsonResponse([]))
      .mockResolvedValueOnce(
        createJsonResponse([
          createIssue({ number: 101, labels: [{ name: 'bug' }], comments: 1 }),
          createIssue({ number: 202, title: 'Popular closed issue', labels: [], comments: 6 }),
          createIssue({ number: 303, title: 'Ignore me', labels: [{ name: 'enhancement' }], comments: 1 })
        ])
      )
      .mockResolvedValueOnce(createJsonResponse([createComment('First fix', 'alice')]))
      .mockResolvedValueOnce(createJsonResponse([createComment('Popular workaround', 'bob')]));

    const ingester = new GitHubIngester();
    const documents = await ingester.ingest();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(documents).toHaveLength(2);
    expect(documents.map((document) => document.id)).toEqual(['gh-issue-101', 'gh-issue-202']);
    expect(documents[0]).toMatchObject({
      trustTier: TrustTier.Community,
      metadata: {
        github_type: 'issue',
        issue_number: 101,
        labels: ['bug'],
        comment_count: 1,
        created_at: '2024-02-01T00:00:00Z',
        updated_at: '2024-02-02T00:00:00Z'
      }
    });
    expect(documents[0].content).toContain('Comment 1 by @alice');
    expect(documents[1].content).toContain('Popular workaround');
  });

  it('includes the API token from the environment when available', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    process.env.GITHUB_TOKEN = 'env-token';

    fetchMock
      .mockResolvedValueOnce(createJsonResponse([]))
      .mockResolvedValueOnce(createJsonResponse([]))
      .mockResolvedValueOnce(createJsonResponse({ data: { repository: { discussions: { nodes: [] } } } }));

    const ingester = new GitHubIngester();

    await ingester.ingest();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer env-token'
      }
    });
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer env-token',
        'Content-Type': 'application/json'
      }
    });
  });

  it('omits the API token header when one is not provided', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock.mockResolvedValueOnce(createJsonResponse([])).mockResolvedValueOnce(createJsonResponse([]));

    const ingester = new GitHubIngester();

    await ingester.ingest();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: {
        Accept: 'application/vnd.github+json'
      }
    });
    expect((fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers.Authorization).toBeUndefined();
  });

  it('retries a 403 response and succeeds on a later attempt', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ message: 'rate limited' }, 403))
      .mockResolvedValueOnce(createJsonResponse([]))
      .mockResolvedValueOnce(createJsonResponse([createRelease()]));

    const ingester = new GitHubIngester();
    const documents = await ingester.ingest();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(documents).toHaveLength(1);
  });

  it('retries a 500 response and succeeds on a later attempt', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(createJsonResponse([]))
      .mockResolvedValueOnce(createJsonResponse({ message: 'server error' }, 500))
      .mockResolvedValueOnce(
        createJsonResponse([createIssue({ number: 99, labels: [{ name: 'answered' }], comments: 0 })])
      );

    const ingester = new GitHubIngester();
    const documents = await ingester.ingest();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(documents).toHaveLength(1);
    expect(documents[0].id).toBe('gh-issue-99');
  });

  it('fetches discussion documents through GitHub GraphQL when a token is available', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(createJsonResponse([]))
      .mockResolvedValueOnce(createJsonResponse([]))
      .mockResolvedValueOnce(
        createJsonResponse({
          data: {
            repository: {
              discussions: {
                nodes: [createDiscussion()]
              }
            }
          }
        })
      );

    const ingester = new GitHubIngester({ apiToken: 'discussion-token' });
    const documents = await ingester.ingest();
    const expectedContent = [
      'Discussion #7: Best practices for syncing support sources?',
      'What sources should we refresh most often?',
      'Accepted answer by @core-maintainer:\nRefresh changelog-style content more frequently than docs.',
      'Comment 1 by @community-user:\nWe run docs daily and changelog every few hours.',
      'Reply 1 by @maintainer:\nThat matches our current expectation.'
    ].join('\n\n');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe('https://api.github.com/graphql');
    expect(JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string)).toMatchObject({
      variables: {
        owner: 'usebruno',
        repo: 'bruno',
        first: 50,
        commentFirst: 5,
        replyFirst: 3
      }
    });
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      id: 'gh-discussion-7',
      sourceType: 'github',
      url: 'https://github.com/usebruno/bruno/discussions/7',
      title: 'Best practices for syncing support sources?',
      content: expectedContent,
      trustTier: TrustTier.Community,
      metadata: {
        github_type: 'discussion',
        discussion_number: 7,
        category_name: 'Q&A',
        comment_count: 1,
        is_answered: true,
        created_at: '2024-03-01T00:00:00Z',
        updated_at: '2024-03-02T00:00:00Z'
      }
    });
    expect(documents[0].contentHash).toBe(createHash('sha256').update(expectedContent).digest('hex'));
  });

  it('returns documents that conform to the SourceDocument schema', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(createJsonResponse([createRelease()]))
      .mockResolvedValueOnce(createJsonResponse([createIssue()]))
      .mockResolvedValueOnce(createJsonResponse({ data: { repository: { discussions: { nodes: [createDiscussion()] } } } }))
      .mockResolvedValueOnce(createJsonResponse([createComment('Resolved in v1.2.3')]));

    const ingester = new GitHubIngester({ apiToken: 'schema-token' });
    const documents = await ingester.ingest();

    expect(() => documents.forEach((document) => sourceDocumentSchema.parse(document))).not.toThrow();
  });
});