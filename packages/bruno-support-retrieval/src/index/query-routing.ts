import {
  supportQueryClassificationSchema,
  supportQueryClassifierConfigSchema,
  supportQueryRoutePlanSchema,
  supportQueryRoutingConfigSchema,
  type ClassifierOverrideMatchMode,
  type RoutedEvidenceOptions,
  type SearchOptions,
  type SupportQueryClassification,
  type SupportQueryClassifierConfig,
  type SupportQueryIntent,
  type SupportQueryIntentScores,
  type SupportQueryRoutePlan,
  type SupportQueryRoutingConfig,
  type SupportQueryRoutingRule,
  type SupportQueryRoutingRuleOverride
} from './types';

type RecognizedSupportQueryIntent = Exclude<SupportQueryIntent, 'unknown'>;

interface IntentSignalDefinition {
  signal: string;
  terms: string[];
  weight: number;
  matchMode?: ClassifierOverrideMatchMode;
}

const ROUTABLE_INTENTS: RecognizedSupportQueryIntent[] = [
  'install',
  'cli',
  'scripting',
  'auth',
  'pricing',
  'troubleshooting',
  'version_release'
];
const DEFAULT_MINIMUM_SCORE = 1.5;
const DEFAULT_MINIMUM_MARGIN = 0.35;
const OVERRIDE_SCORE_BONUS = 3;

const DEFAULT_INTENT_SIGNALS: Record<RecognizedSupportQueryIntent, IntentSignalDefinition[]> = {
  install: [
    { signal: 'install', terms: ['install', 'setup', 'set up'], weight: 1.4 },
    { signal: 'download', terms: ['download', 'desktop app'], weight: 1.1 },
    {
      signal: 'package_manager',
      terms: ['brew', 'homebrew', 'apt', 'apt-get', 'winget', 'choco', 'chocolatey', 'snap', 'npm install'],
      weight: 1.1
    }
  ],
  cli: [
    { signal: 'cli', terms: ['cli', 'command line', 'terminal'], weight: 1.4 },
    { signal: 'commands', terms: ['command', 'commands', 'flag', 'option', '--'], weight: 0.9 },
    { signal: 'bru', terms: ['bru run', 'bru collection', 'bru env', 'bru test'], weight: 1.1 }
  ],
  scripting: [
    { signal: 'script', terms: ['script', 'scripts', 'scripting'], weight: 1.4 },
    { signal: 'workflow_script', terms: ['pre-request', 'post-response', 'test script'], weight: 1.2 },
    { signal: 'javascript', terms: ['javascript', 'js', 'automation', 'programmatic'], weight: 1 }
  ],
  auth: [
    { signal: 'auth', terms: ['auth', 'authentication', 'authorization', 'authorize'], weight: 1.4 },
    { signal: 'credential', terms: ['api key', 'token', 'bearer', 'oauth', 'login', 'signin'], weight: 1.2 },
    { signal: 'auth_scheme', terms: ['basic auth', 'digest auth', 'oauth2'], weight: 1 }
  ],
  pricing: [
    { signal: 'pricing', terms: ['pricing', 'price', 'cost', 'plan', 'plans', 'billing', 'subscription'], weight: 1.5 },
    { signal: 'license', terms: ['license', 'licence', 'seat', 'enterprise', 'pro'], weight: 1 }
  ],
  troubleshooting: [
    { signal: 'issue', terms: ['error', 'issue', 'problem', 'broken', 'not working', 'fails', 'failing', 'failed', 'crash', 'bug'], weight: 2 },
    { signal: 'diagnostic', terms: ['exception', 'stack trace', 'debug', 'unable to', "can't", 'cannot'], weight: 1.1 }
  ],
  version_release: [
    { signal: 'release', terms: ['version', 'release', 'released', 'latest', 'changelog', 'release notes'], weight: 1.5 },
    { signal: 'whats_new', terms: ["what's new", 'whats new', 'new in', 'upgrade', 'downgrade'], weight: 1.1 }
  ]
};

