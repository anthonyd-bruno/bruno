import { afterAll, afterEach, describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'node:path';

import { RepoIngester } from '../repo';
import { sourceDocumentSchema, TrustTier } from '../../types';

const tempDirectories: string[] = [];

async function writeRepoFile(repoRoot: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(repoRoot, relativePath);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function createFixtureRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'repo-ingester-'));
  tempDirectories.push(repoRoot);

  await Promise.all([
    writeRepoFile(repoRoot, 'readme.md', '# Root Readme\nMain repo guide'),
    writeRepoFile(repoRoot, 'security.md', '# Security\nSecurity guidance'),
    writeRepoFile(repoRoot, 'random.md', '# Ignore Me\nNot in scope'),
    writeRepoFile(repoRoot, 'docs/guide.md', '# Docs Guide\nGeneral docs'),
    writeRepoFile(repoRoot, 'docs/contributing/contributing_bn.md', '# Bengali Translation\nSkip me'),
    writeRepoFile(repoRoot, 'docs/contributing/contributing_en.md', '# English Contribution Guide\nKeep me'),
    writeRepoFile(repoRoot, 'docs/readme/readme_pt_br.md', '# Portuguese Translation\nSkip me'),
    writeRepoFile(repoRoot, 'packages/pkg-one/readme.md', '# Package One\nPackage docs'),
    writeRepoFile(repoRoot, 'packages/pkg-two/README.md', '# Package Two\nUppercase readme'),
    writeRepoFile(repoRoot, 'packages/bruno-cli/readme.md', '# Bruno CLI\nCLI docs'),
    writeRepoFile(repoRoot, 'packages/bruno-cli/docs/usage.md', '# CLI Usage\nUsage docs'),
    writeRepoFile(repoRoot, 'packages/bruno-schema/src/schema.js', 'module.exports = { version: 1 };'),
    writeRepoFile(repoRoot, 'packages/bruno-schema-types/src/schema.ts', 'export type Schema = { version: number };')
  ]);

  return repoRoot;
}

describe('RepoIngester', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await Promise.all(tempDirectories.map(async (directory) => rm(directory, { recursive: true, force: true })));
  });

  it('discovers the expected repo files, skips translations, and deduplicates by path', async () => {
    const repoRoot = await createFixtureRepo();
    const ingester = new RepoIngester({ repoRoot });
    const documents = await ingester.ingest();
    const sourcePaths = documents.map((document) => document.sourcePath).sort();

    expect(sourcePaths).toEqual([
      'docs/contributing/contributing_en.md',
      'docs/guide.md',
      'packages/bruno-cli/docs/usage.md',
      'packages/bruno-cli/readme.md',
      'packages/bruno-schema-types/src/schema.ts',
      'packages/bruno-schema/src/schema.js',
      'packages/pkg-one/readme.md',
      'packages/pkg-two/README.md',
      'readme.md',
      'security.md'
    ]);
    expect(sourcePaths).not.toContain('docs/contributing/contributing_bn.md');
    expect(sourcePaths).not.toContain('docs/readme/readme_pt_br.md');
    expect(sourcePaths.filter((sourcePath) => sourcePath === 'packages/bruno-cli/readme.md')).toHaveLength(1);
  });

  it('skips files larger than the configured max size', async () => {
    const repoRoot = await createFixtureRepo();
    await writeRepoFile(repoRoot, 'docs/large.md', '# Large\n' + 'x'.repeat(128));

    const ingester = new RepoIngester({ repoRoot, maxFileSizeBytes: 64 });
    const sourcePaths = (await ingester.ingest()).map((document) => document.sourcePath);

    expect(sourcePaths).not.toContain('docs/large.md');
  });

  it('extracts markdown titles from headings and uses filenames for non-markdown files', async () => {
    const repoRoot = await createFixtureRepo();
    const ingester = new RepoIngester({ repoRoot });
    const documents = await ingester.ingest();
    const docsGuide = documents.find((document) => document.sourcePath === 'docs/guide.md');
    const schemaDocument = documents.find((document) => document.sourcePath === 'packages/bruno-schema/src/schema.js');

    expect(docsGuide?.title).toBe('Docs Guide');
    expect(schemaDocument?.title).toBe('schema.js');
  });

  it('populates metadata, hashes content, and returns schema-valid documents', async () => {
    const repoRoot = await createFixtureRepo();
    const ingester = new RepoIngester({ repoRoot });
    const documents = await ingester.ingest();
    const readmeDocument = documents.find((document) => document.sourcePath === 'readme.md');
    const readmeStats = await stat(path.join(repoRoot, 'readme.md'));

    expect(readmeDocument).toMatchObject({
      id: 'repo-readme-md',
      sourceType: 'repo',
      title: 'Root Readme',
      trustTier: TrustTier.Repo,
      metadata: {
        file_extension: '.md',
        file_size_bytes: readmeStats.size
      }
    });
    expect(readmeDocument?.contentHash).toBe(
      createHash('sha256').update('# Root Readme\nMain repo guide').digest('hex')
    );
    expect(() => documents.forEach((document) => sourceDocumentSchema.parse(document))).not.toThrow();
  });
});