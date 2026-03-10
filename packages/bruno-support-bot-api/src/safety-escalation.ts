import type { SupportQueryIntent } from '../../bruno-support-retrieval/src/index/types';

import type { GroundedEvidenceAssessment } from './grounded-prompt-policy';

export const OFFICIAL_BRUNO_DESTINATIONS = {
  securityEmail: 'mailto:security@usebruno.com',
  securityEmailAddress: 'security@usebruno.com',
  pricing: 'https://www.usebruno.com/pricing',
  downloads: 'https://www.usebruno.com/downloads',
  docs: 'https://docs.usebruno.com',
  discussions: 'https://github.com/usebruno/bruno/discussions',
  issues: 'https://github.com/usebruno/bruno/issues'
} as const;

const SECURITY_TERMS = [
  'vulnerability',
  'vulnerabilities',
  'security issue',
  'security bug',
  'responsible disclosure',
  'cve',
  'exploit',
  'xss',
  'csrf',
  'ssrf',
  'sql injection',
  'command injection',
  'rce',
  'remote code execution',
  'secret leak',
  'credential leak',
  'api key leak',
  'private key exposed',
  'malicious package',
  'supply chain',
  'dependency confusion',
  'unauthorized access',
  'privilege escalation',
  'account takeover'
] as const;

const PUBLIC_ISSUE_TERMS = ['bug', 'broken', 'crash', 'crashes', 'crashed', 'defect', 'regression', 'failing', 'fails'] as const;
const COMMUNITY_HELP_TERMS = ['help', 'support', 'question', 'can someone help', 'not sure'] as const;

export interface SupportAnswerSafety {
  classification: 'normal' | 'low_confidence' | 'insufficient_evidence' | 'security_sensitive';
  requiresFallback: boolean;
  fallbackReason?: 'weak_evidence' | 'insufficient_evidence' | 'security_sensitive';
}

export type SupportAnswerEscalationChannel =
  | 'none'
  | 'security_email'
  | 'docs'
  | 'github_discussions'
  | 'github_issues'
  | 'pricing'
  | 'downloads';

export type SupportAnswerEscalation =
  | {
      channel: 'none';
      shouldEscalate: false;
    }
  | {
      channel: Exclude<SupportAnswerEscalationChannel, 'none'>;
      shouldEscalate: true;
      destination: string;
      label: string;
      message: string;
    };

export interface SafetyAndEscalationDecision {
  safety: SupportAnswerSafety;
  escalation: SupportAnswerEscalation;
}

export interface ClassifySafetyAndEscalationInput {
  query: string;
  routeIntent: SupportQueryIntent;
  assessment: GroundedEvidenceAssessment;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9'\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function includesAnyTerm(query: string, terms: readonly string[]): boolean {
  return terms.some((term) => query.includes(term));
}

function isSecuritySensitiveQuery(query: string): boolean {
  return includesAnyTerm(normalizeText(query), SECURITY_TERMS);
}

function noEscalation(): SupportAnswerEscalation {
  return {
    channel: 'none',
    shouldEscalate: false
  };
}

function activeEscalation(
  channel: Exclude<SupportAnswerEscalationChannel, 'none'>,
  destination: string,
  label: string,
  message: string
): SupportAnswerEscalation {
  return {
    channel,
    shouldEscalate: true,
    destination,
    label,
    message
  };
}

function selectFallbackEscalation(routeIntent: SupportQueryIntent, query: string): SupportAnswerEscalation {
  const normalizedQuery = normalizeText(query);

  switch (routeIntent) {
    case 'pricing':
      return activeEscalation(
        'pricing',
        OFFICIAL_BRUNO_DESTINATIONS.pricing,
        'Bruno pricing',
        'Please use the official Bruno pricing page for current plans and billing details.'
      );
    case 'install':
      return activeEscalation(
        'downloads',
        OFFICIAL_BRUNO_DESTINATIONS.downloads,
        'Bruno downloads',
        'Please use the official Bruno downloads page for current installers and package-manager links.'
      );
    case 'cli':
    case 'scripting':
    case 'auth':
    case 'version_release':
      return activeEscalation(
        'docs',
        OFFICIAL_BRUNO_DESTINATIONS.docs,
        'Bruno docs',
        'Please continue with the official Bruno docs for supported guidance.'
      );
    case 'troubleshooting':
      if (includesAnyTerm(normalizedQuery, PUBLIC_ISSUE_TERMS)) {
        return activeEscalation(
          'github_issues',
          OFFICIAL_BRUNO_DESTINATIONS.issues,
          'Bruno GitHub Issues',
          'Please continue this question in Bruno GitHub Issues with reproduction details if this appears to be a product bug.'
        );
      }

      return activeEscalation(
        'github_discussions',
        OFFICIAL_BRUNO_DESTINATIONS.discussions,
        'Bruno GitHub Discussions',
        'Please continue this question in Bruno GitHub Discussions for official community support.'
      );
    case 'unknown':
    default:
      if (includesAnyTerm(normalizedQuery, COMMUNITY_HELP_TERMS) || normalizedQuery.length > 0) {
        return activeEscalation(
          'github_discussions',
          OFFICIAL_BRUNO_DESTINATIONS.discussions,
          'Bruno GitHub Discussions',
          'Please continue this question in Bruno GitHub Discussions for official community support.'
        );
      }

      return noEscalation();
  }
}

export function classifySafetyAndEscalation(input: ClassifySafetyAndEscalationInput): SafetyAndEscalationDecision {
  if (isSecuritySensitiveQuery(input.query)) {
    return {
      safety: {
        classification: 'security_sensitive',
        requiresFallback: true,
        fallbackReason: 'security_sensitive'
      },
      escalation: activeEscalation(
        'security_email',
        OFFICIAL_BRUNO_DESTINATIONS.securityEmail,
        'security@usebruno.com',
        'Please report potential Bruno security vulnerabilities privately to security@usebruno.com instead of posting them publicly.'
      )
    };
  }

  if (input.assessment.reason === 'insufficient_evidence') {
    return {
      safety: {
        classification: 'insufficient_evidence',
        requiresFallback: true,
        fallbackReason: 'insufficient_evidence'
      },
      escalation: selectFallbackEscalation(input.routeIntent, input.query)
    };
  }

  if (input.assessment.reason === 'weak_evidence') {
    return {
      safety: {
        classification: 'low_confidence',
        requiresFallback: true,
        fallbackReason: 'weak_evidence'
      },
      escalation: selectFallbackEscalation(input.routeIntent, input.query)
    };
  }

  return {
    safety: {
      classification: 'normal',
      requiresFallback: false
    },
    escalation: noEscalation()
  };
}

export function buildFallbackMessage(
  decision: SafetyAndEscalationDecision,
  fallbackMessage?: string
): string | undefined {
  const normalizedFallbackMessage = fallbackMessage?.trim();

  if (normalizedFallbackMessage) {
    return normalizedFallbackMessage;
  }

  return decision.escalation.shouldEscalate ? decision.escalation.message : undefined;
}