const DEFAULT_SUPPORT_QUERY_ROUTING_RULES: Record<SupportQueryIntent, SupportQueryRoutingRule> = {
  install: {
    search: {
      mode: 'hybrid',
      topK: 8,
      filter: {
        sourceTypes: ['docs_site', 'website', 'repo'],
        trustTiers: ['official_docs', 'repo']
      },
      ranking: {
        trustWeight: 0.25,
        freshnessWeight: 0.25,
        freshnessHalfLifeDays: 120,
        volatileFreshnessHalfLifeDays: 30,
        volatilityIndicators: ['install', 'download', 'setup']
      }
    },
    evidence: { minEvidence: 2, maxEvidence: 4 }
  },
  cli: {
    search: {
      mode: 'hybrid',
      topK: 8,
      filter: {
        sourceTypes: ['docs_site', 'repo', 'github'],
        trustTiers: ['official_docs', 'repo', 'community']
      },
      ranking: {
        trustWeight: 0.2,
        freshnessWeight: 0.1
      }
    },
    evidence: { minEvidence: 2, maxEvidence: 4 }
  },
  scripting: {
    search: {
      mode: 'hybrid',
      topK: 8,
      filter: {
        sourceTypes: ['docs_site', 'repo', 'github'],
        trustTiers: ['official_docs', 'repo', 'community']
      },
      ranking: {
        trustWeight: 0.2,
        freshnessWeight: 0.1
      }
    },
    evidence: { minEvidence: 2, maxEvidence: 4 }
  },
  auth: {
    search: {
      mode: 'hybrid',
      topK: 8,
      filter: {
        sourceTypes: ['docs_site', 'website', 'repo'],
        trustTiers: ['official_docs', 'repo']
      },
      ranking: {
        trustWeight: 0.25,
        freshnessWeight: 0.15
      }
    },
    evidence: { minEvidence: 2, maxEvidence: 4 }
  },
  pricing: {
    search: {
      mode: 'hybrid',
      topK: 6,
      filter: {
        sourceTypes: ['website', 'docs_site'],
        trustTiers: ['official_docs']
      },
      ranking: {
        trustWeight: 0.25,
        freshnessWeight: 0.35,
        freshnessHalfLifeDays: 90,
        volatileFreshnessHalfLifeDays: 14,
        volatilityIndicators: ['pricing', 'plan', 'billing', 'license']
      }
    },
    evidence: { minEvidence: 1, maxEvidence: 3 }
  },
  troubleshooting: {
    search: {
      mode: 'hybrid',
      topK: 10,
      filter: {
        sourceTypes: ['docs_site', 'repo', 'github', 'stackoverflow'],
        trustTiers: ['official_docs', 'repo', 'community']
      },
      ranking: {
        trustWeight: 0.15,
        freshnessWeight: 0.2,
        freshnessHalfLifeDays: 120,
        volatileFreshnessHalfLifeDays: 21,
        volatilityIndicators: ['error', 'issue', 'troubleshooting', 'broken']
      }
    },
    evidence: { minEvidence: 2, maxEvidence: 5 }
  },
  version_release: {
    search: {
      mode: 'hybrid',
      topK: 6,
      filter: {
        sourceTypes: ['website', 'docs_site', 'github'],
        trustTiers: ['official_docs', 'repo', 'community']
      },
      ranking: {
        trustWeight: 0.2,
        freshnessWeight: 0.35,
        freshnessHalfLifeDays: 60,
        volatileFreshnessHalfLifeDays: 14,
        volatilityIndicators: ['release', 'version', 'changelog', 'whats new', "what's new"]
      }
    },
    evidence: { minEvidence: 1, maxEvidence: 3 }
  },
  unknown: {
    search: {
      mode: 'hybrid',
      topK: 6,
      filter: {
        sourceTypes: ['docs_site', 'website', 'repo'],
        trustTiers: ['official_docs', 'repo']
      },
      ranking: {
        trustWeight: 0.25,
        freshnessWeight: 0.15
      }
    },
    evidence: { minEvidence: 2, maxEvidence: 4 }
  }
};

