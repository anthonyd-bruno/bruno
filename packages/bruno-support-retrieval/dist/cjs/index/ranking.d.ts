import { type IndexedChunkTrustTier, type RankingOptions, type SearchResult, type TrustTierScoreOverrides } from './types';
export declare const DEFAULT_TRUST_TIER_SCORES: Record<IndexedChunkTrustTier, number>;
export declare const DEFAULT_VOLATILITY_INDICATORS: string[];
export declare function rerankSearchResults(results: SearchResult[], options?: RankingOptions): SearchResult[];
export declare function getTrustTierScores(overrides?: TrustTierScoreOverrides): Record<IndexedChunkTrustTier, number>;
