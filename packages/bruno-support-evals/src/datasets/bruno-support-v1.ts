import type { SupportEvalCase, SupportEvalCitationTarget, SupportEvalDataset } from '../types';

export const BRUNO_SUPPORT_EVAL_DATASET_VERSION = '1.0.0-seed.1';

function docsCitation(url: string, title: string, rationale: string, importance: 'required' | 'recommended' = 'required'):
SupportEvalCitationTarget {
  return { url, title, rationale, importance, sourceType: 'docs_site', trustTier: 'official_docs' };
}

function websiteCitation(
  url: string,
  title: string,
  rationale: string,
  importance: 'required' | 'recommended' = 'required'
): SupportEvalCitationTarget {
  return { url, title, rationale, importance, sourceType: 'website', trustTier: 'official_docs' };
}

function githubCitation(
  url: string,
  title: string,
  rationale: string,
  importance: 'required' | 'recommended' = 'required',
  trustTier: 'repo' | 'community' = 'repo'
): SupportEvalCitationTarget {
  return { url, title, rationale, importance, sourceType: 'github', trustTier };
}

const downloadsPage = websiteCitation(
  'https://www.usebruno.com/downloads',
  'Bruno downloads',
  'Official installers and package-manager guidance should anchor install answers.'
);
const pricingPage = websiteCitation(
  'https://www.usebruno.com/pricing',
  'Bruno pricing',
  'Pricing and billing answers must defer to the current official pricing page.'
);
const docsHome = docsCitation(
  'https://docs.usebruno.com',
  'Bruno documentation',
  'General feature answers should stay grounded in official documentation.',
  'recommended'
);
const cliOverview = docsCitation(
  'https://docs.usebruno.com/bru-cli/overview',
  'Bruno CLI overview',
  'Canonical CLI command references should point to the official CLI docs.'
);
const authBearerDocs = docsCitation(
  'https://docs.usebruno.com/auth/bearer',
  'Bruno bearer auth',
  'Bearer-auth questions should cite the specific auth documentation.'
);
const issuesPage = githubCitation(
  'https://github.com/usebruno/bruno/issues',
  'Bruno GitHub issues',
  'Confirmed bugs and regressions should escalate to the public issues tracker.'
);
const discussionsPage = githubCitation(
  'https://github.com/usebruno/bruno/discussions',
  'Bruno GitHub discussions',
  'Low-confidence or community-help cases should escalate to official discussions.',
  'required',
  'community'
);
const securityEmail = websiteCitation(
  'mailto:security@usebruno.com',
  'security@usebruno.com',
  'Security-sensitive questions must route to the private disclosure channel.'
);
const scriptmaniaDiscussion = githubCitation(
  'https://github.com/usebruno/bruno/discussions/385',
  'Scriptmania',
  'Script examples and scripting discovery can cite the curated Scriptmania thread.',
  'recommended',
  'community'
);
const knowledgeHubDiscussion = githubCitation(
  'https://github.com/usebruno/bruno/discussions/386',
  'Bruno Knowledge Hub',
  'Troubleshooting and fallback replies can point to the official knowledge hub discussion.',
  'recommended',
  'community'
);
const roadmapDiscussion = githubCitation(
  'https://github.com/usebruno/bruno/discussions/384',
  'Bruno roadmap',
  'Version and release trajectory answers can cite the roadmap when a release note is not enough.',
  'recommended',
  'community'
);
const releasesPage = githubCitation(
  'https://github.com/usebruno/bruno/releases',
  'Bruno releases',
  'Version and release answers should cite the canonical releases page.'
);

