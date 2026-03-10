import {
  DEFAULT_MIN_EVIDENCE,
  evidencePackOptionsSchema,
  evidencePackResultSchema,
  searchResultSchema,
  type EvidenceBundle,
  type EvidenceDocumentReference,
  type EvidencePackOptions,
  type EvidencePackResult,
  type IndexedChunk,
  type SearchResult
} from './types';

type EvidenceLocation = { kind: 'url'; url: string } | { kind: 'sourcePath'; sourcePath: string };

function pickFirstString(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim();
}

function getMetadataString(chunk: IndexedChunk, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = chunk.metadata[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function resolveDocumentReference(
  result: SearchResult,
  documentsById?: Record<string, EvidenceDocumentReference>
): EvidenceDocumentReference {
  const reference = documentsById?.[result.chunk.documentId];

  return {
    title: pickFirstString(reference?.title, getMetadataString(result.chunk, 'title', 'document_title')),
    url: pickFirstString(reference?.url, getMetadataString(result.chunk, 'url', 'canonical_url')),
    sourcePath: pickFirstString(reference?.sourcePath, getMetadataString(result.chunk, 'sourcePath', 'source_path'))
  };
}

function resolveEvidenceLocation(
  chunk: IndexedChunk,
  reference: EvidenceDocumentReference
): EvidenceLocation | undefined {
  if (chunk.sourceType === 'repo') {
    if (reference.sourcePath) {
      return { kind: 'sourcePath', sourcePath: reference.sourcePath };
    }

    if (reference.url) {
      return { kind: 'url', url: reference.url };
    }

    return undefined;
  }

  if (reference.url) {
    return { kind: 'url', url: reference.url };
  }

  if (reference.sourcePath) {
    return { kind: 'sourcePath', sourcePath: reference.sourcePath };
  }

  return undefined;
}

function createEvidenceKey(location: EvidenceLocation): string {
  return location.kind === 'url' ? `url:${location.url}` : `sourcePath:${location.sourcePath}`;
}

function mergeEvidence(existing: EvidenceBundle, candidate: SearchResult, title: string): EvidenceBundle {
  const isNewPrimary = candidate.score > existing.retrievalScore;
  const nextChunkIds = existing.supportingChunkIds.includes(candidate.chunk.id)
    ? existing.supportingChunkIds
    : [...existing.supportingChunkIds, candidate.chunk.id];

  return {
    ...existing,
    title: existing.title === existing.documentId ? title : existing.title,
    headingAnchor: isNewPrimary
      ? candidate.chunk.headingAnchor ?? existing.headingAnchor
      : existing.headingAnchor ?? candidate.chunk.headingAnchor,
    retrievalScore: Math.max(existing.retrievalScore, candidate.score),
    ranking: isNewPrimary ? candidate.ranking : existing.ranking,
    supportCount: nextChunkIds.length,
    supportingChunkIds: nextChunkIds
  };
}

function createEvidenceBundle(result: SearchResult, title: string, location: EvidenceLocation): EvidenceBundle {
  const base = {
    documentId: result.chunk.documentId,
    sourceType: result.chunk.sourceType,
    title,
    headingAnchor: result.chunk.headingAnchor,
    trustTier: result.chunk.trustTier,
    retrievalScore: result.score,
    ranking: result.ranking,
    supportCount: 1,
    supportingChunkIds: [result.chunk.id]
  };

  if (location.kind === 'url') {
    return {
      ...base,
      url: location.url
    };
  }

  return {
    ...base,
    sourcePath: location.sourcePath
  };
}

export function packEvidence(results: SearchResult[], options?: EvidencePackOptions): EvidencePackResult {
  const validatedResults = results.map((result) => searchResultSchema.parse(result));
  const validatedOptions = evidencePackOptionsSchema.parse(options ?? {});
  const minEvidence = validatedOptions.minEvidence ?? DEFAULT_MIN_EVIDENCE;
  const maxEvidence = validatedOptions.maxEvidence ?? validatedResults.length;
  const evidenceByKey = new Map<string, EvidenceBundle>();

  for (const result of validatedResults) {
    const reference = resolveDocumentReference(result, validatedOptions.documentsById);
    const location = resolveEvidenceLocation(result.chunk, reference);

    if (!location) {
      continue;
    }

    const key = createEvidenceKey(location);
    const title = reference.title ?? result.chunk.documentId;
    const existing = evidenceByKey.get(key);

    if (existing) {
      evidenceByKey.set(key, mergeEvidence(existing, result, title));
      continue;
    }

    if (evidenceByKey.size >= maxEvidence) {
      break;
    }

    evidenceByKey.set(key, createEvidenceBundle(result, title, location));
  }

  const packedEvidence = Array.from(evidenceByKey.values());
  const packResult: EvidencePackResult =
    packedEvidence.length >= minEvidence
      ? {
          status: 'ready',
          evidence: packedEvidence,
          totalHits: validatedResults.length,
          packedEvidenceCount: packedEvidence.length,
          minEvidence
        }
      : {
          status: 'insufficient_evidence',
          reason: 'below_minimum_evidence',
          evidence: [],
          totalHits: validatedResults.length,
          packedEvidenceCount: packedEvidence.length,
          minEvidence
        };

  return evidencePackResultSchema.parse(packResult) as EvidencePackResult;
}