function createEmptyScores(): SupportQueryIntentScores {
  return {
    install: 0,
    cli: 0,
    scripting: 0,
    auth: 0,
    pricing: 0,
    troubleshooting: 0,
    version_release: 0,
    unknown: 0
  };
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9'\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesTerms(query: string, terms: string[], matchMode: ClassifierOverrideMatchMode = 'any'): boolean {
  const normalizedTerms = terms.map((term) => normalizeText(term)).filter((term) => term.length > 0);

  if (normalizedTerms.length === 0) {
    return false;
  }

  return matchMode === 'all'
    ? normalizedTerms.every((term) => query.includes(term))
    : normalizedTerms.some((term) => query.includes(term));
}

function buildIntentSignals(config?: SupportQueryClassifierConfig): Record<RecognizedSupportQueryIntent, IntentSignalDefinition[]> {
  const signals = Object.fromEntries(
    ROUTABLE_INTENTS.map((intent) => [intent, DEFAULT_INTENT_SIGNALS[intent].map((signal) => ({ ...signal }))])
  ) as Record<RecognizedSupportQueryIntent, IntentSignalDefinition[]>;

  if (!config?.extraTermsByIntent) {
    return signals;
  }

  for (const intent of ROUTABLE_INTENTS) {
    const extraTerms = config.extraTermsByIntent[intent];

    if (!extraTerms) {
      continue;
    }

    for (const term of extraTerms) {
      signals[intent].push({ signal: `extra:${term}`, terms: [term], weight: 1 });
    }
  }

  return signals;
}

function cloneSearchOptions(search: SearchOptions): SearchOptions {
  return {
    ...search,
    filter: search.filter
      ? {
          ...search.filter,
          sourceTypes: search.filter.sourceTypes ? [...search.filter.sourceTypes] : undefined,
          trustTiers: search.filter.trustTiers ? [...search.filter.trustTiers] : undefined
        }
      : undefined,
    ranking: search.ranking
      ? {
          ...search.ranking,
          trustTierScores: search.ranking.trustTierScores ? { ...search.ranking.trustTierScores } : undefined,
          volatilityIndicators: search.ranking.volatilityIndicators ? [...search.ranking.volatilityIndicators] : undefined,
          now: search.ranking.now ? new Date(search.ranking.now) : undefined
        }
      : undefined
  };
}

function cloneEvidenceOptions(evidence?: RoutedEvidenceOptions): RoutedEvidenceOptions | undefined {
  return evidence ? { ...evidence } : undefined;
}

function mergeSearchOptions(base: SearchOptions, override?: Partial<SearchOptions>): SearchOptions {
  if (!override) {
    return cloneSearchOptions(base);
  }

  return {
    ...cloneSearchOptions(base),
    ...override,
    filter: override.filter ? { ...(base.filter ?? {}), ...override.filter } : cloneSearchOptions(base).filter,
    ranking: override.ranking ? { ...(base.ranking ?? {}), ...override.ranking } : cloneSearchOptions(base).ranking
  };
}

function mergeEvidenceOptions(
  base?: RoutedEvidenceOptions,
  override?: RoutedEvidenceOptions
): RoutedEvidenceOptions | undefined {
  if (!base && !override) {
    return undefined;
  }

  return {
    ...(base ?? {}),
    ...(override ?? {})
  };
}

function mergeRoutingRule(
  base: SupportQueryRoutingRule,
  override?: SupportQueryRoutingRuleOverride
): SupportQueryRoutingRule {
  return {
    search: mergeSearchOptions(base.search, override?.search),
    evidence: mergeEvidenceOptions(base.evidence, override?.evidence)
  };
}

