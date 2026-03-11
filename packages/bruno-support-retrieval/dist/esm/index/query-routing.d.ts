import { type SupportQueryClassification, type SupportQueryClassifierConfig, type SupportQueryIntent, type SupportQueryRoutePlan, type SupportQueryRoutingConfig, type SupportQueryRoutingRule } from './types';
export declare function getDefaultSupportQueryRoutingRules(): Record<SupportQueryIntent, SupportQueryRoutingRule>;
export declare function classifySupportQuery(query: string, config?: SupportQueryClassifierConfig): SupportQueryClassification;
export declare function planSupportQueryRoute(query: string, config?: SupportQueryRoutingConfig): SupportQueryRoutePlan;
