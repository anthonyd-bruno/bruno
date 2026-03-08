import { execSync } from 'child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'fs/promises';
import path from 'node:path';

import { type SourceDocument } from '../types/source-document';
import { TrustTier } from '../types/trust-tier';

const DEFAULT_MAX_FILE_SIZE_BYTES = 1024 * 1024;
const ROOT_MARKDOWN_FILES = ['readme.md', 'security.md', 'contributing.md', 'license.md', 'publishing.md'];
const PACKAGE_README_FILES = ['readme.md', 'README.md'];
const DOCS_TRANSLATION_SUFFIX_PATTERN = /_(?:[a-z]{2}|[a-z]{4}|[a-z]{2}_[a-z]{2})\.md$/i;

export interface RepoIngesterConfig {
  repoRoot: string;
  maxFileSizeBytes?: number;
}

export class RepoIngester {
  private readonly repoRoot: string;
  private readonly maxFileSizeBytes: number;

  constructor(config: RepoIngesterConfig) {
    this.repoRoot = config.repoRoot;
    this.maxFileSizeBytes = config.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
  }

  async ingest(): Promise<SourceDocument[]> {
    const candidatePaths = await this.discoverFiles();
    const lastSeen = new Date();
    const documentsByPath = new Map<string, SourceDocument>();

    await Promise.all(
      candidatePaths.map(async (relativePath) => {
        const document = await this.createDocument(relativePath, lastSeen);

        if (document?.sourcePath) {
          documentsByPath.set(document.sourcePath, document);
        }
      })
    );

    return Array.from(documentsByPath.values());
  }

  private async discoverFiles(): Promise<string[]> {
    const filePaths = new Set<string>();

    await Promise.all(ROOT_MARKDOWN_FILES.map(async (relativePath) => this.addIfFileExists(filePaths, relativePath)));
    await this.addMatchingFiles(filePaths, 'docs', (relativePath) => this.isSupportedDocsMarkdown(relativePath));
    await this.addPackageReadmes(filePaths);
    await this.addMatchingFiles(filePaths, path.join('packages', 'bruno-cli'), (relativePath) => this.isMarkdownFile(relativePath));
    await this.addMatchingFiles(filePaths, path.join('packages', 'bruno-schema', 'src'), (relativePath) =>
      relativePath.toLowerCase().endsWith('.js')
    );
    await this.addMatchingFiles(filePaths, path.join('packages', 'bruno-schema-types', 'src'), (relativePath) =>
      relativePath.toLowerCase().endsWith('.ts')
    );

    return Array.from(filePaths).sort();
  }

  private async addPackageReadmes(filePaths: Set<string>): Promise<void> {
    const packagesDirectory = path.join(this.repoRoot, 'packages');
    let entries;

    try {
      entries = await readdir(packagesDirectory, { withFileTypes: true });
    } catch {
      return;
    }

    await Promise.all(
      entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
        const packagePath = path.join(packagesDirectory, entry.name);
        let packageEntries;

        try {
          packageEntries = await readdir(packagePath, { withFileTypes: true });
        } catch {
          return;
        }

        packageEntries.forEach((packageEntry) => {
          if (packageEntry.isFile() && PACKAGE_README_FILES.includes(packageEntry.name)) {
            filePaths.add(this.normalizeRelativePath(path.join('packages', entry.name, packageEntry.name)));
          }
        });
      })
    );
  }

  private async addMatchingFiles(
    filePaths: Set<string>,
    relativeDirectory: string,
    matcher: (relativePath: string) => boolean
  ): Promise<void> {
    const entries = await this.walk(relativeDirectory);

    entries.forEach((relativePath) => {
      if (matcher(relativePath)) {
        filePaths.add(relativePath);
      }
    });
  }

  private async walk(relativeDirectory: string): Promise<string[]> {
    const directoryPath = path.join(this.repoRoot, relativeDirectory);
    let entries;

    try {
      entries = await readdir(directoryPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const nestedEntries = await Promise.all(
      entries
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(async (entry) => {
          const entryRelativePath = path.join(relativeDirectory, entry.name);

          if (entry.isDirectory()) {
            return this.walk(entryRelativePath);
          }

          return [this.normalizeRelativePath(entryRelativePath)];
        })
    );

    return nestedEntries.flat();
  }

  private async addIfFileExists(filePaths: Set<string>, relativePath: string): Promise<void> {
    try {
      const fileStats = await stat(path.join(this.repoRoot, relativePath));

      if (fileStats.isFile()) {
        filePaths.add(this.normalizeRelativePath(relativePath));
      }
    } catch {
      // Ignore missing files.
    }
  }

  private async createDocument(relativePath: string, lastSeen: Date): Promise<SourceDocument | null> {
    const fullPath = path.join(this.repoRoot, relativePath);
    const fileStats = await stat(fullPath);

    if (!fileStats.isFile() || fileStats.size > this.maxFileSizeBytes) {
      return null;
    }

    const content = await readFile(fullPath, 'utf8');
    const sourcePath = this.normalizeRelativePath(relativePath);
    const metadata: Record<string, unknown> = {
      file_extension: path.extname(sourcePath).toLowerCase(),
      file_size_bytes: fileStats.size
    };
    const gitSha = this.getGitSha(sourcePath);

    if (gitSha) {
      metadata.git_sha = gitSha;
    }

    return {
      id: this.createDocumentId(sourcePath),
      sourceType: 'repo',
      sourcePath,
      title: this.extractTitle(sourcePath, content),
      content,
      contentHash: createHash('sha256').update(content).digest('hex'),
      trustTier: TrustTier.Repo,
      lastModified: new Date(fileStats.mtime),
      lastSeen: new Date(lastSeen),
      metadata
    };
  }

  private isMarkdownFile(relativePath: string): boolean {
    return relativePath.toLowerCase().endsWith('.md');
  }

  private isSupportedDocsMarkdown(relativePath: string): boolean {
    if (!this.isMarkdownFile(relativePath)) {
      return false;
    }

    const fileName = path.basename(relativePath);
    const isTranslationFile = DOCS_TRANSLATION_SUFFIX_PATTERN.test(fileName);

    return !isTranslationFile || fileName.toLowerCase().endsWith('_en.md');
  }

  private extractTitle(sourcePath: string, content: string): string {
    if (this.isMarkdownFile(sourcePath)) {
      const headingMatch = content.match(/^#\s+(.+)$/m);

      if (headingMatch?.[1]) {
        return headingMatch[1].trim();
      }
    }

    return path.basename(sourcePath);
  }

  private createDocumentId(sourcePath: string): string {
    return `repo-${sourcePath.replace(/[/.\\]/g, '-')}`;
  }

  private getGitSha(sourcePath: string): string | undefined {
    try {
      const result = execSync(`git log -1 --format=%H -- ${JSON.stringify(sourcePath)}`, {
        cwd: this.repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();

      return result || undefined;
    } catch {
      return undefined;
    }
  }

  private normalizeRelativePath(relativePath: string): string {
    return relativePath.split(path.sep).join('/');
  }
}