import type { SupportSyncScheduleConfig, SupportSyncSourceGroupId } from './cadence';
export interface SupportSyncState {
    version: 1;
    updatedAt?: string;
    lastSuccessfulRunByGroup: Partial<Record<SupportSyncSourceGroupId, string>>;
}
export interface SupportSyncGroupFreshness {
    id: SupportSyncSourceGroupId;
    label: string;
    cadenceHours: number;
    staleAfterHours: number;
    status: 'fresh' | 'stale' | 'never_synced';
    lastSuccessfulAt?: string;
    ageHours?: number;
}
export interface SupportSyncStalenessReport {
    checkedAt: string;
    status: 'ok' | 'stale';
    staleGroupIds: SupportSyncSourceGroupId[];
    groups: SupportSyncGroupFreshness[];
}
export declare function parseSupportSyncState(input?: unknown): SupportSyncState;
export declare function recordSupportSyncSuccess(state: SupportSyncState, groupId: SupportSyncSourceGroupId, completedAt: Date): SupportSyncState;
export declare function evaluateSupportSyncStaleness(config: SupportSyncScheduleConfig, state: SupportSyncState, now: Date): SupportSyncStalenessReport;