const cases: SupportEvalCase[] = [
  {
    id: 'install-downloads-page',
    category: 'install',
    query: 'Where can I download Bruno for Windows, and is there an official installer?',
    difficulty: 'easy',
    expectedAnswer: 'Point the user to the official Bruno downloads page and mention that official installers are provided there.',
    expectedCitationTargets: [downloadsPage],
    answerRubric: {
      requiredFacts: ['References the official downloads page', 'Does not invent unsupported third-party download mirrors'],
      preferredFacts: ['Clarifies that the downloads page is the official source for current installers'],
      prohibitedClaims: ['Claims that an unofficial mirror is recommended', 'Mentions cloud-only installation'],
      minimumCitationCount: 1,
      fallbackPolicy: 'never',
      allowedEscalationChannels: ['downloads'],
      gradingNotes: 'Strong answers are short, direct, and avoid stale platform-specific guesses beyond the official download source.'
    },
    tags: ['windows', 'download', 'installer']
  },
  {
    id: 'install-package-manager-options',
    category: 'install',
    query: 'Can I install Bruno with Homebrew or another package manager?',
    difficulty: 'medium',
    expectedAnswer: 'Confirm Bruno supports package-manager installation paths and ground the answer in official install surfaces instead of guessing unsupported managers.',
    expectedCitationTargets: [downloadsPage, docsHome],
    answerRubric: {
      requiredFacts: ['Keeps the answer anchored to official install guidance', 'Mentions package-manager installation is part of the supported install story'],
      preferredFacts: ['Suggests checking the official downloads/docs pages for the current platform-specific option list'],
      prohibitedClaims: ['Invents a package manager that Bruno does not support'],
      minimumCitationCount: 2,
      fallbackPolicy: 'allowed',
      allowedEscalationChannels: ['downloads', 'docs']
    },
    tags: ['install', 'package-manager', 'homebrew']
  },
  {
    id: 'cli-run-collection',
    category: 'cli',
    query: 'How do I run a Bruno collection from the terminal with an environment selected?',
    difficulty: 'easy',
    expectedAnswer: 'Explain the `bru run` workflow, including running from the collection directory and using `--env` when an environment is needed.',
    expectedCitationTargets: [cliOverview],
    answerRubric: {
      requiredFacts: ['Mentions `bru run`', 'Mentions using `--env` for environment selection', 'Frames the command as being run from a collection directory'],
      prohibitedClaims: ['Claims the CLI requires a cloud account'],
      minimumCitationCount: 1,
      fallbackPolicy: 'never',
      allowedEscalationChannels: ['docs']
    },
    tags: ['cli', 'bru-run', 'environment']
  },
  {
    id: 'cli-import-openapi',
    category: 'cli',
    query: 'Can Bruno CLI import an OpenAPI file or URL into a collection?',
    difficulty: 'medium',
    expectedAnswer: 'State that Bruno CLI supports OpenAPI import from a local source or URL and keep the guidance grounded in the CLI overview.',
    expectedCitationTargets: [cliOverview],
    answerRubric: {
      requiredFacts: ['Confirms OpenAPI import is supported in the CLI', 'Avoids inventing unsupported import flags'],
      preferredFacts: ['Mentions that local files and URLs are both supported import sources'],
      prohibitedClaims: ['Claims only GUI import is supported'],
      minimumCitationCount: 1,
      fallbackPolicy: 'never',
      allowedEscalationChannels: ['docs']
    },
    tags: ['cli', 'openapi', 'import']
  },
  {
    id: 'scripting-pre-request',
    category: 'scripting',
    query: 'Does Bruno support pre-request scripts for request automation?',
    difficulty: 'medium',
    expectedAnswer: 'Confirm Bruno supports pre-request scripting and keep the explanation grounded in official docs plus the community scripting showcase.',
    expectedCitationTargets: [docsHome, scriptmaniaDiscussion],
    answerRubric: {
      requiredFacts: ['Confirms scripting support', 'Mentions pre-request scripts specifically'],
      preferredFacts: ['Points the user to Scriptmania for examples'],
      prohibitedClaims: ['Claims scripting only works in the cloud'],
      minimumCitationCount: 2,
      fallbackPolicy: 'never',
      allowedEscalationChannels: ['docs', 'github_discussions']
    },
    tags: ['scripting', 'pre-request', 'automation']
  },
  {
    id: 'scripting-local-modules',
    category: 'scripting',
    query: 'Can Bruno scripts use local or npm modules?',
    difficulty: 'hard',
    expectedAnswer: 'Answer cautiously: confirm Bruno has scripting extensibility, cite official/community sources, and avoid overstating module-loading guarantees beyond the grounded evidence.',
    expectedCitationTargets: [docsHome, scriptmaniaDiscussion],
    answerRubric: {
      requiredFacts: ['Answers conservatively and stays grounded', 'Does not promise unrestricted module access without evidence'],
      preferredFacts: ['Suggests checking the docs or community scripting examples for the current supported setup'],
      prohibitedClaims: ['Claims any Node module is always available in every scripting context'],
      minimumCitationCount: 2,
      fallbackPolicy: 'allowed',
      allowedEscalationChannels: ['docs', 'github_discussions'],
      gradingNotes: 'This is a good partial-answer case: a strong answer can acknowledge uncertainty while still pointing to grounded scripting resources.'
    },
    tags: ['scripting', 'modules', 'npm']
  },
  {
    id: 'auth-bearer-token',
    category: 'auth',
    query: 'How do I set a bearer token in Bruno?',
    difficulty: 'easy',
    expectedAnswer: 'Tell the user to use Bruno’s bearer auth support and cite the specific bearer-auth documentation.',
    expectedCitationTargets: [authBearerDocs],
    answerRubric: {
      requiredFacts: ['Mentions bearer auth support', 'Points to the bearer auth documentation'],
      prohibitedClaims: ['Routes a normal bearer-token question to the security disclosure channel'],
      minimumCitationCount: 1,
      fallbackPolicy: 'never',
      allowedEscalationChannels: ['docs']
    },
    tags: ['auth', 'bearer', 'token']
  },
  {
    id: 'auth-oauth2',
    category: 'auth',
    query: 'Does Bruno support OAuth2 flows?',
    difficulty: 'medium',
    expectedAnswer: 'Confirm that Bruno supports OAuth2 and keep the answer tied to official docs and auth guidance rather than making claims about unsupported grant flows.',
    expectedCitationTargets: [docsHome, authBearerDocs],
    answerRubric: {
      requiredFacts: ['Confirms OAuth2 support exists', 'Stays at the level supported by grounded Bruno auth references'],
      preferredFacts: ['Avoids overspecifying grant-type support unless cited'],
      prohibitedClaims: ['Invents unsupported OAuth2 flow details'],
      minimumCitationCount: 2,
      fallbackPolicy: 'allowed',
      allowedEscalationChannels: ['docs']
    },
    tags: ['auth', 'oauth2', 'browser-login']
  },
  {
    id: 'pricing-current-plans',
    category: 'pricing',
    query: 'What plans does Bruno offer right now?',
    difficulty: 'easy',
    expectedAnswer: 'Direct the user to the official Bruno pricing page and avoid restating potentially stale plan details from memory.',
    expectedCitationTargets: [pricingPage],
    answerRubric: {
      requiredFacts: ['References the official pricing page', 'Avoids stale or speculative plan details'],
      prohibitedClaims: ['Quotes pricing numbers without citing the current pricing page'],
      minimumCitationCount: 1,
      fallbackPolicy: 'never',
      requiredEscalationChannel: 'pricing',
      allowedEscalationChannels: ['pricing']
    },
    tags: ['pricing', 'plans', 'billing']
  },
  {
    id: 'pricing-seat-billing',
    category: 'pricing',
    query: 'Where should I look for Bruno seat or billing details for my team?',
    difficulty: 'medium',
    expectedAnswer: 'Send the user to the official pricing page for up-to-date billing and seat information.',
    expectedCitationTargets: [pricingPage],
    answerRubric: {
      requiredFacts: ['Uses the pricing page as the source of truth for billing'],
      preferredFacts: ['Frames the answer as current-plan guidance rather than a hard-coded quote'],
      prohibitedClaims: ['Claims billing details are documented in GitHub issues'],
      minimumCitationCount: 1,
      fallbackPolicy: 'never',
      requiredEscalationChannel: 'pricing',
      allowedEscalationChannels: ['pricing']
    },
    tags: ['pricing', 'seats', 'team']
  },
  {
    id: 'troubleshooting-bug-report',
    category: 'troubleshooting',
    query: 'Bruno crashes every time I open a collection. Where should I report this bug?',
    difficulty: 'medium',
    expectedAnswer: 'Treat this as a troubleshooting/bug-report question and direct the user to Bruno GitHub Issues with reproduction details.',
    expectedCitationTargets: [issuesPage, knowledgeHubDiscussion],
    answerRubric: {
      requiredFacts: ['Recognizes the question as a product bug report', 'Routes to GitHub Issues'],
      preferredFacts: ['Suggests including reproduction details'],
      prohibitedClaims: ['Routes a bug report to the private security channel without security indicators'],
      minimumCitationCount: 1,
      fallbackPolicy: 'never',
      requiredEscalationChannel: 'github_issues',
      allowedEscalationChannels: ['github_issues']
    },
    tags: ['troubleshooting', 'crash', 'issues']
  },
  {
    id: 'troubleshooting-community-help',
    category: 'troubleshooting',
    query: 'Bruno is not working the way I expect. Where can I ask for help?',
    difficulty: 'easy',
    expectedAnswer: 'Route the user toward official community support in Bruno GitHub Discussions and keep the answer confidence-aware.',
    expectedCitationTargets: [discussionsPage, knowledgeHubDiscussion],
    answerRubric: {
      requiredFacts: ['Points the user to GitHub Discussions for support'],
      preferredFacts: ['Keeps the answer broad when the technical problem statement is vague'],
      prohibitedClaims: ['Pretends to diagnose a root cause without evidence'],
      minimumCitationCount: 1,
      fallbackPolicy: 'allowed',
      requiredEscalationChannel: 'github_discussions',
      allowedEscalationChannels: ['github_discussions']
    },
    tags: ['troubleshooting', 'support', 'community']
  },
  {
    id: 'version-release-notes',
    category: 'version_release',
    query: 'Where can I see the latest Bruno release notes?',
    difficulty: 'easy',
    expectedAnswer: 'Point to the Bruno releases page as the canonical source for current release notes.',
    expectedCitationTargets: [releasesPage],
    answerRubric: {
      requiredFacts: ['Uses the GitHub releases page as the source of truth'],
      prohibitedClaims: ['Invents a changelog location that is not grounded'],
      minimumCitationCount: 1,
      fallbackPolicy: 'never',
      allowedEscalationChannels: ['docs']
    },
    tags: ['version', 'release-notes', 'changelog']
  },
  {
    id: 'version-cli-sync',
    category: 'version_release',
    query: 'How do Bruno app and CLI releases stay in sync?',
    difficulty: 'medium',
    expectedAnswer: 'Explain cautiously that the CLI changelog points to the shared Bruno releases page, and avoid promising exact synchronization guarantees beyond the cited release guidance.',
    expectedCitationTargets: [releasesPage, roadmapDiscussion],
    answerRubric: {
      requiredFacts: ['References the releases page', 'Avoids overclaiming exact release cadence guarantees'],
      preferredFacts: ['Mentions roadmap/release guidance as context'],
      prohibitedClaims: ['Claims every app and CLI release is always simultaneous without evidence'],
      minimumCitationCount: 2,
      fallbackPolicy: 'allowed',
      allowedEscalationChannels: ['docs', 'github_discussions']
    },
    tags: ['version', 'cli', 'release-sync']
  },
  {
    id: 'fallback-ambiguous-feature',
    category: 'fallback',
    query: 'Does Bruno have a hosted cloud workspace that auto-syncs everything for my team?',
    difficulty: 'hard',
    expectedAnswer: 'Avoid inventing unsupported hosted/cloud capabilities, acknowledge the uncertainty or mismatch, and redirect the user to official docs/community channels for current product guidance.',
    expectedCitationTargets: [docsHome, discussionsPage],
    answerRubric: {
      requiredFacts: ['Avoids hallucinating unsupported hosted features', 'Uses a confidence-aware fallback tone'],
      preferredFacts: ['Redirects to official docs or discussions for the current supported workflow'],
      prohibitedClaims: ['Claims Bruno offers hosted auto-sync without a citation'],
      minimumCitationCount: 2,
      fallbackPolicy: 'required',
      requiredEscalationChannel: 'github_discussions',
      allowedEscalationChannels: ['docs', 'github_discussions'],
      gradingNotes: 'This case is successful when the answer is safely incomplete instead of confidently wrong.'
    },
    tags: ['fallback', 'unknown-feature', 'product-scope']
  },
  {
    id: 'fallback-too-vague',
    category: 'fallback',
    query: 'help',
    difficulty: 'easy',
    expectedAnswer: 'Provide a brief fallback response that asks for clarification or routes the user to an official support venue instead of guessing.',
    expectedCitationTargets: [discussionsPage, knowledgeHubDiscussion],
    answerRubric: {
      requiredFacts: ['Does not pretend to answer an underspecified question', 'Routes to an official support surface or asks for clarification'],
      prohibitedClaims: ['Invents a specific solution from the one-word query'],
      minimumCitationCount: 1,
      fallbackPolicy: 'required',
      requiredEscalationChannel: 'github_discussions',
      allowedEscalationChannels: ['github_discussions']
    },
    tags: ['fallback', 'clarification', 'vague-query']
  },
  {
    id: 'escalation-security-report',
    category: 'escalation',
    query: 'I think I found an XSS vulnerability in Bruno. How should I report it?',
    difficulty: 'medium',
    expectedAnswer: 'Route the user to the private Bruno security contact instead of any public tracker and keep the response short and explicit.',
    expectedCitationTargets: [securityEmail],
    answerRubric: {
      requiredFacts: ['Routes to security@usebruno.com', 'Avoids suggesting a public issue or discussion thread'],
      prohibitedClaims: ['Asks the user to post the vulnerability publicly'],
      minimumCitationCount: 1,
      fallbackPolicy: 'required',
      requiredEscalationChannel: 'security_email',
      allowedEscalationChannels: ['security_email']
    },
    tags: ['security', 'vulnerability', 'private-reporting']
  },
  {
    id: 'escalation-public-bug-path',
    category: 'escalation',
    query: 'I can reproduce a Bruno regression and want the right public place to file it.',
    difficulty: 'medium',
    expectedAnswer: 'Route the user to Bruno GitHub Issues as the correct public escalation path for reproducible bugs.',
    expectedCitationTargets: [issuesPage],
    answerRubric: {
      requiredFacts: ['Selects GitHub Issues as the public escalation path', 'Keeps the answer focused on where to file the bug'],
      preferredFacts: ['Mentions including reproduction details'],
      prohibitedClaims: ['Routes a normal bug to the security email path'],
      minimumCitationCount: 1,
      fallbackPolicy: 'never',
      requiredEscalationChannel: 'github_issues',
      allowedEscalationChannels: ['github_issues']
    },
    tags: ['escalation', 'bug', 'public-reporting']
  }
];

export const BRUNO_SUPPORT_EVAL_DATASET_V1: SupportEvalDataset = {
  metadata: {
    datasetId: 'bruno-support-evals',
    schemaVersion: 1,
    datasetVersion: BRUNO_SUPPORT_EVAL_DATASET_VERSION,
    createdAt: '2026-03-09T00:00:00.000Z',
    description:
      'Wave 1 seed dataset for Bruno support QA evaluation. This release prioritizes broad intent coverage, explicit citation targets, and rubric-ready answer scoring while documenting the planned expansion to a 200+ case corpus.',
    declaredCategoryCoverage: [
      'install',
      'cli',
      'scripting',
      'auth',
      'pricing',
      'troubleshooting',
      'version_release',
      'fallback',
      'escalation'
    ],
    stagedDelivery: {
      stage: 'wave1_seed',
      shippedCaseCount: cases.length,
      targetCaseCount: 200,
      notes:
        'Wave 1 lands a curated seed set that exercises all Epic 6 intents plus fallback and escalation behavior. Follow-up waves should expand each category with doc-derived paraphrases, changelog/release permutations, and common issue themes until the corpus exceeds 200 cases.'
    }
  },
  cases
};