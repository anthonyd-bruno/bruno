import type { SourceDocument } from '../types';
import { type SupportSyncScheduleConfig, type SupportSyncSourceGroupId } from './cadence';
import { type SupportSyncStalenessReport, type SupportSyncState } from './staleness';
export type SupportSyncHandler = () => Promise<SourceDocument[]>;
export type SupportSyncHandlerMap = Record<SupportSyncSourceGroupId, SupportSyncHandler>;
export interface SupportSyncAttemptResult {
    attempt: number;
    status: 'succeeded' | 'failed';
    startedAt: string;
    completedAt: string;
    durationMs: number;
    documentCount: number;
    error?: string;
}
export interface SupportSyncSourceGroupRunResult {
    id: SupportSyncSourceGroupId;
    label: string;
    cadenceHours: number;
    staleAfterHours: number;
    status: 'succeeded' | 'failed' | 'skipped_not_due';
    attempts: SupportSyncAttemptResult[];
    documentCount: number;
    lastSuccessfulAtBeforeRun?: string;
    lastSuccessfulAtAfterRun?: string;
    nextDueAt?: string;
}
export interface SupportSyncRunOutput {
    version: 1;
    status: 'completed' | 'failed';
    startedAt: string;
    completedAt: string;
    schedule: SupportSyncScheduleConfig;
    totals: {
        executedGroupCount: number;
        successfulGroupCount: number;
        failedGroupCount: number;
        skippedGroupCount: number;
        documentCount: number;
    };
    sourceGroups: SupportSyncSourceGroupRunResult[];
    staleReport: SupportSyncStalenessReport;
    state: SupportSyncState;
}
export interface RunScheduledSupportSyncInput {
    repoRoot: string;
    scheduleConfig?: unknown;
    previousState?: unknown;
    now?: () => Date;
    sleep?: (ms: number) => Promise<void>;
    handlers?: Partial<SupportSyncHandlerMap>;
}
export declare function createDefaultSupportSyncHandlers(repoRoot: string): SupportSyncHandlerMap;
export declare function runScheduledSupportSync(input: RunScheduledSupportSyncInput): Promise<SupportSyncRunOutput>;
export declare function renderSupportSyncRunMarkdown(output: SupportSyncRunOutput): string;
