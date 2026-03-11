export declare const supportSyncSourceGroupIds: readonly ["repo", "docs", "website_high_churn", "website_daily", "github"];
export type SupportSyncSourceGroupId = (typeof supportSyncSourceGroupIds)[number];
export interface SupportSyncSourceGroupSchedule {
    id: SupportSyncSourceGroupId;
    label: string;
    cadenceHours: number;
    staleAfterHours: number;
}
export interface SupportSyncRetryPolicy {
    maxAttempts: number;
    baseDelayMs: number;
}
export interface SupportSyncScheduleConfig {
    sourceGroups: SupportSyncSourceGroupSchedule[];
    retry: SupportSyncRetryPolicy;
}
export declare const DEFAULT_SUPPORT_SYNC_RETRY_POLICY: SupportSyncRetryPolicy;
export declare const DEFAULT_SUPPORT_SYNC_SCHEDULE_CONFIG: SupportSyncScheduleConfig;
export declare function parseSupportSyncScheduleConfig(input?: unknown): SupportSyncScheduleConfig;
export declare function getSupportSyncSourceGroupSchedule(config: SupportSyncScheduleConfig, groupId: SupportSyncSourceGroupId): SupportSyncSourceGroupSchedule;
export declare function getSupportSyncNextDueAt(group: Pick<SupportSyncSourceGroupSchedule, 'cadenceHours'>, lastSuccessfulAt: Date): Date;
export declare function isSupportSyncSourceGroupDue(group: Pick<SupportSyncSourceGroupSchedule, 'cadenceHours'>, lastSuccessfulAt: Date | undefined, now: Date): boolean;