export function getDefaultSupportQueryRoutingRules(): Record<SupportQueryIntent, SupportQueryRoutingRule> {
  return Object.fromEntries(
    Object.entries(DEFAULT_SUPPORT_QUERY_ROUTING_RULES).map(([intent, rule]) => [
      intent,
      {
        search: cloneSearchOptions(rule.search),
        evidence: cloneEvidenceOptions(rule.evidence)
      }
    ])
  ) as Record<SupportQueryIntent, SupportQueryRoutingRule>;
}

export function classifySupportQuery(
  query: string,
  config?: SupportQueryClassifierConfig
): SupportQueryClassification {
  const validatedConfig = supportQueryClassifierConfigSchema.parse(config ?? {});
  const normalizedQuery = normalizeText(query);
  const scores = createEmptyScores();
  const matchedSignals = ROUTABLE_INTENTS.reduce<Record<RecognizedSupportQueryIntent, string[]>>(
    (accumulator, intent) => {
      accumulator[intent] = [];
      return accumulator;
    },
    {
      install: [],
      cli: [],
      scripting: [],
      auth: [],
      pricing: [],
      troubleshooting: [],
      version_release: []
    }
  );

  if (normalizedQuery.length === 0) {
    return supportQueryClassificationSchema.parse({
      intent: 'unknown',
      score: 0,
      matchedSignals: [],
      scores,
      isFallback: true
    });
  }

  const intentSignals = buildIntentSignals(validatedConfig);

  for (const intent of ROUTABLE_INTENTS) {
    for (const signal of intentSignals[intent]) {
      if (!matchesTerms(normalizedQuery, signal.terms, signal.matchMode)) {
        continue;
      }

      scores[intent] += signal.weight;
      matchedSignals[intent].push(signal.signal);
    }
  }

  for (const override of validatedConfig.overrides ?? []) {
    if (!matchesTerms(normalizedQuery, override.terms, override.matchMode ?? 'all')) {
      continue;
    }

    if (override.intent === 'unknown') {
      scores.unknown += OVERRIDE_SCORE_BONUS;

      return supportQueryClassificationSchema.parse({
        intent: 'unknown',
        score: 0,
        matchedSignals: [`override:${override.terms.join(' & ')}`],
        scores,
        isFallback: true
      });
    }

    scores[override.intent] += OVERRIDE_SCORE_BONUS;
    matchedSignals[override.intent].push(`override:${override.terms.join(' & ')}`);
  }

  const rankedIntents = [...ROUTABLE_INTENTS].sort((left, right) => {
    const scoreDifference = scores[right] - scores[left];

    return scoreDifference !== 0 ? scoreDifference : left.localeCompare(right);
  });
  const topIntent = rankedIntents[0];
  const topScore = scores[topIntent];
  const secondScore = scores[rankedIntents[1]];
  const minimumScore = validatedConfig.minimumScore ?? DEFAULT_MINIMUM_SCORE;
  const minimumMargin = validatedConfig.minimumMargin ?? DEFAULT_MINIMUM_MARGIN;
  const isFallback = topScore < minimumScore || topScore - secondScore < minimumMargin;

  return supportQueryClassificationSchema.parse({
    intent: isFallback ? 'unknown' : topIntent,
    score: isFallback ? 0 : topScore,
    matchedSignals: matchedSignals[topIntent],
    scores,
    isFallback
  });
}

export function planSupportQueryRoute(query: string, config?: SupportQueryRoutingConfig): SupportQueryRoutePlan {
  const validatedConfig = supportQueryRoutingConfigSchema.parse(config ?? {});
  const classification = classifySupportQuery(query, validatedConfig.classifier);
  const defaultRule = getDefaultSupportQueryRoutingRules()[classification.intent];
  const route = mergeRoutingRule(defaultRule, validatedConfig.routeOverrides?.[classification.intent]);

  return supportQueryRoutePlanSchema.parse({
    query,
    intent: classification.intent,
    classification,
    search: route.search,
    evidence: route.evidence
  });
}