import {
  DEFAULT_FRESHNESS_HALF_LIFE_DAYS,
  DEFAULT_FRESHNESS_WEIGHT,
  DEFAULT_TRUST_WEIGHT,
  DEFAULT_VOLATILE_FRESHNESS_HALF_LIFE_DAYS,
  type FreshnessProfile,
  type IndexedChunk,
  type IndexedChunkTrustTier,
  type RankingAdjustment,
  type RankingAdjustmentBasis,
  type RankingOptions,
  type RankingRationale,
  type SearchResult,
  type TrustTierScoreOverrides
} from './types';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SIGNAL_BASELINE = 0.5;

export const DEFAULT_TRUST_TIER_SCORES: Record<IndexedChunkTrustTier, number> = {
  official_docs: 1,
  repo: 0.8,
  community: 0.45,
  external: 0.25
};

export const DEFAULT_VOLATILITY_INDICATORS = [
  'changelog',
  'release notes',
  'release note',
  'downloads',
  'download',
  'pricing',
  "what's new",
  'whats new'
];

interface ResolvedRankingOptions {
  enabled: boolean;
  trustWeight: number;
  freshnessWeight: number;
  trustTierScores: Record<IndexedChunkTrustTier, number>;
  freshnessHalfLifeDays: number;
  volatileFreshnessHalfLifeDays: number;
  volatilityIndicators: string[];
  now: Date;
}

interface FreshnessAssessment {
  profile: FreshnessProfile;
  freshnessHalfLifeDays: number;
  matchedVolatilityIndicators: string[];
}

function resolveRankingOptions(options?: RankingOptions): ResolvedRankingOptions {
  return {
    enabled: options?.enabled ?? true,
    trustWeight: options?.trustWeight ?? DEFAULT_TRUST_WEIGHT,
    freshnessWeight: options?.freshnessWeight ?? DEFAULT_FRESHNESS_WEIGHT,
    trustTierScores: {
      ...DEFAULT_TRUST_TIER_SCORES,
      ...(options?.trustTierScores ?? {})
    },
    freshnessHalfLifeDays: options?.freshnessHalfLifeDays ?? DEFAULT_FRESHNESS_HALF_LIFE_DAYS,
    volatileFreshnessHalfLifeDays:
      options?.volatileFreshnessHalfLifeDays ?? DEFAULT_VOLATILE_FRESHNESS_HALF_LIFE_DAYS,
    volatilityIndicators: (options?.volatilityIndicators ?? DEFAULT_VOLATILITY_INDICATORS).map((indicator) =>
      indicator.toLowerCase()
    ),
    now: options?.now ?? new Date()
  };
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStrings(entry));
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((entry) => collectStrings(entry));
  }

  return [];
}

function assessFreshness(chunk: IndexedChunk, options: ResolvedRankingOptions): FreshnessAssessment {
  const haystacks = [chunk.headingAnchor ?? '', chunk.content, ...collectStrings(chunk.metadata)].map((value) =>
    value.toLowerCase()
  );
  const matchedVolatilityIndicators = options.volatilityIndicators.filter((indicator) =>
    haystacks.some((value) => value.includes(indicator))
  );

  if (matchedVolatilityIndicators.length > 0) {
    return {
      profile: 'volatile',
      freshnessHalfLifeDays: options.volatileFreshnessHalfLifeDays,
      matchedVolatilityIndicators: [...new Set(matchedVolatilityIndicators)]
    };
  }

  return {
    profile: 'standard',
    freshnessHalfLifeDays: options.freshnessHalfLifeDays,
    matchedVolatilityIndicators: []
  };
}

function calculateAgeDays(lastModified: Date, now: Date): number {
  return Math.max(0, (now.getTime() - lastModified.getTime()) / MILLISECONDS_PER_DAY);
}

function calculateFreshnessScore(ageDays: number, freshnessHalfLifeDays: number): number {
  return Math.exp((-Math.LN2 * ageDays) / freshnessHalfLifeDays);
}

function getDirection(contribution: number): RankingAdjustment['direction'] {
  if (contribution > 0) {
    return 'boost';
  }

  if (contribution < 0) {
    return 'penalty';
  }

  return 'neutral';
}

function createAdjustment(
  signal: RankingAdjustment['signal'],
  basis: RankingAdjustmentBasis,
  score: number,
  weight: number,
  contribution: number
): RankingAdjustment {
  return {
    signal,
    basis,
    score,
    weight,
    baseline: SIGNAL_BASELINE,
    contribution,
    direction: getDirection(contribution)
  };
}

export function rerankSearchResults(results: SearchResult[], options?: RankingOptions): SearchResult[] {
  if (results.length === 0) {
    return [];
  }

  const resolvedOptions = resolveRankingOptions(options);

  if (!resolvedOptions.enabled) {
    return [...results].sort((left, right) => right.score - left.score);
  }

  return results
    .map((result) => {
      const { chunk } = result;
      const baseScore = result.score;
      const trustScore = resolvedOptions.trustTierScores[chunk.trustTier];
      const trustContribution = resolvedOptions.trustWeight * (trustScore - SIGNAL_BASELINE);
      const freshnessAssessment = assessFreshness(chunk, resolvedOptions);
      const ageDays = calculateAgeDays(chunk.lastModified, resolvedOptions.now);
      const freshnessScore = calculateFreshnessScore(ageDays, freshnessAssessment.freshnessHalfLifeDays);
      const freshnessContribution = resolvedOptions.freshnessWeight * (freshnessScore - SIGNAL_BASELINE);
      const finalScore = baseScore + trustContribution + freshnessContribution;
      const ranking: RankingRationale = {
        baseScore,
        finalScore,
        trustScore,
        freshnessScore,
        trustTier: chunk.trustTier,
        ageDays,
        freshnessProfile: freshnessAssessment.profile,
        freshnessHalfLifeDays: freshnessAssessment.freshnessHalfLifeDays,
        matchedVolatilityIndicators: freshnessAssessment.matchedVolatilityIndicators,
        adjustments: [
          createAdjustment('trust', 'trust_tier', trustScore, resolvedOptions.trustWeight, trustContribution),
          createAdjustment(
            'freshness',
            freshnessAssessment.profile === 'volatile' ? 'volatile_content' : 'last_modified',
            freshnessScore,
            resolvedOptions.freshnessWeight,
            freshnessContribution
          )
        ]
      };

      return {
        ...result,
        score: finalScore,
        ranking
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function getTrustTierScores(overrides?: TrustTierScoreOverrides): Record<IndexedChunkTrustTier, number> {
  return {
    ...DEFAULT_TRUST_TIER_SCORES,
    ...(overrides ?? {})
  };
}