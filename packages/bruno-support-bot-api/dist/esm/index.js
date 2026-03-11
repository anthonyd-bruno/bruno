import { createServer } from 'http';
import { URL as URL$1 } from 'url';

const GROUNDED_PROMPT_POLICY_VERSION = 'bruno-support-grounded-answer/v1';
const DEFAULT_GROUNDED_PROMPT_POLICY = {
    version: GROUNDED_PROMPT_POLICY_VERSION,
    minimumStrongEvidenceCount: 2,
    minimumStrongEvidenceScore: 0.75,
    strongTrustTiers: ['official_docs', 'repo'],
    systemRules: [
        'Answer only from the supplied Bruno support evidence.',
        'Do not invent product behavior, commands, versions, or troubleshooting steps.',
        'Every substantive claim must be supported by the supplied evidence.',
        'Prefer concise, direct language for the short answer.',
        'Only include steps or commands when the evidence directly supports them.'
    ],
    fallbackRules: [
        'If evidence is weak or insufficient, say that explicitly.',
        'Prefer safe next steps over speculative fixes.',
        'Do not present uncertain guidance as confirmed Bruno behavior.'
    ]
};
function qualifiesForStrongGrounding(trustTier, retrievalScore, policy) {
    return policy.strongTrustTiers.includes(trustTier) && retrievalScore >= policy.minimumStrongEvidenceScore;
}
function assessEvidenceStrength(result, policy = DEFAULT_GROUNDED_PROMPT_POLICY) {
    const evidence = result.status === 'ready' ? result.evidence : [];
    const strongestEvidenceScore = evidence.length > 0 ? Math.max(...evidence.map((item) => item.retrievalScore)) : undefined;
    const qualifyingEvidenceCount = evidence.filter((item) => qualifiesForStrongGrounding(item.trustTier, item.retrievalScore, policy)).length;
    if (result.status !== 'ready' || evidence.length === 0) {
        return {
            strength: 'insufficient',
            reason: 'insufficient_evidence',
            evidenceCount: evidence.length,
            qualifyingEvidenceCount,
            strongestEvidenceScore
        };
    }
    if (qualifyingEvidenceCount >= policy.minimumStrongEvidenceCount) {
        return {
            strength: 'strong',
            reason: 'meets_grounding_threshold',
            evidenceCount: evidence.length,
            qualifyingEvidenceCount,
            strongestEvidenceScore
        };
    }
    return {
        strength: 'weak',
        reason: 'weak_evidence',
        evidenceCount: evidence.length,
        qualifyingEvidenceCount,
        strongestEvidenceScore
    };
}

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_COMPLETION_TOKENS = 400;
function buildJsonInstructionMessage() {
    return {
        role: 'system',
        content: [
            'Return only valid JSON.',
            'Do not include markdown fences or explanatory text.',
            'Allowed keys: shortAnswer (string, required), steps (string[]), commands (string[]), citedEvidenceIndexes (integer[]), confidence (number 0-1), uncertainty (string).',
            'Only cite evidence indexes that appear in the provided evidence list.'
        ].join(' ')
    };
}
function extractMessageContent(payload) {
    var _a, _b;
    const message = (_b = (_a = payload.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message;
    if (!message) {
        throw new Error('OpenAI answer generation returned no choices.');
    }
    if (message.refusal) {
        throw new Error(`OpenAI answer generation refused the request: ${message.refusal}`);
    }
    if (typeof message.content === 'string') {
        return message.content;
    }
    if (Array.isArray(message.content)) {
        const text = message.content
            .map((part) => (part && part.type === 'text' && typeof part.text === 'string' ? part.text : ''))
            .join('')
            .trim();
        if (text) {
            return text;
        }
    }
    throw new Error('OpenAI answer generation returned an empty response body.');
}
function toStringList(value) {
    if (!Array.isArray(value)) {
        return undefined;
    }
    const items = value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
    return items.length > 0 ? items : undefined;
}
function toPositiveIntegerList(value) {
    if (!Array.isArray(value)) {
        return undefined;
    }
    const items = value
        .map((item) => (Number.isInteger(item) && item > 0 ? item : undefined))
        .filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
}
function parseDraft(content) {
    let value;
    try {
        value = JSON.parse(content);
    }
    catch (error) {
        throw new Error(`OpenAI answer generation returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!value || typeof value !== 'object') {
        throw new Error('OpenAI answer generation returned a non-object JSON payload.');
    }
    const draft = value;
    if (typeof draft.shortAnswer !== 'string' || draft.shortAnswer.trim().length === 0) {
        throw new Error('OpenAI answer generation payload must include a non-empty shortAnswer string.');
    }
    return {
        shortAnswer: draft.shortAnswer.trim(),
        steps: toStringList(draft.steps),
        commands: toStringList(draft.commands),
        citedEvidenceIndexes: toPositiveIntegerList(draft.citedEvidenceIndexes),
        confidence: typeof draft.confidence === 'number' && draft.confidence >= 0 && draft.confidence <= 1
            ? draft.confidence
            : undefined,
        uncertainty: typeof draft.uncertainty === 'string' && draft.uncertainty.trim().length > 0 ? draft.uncertainty.trim() : undefined
    };
}
class OpenAIAnswerGenerationAdapter {
    constructor(config = {}) {
        var _a, _b, _c, _d, _e, _f, _g;
        this.apiKey = (_a = config.apiKey) !== null && _a !== void 0 ? _a : process.env.OPENAI_API_KEY;
        this.modelName = (_c = (_b = config.model) !== null && _b !== void 0 ? _b : process.env.SUPPORT_BOT_OPENAI_MODEL) !== null && _c !== void 0 ? _c : DEFAULT_MODEL;
        this.endpoint = (_d = config.endpoint) !== null && _d !== void 0 ? _d : OPENAI_CHAT_COMPLETIONS_URL;
        this.temperature = (_e = config.temperature) !== null && _e !== void 0 ? _e : DEFAULT_TEMPERATURE;
        this.maxCompletionTokens = (_f = config.maxCompletionTokens) !== null && _f !== void 0 ? _f : DEFAULT_MAX_COMPLETION_TOKENS;
        this.fetchImpl = (_g = config.fetchImpl) !== null && _g !== void 0 ? _g : fetch;
    }
    async generate(request) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key is required for support-bot answer generation.');
        }
        const response = await this.fetchImpl(this.endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.modelName,
                temperature: this.temperature,
                max_completion_tokens: this.maxCompletionTokens,
                response_format: { type: 'json_object' },
                messages: [buildJsonInstructionMessage(), ...request.messages]
            })
        });
        if (!response.ok) {
            const detail = (await response.text()).trim();
            throw new Error(`OpenAI answer generation request failed with status ${response.status}${detail ? `: ${detail}` : ''}`);
        }
        return parseDraft(extractMessageContent((await response.json())));
    }
}

const OFFICIAL_BRUNO_DESTINATIONS = {
    securityEmail: 'mailto:security@usebruno.com',
    securityEmailAddress: 'security@usebruno.com',
    pricing: 'https://www.usebruno.com/pricing',
    downloads: 'https://www.usebruno.com/downloads',
    docs: 'https://docs.usebruno.com',
    discussions: 'https://github.com/usebruno/bruno/discussions',
    issues: 'https://github.com/usebruno/bruno/issues'
};
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
];
const PUBLIC_ISSUE_TERMS = ['bug', 'broken', 'crash', 'crashes', 'crashed', 'defect', 'regression', 'failing', 'fails'];
const COMMUNITY_HELP_TERMS = ['help', 'support', 'question', 'can someone help', 'not sure'];
function normalizeText$2(value) {
    return value.toLowerCase().replace(/[^a-z0-9'\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function includesAnyTerm(query, terms) {
    return terms.some((term) => query.includes(term));
}
function isSecuritySensitiveQuery(query) {
    return includesAnyTerm(normalizeText$2(query), SECURITY_TERMS);
}
function noEscalation() {
    return {
        channel: 'none',
        shouldEscalate: false
    };
}
function activeEscalation(channel, destination, label, message) {
    return {
        channel,
        shouldEscalate: true,
        destination,
        label,
        message
    };
}
function selectFallbackEscalation(routeIntent, query) {
    const normalizedQuery = normalizeText$2(query);
    switch (routeIntent) {
        case 'pricing':
            return activeEscalation('pricing', OFFICIAL_BRUNO_DESTINATIONS.pricing, 'Bruno pricing', 'Please use the official Bruno pricing page for current plans and billing details.');
        case 'install':
            return activeEscalation('downloads', OFFICIAL_BRUNO_DESTINATIONS.downloads, 'Bruno downloads', 'Please use the official Bruno downloads page for current installers and package-manager links.');
        case 'cli':
        case 'scripting':
        case 'auth':
        case 'version_release':
            return activeEscalation('docs', OFFICIAL_BRUNO_DESTINATIONS.docs, 'Bruno docs', 'Please continue with the official Bruno docs for supported guidance.');
        case 'troubleshooting':
            if (includesAnyTerm(normalizedQuery, PUBLIC_ISSUE_TERMS)) {
                return activeEscalation('github_issues', OFFICIAL_BRUNO_DESTINATIONS.issues, 'Bruno GitHub Issues', 'Please continue this question in Bruno GitHub Issues with reproduction details if this appears to be a product bug.');
            }
            return activeEscalation('github_discussions', OFFICIAL_BRUNO_DESTINATIONS.discussions, 'Bruno GitHub Discussions', 'Please continue this question in Bruno GitHub Discussions for official community support.');
        case 'unknown':
        default:
            if (includesAnyTerm(normalizedQuery, COMMUNITY_HELP_TERMS) || normalizedQuery.length > 0) {
                return activeEscalation('github_discussions', OFFICIAL_BRUNO_DESTINATIONS.discussions, 'Bruno GitHub Discussions', 'Please continue this question in Bruno GitHub Discussions for official community support.');
            }
            return noEscalation();
    }
}
function classifySafetyAndEscalation(input) {
    if (isSecuritySensitiveQuery(input.query)) {
        return {
            safety: {
                classification: 'security_sensitive',
                requiresFallback: true,
                fallbackReason: 'security_sensitive'
            },
            escalation: activeEscalation('security_email', OFFICIAL_BRUNO_DESTINATIONS.securityEmail, 'security@usebruno.com', 'Please report potential Bruno security vulnerabilities privately to security@usebruno.com instead of posting them publicly.')
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
function buildFallbackMessage(decision, fallbackMessage) {
    const normalizedFallbackMessage = fallbackMessage === null || fallbackMessage === void 0 ? void 0 : fallbackMessage.trim();
    if (normalizedFallbackMessage) {
        return normalizedFallbackMessage;
    }
    return decision.escalation.shouldEscalate ? decision.escalation.message : undefined;
}

function toPromptEvidenceItem(item, index) {
    return {
        index: index + 1,
        documentId: item.documentId,
        sourceType: item.sourceType,
        title: item.title,
        headingAnchor: item.headingAnchor,
        trustTier: item.trustTier,
        retrievalScore: item.retrievalScore,
        supportCount: item.supportCount,
        url: 'url' in item ? item.url : undefined,
        sourcePath: 'sourcePath' in item ? item.sourcePath : undefined
    };
}
function formatEvidenceLocation(item) {
    var _a, _b;
    const location = (_b = (_a = item.url) !== null && _a !== void 0 ? _a : item.sourcePath) !== null && _b !== void 0 ? _b : 'unknown';
    return item.headingAnchor ? `${location}#${item.headingAnchor}` : location;
}
function formatEvidenceLine(item) {
    return [
        `[E${item.index}] ${item.title}`,
        `source=${item.sourceType}`,
        `trust=${item.trustTier}`,
        `score=${item.retrievalScore.toFixed(2)}`,
        `support=${item.supportCount}`,
        `location=${formatEvidenceLocation(item)}`
    ].join(' | ');
}
function buildSystemMessage(policy, mode, promptEvidence, fallbackMessage, assessment, request) {
    const rules = [...policy.systemRules, ...(mode === 'fallback' ? policy.fallbackRules : [])];
    const lines = [
        `Policy version: ${policy.version}`,
        `Mode: ${mode}`,
        `Evidence strength: ${assessment.strength}`,
        `Safety classification: ${request.safety.classification}`,
        'Rules:',
        ...rules.map((rule, index) => `${index + 1}. ${rule}`),
        'Output requirements:',
        '- Provide shortAnswer.',
        '- Provide steps only when directly supported by the evidence.',
        '- Provide commands only when directly supported by the evidence.',
        mode === 'grounded'
            ? '- Cite evidence indexes for each substantive claim.'
            : '- State uncertainty explicitly and avoid unsupported claims.',
        promptEvidence.length > 0 ? `- You may cite evidence indexes E1-${promptEvidence.length}.` : '- No evidence indexes are available.'
    ];
    if (fallbackMessage) {
        lines.push(`- Fallback guidance: ${fallbackMessage}`);
    }
    if (request.escalation.shouldEscalate) {
        lines.push(`- Escalate to ${request.escalation.label}: ${request.escalation.destination}`);
    }
    return lines.join('\n');
}
function buildUserMessage(query, promptEvidence, fallbackMessage) {
    const evidenceSection = promptEvidence.length > 0
        ? promptEvidence.map((item) => formatEvidenceLine(item)).join('\n')
        : 'No evidence passed grounding checks.';
    const lines = ['User query:', query, '', 'Available evidence:', evidenceSection];
    if (fallbackMessage) {
        lines.push('', 'Fallback guidance:', fallbackMessage);
    }
    return lines.join('\n');
}
function buildAnswerGenerationRequest(input) {
    var _a;
    const policy = (_a = input.policy) !== null && _a !== void 0 ? _a : DEFAULT_GROUNDED_PROMPT_POLICY;
    const assessment = assessEvidenceStrength(input.evidence, policy);
    const promptEvidence = input.evidence.status === 'ready' ? input.evidence.evidence.map(toPromptEvidenceItem) : [];
    const safetyDecision = classifySafetyAndEscalation({
        query: input.query,
        routeIntent: input.routeIntent,
        assessment
    });
    const mode = safetyDecision.safety.requiresFallback ? 'fallback' : 'grounded';
    const fallbackMessage = buildFallbackMessage(safetyDecision, input.fallbackMessage);
    return {
        policyVersion: policy.version,
        mode,
        query: input.query,
        assessment,
        safety: safetyDecision.safety,
        escalation: safetyDecision.escalation,
        evidence: promptEvidence,
        fallbackMessage,
        responseShape: {
            shortAnswer: 'required',
            steps: 'optional',
            commands: 'optional',
            citations: mode === 'grounded' && promptEvidence.length > 0 ? 'required' : 'optional',
            confidence: 'required',
            uncertainty: mode === 'grounded' ? 'optional' : 'required'
        },
        messages: [
            {
                role: 'system',
                content: buildSystemMessage(policy, mode, promptEvidence, fallbackMessage, assessment, safetyDecision)
            },
            {
                role: 'user',
                content: buildUserMessage(input.query, promptEvidence, fallbackMessage)
            }
        ]
    };
}

var util$2;
(function (util) {
    util.assertEqual = (_) => { };
    function assertIs(_arg) { }
    util.assertIs = assertIs;
    function assertNever(_x) {
        throw new Error();
    }
    util.assertNever = assertNever;
    util.arrayToEnum = (items) => {
        const obj = {};
        for (const item of items) {
            obj[item] = item;
        }
        return obj;
    };
    util.getValidEnumValues = (obj) => {
        const validKeys = util.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
        const filtered = {};
        for (const k of validKeys) {
            filtered[k] = obj[k];
        }
        return util.objectValues(filtered);
    };
    util.objectValues = (obj) => {
        return util.objectKeys(obj).map(function (e) {
            return obj[e];
        });
    };
    util.objectKeys = typeof Object.keys === "function" // eslint-disable-line ban/ban
        ? (obj) => Object.keys(obj) // eslint-disable-line ban/ban
        : (object) => {
            const keys = [];
            for (const key in object) {
                if (Object.prototype.hasOwnProperty.call(object, key)) {
                    keys.push(key);
                }
            }
            return keys;
        };
    util.find = (arr, checker) => {
        for (const item of arr) {
            if (checker(item))
                return item;
        }
        return undefined;
    };
    util.isInteger = typeof Number.isInteger === "function"
        ? (val) => Number.isInteger(val) // eslint-disable-line ban/ban
        : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
    function joinValues(array, separator = " | ") {
        return array.map((val) => (typeof val === "string" ? `'${val}'` : val)).join(separator);
    }
    util.joinValues = joinValues;
    util.jsonStringifyReplacer = (_, value) => {
        if (typeof value === "bigint") {
            return value.toString();
        }
        return value;
    };
})(util$2 || (util$2 = {}));
var objectUtil$2;
(function (objectUtil) {
    objectUtil.mergeShapes = (first, second) => {
        return {
            ...first,
            ...second, // second overwrites first
        };
    };
})(objectUtil$2 || (objectUtil$2 = {}));
const ZodParsedType$2 = util$2.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set",
]);
const getParsedType$2 = (data) => {
    const t = typeof data;
    switch (t) {
        case "undefined":
            return ZodParsedType$2.undefined;
        case "string":
            return ZodParsedType$2.string;
        case "number":
            return Number.isNaN(data) ? ZodParsedType$2.nan : ZodParsedType$2.number;
        case "boolean":
            return ZodParsedType$2.boolean;
        case "function":
            return ZodParsedType$2.function;
        case "bigint":
            return ZodParsedType$2.bigint;
        case "symbol":
            return ZodParsedType$2.symbol;
        case "object":
            if (Array.isArray(data)) {
                return ZodParsedType$2.array;
            }
            if (data === null) {
                return ZodParsedType$2.null;
            }
            if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
                return ZodParsedType$2.promise;
            }
            if (typeof Map !== "undefined" && data instanceof Map) {
                return ZodParsedType$2.map;
            }
            if (typeof Set !== "undefined" && data instanceof Set) {
                return ZodParsedType$2.set;
            }
            if (typeof Date !== "undefined" && data instanceof Date) {
                return ZodParsedType$2.date;
            }
            return ZodParsedType$2.object;
        default:
            return ZodParsedType$2.unknown;
    }
};

const ZodIssueCode$2 = util$2.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of",
    "not_finite",
]);
let ZodError$2 = class ZodError extends Error {
    get errors() {
        return this.issues;
    }
    constructor(issues) {
        super();
        this.issues = [];
        this.addIssue = (sub) => {
            this.issues = [...this.issues, sub];
        };
        this.addIssues = (subs = []) => {
            this.issues = [...this.issues, ...subs];
        };
        const actualProto = new.target.prototype;
        if (Object.setPrototypeOf) {
            // eslint-disable-next-line ban/ban
            Object.setPrototypeOf(this, actualProto);
        }
        else {
            this.__proto__ = actualProto;
        }
        this.name = "ZodError";
        this.issues = issues;
    }
    format(_mapper) {
        const mapper = _mapper ||
            function (issue) {
                return issue.message;
            };
        const fieldErrors = { _errors: [] };
        const processError = (error) => {
            for (const issue of error.issues) {
                if (issue.code === "invalid_union") {
                    issue.unionErrors.map(processError);
                }
                else if (issue.code === "invalid_return_type") {
                    processError(issue.returnTypeError);
                }
                else if (issue.code === "invalid_arguments") {
                    processError(issue.argumentsError);
                }
                else if (issue.path.length === 0) {
                    fieldErrors._errors.push(mapper(issue));
                }
                else {
                    let curr = fieldErrors;
                    let i = 0;
                    while (i < issue.path.length) {
                        const el = issue.path[i];
                        const terminal = i === issue.path.length - 1;
                        if (!terminal) {
                            curr[el] = curr[el] || { _errors: [] };
                            // if (typeof el === "string") {
                            //   curr[el] = curr[el] || { _errors: [] };
                            // } else if (typeof el === "number") {
                            //   const errorArray: any = [];
                            //   errorArray._errors = [];
                            //   curr[el] = curr[el] || errorArray;
                            // }
                        }
                        else {
                            curr[el] = curr[el] || { _errors: [] };
                            curr[el]._errors.push(mapper(issue));
                        }
                        curr = curr[el];
                        i++;
                    }
                }
            }
        };
        processError(this);
        return fieldErrors;
    }
    static assert(value) {
        if (!(value instanceof ZodError)) {
            throw new Error(`Not a ZodError: ${value}`);
        }
    }
    toString() {
        return this.message;
    }
    get message() {
        return JSON.stringify(this.issues, util$2.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
        return this.issues.length === 0;
    }
    flatten(mapper = (issue) => issue.message) {
        const fieldErrors = {};
        const formErrors = [];
        for (const sub of this.issues) {
            if (sub.path.length > 0) {
                const firstEl = sub.path[0];
                fieldErrors[firstEl] = fieldErrors[firstEl] || [];
                fieldErrors[firstEl].push(mapper(sub));
            }
            else {
                formErrors.push(mapper(sub));
            }
        }
        return { formErrors, fieldErrors };
    }
    get formErrors() {
        return this.flatten();
    }
};
ZodError$2.create = (issues) => {
    const error = new ZodError$2(issues);
    return error;
};

const errorMap$2 = (issue, _ctx) => {
    let message;
    switch (issue.code) {
        case ZodIssueCode$2.invalid_type:
            if (issue.received === ZodParsedType$2.undefined) {
                message = "Required";
            }
            else {
                message = `Expected ${issue.expected}, received ${issue.received}`;
            }
            break;
        case ZodIssueCode$2.invalid_literal:
            message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util$2.jsonStringifyReplacer)}`;
            break;
        case ZodIssueCode$2.unrecognized_keys:
            message = `Unrecognized key(s) in object: ${util$2.joinValues(issue.keys, ", ")}`;
            break;
        case ZodIssueCode$2.invalid_union:
            message = `Invalid input`;
            break;
        case ZodIssueCode$2.invalid_union_discriminator:
            message = `Invalid discriminator value. Expected ${util$2.joinValues(issue.options)}`;
            break;
        case ZodIssueCode$2.invalid_enum_value:
            message = `Invalid enum value. Expected ${util$2.joinValues(issue.options)}, received '${issue.received}'`;
            break;
        case ZodIssueCode$2.invalid_arguments:
            message = `Invalid function arguments`;
            break;
        case ZodIssueCode$2.invalid_return_type:
            message = `Invalid function return type`;
            break;
        case ZodIssueCode$2.invalid_date:
            message = `Invalid date`;
            break;
        case ZodIssueCode$2.invalid_string:
            if (typeof issue.validation === "object") {
                if ("includes" in issue.validation) {
                    message = `Invalid input: must include "${issue.validation.includes}"`;
                    if (typeof issue.validation.position === "number") {
                        message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
                    }
                }
                else if ("startsWith" in issue.validation) {
                    message = `Invalid input: must start with "${issue.validation.startsWith}"`;
                }
                else if ("endsWith" in issue.validation) {
                    message = `Invalid input: must end with "${issue.validation.endsWith}"`;
                }
                else {
                    util$2.assertNever(issue.validation);
                }
            }
            else if (issue.validation !== "regex") {
                message = `Invalid ${issue.validation}`;
            }
            else {
                message = "Invalid";
            }
            break;
        case ZodIssueCode$2.too_small:
            if (issue.type === "array")
                message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
            else if (issue.type === "string")
                message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
            else if (issue.type === "number")
                message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
            else if (issue.type === "bigint")
                message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
            else if (issue.type === "date")
                message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
            else
                message = "Invalid input";
            break;
        case ZodIssueCode$2.too_big:
            if (issue.type === "array")
                message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
            else if (issue.type === "string")
                message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
            else if (issue.type === "number")
                message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
            else if (issue.type === "bigint")
                message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
            else if (issue.type === "date")
                message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
            else
                message = "Invalid input";
            break;
        case ZodIssueCode$2.custom:
            message = `Invalid input`;
            break;
        case ZodIssueCode$2.invalid_intersection_types:
            message = `Intersection results could not be merged`;
            break;
        case ZodIssueCode$2.not_multiple_of:
            message = `Number must be a multiple of ${issue.multipleOf}`;
            break;
        case ZodIssueCode$2.not_finite:
            message = "Number must be finite";
            break;
        default:
            message = _ctx.defaultError;
            util$2.assertNever(issue);
    }
    return { message };
};
var defaultErrorMap$1 = errorMap$2;

let overrideErrorMap$2 = defaultErrorMap$1;
function getErrorMap$2() {
    return overrideErrorMap$2;
}

const makeIssue$2 = (params) => {
    const { data, path, errorMaps, issueData } = params;
    const fullPath = [...path, ...(issueData.path || [])];
    const fullIssue = {
        ...issueData,
        path: fullPath,
    };
    if (issueData.message !== undefined) {
        return {
            ...issueData,
            path: fullPath,
            message: issueData.message,
        };
    }
    let errorMessage = "";
    const maps = errorMaps
        .filter((m) => !!m)
        .slice()
        .reverse();
    for (const map of maps) {
        errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
    }
    return {
        ...issueData,
        path: fullPath,
        message: errorMessage,
    };
};
function addIssueToContext$2(ctx, issueData) {
    const overrideMap = getErrorMap$2();
    const issue = makeIssue$2({
        issueData: issueData,
        data: ctx.data,
        path: ctx.path,
        errorMaps: [
            ctx.common.contextualErrorMap, // contextual error map is first priority
            ctx.schemaErrorMap, // then schema-bound map if available
            overrideMap, // then global override map
            overrideMap === defaultErrorMap$1 ? undefined : defaultErrorMap$1, // then global default map
        ].filter((x) => !!x),
    });
    ctx.common.issues.push(issue);
}
let ParseStatus$2 = class ParseStatus {
    constructor() {
        this.value = "valid";
    }
    dirty() {
        if (this.value === "valid")
            this.value = "dirty";
    }
    abort() {
        if (this.value !== "aborted")
            this.value = "aborted";
    }
    static mergeArray(status, results) {
        const arrayValue = [];
        for (const s of results) {
            if (s.status === "aborted")
                return INVALID$2;
            if (s.status === "dirty")
                status.dirty();
            arrayValue.push(s.value);
        }
        return { status: status.value, value: arrayValue };
    }
    static async mergeObjectAsync(status, pairs) {
        const syncPairs = [];
        for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            syncPairs.push({
                key,
                value,
            });
        }
        return ParseStatus.mergeObjectSync(status, syncPairs);
    }
    static mergeObjectSync(status, pairs) {
        const finalObject = {};
        for (const pair of pairs) {
            const { key, value } = pair;
            if (key.status === "aborted")
                return INVALID$2;
            if (value.status === "aborted")
                return INVALID$2;
            if (key.status === "dirty")
                status.dirty();
            if (value.status === "dirty")
                status.dirty();
            if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
                finalObject[key.value] = value.value;
            }
        }
        return { status: status.value, value: finalObject };
    }
};
const INVALID$2 = Object.freeze({
    status: "aborted",
});
const DIRTY$2 = (value) => ({ status: "dirty", value });
const OK$2 = (value) => ({ status: "valid", value });
const isAborted$2 = (x) => x.status === "aborted";
const isDirty$2 = (x) => x.status === "dirty";
const isValid$2 = (x) => x.status === "valid";
const isAsync$2 = (x) => typeof Promise !== "undefined" && x instanceof Promise;

var errorUtil$2;
(function (errorUtil) {
    errorUtil.errToObj = (message) => typeof message === "string" ? { message } : message || {};
    // biome-ignore lint:
    errorUtil.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil$2 || (errorUtil$2 = {}));

let ParseInputLazyPath$2 = class ParseInputLazyPath {
    constructor(parent, value, path, key) {
        this._cachedPath = [];
        this.parent = parent;
        this.data = value;
        this._path = path;
        this._key = key;
    }
    get path() {
        if (!this._cachedPath.length) {
            if (Array.isArray(this._key)) {
                this._cachedPath.push(...this._path, ...this._key);
            }
            else {
                this._cachedPath.push(...this._path, this._key);
            }
        }
        return this._cachedPath;
    }
};
const handleResult$2 = (ctx, result) => {
    if (isValid$2(result)) {
        return { success: true, data: result.value };
    }
    else {
        if (!ctx.common.issues.length) {
            throw new Error("Validation failed but no issues detected.");
        }
        return {
            success: false,
            get error() {
                if (this._error)
                    return this._error;
                const error = new ZodError$2(ctx.common.issues);
                this._error = error;
                return this._error;
            },
        };
    }
};
function processCreateParams$2(params) {
    if (!params)
        return {};
    const { errorMap, invalid_type_error, required_error, description } = params;
    if (errorMap && (invalid_type_error || required_error)) {
        throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap)
        return { errorMap: errorMap, description };
    const customMap = (iss, ctx) => {
        const { message } = params;
        if (iss.code === "invalid_enum_value") {
            return { message: message ?? ctx.defaultError };
        }
        if (typeof ctx.data === "undefined") {
            return { message: message ?? required_error ?? ctx.defaultError };
        }
        if (iss.code !== "invalid_type")
            return { message: ctx.defaultError };
        return { message: message ?? invalid_type_error ?? ctx.defaultError };
    };
    return { errorMap: customMap, description };
}
let ZodType$2 = class ZodType {
    get description() {
        return this._def.description;
    }
    _getType(input) {
        return getParsedType$2(input.data);
    }
    _getOrReturnCtx(input, ctx) {
        return (ctx || {
            common: input.parent.common,
            data: input.data,
            parsedType: getParsedType$2(input.data),
            schemaErrorMap: this._def.errorMap,
            path: input.path,
            parent: input.parent,
        });
    }
    _processInputParams(input) {
        return {
            status: new ParseStatus$2(),
            ctx: {
                common: input.parent.common,
                data: input.data,
                parsedType: getParsedType$2(input.data),
                schemaErrorMap: this._def.errorMap,
                path: input.path,
                parent: input.parent,
            },
        };
    }
    _parseSync(input) {
        const result = this._parse(input);
        if (isAsync$2(result)) {
            throw new Error("Synchronous parse encountered promise.");
        }
        return result;
    }
    _parseAsync(input) {
        const result = this._parse(input);
        return Promise.resolve(result);
    }
    parse(data, params) {
        const result = this.safeParse(data, params);
        if (result.success)
            return result.data;
        throw result.error;
    }
    safeParse(data, params) {
        const ctx = {
            common: {
                issues: [],
                async: params?.async ?? false,
                contextualErrorMap: params?.errorMap,
            },
            path: params?.path || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType$2(data),
        };
        const result = this._parseSync({ data, path: ctx.path, parent: ctx });
        return handleResult$2(ctx, result);
    }
    "~validate"(data) {
        const ctx = {
            common: {
                issues: [],
                async: !!this["~standard"].async,
            },
            path: [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType$2(data),
        };
        if (!this["~standard"].async) {
            try {
                const result = this._parseSync({ data, path: [], parent: ctx });
                return isValid$2(result)
                    ? {
                        value: result.value,
                    }
                    : {
                        issues: ctx.common.issues,
                    };
            }
            catch (err) {
                if (err?.message?.toLowerCase()?.includes("encountered")) {
                    this["~standard"].async = true;
                }
                ctx.common = {
                    issues: [],
                    async: true,
                };
            }
        }
        return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid$2(result)
            ? {
                value: result.value,
            }
            : {
                issues: ctx.common.issues,
            });
    }
    async parseAsync(data, params) {
        const result = await this.safeParseAsync(data, params);
        if (result.success)
            return result.data;
        throw result.error;
    }
    async safeParseAsync(data, params) {
        const ctx = {
            common: {
                issues: [],
                contextualErrorMap: params?.errorMap,
                async: true,
            },
            path: params?.path || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType$2(data),
        };
        const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
        const result = await (isAsync$2(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
        return handleResult$2(ctx, result);
    }
    refine(check, message) {
        const getIssueProperties = (val) => {
            if (typeof message === "string" || typeof message === "undefined") {
                return { message };
            }
            else if (typeof message === "function") {
                return message(val);
            }
            else {
                return message;
            }
        };
        return this._refinement((val, ctx) => {
            const result = check(val);
            const setError = () => ctx.addIssue({
                code: ZodIssueCode$2.custom,
                ...getIssueProperties(val),
            });
            if (typeof Promise !== "undefined" && result instanceof Promise) {
                return result.then((data) => {
                    if (!data) {
                        setError();
                        return false;
                    }
                    else {
                        return true;
                    }
                });
            }
            if (!result) {
                setError();
                return false;
            }
            else {
                return true;
            }
        });
    }
    refinement(check, refinementData) {
        return this._refinement((val, ctx) => {
            if (!check(val)) {
                ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
                return false;
            }
            else {
                return true;
            }
        });
    }
    _refinement(refinement) {
        return new ZodEffects$2({
            schema: this,
            typeName: ZodFirstPartyTypeKind$2.ZodEffects,
            effect: { type: "refinement", refinement },
        });
    }
    superRefine(refinement) {
        return this._refinement(refinement);
    }
    constructor(def) {
        /** Alias of safeParseAsync */
        this.spa = this.safeParseAsync;
        this._def = def;
        this.parse = this.parse.bind(this);
        this.safeParse = this.safeParse.bind(this);
        this.parseAsync = this.parseAsync.bind(this);
        this.safeParseAsync = this.safeParseAsync.bind(this);
        this.spa = this.spa.bind(this);
        this.refine = this.refine.bind(this);
        this.refinement = this.refinement.bind(this);
        this.superRefine = this.superRefine.bind(this);
        this.optional = this.optional.bind(this);
        this.nullable = this.nullable.bind(this);
        this.nullish = this.nullish.bind(this);
        this.array = this.array.bind(this);
        this.promise = this.promise.bind(this);
        this.or = this.or.bind(this);
        this.and = this.and.bind(this);
        this.transform = this.transform.bind(this);
        this.brand = this.brand.bind(this);
        this.default = this.default.bind(this);
        this.catch = this.catch.bind(this);
        this.describe = this.describe.bind(this);
        this.pipe = this.pipe.bind(this);
        this.readonly = this.readonly.bind(this);
        this.isNullable = this.isNullable.bind(this);
        this.isOptional = this.isOptional.bind(this);
        this["~standard"] = {
            version: 1,
            vendor: "zod",
            validate: (data) => this["~validate"](data),
        };
    }
    optional() {
        return ZodOptional$2.create(this, this._def);
    }
    nullable() {
        return ZodNullable$2.create(this, this._def);
    }
    nullish() {
        return this.nullable().optional();
    }
    array() {
        return ZodArray$2.create(this);
    }
    promise() {
        return ZodPromise$2.create(this, this._def);
    }
    or(option) {
        return ZodUnion$2.create([this, option], this._def);
    }
    and(incoming) {
        return ZodIntersection$2.create(this, incoming, this._def);
    }
    transform(transform) {
        return new ZodEffects$2({
            ...processCreateParams$2(this._def),
            schema: this,
            typeName: ZodFirstPartyTypeKind$2.ZodEffects,
            effect: { type: "transform", transform },
        });
    }
    default(def) {
        const defaultValueFunc = typeof def === "function" ? def : () => def;
        return new ZodDefault$2({
            ...processCreateParams$2(this._def),
            innerType: this,
            defaultValue: defaultValueFunc,
            typeName: ZodFirstPartyTypeKind$2.ZodDefault,
        });
    }
    brand() {
        return new ZodBranded$2({
            typeName: ZodFirstPartyTypeKind$2.ZodBranded,
            type: this,
            ...processCreateParams$2(this._def),
        });
    }
    catch(def) {
        const catchValueFunc = typeof def === "function" ? def : () => def;
        return new ZodCatch$2({
            ...processCreateParams$2(this._def),
            innerType: this,
            catchValue: catchValueFunc,
            typeName: ZodFirstPartyTypeKind$2.ZodCatch,
        });
    }
    describe(description) {
        const This = this.constructor;
        return new This({
            ...this._def,
            description,
        });
    }
    pipe(target) {
        return ZodPipeline$2.create(this, target);
    }
    readonly() {
        return ZodReadonly$2.create(this);
    }
    isOptional() {
        return this.safeParse(undefined).success;
    }
    isNullable() {
        return this.safeParse(null).success;
    }
};
const cuidRegex$2 = /^c[^\s-]{8,}$/i;
const cuid2Regex$2 = /^[0-9a-z]+$/;
const ulidRegex$2 = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
// const uuidRegex =
//   /^([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}|00000000-0000-0000-0000-000000000000)$/i;
const uuidRegex$2 = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
const nanoidRegex$2 = /^[a-z0-9_-]{21}$/i;
const jwtRegex$2 = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
const durationRegex$2 = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
// from https://stackoverflow.com/a/46181/1550155
// old version: too slow, didn't support unicode
// const emailRegex = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i;
//old email regex
// const emailRegex = /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@((?!-)([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{1,})[^-<>()[\].,;:\s@"]$/i;
// eslint-disable-next-line
// const emailRegex =
//   /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\])|(\[IPv6:(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))\])|([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])*(\.[A-Za-z]{2,})+))$/;
// const emailRegex =
//   /^[a-zA-Z0-9\.\!\#\$\%\&\'\*\+\/\=\?\^\_\`\{\|\}\~\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
// const emailRegex =
//   /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;
const emailRegex$2 = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
// const emailRegex =
//   /^[a-z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9\-]+)*$/i;
// from https://thekevinscott.com/emojis-in-javascript/#writing-a-regular-expression
const _emojiRegex$2 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
let emojiRegex$2;
// faster, simpler, safer
const ipv4Regex$2 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv4CidrRegex$2 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
// const ipv6Regex =
// /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/;
const ipv6Regex$2 = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
const ipv6CidrRegex$2 = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
// https://stackoverflow.com/questions/7860392/determine-if-string-is-in-base64-using-javascript
const base64Regex$2 = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
// https://base64.guru/standards/base64url
const base64urlRegex$2 = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
// simple
// const dateRegexSource = `\\d{4}-\\d{2}-\\d{2}`;
// no leap year validation
// const dateRegexSource = `\\d{4}-((0[13578]|10|12)-31|(0[13-9]|1[0-2])-30|(0[1-9]|1[0-2])-(0[1-9]|1\\d|2\\d))`;
// with leap year validation
const dateRegexSource$2 = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
const dateRegex$2 = new RegExp(`^${dateRegexSource$2}$`);
function timeRegexSource$2(args) {
    let secondsRegexSource = `[0-5]\\d`;
    if (args.precision) {
        secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
    }
    else if (args.precision == null) {
        secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
    }
    const secondsQuantifier = args.precision ? "+" : "?"; // require seconds if precision is nonzero
    return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex$2(args) {
    return new RegExp(`^${timeRegexSource$2(args)}$`);
}
// Adapted from https://stackoverflow.com/a/3143231
function datetimeRegex$2(args) {
    let regex = `${dateRegexSource$2}T${timeRegexSource$2(args)}`;
    const opts = [];
    opts.push(args.local ? `Z?` : `Z`);
    if (args.offset)
        opts.push(`([+-]\\d{2}:?\\d{2})`);
    regex = `${regex}(${opts.join("|")})`;
    return new RegExp(`^${regex}$`);
}
function isValidIP$2(ip, version) {
    if ((version === "v4" || !version) && ipv4Regex$2.test(ip)) {
        return true;
    }
    if ((version === "v6" || !version) && ipv6Regex$2.test(ip)) {
        return true;
    }
    return false;
}
function isValidJWT$2(jwt, alg) {
    if (!jwtRegex$2.test(jwt))
        return false;
    try {
        const [header] = jwt.split(".");
        if (!header)
            return false;
        // Convert base64url to base64
        const base64 = header
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(header.length + ((4 - (header.length % 4)) % 4), "=");
        const decoded = JSON.parse(atob(base64));
        if (typeof decoded !== "object" || decoded === null)
            return false;
        if ("typ" in decoded && decoded?.typ !== "JWT")
            return false;
        if (!decoded.alg)
            return false;
        if (alg && decoded.alg !== alg)
            return false;
        return true;
    }
    catch {
        return false;
    }
}
function isValidCidr$2(ip, version) {
    if ((version === "v4" || !version) && ipv4CidrRegex$2.test(ip)) {
        return true;
    }
    if ((version === "v6" || !version) && ipv6CidrRegex$2.test(ip)) {
        return true;
    }
    return false;
}
let ZodString$2 = class ZodString extends ZodType$2 {
    _parse(input) {
        if (this._def.coerce) {
            input.data = String(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$2.string) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_type,
                expected: ZodParsedType$2.string,
                received: ctx.parsedType,
            });
            return INVALID$2;
        }
        const status = new ParseStatus$2();
        let ctx = undefined;
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                if (input.data.length < check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.too_small,
                        minimum: check.value,
                        type: "string",
                        inclusive: true,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                if (input.data.length > check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.too_big,
                        maximum: check.value,
                        type: "string",
                        inclusive: true,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "length") {
                const tooBig = input.data.length > check.value;
                const tooSmall = input.data.length < check.value;
                if (tooBig || tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    if (tooBig) {
                        addIssueToContext$2(ctx, {
                            code: ZodIssueCode$2.too_big,
                            maximum: check.value,
                            type: "string",
                            inclusive: true,
                            exact: true,
                            message: check.message,
                        });
                    }
                    else if (tooSmall) {
                        addIssueToContext$2(ctx, {
                            code: ZodIssueCode$2.too_small,
                            minimum: check.value,
                            type: "string",
                            inclusive: true,
                            exact: true,
                            message: check.message,
                        });
                    }
                    status.dirty();
                }
            }
            else if (check.kind === "email") {
                if (!emailRegex$2.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        validation: "email",
                        code: ZodIssueCode$2.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "emoji") {
                if (!emojiRegex$2) {
                    emojiRegex$2 = new RegExp(_emojiRegex$2, "u");
                }
                if (!emojiRegex$2.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        validation: "emoji",
                        code: ZodIssueCode$2.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "uuid") {
                if (!uuidRegex$2.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        validation: "uuid",
                        code: ZodIssueCode$2.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "nanoid") {
                if (!nanoidRegex$2.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        validation: "nanoid",
                        code: ZodIssueCode$2.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cuid") {
                if (!cuidRegex$2.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        validation: "cuid",
                        code: ZodIssueCode$2.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cuid2") {
                if (!cuid2Regex$2.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        validation: "cuid2",
                        code: ZodIssueCode$2.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "ulid") {
                if (!ulidRegex$2.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        validation: "ulid",
                        code: ZodIssueCode$2.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "url") {
                try {
                    new URL(input.data);
                }
                catch {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        validation: "url",
                        code: ZodIssueCode$2.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "regex") {
                check.regex.lastIndex = 0;
                const testResult = check.regex.test(input.data);
                if (!testResult) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        validation: "regex",
                        code: ZodIssueCode$2.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "trim") {
                input.data = input.data.trim();
            }
            else if (check.kind === "includes") {
                if (!input.data.includes(check.value, check.position)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.invalid_string,
                        validation: { includes: check.value, position: check.position },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "toLowerCase") {
                input.data = input.data.toLowerCase();
            }
            else if (check.kind === "toUpperCase") {
                input.data = input.data.toUpperCase();
            }
            else if (check.kind === "startsWith") {
                if (!input.data.startsWith(check.value)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.invalid_string,
                        validation: { startsWith: check.value },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "endsWith") {
                if (!input.data.endsWith(check.value)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.invalid_string,
                        validation: { endsWith: check.value },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "datetime") {
                const regex = datetimeRegex$2(check);
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.invalid_string,
                        validation: "datetime",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "date") {
                const regex = dateRegex$2;
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.invalid_string,
                        validation: "date",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "time") {
                const regex = timeRegex$2(check);
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.invalid_string,
                        validation: "time",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "duration") {
                if (!durationRegex$2.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        validation: "duration",
                        code: ZodIssueCode$2.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "ip") {
                if (!isValidIP$2(input.data, check.version)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        validation: "ip",
                        code: ZodIssueCode$2.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "jwt") {
                if (!isValidJWT$2(input.data, check.alg)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        validation: "jwt",
                        code: ZodIssueCode$2.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cidr") {
                if (!isValidCidr$2(input.data, check.version)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        validation: "cidr",
                        code: ZodIssueCode$2.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "base64") {
                if (!base64Regex$2.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        validation: "base64",
                        code: ZodIssueCode$2.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "base64url") {
                if (!base64urlRegex$2.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        validation: "base64url",
                        code: ZodIssueCode$2.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util$2.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    _regex(regex, validation, message) {
        return this.refinement((data) => regex.test(data), {
            validation,
            code: ZodIssueCode$2.invalid_string,
            ...errorUtil$2.errToObj(message),
        });
    }
    _addCheck(check) {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    email(message) {
        return this._addCheck({ kind: "email", ...errorUtil$2.errToObj(message) });
    }
    url(message) {
        return this._addCheck({ kind: "url", ...errorUtil$2.errToObj(message) });
    }
    emoji(message) {
        return this._addCheck({ kind: "emoji", ...errorUtil$2.errToObj(message) });
    }
    uuid(message) {
        return this._addCheck({ kind: "uuid", ...errorUtil$2.errToObj(message) });
    }
    nanoid(message) {
        return this._addCheck({ kind: "nanoid", ...errorUtil$2.errToObj(message) });
    }
    cuid(message) {
        return this._addCheck({ kind: "cuid", ...errorUtil$2.errToObj(message) });
    }
    cuid2(message) {
        return this._addCheck({ kind: "cuid2", ...errorUtil$2.errToObj(message) });
    }
    ulid(message) {
        return this._addCheck({ kind: "ulid", ...errorUtil$2.errToObj(message) });
    }
    base64(message) {
        return this._addCheck({ kind: "base64", ...errorUtil$2.errToObj(message) });
    }
    base64url(message) {
        // base64url encoding is a modification of base64 that can safely be used in URLs and filenames
        return this._addCheck({
            kind: "base64url",
            ...errorUtil$2.errToObj(message),
        });
    }
    jwt(options) {
        return this._addCheck({ kind: "jwt", ...errorUtil$2.errToObj(options) });
    }
    ip(options) {
        return this._addCheck({ kind: "ip", ...errorUtil$2.errToObj(options) });
    }
    cidr(options) {
        return this._addCheck({ kind: "cidr", ...errorUtil$2.errToObj(options) });
    }
    datetime(options) {
        if (typeof options === "string") {
            return this._addCheck({
                kind: "datetime",
                precision: null,
                offset: false,
                local: false,
                message: options,
            });
        }
        return this._addCheck({
            kind: "datetime",
            precision: typeof options?.precision === "undefined" ? null : options?.precision,
            offset: options?.offset ?? false,
            local: options?.local ?? false,
            ...errorUtil$2.errToObj(options?.message),
        });
    }
    date(message) {
        return this._addCheck({ kind: "date", message });
    }
    time(options) {
        if (typeof options === "string") {
            return this._addCheck({
                kind: "time",
                precision: null,
                message: options,
            });
        }
        return this._addCheck({
            kind: "time",
            precision: typeof options?.precision === "undefined" ? null : options?.precision,
            ...errorUtil$2.errToObj(options?.message),
        });
    }
    duration(message) {
        return this._addCheck({ kind: "duration", ...errorUtil$2.errToObj(message) });
    }
    regex(regex, message) {
        return this._addCheck({
            kind: "regex",
            regex: regex,
            ...errorUtil$2.errToObj(message),
        });
    }
    includes(value, options) {
        return this._addCheck({
            kind: "includes",
            value: value,
            position: options?.position,
            ...errorUtil$2.errToObj(options?.message),
        });
    }
    startsWith(value, message) {
        return this._addCheck({
            kind: "startsWith",
            value: value,
            ...errorUtil$2.errToObj(message),
        });
    }
    endsWith(value, message) {
        return this._addCheck({
            kind: "endsWith",
            value: value,
            ...errorUtil$2.errToObj(message),
        });
    }
    min(minLength, message) {
        return this._addCheck({
            kind: "min",
            value: minLength,
            ...errorUtil$2.errToObj(message),
        });
    }
    max(maxLength, message) {
        return this._addCheck({
            kind: "max",
            value: maxLength,
            ...errorUtil$2.errToObj(message),
        });
    }
    length(len, message) {
        return this._addCheck({
            kind: "length",
            value: len,
            ...errorUtil$2.errToObj(message),
        });
    }
    /**
     * Equivalent to `.min(1)`
     */
    nonempty(message) {
        return this.min(1, errorUtil$2.errToObj(message));
    }
    trim() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "trim" }],
        });
    }
    toLowerCase() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "toLowerCase" }],
        });
    }
    toUpperCase() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "toUpperCase" }],
        });
    }
    get isDatetime() {
        return !!this._def.checks.find((ch) => ch.kind === "datetime");
    }
    get isDate() {
        return !!this._def.checks.find((ch) => ch.kind === "date");
    }
    get isTime() {
        return !!this._def.checks.find((ch) => ch.kind === "time");
    }
    get isDuration() {
        return !!this._def.checks.find((ch) => ch.kind === "duration");
    }
    get isEmail() {
        return !!this._def.checks.find((ch) => ch.kind === "email");
    }
    get isURL() {
        return !!this._def.checks.find((ch) => ch.kind === "url");
    }
    get isEmoji() {
        return !!this._def.checks.find((ch) => ch.kind === "emoji");
    }
    get isUUID() {
        return !!this._def.checks.find((ch) => ch.kind === "uuid");
    }
    get isNANOID() {
        return !!this._def.checks.find((ch) => ch.kind === "nanoid");
    }
    get isCUID() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid");
    }
    get isCUID2() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid2");
    }
    get isULID() {
        return !!this._def.checks.find((ch) => ch.kind === "ulid");
    }
    get isIP() {
        return !!this._def.checks.find((ch) => ch.kind === "ip");
    }
    get isCIDR() {
        return !!this._def.checks.find((ch) => ch.kind === "cidr");
    }
    get isBase64() {
        return !!this._def.checks.find((ch) => ch.kind === "base64");
    }
    get isBase64url() {
        // base64url encoding is a modification of base64 that can safely be used in URLs and filenames
        return !!this._def.checks.find((ch) => ch.kind === "base64url");
    }
    get minLength() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxLength() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
};
ZodString$2.create = (params) => {
    return new ZodString$2({
        checks: [],
        typeName: ZodFirstPartyTypeKind$2.ZodString,
        coerce: params?.coerce ?? false,
        ...processCreateParams$2(params),
    });
};
// https://stackoverflow.com/questions/3966484/why-does-modulus-operator-return-fractional-number-in-javascript/31711034#31711034
function floatSafeRemainder$2(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepDecCount = (step.toString().split(".")[1] || "").length;
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
    return (valInt % stepInt) / 10 ** decCount;
}
let ZodNumber$2 = class ZodNumber extends ZodType$2 {
    constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
        this.step = this.multipleOf;
    }
    _parse(input) {
        if (this._def.coerce) {
            input.data = Number(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$2.number) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_type,
                expected: ZodParsedType$2.number,
                received: ctx.parsedType,
            });
            return INVALID$2;
        }
        let ctx = undefined;
        const status = new ParseStatus$2();
        for (const check of this._def.checks) {
            if (check.kind === "int") {
                if (!util$2.isInteger(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.invalid_type,
                        expected: "integer",
                        received: "float",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "min") {
                const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
                if (tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.too_small,
                        minimum: check.value,
                        type: "number",
                        inclusive: check.inclusive,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
                if (tooBig) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.too_big,
                        maximum: check.value,
                        type: "number",
                        inclusive: check.inclusive,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "multipleOf") {
                if (floatSafeRemainder$2(input.data, check.value) !== 0) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.not_multiple_of,
                        multipleOf: check.value,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "finite") {
                if (!Number.isFinite(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.not_finite,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util$2.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    gte(value, message) {
        return this.setLimit("min", value, true, errorUtil$2.toString(message));
    }
    gt(value, message) {
        return this.setLimit("min", value, false, errorUtil$2.toString(message));
    }
    lte(value, message) {
        return this.setLimit("max", value, true, errorUtil$2.toString(message));
    }
    lt(value, message) {
        return this.setLimit("max", value, false, errorUtil$2.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
        return new ZodNumber({
            ...this._def,
            checks: [
                ...this._def.checks,
                {
                    kind,
                    value,
                    inclusive,
                    message: errorUtil$2.toString(message),
                },
            ],
        });
    }
    _addCheck(check) {
        return new ZodNumber({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    int(message) {
        return this._addCheck({
            kind: "int",
            message: errorUtil$2.toString(message),
        });
    }
    positive(message) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: false,
            message: errorUtil$2.toString(message),
        });
    }
    negative(message) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: false,
            message: errorUtil$2.toString(message),
        });
    }
    nonpositive(message) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: true,
            message: errorUtil$2.toString(message),
        });
    }
    nonnegative(message) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: true,
            message: errorUtil$2.toString(message),
        });
    }
    multipleOf(value, message) {
        return this._addCheck({
            kind: "multipleOf",
            value: value,
            message: errorUtil$2.toString(message),
        });
    }
    finite(message) {
        return this._addCheck({
            kind: "finite",
            message: errorUtil$2.toString(message),
        });
    }
    safe(message) {
        return this._addCheck({
            kind: "min",
            inclusive: true,
            value: Number.MIN_SAFE_INTEGER,
            message: errorUtil$2.toString(message),
        })._addCheck({
            kind: "max",
            inclusive: true,
            value: Number.MAX_SAFE_INTEGER,
            message: errorUtil$2.toString(message),
        });
    }
    get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
    get isInt() {
        return !!this._def.checks.find((ch) => ch.kind === "int" || (ch.kind === "multipleOf" && util$2.isInteger(ch.value)));
    }
    get isFinite() {
        let max = null;
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
                return true;
            }
            else if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
            else if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return Number.isFinite(min) && Number.isFinite(max);
    }
};
ZodNumber$2.create = (params) => {
    return new ZodNumber$2({
        checks: [],
        typeName: ZodFirstPartyTypeKind$2.ZodNumber,
        coerce: params?.coerce || false,
        ...processCreateParams$2(params),
    });
};
let ZodBigInt$2 = class ZodBigInt extends ZodType$2 {
    constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
    }
    _parse(input) {
        if (this._def.coerce) {
            try {
                input.data = BigInt(input.data);
            }
            catch {
                return this._getInvalidInput(input);
            }
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$2.bigint) {
            return this._getInvalidInput(input);
        }
        let ctx = undefined;
        const status = new ParseStatus$2();
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
                if (tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.too_small,
                        type: "bigint",
                        minimum: check.value,
                        inclusive: check.inclusive,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
                if (tooBig) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.too_big,
                        type: "bigint",
                        maximum: check.value,
                        inclusive: check.inclusive,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "multipleOf") {
                if (input.data % check.value !== BigInt(0)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.not_multiple_of,
                        multipleOf: check.value,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util$2.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    _getInvalidInput(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext$2(ctx, {
            code: ZodIssueCode$2.invalid_type,
            expected: ZodParsedType$2.bigint,
            received: ctx.parsedType,
        });
        return INVALID$2;
    }
    gte(value, message) {
        return this.setLimit("min", value, true, errorUtil$2.toString(message));
    }
    gt(value, message) {
        return this.setLimit("min", value, false, errorUtil$2.toString(message));
    }
    lte(value, message) {
        return this.setLimit("max", value, true, errorUtil$2.toString(message));
    }
    lt(value, message) {
        return this.setLimit("max", value, false, errorUtil$2.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
        return new ZodBigInt({
            ...this._def,
            checks: [
                ...this._def.checks,
                {
                    kind,
                    value,
                    inclusive,
                    message: errorUtil$2.toString(message),
                },
            ],
        });
    }
    _addCheck(check) {
        return new ZodBigInt({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    positive(message) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil$2.toString(message),
        });
    }
    negative(message) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil$2.toString(message),
        });
    }
    nonpositive(message) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil$2.toString(message),
        });
    }
    nonnegative(message) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil$2.toString(message),
        });
    }
    multipleOf(value, message) {
        return this._addCheck({
            kind: "multipleOf",
            value,
            message: errorUtil$2.toString(message),
        });
    }
    get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
};
ZodBigInt$2.create = (params) => {
    return new ZodBigInt$2({
        checks: [],
        typeName: ZodFirstPartyTypeKind$2.ZodBigInt,
        coerce: params?.coerce ?? false,
        ...processCreateParams$2(params),
    });
};
let ZodBoolean$2 = class ZodBoolean extends ZodType$2 {
    _parse(input) {
        if (this._def.coerce) {
            input.data = Boolean(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$2.boolean) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_type,
                expected: ZodParsedType$2.boolean,
                received: ctx.parsedType,
            });
            return INVALID$2;
        }
        return OK$2(input.data);
    }
};
ZodBoolean$2.create = (params) => {
    return new ZodBoolean$2({
        typeName: ZodFirstPartyTypeKind$2.ZodBoolean,
        coerce: params?.coerce || false,
        ...processCreateParams$2(params),
    });
};
let ZodDate$2 = class ZodDate extends ZodType$2 {
    _parse(input) {
        if (this._def.coerce) {
            input.data = new Date(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$2.date) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_type,
                expected: ZodParsedType$2.date,
                received: ctx.parsedType,
            });
            return INVALID$2;
        }
        if (Number.isNaN(input.data.getTime())) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_date,
            });
            return INVALID$2;
        }
        const status = new ParseStatus$2();
        let ctx = undefined;
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                if (input.data.getTime() < check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.too_small,
                        message: check.message,
                        inclusive: true,
                        exact: false,
                        minimum: check.value,
                        type: "date",
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                if (input.data.getTime() > check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.too_big,
                        message: check.message,
                        inclusive: true,
                        exact: false,
                        maximum: check.value,
                        type: "date",
                    });
                    status.dirty();
                }
            }
            else {
                util$2.assertNever(check);
            }
        }
        return {
            status: status.value,
            value: new Date(input.data.getTime()),
        };
    }
    _addCheck(check) {
        return new ZodDate({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    min(minDate, message) {
        return this._addCheck({
            kind: "min",
            value: minDate.getTime(),
            message: errorUtil$2.toString(message),
        });
    }
    max(maxDate, message) {
        return this._addCheck({
            kind: "max",
            value: maxDate.getTime(),
            message: errorUtil$2.toString(message),
        });
    }
    get minDate() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min != null ? new Date(min) : null;
    }
    get maxDate() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max != null ? new Date(max) : null;
    }
};
ZodDate$2.create = (params) => {
    return new ZodDate$2({
        checks: [],
        coerce: params?.coerce || false,
        typeName: ZodFirstPartyTypeKind$2.ZodDate,
        ...processCreateParams$2(params),
    });
};
let ZodSymbol$2 = class ZodSymbol extends ZodType$2 {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$2.symbol) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_type,
                expected: ZodParsedType$2.symbol,
                received: ctx.parsedType,
            });
            return INVALID$2;
        }
        return OK$2(input.data);
    }
};
ZodSymbol$2.create = (params) => {
    return new ZodSymbol$2({
        typeName: ZodFirstPartyTypeKind$2.ZodSymbol,
        ...processCreateParams$2(params),
    });
};
let ZodUndefined$2 = class ZodUndefined extends ZodType$2 {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$2.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_type,
                expected: ZodParsedType$2.undefined,
                received: ctx.parsedType,
            });
            return INVALID$2;
        }
        return OK$2(input.data);
    }
};
ZodUndefined$2.create = (params) => {
    return new ZodUndefined$2({
        typeName: ZodFirstPartyTypeKind$2.ZodUndefined,
        ...processCreateParams$2(params),
    });
};
let ZodNull$2 = class ZodNull extends ZodType$2 {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$2.null) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_type,
                expected: ZodParsedType$2.null,
                received: ctx.parsedType,
            });
            return INVALID$2;
        }
        return OK$2(input.data);
    }
};
ZodNull$2.create = (params) => {
    return new ZodNull$2({
        typeName: ZodFirstPartyTypeKind$2.ZodNull,
        ...processCreateParams$2(params),
    });
};
let ZodAny$2 = class ZodAny extends ZodType$2 {
    constructor() {
        super(...arguments);
        // to prevent instances of other classes from extending ZodAny. this causes issues with catchall in ZodObject.
        this._any = true;
    }
    _parse(input) {
        return OK$2(input.data);
    }
};
ZodAny$2.create = (params) => {
    return new ZodAny$2({
        typeName: ZodFirstPartyTypeKind$2.ZodAny,
        ...processCreateParams$2(params),
    });
};
let ZodUnknown$2 = class ZodUnknown extends ZodType$2 {
    constructor() {
        super(...arguments);
        // required
        this._unknown = true;
    }
    _parse(input) {
        return OK$2(input.data);
    }
};
ZodUnknown$2.create = (params) => {
    return new ZodUnknown$2({
        typeName: ZodFirstPartyTypeKind$2.ZodUnknown,
        ...processCreateParams$2(params),
    });
};
let ZodNever$2 = class ZodNever extends ZodType$2 {
    _parse(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext$2(ctx, {
            code: ZodIssueCode$2.invalid_type,
            expected: ZodParsedType$2.never,
            received: ctx.parsedType,
        });
        return INVALID$2;
    }
};
ZodNever$2.create = (params) => {
    return new ZodNever$2({
        typeName: ZodFirstPartyTypeKind$2.ZodNever,
        ...processCreateParams$2(params),
    });
};
let ZodVoid$2 = class ZodVoid extends ZodType$2 {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$2.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_type,
                expected: ZodParsedType$2.void,
                received: ctx.parsedType,
            });
            return INVALID$2;
        }
        return OK$2(input.data);
    }
};
ZodVoid$2.create = (params) => {
    return new ZodVoid$2({
        typeName: ZodFirstPartyTypeKind$2.ZodVoid,
        ...processCreateParams$2(params),
    });
};
let ZodArray$2 = class ZodArray extends ZodType$2 {
    _parse(input) {
        const { ctx, status } = this._processInputParams(input);
        const def = this._def;
        if (ctx.parsedType !== ZodParsedType$2.array) {
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_type,
                expected: ZodParsedType$2.array,
                received: ctx.parsedType,
            });
            return INVALID$2;
        }
        if (def.exactLength !== null) {
            const tooBig = ctx.data.length > def.exactLength.value;
            const tooSmall = ctx.data.length < def.exactLength.value;
            if (tooBig || tooSmall) {
                addIssueToContext$2(ctx, {
                    code: tooBig ? ZodIssueCode$2.too_big : ZodIssueCode$2.too_small,
                    minimum: (tooSmall ? def.exactLength.value : undefined),
                    maximum: (tooBig ? def.exactLength.value : undefined),
                    type: "array",
                    inclusive: true,
                    exact: true,
                    message: def.exactLength.message,
                });
                status.dirty();
            }
        }
        if (def.minLength !== null) {
            if (ctx.data.length < def.minLength.value) {
                addIssueToContext$2(ctx, {
                    code: ZodIssueCode$2.too_small,
                    minimum: def.minLength.value,
                    type: "array",
                    inclusive: true,
                    exact: false,
                    message: def.minLength.message,
                });
                status.dirty();
            }
        }
        if (def.maxLength !== null) {
            if (ctx.data.length > def.maxLength.value) {
                addIssueToContext$2(ctx, {
                    code: ZodIssueCode$2.too_big,
                    maximum: def.maxLength.value,
                    type: "array",
                    inclusive: true,
                    exact: false,
                    message: def.maxLength.message,
                });
                status.dirty();
            }
        }
        if (ctx.common.async) {
            return Promise.all([...ctx.data].map((item, i) => {
                return def.type._parseAsync(new ParseInputLazyPath$2(ctx, item, ctx.path, i));
            })).then((result) => {
                return ParseStatus$2.mergeArray(status, result);
            });
        }
        const result = [...ctx.data].map((item, i) => {
            return def.type._parseSync(new ParseInputLazyPath$2(ctx, item, ctx.path, i));
        });
        return ParseStatus$2.mergeArray(status, result);
    }
    get element() {
        return this._def.type;
    }
    min(minLength, message) {
        return new ZodArray({
            ...this._def,
            minLength: { value: minLength, message: errorUtil$2.toString(message) },
        });
    }
    max(maxLength, message) {
        return new ZodArray({
            ...this._def,
            maxLength: { value: maxLength, message: errorUtil$2.toString(message) },
        });
    }
    length(len, message) {
        return new ZodArray({
            ...this._def,
            exactLength: { value: len, message: errorUtil$2.toString(message) },
        });
    }
    nonempty(message) {
        return this.min(1, message);
    }
};
ZodArray$2.create = (schema, params) => {
    return new ZodArray$2({
        type: schema,
        minLength: null,
        maxLength: null,
        exactLength: null,
        typeName: ZodFirstPartyTypeKind$2.ZodArray,
        ...processCreateParams$2(params),
    });
};
function deepPartialify$2(schema) {
    if (schema instanceof ZodObject$2) {
        const newShape = {};
        for (const key in schema.shape) {
            const fieldSchema = schema.shape[key];
            newShape[key] = ZodOptional$2.create(deepPartialify$2(fieldSchema));
        }
        return new ZodObject$2({
            ...schema._def,
            shape: () => newShape,
        });
    }
    else if (schema instanceof ZodArray$2) {
        return new ZodArray$2({
            ...schema._def,
            type: deepPartialify$2(schema.element),
        });
    }
    else if (schema instanceof ZodOptional$2) {
        return ZodOptional$2.create(deepPartialify$2(schema.unwrap()));
    }
    else if (schema instanceof ZodNullable$2) {
        return ZodNullable$2.create(deepPartialify$2(schema.unwrap()));
    }
    else if (schema instanceof ZodTuple$2) {
        return ZodTuple$2.create(schema.items.map((item) => deepPartialify$2(item)));
    }
    else {
        return schema;
    }
}
let ZodObject$2 = class ZodObject extends ZodType$2 {
    constructor() {
        super(...arguments);
        this._cached = null;
        /**
         * @deprecated In most cases, this is no longer needed - unknown properties are now silently stripped.
         * If you want to pass through unknown properties, use `.passthrough()` instead.
         */
        this.nonstrict = this.passthrough;
        // extend<
        //   Augmentation extends ZodRawShape,
        //   NewOutput extends util.flatten<{
        //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
        //       ? Augmentation[k]["_output"]
        //       : k extends keyof Output
        //       ? Output[k]
        //       : never;
        //   }>,
        //   NewInput extends util.flatten<{
        //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
        //       ? Augmentation[k]["_input"]
        //       : k extends keyof Input
        //       ? Input[k]
        //       : never;
        //   }>
        // >(
        //   augmentation: Augmentation
        // ): ZodObject<
        //   extendShape<T, Augmentation>,
        //   UnknownKeys,
        //   Catchall,
        //   NewOutput,
        //   NewInput
        // > {
        //   return new ZodObject({
        //     ...this._def,
        //     shape: () => ({
        //       ...this._def.shape(),
        //       ...augmentation,
        //     }),
        //   }) as any;
        // }
        /**
         * @deprecated Use `.extend` instead
         *  */
        this.augment = this.extend;
    }
    _getCached() {
        if (this._cached !== null)
            return this._cached;
        const shape = this._def.shape();
        const keys = util$2.objectKeys(shape);
        this._cached = { shape, keys };
        return this._cached;
    }
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$2.object) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_type,
                expected: ZodParsedType$2.object,
                received: ctx.parsedType,
            });
            return INVALID$2;
        }
        const { status, ctx } = this._processInputParams(input);
        const { shape, keys: shapeKeys } = this._getCached();
        const extraKeys = [];
        if (!(this._def.catchall instanceof ZodNever$2 && this._def.unknownKeys === "strip")) {
            for (const key in ctx.data) {
                if (!shapeKeys.includes(key)) {
                    extraKeys.push(key);
                }
            }
        }
        const pairs = [];
        for (const key of shapeKeys) {
            const keyValidator = shape[key];
            const value = ctx.data[key];
            pairs.push({
                key: { status: "valid", value: key },
                value: keyValidator._parse(new ParseInputLazyPath$2(ctx, value, ctx.path, key)),
                alwaysSet: key in ctx.data,
            });
        }
        if (this._def.catchall instanceof ZodNever$2) {
            const unknownKeys = this._def.unknownKeys;
            if (unknownKeys === "passthrough") {
                for (const key of extraKeys) {
                    pairs.push({
                        key: { status: "valid", value: key },
                        value: { status: "valid", value: ctx.data[key] },
                    });
                }
            }
            else if (unknownKeys === "strict") {
                if (extraKeys.length > 0) {
                    addIssueToContext$2(ctx, {
                        code: ZodIssueCode$2.unrecognized_keys,
                        keys: extraKeys,
                    });
                    status.dirty();
                }
            }
            else if (unknownKeys === "strip") ;
            else {
                throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
            }
        }
        else {
            // run catchall validation
            const catchall = this._def.catchall;
            for (const key of extraKeys) {
                const value = ctx.data[key];
                pairs.push({
                    key: { status: "valid", value: key },
                    value: catchall._parse(new ParseInputLazyPath$2(ctx, value, ctx.path, key) //, ctx.child(key), value, getParsedType(value)
                    ),
                    alwaysSet: key in ctx.data,
                });
            }
        }
        if (ctx.common.async) {
            return Promise.resolve()
                .then(async () => {
                const syncPairs = [];
                for (const pair of pairs) {
                    const key = await pair.key;
                    const value = await pair.value;
                    syncPairs.push({
                        key,
                        value,
                        alwaysSet: pair.alwaysSet,
                    });
                }
                return syncPairs;
            })
                .then((syncPairs) => {
                return ParseStatus$2.mergeObjectSync(status, syncPairs);
            });
        }
        else {
            return ParseStatus$2.mergeObjectSync(status, pairs);
        }
    }
    get shape() {
        return this._def.shape();
    }
    strict(message) {
        errorUtil$2.errToObj;
        return new ZodObject({
            ...this._def,
            unknownKeys: "strict",
            ...(message !== undefined
                ? {
                    errorMap: (issue, ctx) => {
                        const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
                        if (issue.code === "unrecognized_keys")
                            return {
                                message: errorUtil$2.errToObj(message).message ?? defaultError,
                            };
                        return {
                            message: defaultError,
                        };
                    },
                }
                : {}),
        });
    }
    strip() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "strip",
        });
    }
    passthrough() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "passthrough",
        });
    }
    // const AugmentFactory =
    //   <Def extends ZodObjectDef>(def: Def) =>
    //   <Augmentation extends ZodRawShape>(
    //     augmentation: Augmentation
    //   ): ZodObject<
    //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
    //     Def["unknownKeys"],
    //     Def["catchall"]
    //   > => {
    //     return new ZodObject({
    //       ...def,
    //       shape: () => ({
    //         ...def.shape(),
    //         ...augmentation,
    //       }),
    //     }) as any;
    //   };
    extend(augmentation) {
        return new ZodObject({
            ...this._def,
            shape: () => ({
                ...this._def.shape(),
                ...augmentation,
            }),
        });
    }
    /**
     * Prior to zod@1.0.12 there was a bug in the
     * inferred type of merged objects. Please
     * upgrade if you are experiencing issues.
     */
    merge(merging) {
        const merged = new ZodObject({
            unknownKeys: merging._def.unknownKeys,
            catchall: merging._def.catchall,
            shape: () => ({
                ...this._def.shape(),
                ...merging._def.shape(),
            }),
            typeName: ZodFirstPartyTypeKind$2.ZodObject,
        });
        return merged;
    }
    // merge<
    //   Incoming extends AnyZodObject,
    //   Augmentation extends Incoming["shape"],
    //   NewOutput extends {
    //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
    //       ? Augmentation[k]["_output"]
    //       : k extends keyof Output
    //       ? Output[k]
    //       : never;
    //   },
    //   NewInput extends {
    //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
    //       ? Augmentation[k]["_input"]
    //       : k extends keyof Input
    //       ? Input[k]
    //       : never;
    //   }
    // >(
    //   merging: Incoming
    // ): ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"],
    //   NewOutput,
    //   NewInput
    // > {
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    setKey(key, schema) {
        return this.augment({ [key]: schema });
    }
    // merge<Incoming extends AnyZodObject>(
    //   merging: Incoming
    // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
    // ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"]
    // > {
    //   // const mergedShape = objectUtil.mergeShapes(
    //   //   this._def.shape(),
    //   //   merging._def.shape()
    //   // );
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    catchall(index) {
        return new ZodObject({
            ...this._def,
            catchall: index,
        });
    }
    pick(mask) {
        const shape = {};
        for (const key of util$2.objectKeys(mask)) {
            if (mask[key] && this.shape[key]) {
                shape[key] = this.shape[key];
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => shape,
        });
    }
    omit(mask) {
        const shape = {};
        for (const key of util$2.objectKeys(this.shape)) {
            if (!mask[key]) {
                shape[key] = this.shape[key];
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => shape,
        });
    }
    /**
     * @deprecated
     */
    deepPartial() {
        return deepPartialify$2(this);
    }
    partial(mask) {
        const newShape = {};
        for (const key of util$2.objectKeys(this.shape)) {
            const fieldSchema = this.shape[key];
            if (mask && !mask[key]) {
                newShape[key] = fieldSchema;
            }
            else {
                newShape[key] = fieldSchema.optional();
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => newShape,
        });
    }
    required(mask) {
        const newShape = {};
        for (const key of util$2.objectKeys(this.shape)) {
            if (mask && !mask[key]) {
                newShape[key] = this.shape[key];
            }
            else {
                const fieldSchema = this.shape[key];
                let newField = fieldSchema;
                while (newField instanceof ZodOptional$2) {
                    newField = newField._def.innerType;
                }
                newShape[key] = newField;
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => newShape,
        });
    }
    keyof() {
        return createZodEnum$2(util$2.objectKeys(this.shape));
    }
};
ZodObject$2.create = (shape, params) => {
    return new ZodObject$2({
        shape: () => shape,
        unknownKeys: "strip",
        catchall: ZodNever$2.create(),
        typeName: ZodFirstPartyTypeKind$2.ZodObject,
        ...processCreateParams$2(params),
    });
};
ZodObject$2.strictCreate = (shape, params) => {
    return new ZodObject$2({
        shape: () => shape,
        unknownKeys: "strict",
        catchall: ZodNever$2.create(),
        typeName: ZodFirstPartyTypeKind$2.ZodObject,
        ...processCreateParams$2(params),
    });
};
ZodObject$2.lazycreate = (shape, params) => {
    return new ZodObject$2({
        shape,
        unknownKeys: "strip",
        catchall: ZodNever$2.create(),
        typeName: ZodFirstPartyTypeKind$2.ZodObject,
        ...processCreateParams$2(params),
    });
};
let ZodUnion$2 = class ZodUnion extends ZodType$2 {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const options = this._def.options;
        function handleResults(results) {
            // return first issue-free validation if it exists
            for (const result of results) {
                if (result.result.status === "valid") {
                    return result.result;
                }
            }
            for (const result of results) {
                if (result.result.status === "dirty") {
                    // add issues from dirty option
                    ctx.common.issues.push(...result.ctx.common.issues);
                    return result.result;
                }
            }
            // return invalid
            const unionErrors = results.map((result) => new ZodError$2(result.ctx.common.issues));
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_union,
                unionErrors,
            });
            return INVALID$2;
        }
        if (ctx.common.async) {
            return Promise.all(options.map(async (option) => {
                const childCtx = {
                    ...ctx,
                    common: {
                        ...ctx.common,
                        issues: [],
                    },
                    parent: null,
                };
                return {
                    result: await option._parseAsync({
                        data: ctx.data,
                        path: ctx.path,
                        parent: childCtx,
                    }),
                    ctx: childCtx,
                };
            })).then(handleResults);
        }
        else {
            let dirty = undefined;
            const issues = [];
            for (const option of options) {
                const childCtx = {
                    ...ctx,
                    common: {
                        ...ctx.common,
                        issues: [],
                    },
                    parent: null,
                };
                const result = option._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: childCtx,
                });
                if (result.status === "valid") {
                    return result;
                }
                else if (result.status === "dirty" && !dirty) {
                    dirty = { result, ctx: childCtx };
                }
                if (childCtx.common.issues.length) {
                    issues.push(childCtx.common.issues);
                }
            }
            if (dirty) {
                ctx.common.issues.push(...dirty.ctx.common.issues);
                return dirty.result;
            }
            const unionErrors = issues.map((issues) => new ZodError$2(issues));
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_union,
                unionErrors,
            });
            return INVALID$2;
        }
    }
    get options() {
        return this._def.options;
    }
};
ZodUnion$2.create = (types, params) => {
    return new ZodUnion$2({
        options: types,
        typeName: ZodFirstPartyTypeKind$2.ZodUnion,
        ...processCreateParams$2(params),
    });
};
function mergeValues$2(a, b) {
    const aType = getParsedType$2(a);
    const bType = getParsedType$2(b);
    if (a === b) {
        return { valid: true, data: a };
    }
    else if (aType === ZodParsedType$2.object && bType === ZodParsedType$2.object) {
        const bKeys = util$2.objectKeys(b);
        const sharedKeys = util$2.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
        const newObj = { ...a, ...b };
        for (const key of sharedKeys) {
            const sharedValue = mergeValues$2(a[key], b[key]);
            if (!sharedValue.valid) {
                return { valid: false };
            }
            newObj[key] = sharedValue.data;
        }
        return { valid: true, data: newObj };
    }
    else if (aType === ZodParsedType$2.array && bType === ZodParsedType$2.array) {
        if (a.length !== b.length) {
            return { valid: false };
        }
        const newArray = [];
        for (let index = 0; index < a.length; index++) {
            const itemA = a[index];
            const itemB = b[index];
            const sharedValue = mergeValues$2(itemA, itemB);
            if (!sharedValue.valid) {
                return { valid: false };
            }
            newArray.push(sharedValue.data);
        }
        return { valid: true, data: newArray };
    }
    else if (aType === ZodParsedType$2.date && bType === ZodParsedType$2.date && +a === +b) {
        return { valid: true, data: a };
    }
    else {
        return { valid: false };
    }
}
let ZodIntersection$2 = class ZodIntersection extends ZodType$2 {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const handleParsed = (parsedLeft, parsedRight) => {
            if (isAborted$2(parsedLeft) || isAborted$2(parsedRight)) {
                return INVALID$2;
            }
            const merged = mergeValues$2(parsedLeft.value, parsedRight.value);
            if (!merged.valid) {
                addIssueToContext$2(ctx, {
                    code: ZodIssueCode$2.invalid_intersection_types,
                });
                return INVALID$2;
            }
            if (isDirty$2(parsedLeft) || isDirty$2(parsedRight)) {
                status.dirty();
            }
            return { status: status.value, value: merged.data };
        };
        if (ctx.common.async) {
            return Promise.all([
                this._def.left._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                }),
                this._def.right._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                }),
            ]).then(([left, right]) => handleParsed(left, right));
        }
        else {
            return handleParsed(this._def.left._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            }), this._def.right._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            }));
        }
    }
};
ZodIntersection$2.create = (left, right, params) => {
    return new ZodIntersection$2({
        left: left,
        right: right,
        typeName: ZodFirstPartyTypeKind$2.ZodIntersection,
        ...processCreateParams$2(params),
    });
};
// type ZodTupleItems = [ZodTypeAny, ...ZodTypeAny[]];
let ZodTuple$2 = class ZodTuple extends ZodType$2 {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType$2.array) {
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_type,
                expected: ZodParsedType$2.array,
                received: ctx.parsedType,
            });
            return INVALID$2;
        }
        if (ctx.data.length < this._def.items.length) {
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.too_small,
                minimum: this._def.items.length,
                inclusive: true,
                exact: false,
                type: "array",
            });
            return INVALID$2;
        }
        const rest = this._def.rest;
        if (!rest && ctx.data.length > this._def.items.length) {
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.too_big,
                maximum: this._def.items.length,
                inclusive: true,
                exact: false,
                type: "array",
            });
            status.dirty();
        }
        const items = [...ctx.data]
            .map((item, itemIndex) => {
            const schema = this._def.items[itemIndex] || this._def.rest;
            if (!schema)
                return null;
            return schema._parse(new ParseInputLazyPath$2(ctx, item, ctx.path, itemIndex));
        })
            .filter((x) => !!x); // filter nulls
        if (ctx.common.async) {
            return Promise.all(items).then((results) => {
                return ParseStatus$2.mergeArray(status, results);
            });
        }
        else {
            return ParseStatus$2.mergeArray(status, items);
        }
    }
    get items() {
        return this._def.items;
    }
    rest(rest) {
        return new ZodTuple({
            ...this._def,
            rest,
        });
    }
};
ZodTuple$2.create = (schemas, params) => {
    if (!Array.isArray(schemas)) {
        throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    }
    return new ZodTuple$2({
        items: schemas,
        typeName: ZodFirstPartyTypeKind$2.ZodTuple,
        rest: null,
        ...processCreateParams$2(params),
    });
};
let ZodMap$2 = class ZodMap extends ZodType$2 {
    get keySchema() {
        return this._def.keyType;
    }
    get valueSchema() {
        return this._def.valueType;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType$2.map) {
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_type,
                expected: ZodParsedType$2.map,
                received: ctx.parsedType,
            });
            return INVALID$2;
        }
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        const pairs = [...ctx.data.entries()].map(([key, value], index) => {
            return {
                key: keyType._parse(new ParseInputLazyPath$2(ctx, key, ctx.path, [index, "key"])),
                value: valueType._parse(new ParseInputLazyPath$2(ctx, value, ctx.path, [index, "value"])),
            };
        });
        if (ctx.common.async) {
            const finalMap = new Map();
            return Promise.resolve().then(async () => {
                for (const pair of pairs) {
                    const key = await pair.key;
                    const value = await pair.value;
                    if (key.status === "aborted" || value.status === "aborted") {
                        return INVALID$2;
                    }
                    if (key.status === "dirty" || value.status === "dirty") {
                        status.dirty();
                    }
                    finalMap.set(key.value, value.value);
                }
                return { status: status.value, value: finalMap };
            });
        }
        else {
            const finalMap = new Map();
            for (const pair of pairs) {
                const key = pair.key;
                const value = pair.value;
                if (key.status === "aborted" || value.status === "aborted") {
                    return INVALID$2;
                }
                if (key.status === "dirty" || value.status === "dirty") {
                    status.dirty();
                }
                finalMap.set(key.value, value.value);
            }
            return { status: status.value, value: finalMap };
        }
    }
};
ZodMap$2.create = (keyType, valueType, params) => {
    return new ZodMap$2({
        valueType,
        keyType,
        typeName: ZodFirstPartyTypeKind$2.ZodMap,
        ...processCreateParams$2(params),
    });
};
let ZodSet$2 = class ZodSet extends ZodType$2 {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType$2.set) {
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_type,
                expected: ZodParsedType$2.set,
                received: ctx.parsedType,
            });
            return INVALID$2;
        }
        const def = this._def;
        if (def.minSize !== null) {
            if (ctx.data.size < def.minSize.value) {
                addIssueToContext$2(ctx, {
                    code: ZodIssueCode$2.too_small,
                    minimum: def.minSize.value,
                    type: "set",
                    inclusive: true,
                    exact: false,
                    message: def.minSize.message,
                });
                status.dirty();
            }
        }
        if (def.maxSize !== null) {
            if (ctx.data.size > def.maxSize.value) {
                addIssueToContext$2(ctx, {
                    code: ZodIssueCode$2.too_big,
                    maximum: def.maxSize.value,
                    type: "set",
                    inclusive: true,
                    exact: false,
                    message: def.maxSize.message,
                });
                status.dirty();
            }
        }
        const valueType = this._def.valueType;
        function finalizeSet(elements) {
            const parsedSet = new Set();
            for (const element of elements) {
                if (element.status === "aborted")
                    return INVALID$2;
                if (element.status === "dirty")
                    status.dirty();
                parsedSet.add(element.value);
            }
            return { status: status.value, value: parsedSet };
        }
        const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath$2(ctx, item, ctx.path, i)));
        if (ctx.common.async) {
            return Promise.all(elements).then((elements) => finalizeSet(elements));
        }
        else {
            return finalizeSet(elements);
        }
    }
    min(minSize, message) {
        return new ZodSet({
            ...this._def,
            minSize: { value: minSize, message: errorUtil$2.toString(message) },
        });
    }
    max(maxSize, message) {
        return new ZodSet({
            ...this._def,
            maxSize: { value: maxSize, message: errorUtil$2.toString(message) },
        });
    }
    size(size, message) {
        return this.min(size, message).max(size, message);
    }
    nonempty(message) {
        return this.min(1, message);
    }
};
ZodSet$2.create = (valueType, params) => {
    return new ZodSet$2({
        valueType,
        minSize: null,
        maxSize: null,
        typeName: ZodFirstPartyTypeKind$2.ZodSet,
        ...processCreateParams$2(params),
    });
};
let ZodLazy$2 = class ZodLazy extends ZodType$2 {
    get schema() {
        return this._def.getter();
    }
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const lazySchema = this._def.getter();
        return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
    }
};
ZodLazy$2.create = (getter, params) => {
    return new ZodLazy$2({
        getter: getter,
        typeName: ZodFirstPartyTypeKind$2.ZodLazy,
        ...processCreateParams$2(params),
    });
};
let ZodLiteral$2 = class ZodLiteral extends ZodType$2 {
    _parse(input) {
        if (input.data !== this._def.value) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$2(ctx, {
                received: ctx.data,
                code: ZodIssueCode$2.invalid_literal,
                expected: this._def.value,
            });
            return INVALID$2;
        }
        return { status: "valid", value: input.data };
    }
    get value() {
        return this._def.value;
    }
};
ZodLiteral$2.create = (value, params) => {
    return new ZodLiteral$2({
        value: value,
        typeName: ZodFirstPartyTypeKind$2.ZodLiteral,
        ...processCreateParams$2(params),
    });
};
function createZodEnum$2(values, params) {
    return new ZodEnum$2({
        values,
        typeName: ZodFirstPartyTypeKind$2.ZodEnum,
        ...processCreateParams$2(params),
    });
}
let ZodEnum$2 = class ZodEnum extends ZodType$2 {
    _parse(input) {
        if (typeof input.data !== "string") {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext$2(ctx, {
                expected: util$2.joinValues(expectedValues),
                received: ctx.parsedType,
                code: ZodIssueCode$2.invalid_type,
            });
            return INVALID$2;
        }
        if (!this._cache) {
            this._cache = new Set(this._def.values);
        }
        if (!this._cache.has(input.data)) {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext$2(ctx, {
                received: ctx.data,
                code: ZodIssueCode$2.invalid_enum_value,
                options: expectedValues,
            });
            return INVALID$2;
        }
        return OK$2(input.data);
    }
    get options() {
        return this._def.values;
    }
    get enum() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    get Values() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    get Enum() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    extract(values, newDef = this._def) {
        return ZodEnum.create(values, {
            ...this._def,
            ...newDef,
        });
    }
    exclude(values, newDef = this._def) {
        return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
            ...this._def,
            ...newDef,
        });
    }
};
ZodEnum$2.create = createZodEnum$2;
let ZodNativeEnum$2 = class ZodNativeEnum extends ZodType$2 {
    _parse(input) {
        const nativeEnumValues = util$2.getValidEnumValues(this._def.values);
        const ctx = this._getOrReturnCtx(input);
        if (ctx.parsedType !== ZodParsedType$2.string && ctx.parsedType !== ZodParsedType$2.number) {
            const expectedValues = util$2.objectValues(nativeEnumValues);
            addIssueToContext$2(ctx, {
                expected: util$2.joinValues(expectedValues),
                received: ctx.parsedType,
                code: ZodIssueCode$2.invalid_type,
            });
            return INVALID$2;
        }
        if (!this._cache) {
            this._cache = new Set(util$2.getValidEnumValues(this._def.values));
        }
        if (!this._cache.has(input.data)) {
            const expectedValues = util$2.objectValues(nativeEnumValues);
            addIssueToContext$2(ctx, {
                received: ctx.data,
                code: ZodIssueCode$2.invalid_enum_value,
                options: expectedValues,
            });
            return INVALID$2;
        }
        return OK$2(input.data);
    }
    get enum() {
        return this._def.values;
    }
};
ZodNativeEnum$2.create = (values, params) => {
    return new ZodNativeEnum$2({
        values: values,
        typeName: ZodFirstPartyTypeKind$2.ZodNativeEnum,
        ...processCreateParams$2(params),
    });
};
let ZodPromise$2 = class ZodPromise extends ZodType$2 {
    unwrap() {
        return this._def.type;
    }
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType$2.promise && ctx.common.async === false) {
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_type,
                expected: ZodParsedType$2.promise,
                received: ctx.parsedType,
            });
            return INVALID$2;
        }
        const promisified = ctx.parsedType === ZodParsedType$2.promise ? ctx.data : Promise.resolve(ctx.data);
        return OK$2(promisified.then((data) => {
            return this._def.type.parseAsync(data, {
                path: ctx.path,
                errorMap: ctx.common.contextualErrorMap,
            });
        }));
    }
};
ZodPromise$2.create = (schema, params) => {
    return new ZodPromise$2({
        type: schema,
        typeName: ZodFirstPartyTypeKind$2.ZodPromise,
        ...processCreateParams$2(params),
    });
};
let ZodEffects$2 = class ZodEffects extends ZodType$2 {
    innerType() {
        return this._def.schema;
    }
    sourceType() {
        return this._def.schema._def.typeName === ZodFirstPartyTypeKind$2.ZodEffects
            ? this._def.schema.sourceType()
            : this._def.schema;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const effect = this._def.effect || null;
        const checkCtx = {
            addIssue: (arg) => {
                addIssueToContext$2(ctx, arg);
                if (arg.fatal) {
                    status.abort();
                }
                else {
                    status.dirty();
                }
            },
            get path() {
                return ctx.path;
            },
        };
        checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
        if (effect.type === "preprocess") {
            const processed = effect.transform(ctx.data, checkCtx);
            if (ctx.common.async) {
                return Promise.resolve(processed).then(async (processed) => {
                    if (status.value === "aborted")
                        return INVALID$2;
                    const result = await this._def.schema._parseAsync({
                        data: processed,
                        path: ctx.path,
                        parent: ctx,
                    });
                    if (result.status === "aborted")
                        return INVALID$2;
                    if (result.status === "dirty")
                        return DIRTY$2(result.value);
                    if (status.value === "dirty")
                        return DIRTY$2(result.value);
                    return result;
                });
            }
            else {
                if (status.value === "aborted")
                    return INVALID$2;
                const result = this._def.schema._parseSync({
                    data: processed,
                    path: ctx.path,
                    parent: ctx,
                });
                if (result.status === "aborted")
                    return INVALID$2;
                if (result.status === "dirty")
                    return DIRTY$2(result.value);
                if (status.value === "dirty")
                    return DIRTY$2(result.value);
                return result;
            }
        }
        if (effect.type === "refinement") {
            const executeRefinement = (acc) => {
                const result = effect.refinement(acc, checkCtx);
                if (ctx.common.async) {
                    return Promise.resolve(result);
                }
                if (result instanceof Promise) {
                    throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
                }
                return acc;
            };
            if (ctx.common.async === false) {
                const inner = this._def.schema._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (inner.status === "aborted")
                    return INVALID$2;
                if (inner.status === "dirty")
                    status.dirty();
                // return value is ignored
                executeRefinement(inner.value);
                return { status: status.value, value: inner.value };
            }
            else {
                return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
                    if (inner.status === "aborted")
                        return INVALID$2;
                    if (inner.status === "dirty")
                        status.dirty();
                    return executeRefinement(inner.value).then(() => {
                        return { status: status.value, value: inner.value };
                    });
                });
            }
        }
        if (effect.type === "transform") {
            if (ctx.common.async === false) {
                const base = this._def.schema._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (!isValid$2(base))
                    return INVALID$2;
                const result = effect.transform(base.value, checkCtx);
                if (result instanceof Promise) {
                    throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
                }
                return { status: status.value, value: result };
            }
            else {
                return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
                    if (!isValid$2(base))
                        return INVALID$2;
                    return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
                        status: status.value,
                        value: result,
                    }));
                });
            }
        }
        util$2.assertNever(effect);
    }
};
ZodEffects$2.create = (schema, effect, params) => {
    return new ZodEffects$2({
        schema,
        typeName: ZodFirstPartyTypeKind$2.ZodEffects,
        effect,
        ...processCreateParams$2(params),
    });
};
ZodEffects$2.createWithPreprocess = (preprocess, schema, params) => {
    return new ZodEffects$2({
        schema,
        effect: { type: "preprocess", transform: preprocess },
        typeName: ZodFirstPartyTypeKind$2.ZodEffects,
        ...processCreateParams$2(params),
    });
};
let ZodOptional$2 = class ZodOptional extends ZodType$2 {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType$2.undefined) {
            return OK$2(undefined);
        }
        return this._def.innerType._parse(input);
    }
    unwrap() {
        return this._def.innerType;
    }
};
ZodOptional$2.create = (type, params) => {
    return new ZodOptional$2({
        innerType: type,
        typeName: ZodFirstPartyTypeKind$2.ZodOptional,
        ...processCreateParams$2(params),
    });
};
let ZodNullable$2 = class ZodNullable extends ZodType$2 {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType$2.null) {
            return OK$2(null);
        }
        return this._def.innerType._parse(input);
    }
    unwrap() {
        return this._def.innerType;
    }
};
ZodNullable$2.create = (type, params) => {
    return new ZodNullable$2({
        innerType: type,
        typeName: ZodFirstPartyTypeKind$2.ZodNullable,
        ...processCreateParams$2(params),
    });
};
let ZodDefault$2 = class ZodDefault extends ZodType$2 {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        let data = ctx.data;
        if (ctx.parsedType === ZodParsedType$2.undefined) {
            data = this._def.defaultValue();
        }
        return this._def.innerType._parse({
            data,
            path: ctx.path,
            parent: ctx,
        });
    }
    removeDefault() {
        return this._def.innerType;
    }
};
ZodDefault$2.create = (type, params) => {
    return new ZodDefault$2({
        innerType: type,
        typeName: ZodFirstPartyTypeKind$2.ZodDefault,
        defaultValue: typeof params.default === "function" ? params.default : () => params.default,
        ...processCreateParams$2(params),
    });
};
let ZodCatch$2 = class ZodCatch extends ZodType$2 {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        // newCtx is used to not collect issues from inner types in ctx
        const newCtx = {
            ...ctx,
            common: {
                ...ctx.common,
                issues: [],
            },
        };
        const result = this._def.innerType._parse({
            data: newCtx.data,
            path: newCtx.path,
            parent: {
                ...newCtx,
            },
        });
        if (isAsync$2(result)) {
            return result.then((result) => {
                return {
                    status: "valid",
                    value: result.status === "valid"
                        ? result.value
                        : this._def.catchValue({
                            get error() {
                                return new ZodError$2(newCtx.common.issues);
                            },
                            input: newCtx.data,
                        }),
                };
            });
        }
        else {
            return {
                status: "valid",
                value: result.status === "valid"
                    ? result.value
                    : this._def.catchValue({
                        get error() {
                            return new ZodError$2(newCtx.common.issues);
                        },
                        input: newCtx.data,
                    }),
            };
        }
    }
    removeCatch() {
        return this._def.innerType;
    }
};
ZodCatch$2.create = (type, params) => {
    return new ZodCatch$2({
        innerType: type,
        typeName: ZodFirstPartyTypeKind$2.ZodCatch,
        catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
        ...processCreateParams$2(params),
    });
};
let ZodNaN$2 = class ZodNaN extends ZodType$2 {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$2.nan) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$2(ctx, {
                code: ZodIssueCode$2.invalid_type,
                expected: ZodParsedType$2.nan,
                received: ctx.parsedType,
            });
            return INVALID$2;
        }
        return { status: "valid", value: input.data };
    }
};
ZodNaN$2.create = (params) => {
    return new ZodNaN$2({
        typeName: ZodFirstPartyTypeKind$2.ZodNaN,
        ...processCreateParams$2(params),
    });
};
let ZodBranded$2 = class ZodBranded extends ZodType$2 {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const data = ctx.data;
        return this._def.type._parse({
            data,
            path: ctx.path,
            parent: ctx,
        });
    }
    unwrap() {
        return this._def.type;
    }
};
let ZodPipeline$2 = class ZodPipeline extends ZodType$2 {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.common.async) {
            const handleAsync = async () => {
                const inResult = await this._def.in._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (inResult.status === "aborted")
                    return INVALID$2;
                if (inResult.status === "dirty") {
                    status.dirty();
                    return DIRTY$2(inResult.value);
                }
                else {
                    return this._def.out._parseAsync({
                        data: inResult.value,
                        path: ctx.path,
                        parent: ctx,
                    });
                }
            };
            return handleAsync();
        }
        else {
            const inResult = this._def.in._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
            if (inResult.status === "aborted")
                return INVALID$2;
            if (inResult.status === "dirty") {
                status.dirty();
                return {
                    status: "dirty",
                    value: inResult.value,
                };
            }
            else {
                return this._def.out._parseSync({
                    data: inResult.value,
                    path: ctx.path,
                    parent: ctx,
                });
            }
        }
    }
    static create(a, b) {
        return new ZodPipeline({
            in: a,
            out: b,
            typeName: ZodFirstPartyTypeKind$2.ZodPipeline,
        });
    }
};
let ZodReadonly$2 = class ZodReadonly extends ZodType$2 {
    _parse(input) {
        const result = this._def.innerType._parse(input);
        const freeze = (data) => {
            if (isValid$2(data)) {
                data.value = Object.freeze(data.value);
            }
            return data;
        };
        return isAsync$2(result) ? result.then((data) => freeze(data)) : freeze(result);
    }
    unwrap() {
        return this._def.innerType;
    }
};
ZodReadonly$2.create = (type, params) => {
    return new ZodReadonly$2({
        innerType: type,
        typeName: ZodFirstPartyTypeKind$2.ZodReadonly,
        ...processCreateParams$2(params),
    });
};
({
    object: ZodObject$2.lazycreate,
});
var ZodFirstPartyTypeKind$2;
(function (ZodFirstPartyTypeKind) {
    ZodFirstPartyTypeKind["ZodString"] = "ZodString";
    ZodFirstPartyTypeKind["ZodNumber"] = "ZodNumber";
    ZodFirstPartyTypeKind["ZodNaN"] = "ZodNaN";
    ZodFirstPartyTypeKind["ZodBigInt"] = "ZodBigInt";
    ZodFirstPartyTypeKind["ZodBoolean"] = "ZodBoolean";
    ZodFirstPartyTypeKind["ZodDate"] = "ZodDate";
    ZodFirstPartyTypeKind["ZodSymbol"] = "ZodSymbol";
    ZodFirstPartyTypeKind["ZodUndefined"] = "ZodUndefined";
    ZodFirstPartyTypeKind["ZodNull"] = "ZodNull";
    ZodFirstPartyTypeKind["ZodAny"] = "ZodAny";
    ZodFirstPartyTypeKind["ZodUnknown"] = "ZodUnknown";
    ZodFirstPartyTypeKind["ZodNever"] = "ZodNever";
    ZodFirstPartyTypeKind["ZodVoid"] = "ZodVoid";
    ZodFirstPartyTypeKind["ZodArray"] = "ZodArray";
    ZodFirstPartyTypeKind["ZodObject"] = "ZodObject";
    ZodFirstPartyTypeKind["ZodUnion"] = "ZodUnion";
    ZodFirstPartyTypeKind["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
    ZodFirstPartyTypeKind["ZodIntersection"] = "ZodIntersection";
    ZodFirstPartyTypeKind["ZodTuple"] = "ZodTuple";
    ZodFirstPartyTypeKind["ZodRecord"] = "ZodRecord";
    ZodFirstPartyTypeKind["ZodMap"] = "ZodMap";
    ZodFirstPartyTypeKind["ZodSet"] = "ZodSet";
    ZodFirstPartyTypeKind["ZodFunction"] = "ZodFunction";
    ZodFirstPartyTypeKind["ZodLazy"] = "ZodLazy";
    ZodFirstPartyTypeKind["ZodLiteral"] = "ZodLiteral";
    ZodFirstPartyTypeKind["ZodEnum"] = "ZodEnum";
    ZodFirstPartyTypeKind["ZodEffects"] = "ZodEffects";
    ZodFirstPartyTypeKind["ZodNativeEnum"] = "ZodNativeEnum";
    ZodFirstPartyTypeKind["ZodOptional"] = "ZodOptional";
    ZodFirstPartyTypeKind["ZodNullable"] = "ZodNullable";
    ZodFirstPartyTypeKind["ZodDefault"] = "ZodDefault";
    ZodFirstPartyTypeKind["ZodCatch"] = "ZodCatch";
    ZodFirstPartyTypeKind["ZodPromise"] = "ZodPromise";
    ZodFirstPartyTypeKind["ZodBranded"] = "ZodBranded";
    ZodFirstPartyTypeKind["ZodPipeline"] = "ZodPipeline";
    ZodFirstPartyTypeKind["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind$2 || (ZodFirstPartyTypeKind$2 = {}));
ZodNever$2.create;
ZodArray$2.create;
ZodObject$2.create;
ZodObject$2.strictCreate;
ZodUnion$2.create;
ZodIntersection$2.create;
ZodTuple$2.create;
ZodEnum$2.create;
const nativeEnumType$1 = ZodNativeEnum$2.create;
ZodPromise$2.create;
ZodOptional$2.create;
ZodNullable$2.create;

var TrustTier;
(function (TrustTier) {
    TrustTier["OfficialDocs"] = "official_docs";
    TrustTier["Repo"] = "repo";
    TrustTier["Community"] = "community";
    TrustTier["External"] = "external";
})(TrustTier || (TrustTier = {}));
const trustTierSchema = nativeEnumType$1(TrustTier);

function normalizeText$1(value) {
    const normalized = value === null || value === void 0 ? void 0 : value.trim();
    return normalized ? normalized : undefined;
}
function normalizeList(values) {
    return Array.from(new Set((values !== null && values !== void 0 ? values : []).map((value) => value.trim()).filter(Boolean)));
}
function defaultConfidence(request) {
    if (request.mode === 'grounded') {
        return 0.86;
    }
    return request.safety.classification === 'low_confidence' ? 0.36 : 0.18;
}
function clampConfidence(value, mode) {
    const bounded = Math.max(0, Math.min(1, value));
    return mode === 'fallback' ? Math.min(bounded, 0.49) : bounded;
}
function toConfidenceLabel(confidence) {
    if (confidence >= 0.85) {
        return 'high';
    }
    if (confidence >= 0.6) {
        return 'medium';
    }
    if (confidence > 0.25) {
        return 'low';
    }
    return 'insufficient';
}
function buildDefaultShortAnswer(request) {
    if (request.mode === 'grounded') {
        return 'Based on the supplied Bruno support evidence, this is the most supported answer.';
    }
    if (request.safety.classification === 'security_sensitive') {
        return `This looks like a potential Bruno security issue. Please email ${OFFICIAL_BRUNO_DESTINATIONS.securityEmailAddress} instead of posting it publicly.`;
    }
    return request.safety.classification === 'insufficient_evidence'
        ? 'I do not have enough Bruno support evidence to answer that yet.'
        : 'I do not have enough reliable Bruno support evidence to answer that confidently.';
}
function buildDefaultUncertainty(request) {
    if (request.mode === 'grounded') {
        return undefined;
    }
    if (request.fallbackMessage) {
        return request.fallbackMessage;
    }
    if (request.escalation.shouldEscalate) {
        return request.escalation.message;
    }
    return 'The available evidence is too limited or weak to support a confident answer.';
}
function formatContent(shortAnswer, uncertainty, steps, commands) {
    const sections = [shortAnswer];
    if (uncertainty) {
        sections.push(`Uncertainty: ${uncertainty}`);
    }
    if (steps.length > 0) {
        sections.push(`Steps:\n${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`);
    }
    if (commands.length > 0) {
        sections.push(`Commands:\n${commands.map((command) => `- ${command}`).join('\n')}`);
    }
    return sections.join('\n\n');
}
function selectEvidence(request, draft) {
    var _a;
    if (request.evidence.length === 0) {
        return [];
    }
    const uniqueRequestedIndexes = Array.from(new Set(((_a = draft.citedEvidenceIndexes) !== null && _a !== void 0 ? _a : []).filter((value) => Number.isInteger(value) && value > 0)));
    if (uniqueRequestedIndexes.length === 0) {
        return request.evidence;
    }
    const evidenceByIndex = new Map(request.evidence.map((item) => [item.index, item]));
    return uniqueRequestedIndexes
        .map((index) => evidenceByIndex.get(index))
        .filter((item) => item !== undefined);
}
function toSharedTrustTier(trustTier) {
    switch (trustTier) {
        case 'official_docs':
            return TrustTier.OfficialDocs;
        case 'repo':
            return TrustTier.Repo;
        case 'community':
            return TrustTier.Community;
        case 'external':
        default:
            return TrustTier.External;
    }
}
function toSupportCitation(item) {
    var _a;
    const base = {
        documentId: item.documentId,
        sourceType: item.sourceType,
        title: item.title,
        headingAnchor: item.headingAnchor,
        trustTier: toSharedTrustTier(item.trustTier),
        retrievalScore: item.retrievalScore,
        supportCount: item.supportCount
    };
    if (item.url) {
        const citation = {
            ...base,
            url: item.url
        };
        return citation;
    }
    const citation = {
        ...base,
        sourcePath: (_a = item.sourcePath) !== null && _a !== void 0 ? _a : item.documentId
    };
    return citation;
}
function assembleSupportAnswer(input) {
    var _a, _b, _c, _d, _e;
    const generatedAt = (_a = input.generatedAt) !== null && _a !== void 0 ? _a : new Date();
    const shortAnswer = (_b = normalizeText$1(input.draft.shortAnswer)) !== null && _b !== void 0 ? _b : buildDefaultShortAnswer(input.request);
    const steps = normalizeList(input.draft.steps);
    const commands = normalizeList(input.draft.commands);
    const uncertainty = (_c = normalizeText$1(input.draft.uncertainty)) !== null && _c !== void 0 ? _c : buildDefaultUncertainty(input.request);
    const confidence = clampConfidence((_d = input.draft.confidence) !== null && _d !== void 0 ? _d : defaultConfidence(input.request), input.request.mode);
    const citations = selectEvidence(input.request, input.draft).map(toSupportCitation);
    return {
        id: (_e = input.answerId) !== null && _e !== void 0 ? _e : `support-answer-${generatedAt.toISOString()}`,
        query: input.request.query,
        shortAnswer,
        content: formatContent(shortAnswer, uncertainty, steps, commands),
        steps,
        commands,
        citations,
        confidence,
        confidenceLabel: toConfidenceLabel(confidence),
        generatedAt,
        modelVersion: input.modelVersion,
        policyVersion: input.request.policyVersion,
        mode: input.request.mode,
        safety: input.request.safety,
        escalation: input.request.escalation,
        uncertainty,
        fallbackReason: input.request.mode === 'fallback' ? input.request.safety.fallbackReason : undefined
    };
}
function toSharedCitation(citation) {
    if (!('url' in citation) || typeof citation.url !== 'string') {
        return null;
    }
    return {
        sourceType: citation.sourceType,
        url: citation.url,
        title: citation.title,
        headingAnchor: citation.headingAnchor,
        trustTier: citation.trustTier,
        retrievalScore: citation.retrievalScore
    };
}
function toSharedAnswer(answer) {
    const citations = answer.citations
        .map((citation) => toSharedCitation(citation))
        .filter((citation) => citation !== null);
    return {
        id: answer.id,
        query: answer.query,
        content: answer.content,
        citations,
        confidence: answer.confidence,
        generatedAt: answer.generatedAt,
        modelVersion: answer.modelVersion
    };
}

var util$1;
(function (util) {
    util.assertEqual = (val) => val;
    function assertIs(_arg) { }
    util.assertIs = assertIs;
    function assertNever(_x) {
        throw new Error();
    }
    util.assertNever = assertNever;
    util.arrayToEnum = (items) => {
        const obj = {};
        for (const item of items) {
            obj[item] = item;
        }
        return obj;
    };
    util.getValidEnumValues = (obj) => {
        const validKeys = util.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
        const filtered = {};
        for (const k of validKeys) {
            filtered[k] = obj[k];
        }
        return util.objectValues(filtered);
    };
    util.objectValues = (obj) => {
        return util.objectKeys(obj).map(function (e) {
            return obj[e];
        });
    };
    util.objectKeys = typeof Object.keys === "function" // eslint-disable-line ban/ban
        ? (obj) => Object.keys(obj) // eslint-disable-line ban/ban
        : (object) => {
            const keys = [];
            for (const key in object) {
                if (Object.prototype.hasOwnProperty.call(object, key)) {
                    keys.push(key);
                }
            }
            return keys;
        };
    util.find = (arr, checker) => {
        for (const item of arr) {
            if (checker(item))
                return item;
        }
        return undefined;
    };
    util.isInteger = typeof Number.isInteger === "function"
        ? (val) => Number.isInteger(val) // eslint-disable-line ban/ban
        : (val) => typeof val === "number" && isFinite(val) && Math.floor(val) === val;
    function joinValues(array, separator = " | ") {
        return array
            .map((val) => (typeof val === "string" ? `'${val}'` : val))
            .join(separator);
    }
    util.joinValues = joinValues;
    util.jsonStringifyReplacer = (_, value) => {
        if (typeof value === "bigint") {
            return value.toString();
        }
        return value;
    };
})(util$1 || (util$1 = {}));
var objectUtil$1;
(function (objectUtil) {
    objectUtil.mergeShapes = (first, second) => {
        return {
            ...first,
            ...second, // second overwrites first
        };
    };
})(objectUtil$1 || (objectUtil$1 = {}));
const ZodParsedType$1 = util$1.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set",
]);
const getParsedType$1 = (data) => {
    const t = typeof data;
    switch (t) {
        case "undefined":
            return ZodParsedType$1.undefined;
        case "string":
            return ZodParsedType$1.string;
        case "number":
            return isNaN(data) ? ZodParsedType$1.nan : ZodParsedType$1.number;
        case "boolean":
            return ZodParsedType$1.boolean;
        case "function":
            return ZodParsedType$1.function;
        case "bigint":
            return ZodParsedType$1.bigint;
        case "symbol":
            return ZodParsedType$1.symbol;
        case "object":
            if (Array.isArray(data)) {
                return ZodParsedType$1.array;
            }
            if (data === null) {
                return ZodParsedType$1.null;
            }
            if (data.then &&
                typeof data.then === "function" &&
                data.catch &&
                typeof data.catch === "function") {
                return ZodParsedType$1.promise;
            }
            if (typeof Map !== "undefined" && data instanceof Map) {
                return ZodParsedType$1.map;
            }
            if (typeof Set !== "undefined" && data instanceof Set) {
                return ZodParsedType$1.set;
            }
            if (typeof Date !== "undefined" && data instanceof Date) {
                return ZodParsedType$1.date;
            }
            return ZodParsedType$1.object;
        default:
            return ZodParsedType$1.unknown;
    }
};

const ZodIssueCode$1 = util$1.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of",
    "not_finite",
]);
const quotelessJson = (obj) => {
    const json = JSON.stringify(obj, null, 2);
    return json.replace(/"([^"]+)":/g, "$1:");
};
let ZodError$1 = class ZodError extends Error {
    get errors() {
        return this.issues;
    }
    constructor(issues) {
        super();
        this.issues = [];
        this.addIssue = (sub) => {
            this.issues = [...this.issues, sub];
        };
        this.addIssues = (subs = []) => {
            this.issues = [...this.issues, ...subs];
        };
        const actualProto = new.target.prototype;
        if (Object.setPrototypeOf) {
            // eslint-disable-next-line ban/ban
            Object.setPrototypeOf(this, actualProto);
        }
        else {
            this.__proto__ = actualProto;
        }
        this.name = "ZodError";
        this.issues = issues;
    }
    format(_mapper) {
        const mapper = _mapper ||
            function (issue) {
                return issue.message;
            };
        const fieldErrors = { _errors: [] };
        const processError = (error) => {
            for (const issue of error.issues) {
                if (issue.code === "invalid_union") {
                    issue.unionErrors.map(processError);
                }
                else if (issue.code === "invalid_return_type") {
                    processError(issue.returnTypeError);
                }
                else if (issue.code === "invalid_arguments") {
                    processError(issue.argumentsError);
                }
                else if (issue.path.length === 0) {
                    fieldErrors._errors.push(mapper(issue));
                }
                else {
                    let curr = fieldErrors;
                    let i = 0;
                    while (i < issue.path.length) {
                        const el = issue.path[i];
                        const terminal = i === issue.path.length - 1;
                        if (!terminal) {
                            curr[el] = curr[el] || { _errors: [] };
                            // if (typeof el === "string") {
                            //   curr[el] = curr[el] || { _errors: [] };
                            // } else if (typeof el === "number") {
                            //   const errorArray: any = [];
                            //   errorArray._errors = [];
                            //   curr[el] = curr[el] || errorArray;
                            // }
                        }
                        else {
                            curr[el] = curr[el] || { _errors: [] };
                            curr[el]._errors.push(mapper(issue));
                        }
                        curr = curr[el];
                        i++;
                    }
                }
            }
        };
        processError(this);
        return fieldErrors;
    }
    static assert(value) {
        if (!(value instanceof ZodError)) {
            throw new Error(`Not a ZodError: ${value}`);
        }
    }
    toString() {
        return this.message;
    }
    get message() {
        return JSON.stringify(this.issues, util$1.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
        return this.issues.length === 0;
    }
    flatten(mapper = (issue) => issue.message) {
        const fieldErrors = {};
        const formErrors = [];
        for (const sub of this.issues) {
            if (sub.path.length > 0) {
                fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
                fieldErrors[sub.path[0]].push(mapper(sub));
            }
            else {
                formErrors.push(mapper(sub));
            }
        }
        return { formErrors, fieldErrors };
    }
    get formErrors() {
        return this.flatten();
    }
};
ZodError$1.create = (issues) => {
    const error = new ZodError$1(issues);
    return error;
};

const errorMap$1 = (issue, _ctx) => {
    let message;
    switch (issue.code) {
        case ZodIssueCode$1.invalid_type:
            if (issue.received === ZodParsedType$1.undefined) {
                message = "Required";
            }
            else {
                message = `Expected ${issue.expected}, received ${issue.received}`;
            }
            break;
        case ZodIssueCode$1.invalid_literal:
            message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util$1.jsonStringifyReplacer)}`;
            break;
        case ZodIssueCode$1.unrecognized_keys:
            message = `Unrecognized key(s) in object: ${util$1.joinValues(issue.keys, ", ")}`;
            break;
        case ZodIssueCode$1.invalid_union:
            message = `Invalid input`;
            break;
        case ZodIssueCode$1.invalid_union_discriminator:
            message = `Invalid discriminator value. Expected ${util$1.joinValues(issue.options)}`;
            break;
        case ZodIssueCode$1.invalid_enum_value:
            message = `Invalid enum value. Expected ${util$1.joinValues(issue.options)}, received '${issue.received}'`;
            break;
        case ZodIssueCode$1.invalid_arguments:
            message = `Invalid function arguments`;
            break;
        case ZodIssueCode$1.invalid_return_type:
            message = `Invalid function return type`;
            break;
        case ZodIssueCode$1.invalid_date:
            message = `Invalid date`;
            break;
        case ZodIssueCode$1.invalid_string:
            if (typeof issue.validation === "object") {
                if ("includes" in issue.validation) {
                    message = `Invalid input: must include "${issue.validation.includes}"`;
                    if (typeof issue.validation.position === "number") {
                        message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
                    }
                }
                else if ("startsWith" in issue.validation) {
                    message = `Invalid input: must start with "${issue.validation.startsWith}"`;
                }
                else if ("endsWith" in issue.validation) {
                    message = `Invalid input: must end with "${issue.validation.endsWith}"`;
                }
                else {
                    util$1.assertNever(issue.validation);
                }
            }
            else if (issue.validation !== "regex") {
                message = `Invalid ${issue.validation}`;
            }
            else {
                message = "Invalid";
            }
            break;
        case ZodIssueCode$1.too_small:
            if (issue.type === "array")
                message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
            else if (issue.type === "string")
                message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
            else if (issue.type === "number")
                message = `Number must be ${issue.exact
                    ? `exactly equal to `
                    : issue.inclusive
                        ? `greater than or equal to `
                        : `greater than `}${issue.minimum}`;
            else if (issue.type === "date")
                message = `Date must be ${issue.exact
                    ? `exactly equal to `
                    : issue.inclusive
                        ? `greater than or equal to `
                        : `greater than `}${new Date(Number(issue.minimum))}`;
            else
                message = "Invalid input";
            break;
        case ZodIssueCode$1.too_big:
            if (issue.type === "array")
                message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
            else if (issue.type === "string")
                message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
            else if (issue.type === "number")
                message = `Number must be ${issue.exact
                    ? `exactly`
                    : issue.inclusive
                        ? `less than or equal to`
                        : `less than`} ${issue.maximum}`;
            else if (issue.type === "bigint")
                message = `BigInt must be ${issue.exact
                    ? `exactly`
                    : issue.inclusive
                        ? `less than or equal to`
                        : `less than`} ${issue.maximum}`;
            else if (issue.type === "date")
                message = `Date must be ${issue.exact
                    ? `exactly`
                    : issue.inclusive
                        ? `smaller than or equal to`
                        : `smaller than`} ${new Date(Number(issue.maximum))}`;
            else
                message = "Invalid input";
            break;
        case ZodIssueCode$1.custom:
            message = `Invalid input`;
            break;
        case ZodIssueCode$1.invalid_intersection_types:
            message = `Intersection results could not be merged`;
            break;
        case ZodIssueCode$1.not_multiple_of:
            message = `Number must be a multiple of ${issue.multipleOf}`;
            break;
        case ZodIssueCode$1.not_finite:
            message = "Number must be finite";
            break;
        default:
            message = _ctx.defaultError;
            util$1.assertNever(issue);
    }
    return { message };
};

let overrideErrorMap$1 = errorMap$1;
function setErrorMap(map) {
    overrideErrorMap$1 = map;
}
function getErrorMap$1() {
    return overrideErrorMap$1;
}

const makeIssue$1 = (params) => {
    const { data, path, errorMaps, issueData } = params;
    const fullPath = [...path, ...(issueData.path || [])];
    const fullIssue = {
        ...issueData,
        path: fullPath,
    };
    if (issueData.message !== undefined) {
        return {
            ...issueData,
            path: fullPath,
            message: issueData.message,
        };
    }
    let errorMessage = "";
    const maps = errorMaps
        .filter((m) => !!m)
        .slice()
        .reverse();
    for (const map of maps) {
        errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
    }
    return {
        ...issueData,
        path: fullPath,
        message: errorMessage,
    };
};
const EMPTY_PATH = [];
function addIssueToContext$1(ctx, issueData) {
    const overrideMap = getErrorMap$1();
    const issue = makeIssue$1({
        issueData: issueData,
        data: ctx.data,
        path: ctx.path,
        errorMaps: [
            ctx.common.contextualErrorMap, // contextual error map is first priority
            ctx.schemaErrorMap, // then schema-bound map if available
            overrideMap, // then global override map
            overrideMap === errorMap$1 ? undefined : errorMap$1, // then global default map
        ].filter((x) => !!x),
    });
    ctx.common.issues.push(issue);
}
let ParseStatus$1 = class ParseStatus {
    constructor() {
        this.value = "valid";
    }
    dirty() {
        if (this.value === "valid")
            this.value = "dirty";
    }
    abort() {
        if (this.value !== "aborted")
            this.value = "aborted";
    }
    static mergeArray(status, results) {
        const arrayValue = [];
        for (const s of results) {
            if (s.status === "aborted")
                return INVALID$1;
            if (s.status === "dirty")
                status.dirty();
            arrayValue.push(s.value);
        }
        return { status: status.value, value: arrayValue };
    }
    static async mergeObjectAsync(status, pairs) {
        const syncPairs = [];
        for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            syncPairs.push({
                key,
                value,
            });
        }
        return ParseStatus.mergeObjectSync(status, syncPairs);
    }
    static mergeObjectSync(status, pairs) {
        const finalObject = {};
        for (const pair of pairs) {
            const { key, value } = pair;
            if (key.status === "aborted")
                return INVALID$1;
            if (value.status === "aborted")
                return INVALID$1;
            if (key.status === "dirty")
                status.dirty();
            if (value.status === "dirty")
                status.dirty();
            if (key.value !== "__proto__" &&
                (typeof value.value !== "undefined" || pair.alwaysSet)) {
                finalObject[key.value] = value.value;
            }
        }
        return { status: status.value, value: finalObject };
    }
};
const INVALID$1 = Object.freeze({
    status: "aborted",
});
const DIRTY$1 = (value) => ({ status: "dirty", value });
const OK$1 = (value) => ({ status: "valid", value });
const isAborted$1 = (x) => x.status === "aborted";
const isDirty$1 = (x) => x.status === "dirty";
const isValid$1 = (x) => x.status === "valid";
const isAsync$1 = (x) => typeof Promise !== "undefined" && x instanceof Promise;

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}

function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

var errorUtil$1;
(function (errorUtil) {
    errorUtil.errToObj = (message) => typeof message === "string" ? { message } : message || {};
    errorUtil.toString = (message) => typeof message === "string" ? message : message === null || message === void 0 ? void 0 : message.message;
})(errorUtil$1 || (errorUtil$1 = {}));

var _ZodEnum_cache, _ZodNativeEnum_cache;
let ParseInputLazyPath$1 = class ParseInputLazyPath {
    constructor(parent, value, path, key) {
        this._cachedPath = [];
        this.parent = parent;
        this.data = value;
        this._path = path;
        this._key = key;
    }
    get path() {
        if (!this._cachedPath.length) {
            if (this._key instanceof Array) {
                this._cachedPath.push(...this._path, ...this._key);
            }
            else {
                this._cachedPath.push(...this._path, this._key);
            }
        }
        return this._cachedPath;
    }
};
const handleResult$1 = (ctx, result) => {
    if (isValid$1(result)) {
        return { success: true, data: result.value };
    }
    else {
        if (!ctx.common.issues.length) {
            throw new Error("Validation failed but no issues detected.");
        }
        return {
            success: false,
            get error() {
                if (this._error)
                    return this._error;
                const error = new ZodError$1(ctx.common.issues);
                this._error = error;
                return this._error;
            },
        };
    }
};
function processCreateParams$1(params) {
    if (!params)
        return {};
    const { errorMap, invalid_type_error, required_error, description } = params;
    if (errorMap && (invalid_type_error || required_error)) {
        throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap)
        return { errorMap: errorMap, description };
    const customMap = (iss, ctx) => {
        var _a, _b;
        const { message } = params;
        if (iss.code === "invalid_enum_value") {
            return { message: message !== null && message !== void 0 ? message : ctx.defaultError };
        }
        if (typeof ctx.data === "undefined") {
            return { message: (_a = message !== null && message !== void 0 ? message : required_error) !== null && _a !== void 0 ? _a : ctx.defaultError };
        }
        if (iss.code !== "invalid_type")
            return { message: ctx.defaultError };
        return { message: (_b = message !== null && message !== void 0 ? message : invalid_type_error) !== null && _b !== void 0 ? _b : ctx.defaultError };
    };
    return { errorMap: customMap, description };
}
let ZodType$1 = class ZodType {
    get description() {
        return this._def.description;
    }
    _getType(input) {
        return getParsedType$1(input.data);
    }
    _getOrReturnCtx(input, ctx) {
        return (ctx || {
            common: input.parent.common,
            data: input.data,
            parsedType: getParsedType$1(input.data),
            schemaErrorMap: this._def.errorMap,
            path: input.path,
            parent: input.parent,
        });
    }
    _processInputParams(input) {
        return {
            status: new ParseStatus$1(),
            ctx: {
                common: input.parent.common,
                data: input.data,
                parsedType: getParsedType$1(input.data),
                schemaErrorMap: this._def.errorMap,
                path: input.path,
                parent: input.parent,
            },
        };
    }
    _parseSync(input) {
        const result = this._parse(input);
        if (isAsync$1(result)) {
            throw new Error("Synchronous parse encountered promise.");
        }
        return result;
    }
    _parseAsync(input) {
        const result = this._parse(input);
        return Promise.resolve(result);
    }
    parse(data, params) {
        const result = this.safeParse(data, params);
        if (result.success)
            return result.data;
        throw result.error;
    }
    safeParse(data, params) {
        var _a;
        const ctx = {
            common: {
                issues: [],
                async: (_a = params === null || params === void 0 ? void 0 : params.async) !== null && _a !== void 0 ? _a : false,
                contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap,
            },
            path: (params === null || params === void 0 ? void 0 : params.path) || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType$1(data),
        };
        const result = this._parseSync({ data, path: ctx.path, parent: ctx });
        return handleResult$1(ctx, result);
    }
    "~validate"(data) {
        var _a, _b;
        const ctx = {
            common: {
                issues: [],
                async: !!this["~standard"].async,
            },
            path: [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType$1(data),
        };
        if (!this["~standard"].async) {
            try {
                const result = this._parseSync({ data, path: [], parent: ctx });
                return isValid$1(result)
                    ? {
                        value: result.value,
                    }
                    : {
                        issues: ctx.common.issues,
                    };
            }
            catch (err) {
                if ((_b = (_a = err === null || err === void 0 ? void 0 : err.message) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === null || _b === void 0 ? void 0 : _b.includes("encountered")) {
                    this["~standard"].async = true;
                }
                ctx.common = {
                    issues: [],
                    async: true,
                };
            }
        }
        return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid$1(result)
            ? {
                value: result.value,
            }
            : {
                issues: ctx.common.issues,
            });
    }
    async parseAsync(data, params) {
        const result = await this.safeParseAsync(data, params);
        if (result.success)
            return result.data;
        throw result.error;
    }
    async safeParseAsync(data, params) {
        const ctx = {
            common: {
                issues: [],
                contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap,
                async: true,
            },
            path: (params === null || params === void 0 ? void 0 : params.path) || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType$1(data),
        };
        const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
        const result = await (isAsync$1(maybeAsyncResult)
            ? maybeAsyncResult
            : Promise.resolve(maybeAsyncResult));
        return handleResult$1(ctx, result);
    }
    refine(check, message) {
        const getIssueProperties = (val) => {
            if (typeof message === "string" || typeof message === "undefined") {
                return { message };
            }
            else if (typeof message === "function") {
                return message(val);
            }
            else {
                return message;
            }
        };
        return this._refinement((val, ctx) => {
            const result = check(val);
            const setError = () => ctx.addIssue({
                code: ZodIssueCode$1.custom,
                ...getIssueProperties(val),
            });
            if (typeof Promise !== "undefined" && result instanceof Promise) {
                return result.then((data) => {
                    if (!data) {
                        setError();
                        return false;
                    }
                    else {
                        return true;
                    }
                });
            }
            if (!result) {
                setError();
                return false;
            }
            else {
                return true;
            }
        });
    }
    refinement(check, refinementData) {
        return this._refinement((val, ctx) => {
            if (!check(val)) {
                ctx.addIssue(typeof refinementData === "function"
                    ? refinementData(val, ctx)
                    : refinementData);
                return false;
            }
            else {
                return true;
            }
        });
    }
    _refinement(refinement) {
        return new ZodEffects$1({
            schema: this,
            typeName: ZodFirstPartyTypeKind$1.ZodEffects,
            effect: { type: "refinement", refinement },
        });
    }
    superRefine(refinement) {
        return this._refinement(refinement);
    }
    constructor(def) {
        /** Alias of safeParseAsync */
        this.spa = this.safeParseAsync;
        this._def = def;
        this.parse = this.parse.bind(this);
        this.safeParse = this.safeParse.bind(this);
        this.parseAsync = this.parseAsync.bind(this);
        this.safeParseAsync = this.safeParseAsync.bind(this);
        this.spa = this.spa.bind(this);
        this.refine = this.refine.bind(this);
        this.refinement = this.refinement.bind(this);
        this.superRefine = this.superRefine.bind(this);
        this.optional = this.optional.bind(this);
        this.nullable = this.nullable.bind(this);
        this.nullish = this.nullish.bind(this);
        this.array = this.array.bind(this);
        this.promise = this.promise.bind(this);
        this.or = this.or.bind(this);
        this.and = this.and.bind(this);
        this.transform = this.transform.bind(this);
        this.brand = this.brand.bind(this);
        this.default = this.default.bind(this);
        this.catch = this.catch.bind(this);
        this.describe = this.describe.bind(this);
        this.pipe = this.pipe.bind(this);
        this.readonly = this.readonly.bind(this);
        this.isNullable = this.isNullable.bind(this);
        this.isOptional = this.isOptional.bind(this);
        this["~standard"] = {
            version: 1,
            vendor: "zod",
            validate: (data) => this["~validate"](data),
        };
    }
    optional() {
        return ZodOptional$1.create(this, this._def);
    }
    nullable() {
        return ZodNullable$1.create(this, this._def);
    }
    nullish() {
        return this.nullable().optional();
    }
    array() {
        return ZodArray$1.create(this);
    }
    promise() {
        return ZodPromise$1.create(this, this._def);
    }
    or(option) {
        return ZodUnion$1.create([this, option], this._def);
    }
    and(incoming) {
        return ZodIntersection$1.create(this, incoming, this._def);
    }
    transform(transform) {
        return new ZodEffects$1({
            ...processCreateParams$1(this._def),
            schema: this,
            typeName: ZodFirstPartyTypeKind$1.ZodEffects,
            effect: { type: "transform", transform },
        });
    }
    default(def) {
        const defaultValueFunc = typeof def === "function" ? def : () => def;
        return new ZodDefault$1({
            ...processCreateParams$1(this._def),
            innerType: this,
            defaultValue: defaultValueFunc,
            typeName: ZodFirstPartyTypeKind$1.ZodDefault,
        });
    }
    brand() {
        return new ZodBranded$1({
            typeName: ZodFirstPartyTypeKind$1.ZodBranded,
            type: this,
            ...processCreateParams$1(this._def),
        });
    }
    catch(def) {
        const catchValueFunc = typeof def === "function" ? def : () => def;
        return new ZodCatch$1({
            ...processCreateParams$1(this._def),
            innerType: this,
            catchValue: catchValueFunc,
            typeName: ZodFirstPartyTypeKind$1.ZodCatch,
        });
    }
    describe(description) {
        const This = this.constructor;
        return new This({
            ...this._def,
            description,
        });
    }
    pipe(target) {
        return ZodPipeline$1.create(this, target);
    }
    readonly() {
        return ZodReadonly$1.create(this);
    }
    isOptional() {
        return this.safeParse(undefined).success;
    }
    isNullable() {
        return this.safeParse(null).success;
    }
};
const cuidRegex$1 = /^c[^\s-]{8,}$/i;
const cuid2Regex$1 = /^[0-9a-z]+$/;
const ulidRegex$1 = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
// const uuidRegex =
//   /^([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}|00000000-0000-0000-0000-000000000000)$/i;
const uuidRegex$1 = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
const nanoidRegex$1 = /^[a-z0-9_-]{21}$/i;
const jwtRegex$1 = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
const durationRegex$1 = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
// from https://stackoverflow.com/a/46181/1550155
// old version: too slow, didn't support unicode
// const emailRegex = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i;
//old email regex
// const emailRegex = /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@((?!-)([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{1,})[^-<>()[\].,;:\s@"]$/i;
// eslint-disable-next-line
// const emailRegex =
//   /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\])|(\[IPv6:(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))\])|([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])*(\.[A-Za-z]{2,})+))$/;
// const emailRegex =
//   /^[a-zA-Z0-9\.\!\#\$\%\&\'\*\+\/\=\?\^\_\`\{\|\}\~\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
// const emailRegex =
//   /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;
const emailRegex$1 = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
// const emailRegex =
//   /^[a-z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9\-]+)*$/i;
// from https://thekevinscott.com/emojis-in-javascript/#writing-a-regular-expression
const _emojiRegex$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
let emojiRegex$1;
// faster, simpler, safer
const ipv4Regex$1 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv4CidrRegex$1 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
// const ipv6Regex =
// /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/;
const ipv6Regex$1 = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
const ipv6CidrRegex$1 = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
// https://stackoverflow.com/questions/7860392/determine-if-string-is-in-base64-using-javascript
const base64Regex$1 = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
// https://base64.guru/standards/base64url
const base64urlRegex$1 = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
// simple
// const dateRegexSource = `\\d{4}-\\d{2}-\\d{2}`;
// no leap year validation
// const dateRegexSource = `\\d{4}-((0[13578]|10|12)-31|(0[13-9]|1[0-2])-30|(0[1-9]|1[0-2])-(0[1-9]|1\\d|2\\d))`;
// with leap year validation
const dateRegexSource$1 = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
const dateRegex$1 = new RegExp(`^${dateRegexSource$1}$`);
function timeRegexSource$1(args) {
    let secondsRegexSource = `[0-5]\\d`;
    if (args.precision) {
        secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
    }
    else if (args.precision == null) {
        secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
    }
    const secondsQuantifier = args.precision ? "+" : "?"; // require seconds if precision is nonzero
    return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex$1(args) {
    return new RegExp(`^${timeRegexSource$1(args)}$`);
}
// Adapted from https://stackoverflow.com/a/3143231
function datetimeRegex$1(args) {
    let regex = `${dateRegexSource$1}T${timeRegexSource$1(args)}`;
    const opts = [];
    opts.push(args.local ? `Z?` : `Z`);
    if (args.offset)
        opts.push(`([+-]\\d{2}:?\\d{2})`);
    regex = `${regex}(${opts.join("|")})`;
    return new RegExp(`^${regex}$`);
}
function isValidIP$1(ip, version) {
    if ((version === "v4" || !version) && ipv4Regex$1.test(ip)) {
        return true;
    }
    if ((version === "v6" || !version) && ipv6Regex$1.test(ip)) {
        return true;
    }
    return false;
}
function isValidJWT$1(jwt, alg) {
    if (!jwtRegex$1.test(jwt))
        return false;
    try {
        const [header] = jwt.split(".");
        // Convert base64url to base64
        const base64 = header
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(header.length + ((4 - (header.length % 4)) % 4), "=");
        const decoded = JSON.parse(atob(base64));
        if (typeof decoded !== "object" || decoded === null)
            return false;
        if (!decoded.typ || !decoded.alg)
            return false;
        if (alg && decoded.alg !== alg)
            return false;
        return true;
    }
    catch (_a) {
        return false;
    }
}
function isValidCidr$1(ip, version) {
    if ((version === "v4" || !version) && ipv4CidrRegex$1.test(ip)) {
        return true;
    }
    if ((version === "v6" || !version) && ipv6CidrRegex$1.test(ip)) {
        return true;
    }
    return false;
}
let ZodString$1 = class ZodString extends ZodType$1 {
    _parse(input) {
        if (this._def.coerce) {
            input.data = String(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$1.string) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.string,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        const status = new ParseStatus$1();
        let ctx = undefined;
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                if (input.data.length < check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.too_small,
                        minimum: check.value,
                        type: "string",
                        inclusive: true,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                if (input.data.length > check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.too_big,
                        maximum: check.value,
                        type: "string",
                        inclusive: true,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "length") {
                const tooBig = input.data.length > check.value;
                const tooSmall = input.data.length < check.value;
                if (tooBig || tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    if (tooBig) {
                        addIssueToContext$1(ctx, {
                            code: ZodIssueCode$1.too_big,
                            maximum: check.value,
                            type: "string",
                            inclusive: true,
                            exact: true,
                            message: check.message,
                        });
                    }
                    else if (tooSmall) {
                        addIssueToContext$1(ctx, {
                            code: ZodIssueCode$1.too_small,
                            minimum: check.value,
                            type: "string",
                            inclusive: true,
                            exact: true,
                            message: check.message,
                        });
                    }
                    status.dirty();
                }
            }
            else if (check.kind === "email") {
                if (!emailRegex$1.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        validation: "email",
                        code: ZodIssueCode$1.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "emoji") {
                if (!emojiRegex$1) {
                    emojiRegex$1 = new RegExp(_emojiRegex$1, "u");
                }
                if (!emojiRegex$1.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        validation: "emoji",
                        code: ZodIssueCode$1.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "uuid") {
                if (!uuidRegex$1.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        validation: "uuid",
                        code: ZodIssueCode$1.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "nanoid") {
                if (!nanoidRegex$1.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        validation: "nanoid",
                        code: ZodIssueCode$1.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cuid") {
                if (!cuidRegex$1.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        validation: "cuid",
                        code: ZodIssueCode$1.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cuid2") {
                if (!cuid2Regex$1.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        validation: "cuid2",
                        code: ZodIssueCode$1.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "ulid") {
                if (!ulidRegex$1.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        validation: "ulid",
                        code: ZodIssueCode$1.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "url") {
                try {
                    new URL(input.data);
                }
                catch (_a) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        validation: "url",
                        code: ZodIssueCode$1.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "regex") {
                check.regex.lastIndex = 0;
                const testResult = check.regex.test(input.data);
                if (!testResult) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        validation: "regex",
                        code: ZodIssueCode$1.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "trim") {
                input.data = input.data.trim();
            }
            else if (check.kind === "includes") {
                if (!input.data.includes(check.value, check.position)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.invalid_string,
                        validation: { includes: check.value, position: check.position },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "toLowerCase") {
                input.data = input.data.toLowerCase();
            }
            else if (check.kind === "toUpperCase") {
                input.data = input.data.toUpperCase();
            }
            else if (check.kind === "startsWith") {
                if (!input.data.startsWith(check.value)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.invalid_string,
                        validation: { startsWith: check.value },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "endsWith") {
                if (!input.data.endsWith(check.value)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.invalid_string,
                        validation: { endsWith: check.value },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "datetime") {
                const regex = datetimeRegex$1(check);
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.invalid_string,
                        validation: "datetime",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "date") {
                const regex = dateRegex$1;
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.invalid_string,
                        validation: "date",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "time") {
                const regex = timeRegex$1(check);
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.invalid_string,
                        validation: "time",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "duration") {
                if (!durationRegex$1.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        validation: "duration",
                        code: ZodIssueCode$1.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "ip") {
                if (!isValidIP$1(input.data, check.version)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        validation: "ip",
                        code: ZodIssueCode$1.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "jwt") {
                if (!isValidJWT$1(input.data, check.alg)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        validation: "jwt",
                        code: ZodIssueCode$1.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cidr") {
                if (!isValidCidr$1(input.data, check.version)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        validation: "cidr",
                        code: ZodIssueCode$1.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "base64") {
                if (!base64Regex$1.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        validation: "base64",
                        code: ZodIssueCode$1.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "base64url") {
                if (!base64urlRegex$1.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        validation: "base64url",
                        code: ZodIssueCode$1.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util$1.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    _regex(regex, validation, message) {
        return this.refinement((data) => regex.test(data), {
            validation,
            code: ZodIssueCode$1.invalid_string,
            ...errorUtil$1.errToObj(message),
        });
    }
    _addCheck(check) {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    email(message) {
        return this._addCheck({ kind: "email", ...errorUtil$1.errToObj(message) });
    }
    url(message) {
        return this._addCheck({ kind: "url", ...errorUtil$1.errToObj(message) });
    }
    emoji(message) {
        return this._addCheck({ kind: "emoji", ...errorUtil$1.errToObj(message) });
    }
    uuid(message) {
        return this._addCheck({ kind: "uuid", ...errorUtil$1.errToObj(message) });
    }
    nanoid(message) {
        return this._addCheck({ kind: "nanoid", ...errorUtil$1.errToObj(message) });
    }
    cuid(message) {
        return this._addCheck({ kind: "cuid", ...errorUtil$1.errToObj(message) });
    }
    cuid2(message) {
        return this._addCheck({ kind: "cuid2", ...errorUtil$1.errToObj(message) });
    }
    ulid(message) {
        return this._addCheck({ kind: "ulid", ...errorUtil$1.errToObj(message) });
    }
    base64(message) {
        return this._addCheck({ kind: "base64", ...errorUtil$1.errToObj(message) });
    }
    base64url(message) {
        // base64url encoding is a modification of base64 that can safely be used in URLs and filenames
        return this._addCheck({
            kind: "base64url",
            ...errorUtil$1.errToObj(message),
        });
    }
    jwt(options) {
        return this._addCheck({ kind: "jwt", ...errorUtil$1.errToObj(options) });
    }
    ip(options) {
        return this._addCheck({ kind: "ip", ...errorUtil$1.errToObj(options) });
    }
    cidr(options) {
        return this._addCheck({ kind: "cidr", ...errorUtil$1.errToObj(options) });
    }
    datetime(options) {
        var _a, _b;
        if (typeof options === "string") {
            return this._addCheck({
                kind: "datetime",
                precision: null,
                offset: false,
                local: false,
                message: options,
            });
        }
        return this._addCheck({
            kind: "datetime",
            precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
            offset: (_a = options === null || options === void 0 ? void 0 : options.offset) !== null && _a !== void 0 ? _a : false,
            local: (_b = options === null || options === void 0 ? void 0 : options.local) !== null && _b !== void 0 ? _b : false,
            ...errorUtil$1.errToObj(options === null || options === void 0 ? void 0 : options.message),
        });
    }
    date(message) {
        return this._addCheck({ kind: "date", message });
    }
    time(options) {
        if (typeof options === "string") {
            return this._addCheck({
                kind: "time",
                precision: null,
                message: options,
            });
        }
        return this._addCheck({
            kind: "time",
            precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
            ...errorUtil$1.errToObj(options === null || options === void 0 ? void 0 : options.message),
        });
    }
    duration(message) {
        return this._addCheck({ kind: "duration", ...errorUtil$1.errToObj(message) });
    }
    regex(regex, message) {
        return this._addCheck({
            kind: "regex",
            regex: regex,
            ...errorUtil$1.errToObj(message),
        });
    }
    includes(value, options) {
        return this._addCheck({
            kind: "includes",
            value: value,
            position: options === null || options === void 0 ? void 0 : options.position,
            ...errorUtil$1.errToObj(options === null || options === void 0 ? void 0 : options.message),
        });
    }
    startsWith(value, message) {
        return this._addCheck({
            kind: "startsWith",
            value: value,
            ...errorUtil$1.errToObj(message),
        });
    }
    endsWith(value, message) {
        return this._addCheck({
            kind: "endsWith",
            value: value,
            ...errorUtil$1.errToObj(message),
        });
    }
    min(minLength, message) {
        return this._addCheck({
            kind: "min",
            value: minLength,
            ...errorUtil$1.errToObj(message),
        });
    }
    max(maxLength, message) {
        return this._addCheck({
            kind: "max",
            value: maxLength,
            ...errorUtil$1.errToObj(message),
        });
    }
    length(len, message) {
        return this._addCheck({
            kind: "length",
            value: len,
            ...errorUtil$1.errToObj(message),
        });
    }
    /**
     * Equivalent to `.min(1)`
     */
    nonempty(message) {
        return this.min(1, errorUtil$1.errToObj(message));
    }
    trim() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "trim" }],
        });
    }
    toLowerCase() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "toLowerCase" }],
        });
    }
    toUpperCase() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "toUpperCase" }],
        });
    }
    get isDatetime() {
        return !!this._def.checks.find((ch) => ch.kind === "datetime");
    }
    get isDate() {
        return !!this._def.checks.find((ch) => ch.kind === "date");
    }
    get isTime() {
        return !!this._def.checks.find((ch) => ch.kind === "time");
    }
    get isDuration() {
        return !!this._def.checks.find((ch) => ch.kind === "duration");
    }
    get isEmail() {
        return !!this._def.checks.find((ch) => ch.kind === "email");
    }
    get isURL() {
        return !!this._def.checks.find((ch) => ch.kind === "url");
    }
    get isEmoji() {
        return !!this._def.checks.find((ch) => ch.kind === "emoji");
    }
    get isUUID() {
        return !!this._def.checks.find((ch) => ch.kind === "uuid");
    }
    get isNANOID() {
        return !!this._def.checks.find((ch) => ch.kind === "nanoid");
    }
    get isCUID() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid");
    }
    get isCUID2() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid2");
    }
    get isULID() {
        return !!this._def.checks.find((ch) => ch.kind === "ulid");
    }
    get isIP() {
        return !!this._def.checks.find((ch) => ch.kind === "ip");
    }
    get isCIDR() {
        return !!this._def.checks.find((ch) => ch.kind === "cidr");
    }
    get isBase64() {
        return !!this._def.checks.find((ch) => ch.kind === "base64");
    }
    get isBase64url() {
        // base64url encoding is a modification of base64 that can safely be used in URLs and filenames
        return !!this._def.checks.find((ch) => ch.kind === "base64url");
    }
    get minLength() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxLength() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
};
ZodString$1.create = (params) => {
    var _a;
    return new ZodString$1({
        checks: [],
        typeName: ZodFirstPartyTypeKind$1.ZodString,
        coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
        ...processCreateParams$1(params),
    });
};
// https://stackoverflow.com/questions/3966484/why-does-modulus-operator-return-fractional-number-in-javascript/31711034#31711034
function floatSafeRemainder$1(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepDecCount = (step.toString().split(".")[1] || "").length;
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = parseInt(step.toFixed(decCount).replace(".", ""));
    return (valInt % stepInt) / Math.pow(10, decCount);
}
let ZodNumber$1 = class ZodNumber extends ZodType$1 {
    constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
        this.step = this.multipleOf;
    }
    _parse(input) {
        if (this._def.coerce) {
            input.data = Number(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$1.number) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.number,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        let ctx = undefined;
        const status = new ParseStatus$1();
        for (const check of this._def.checks) {
            if (check.kind === "int") {
                if (!util$1.isInteger(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.invalid_type,
                        expected: "integer",
                        received: "float",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "min") {
                const tooSmall = check.inclusive
                    ? input.data < check.value
                    : input.data <= check.value;
                if (tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.too_small,
                        minimum: check.value,
                        type: "number",
                        inclusive: check.inclusive,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                const tooBig = check.inclusive
                    ? input.data > check.value
                    : input.data >= check.value;
                if (tooBig) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.too_big,
                        maximum: check.value,
                        type: "number",
                        inclusive: check.inclusive,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "multipleOf") {
                if (floatSafeRemainder$1(input.data, check.value) !== 0) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.not_multiple_of,
                        multipleOf: check.value,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "finite") {
                if (!Number.isFinite(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.not_finite,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util$1.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    gte(value, message) {
        return this.setLimit("min", value, true, errorUtil$1.toString(message));
    }
    gt(value, message) {
        return this.setLimit("min", value, false, errorUtil$1.toString(message));
    }
    lte(value, message) {
        return this.setLimit("max", value, true, errorUtil$1.toString(message));
    }
    lt(value, message) {
        return this.setLimit("max", value, false, errorUtil$1.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
        return new ZodNumber({
            ...this._def,
            checks: [
                ...this._def.checks,
                {
                    kind,
                    value,
                    inclusive,
                    message: errorUtil$1.toString(message),
                },
            ],
        });
    }
    _addCheck(check) {
        return new ZodNumber({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    int(message) {
        return this._addCheck({
            kind: "int",
            message: errorUtil$1.toString(message),
        });
    }
    positive(message) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: false,
            message: errorUtil$1.toString(message),
        });
    }
    negative(message) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: false,
            message: errorUtil$1.toString(message),
        });
    }
    nonpositive(message) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: true,
            message: errorUtil$1.toString(message),
        });
    }
    nonnegative(message) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: true,
            message: errorUtil$1.toString(message),
        });
    }
    multipleOf(value, message) {
        return this._addCheck({
            kind: "multipleOf",
            value: value,
            message: errorUtil$1.toString(message),
        });
    }
    finite(message) {
        return this._addCheck({
            kind: "finite",
            message: errorUtil$1.toString(message),
        });
    }
    safe(message) {
        return this._addCheck({
            kind: "min",
            inclusive: true,
            value: Number.MIN_SAFE_INTEGER,
            message: errorUtil$1.toString(message),
        })._addCheck({
            kind: "max",
            inclusive: true,
            value: Number.MAX_SAFE_INTEGER,
            message: errorUtil$1.toString(message),
        });
    }
    get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
    get isInt() {
        return !!this._def.checks.find((ch) => ch.kind === "int" ||
            (ch.kind === "multipleOf" && util$1.isInteger(ch.value)));
    }
    get isFinite() {
        let max = null, min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "finite" ||
                ch.kind === "int" ||
                ch.kind === "multipleOf") {
                return true;
            }
            else if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
            else if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return Number.isFinite(min) && Number.isFinite(max);
    }
};
ZodNumber$1.create = (params) => {
    return new ZodNumber$1({
        checks: [],
        typeName: ZodFirstPartyTypeKind$1.ZodNumber,
        coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
        ...processCreateParams$1(params),
    });
};
let ZodBigInt$1 = class ZodBigInt extends ZodType$1 {
    constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
    }
    _parse(input) {
        if (this._def.coerce) {
            try {
                input.data = BigInt(input.data);
            }
            catch (_a) {
                return this._getInvalidInput(input);
            }
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$1.bigint) {
            return this._getInvalidInput(input);
        }
        let ctx = undefined;
        const status = new ParseStatus$1();
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                const tooSmall = check.inclusive
                    ? input.data < check.value
                    : input.data <= check.value;
                if (tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.too_small,
                        type: "bigint",
                        minimum: check.value,
                        inclusive: check.inclusive,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                const tooBig = check.inclusive
                    ? input.data > check.value
                    : input.data >= check.value;
                if (tooBig) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.too_big,
                        type: "bigint",
                        maximum: check.value,
                        inclusive: check.inclusive,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "multipleOf") {
                if (input.data % check.value !== BigInt(0)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.not_multiple_of,
                        multipleOf: check.value,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util$1.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    _getInvalidInput(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext$1(ctx, {
            code: ZodIssueCode$1.invalid_type,
            expected: ZodParsedType$1.bigint,
            received: ctx.parsedType,
        });
        return INVALID$1;
    }
    gte(value, message) {
        return this.setLimit("min", value, true, errorUtil$1.toString(message));
    }
    gt(value, message) {
        return this.setLimit("min", value, false, errorUtil$1.toString(message));
    }
    lte(value, message) {
        return this.setLimit("max", value, true, errorUtil$1.toString(message));
    }
    lt(value, message) {
        return this.setLimit("max", value, false, errorUtil$1.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
        return new ZodBigInt({
            ...this._def,
            checks: [
                ...this._def.checks,
                {
                    kind,
                    value,
                    inclusive,
                    message: errorUtil$1.toString(message),
                },
            ],
        });
    }
    _addCheck(check) {
        return new ZodBigInt({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    positive(message) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil$1.toString(message),
        });
    }
    negative(message) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil$1.toString(message),
        });
    }
    nonpositive(message) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil$1.toString(message),
        });
    }
    nonnegative(message) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil$1.toString(message),
        });
    }
    multipleOf(value, message) {
        return this._addCheck({
            kind: "multipleOf",
            value,
            message: errorUtil$1.toString(message),
        });
    }
    get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
};
ZodBigInt$1.create = (params) => {
    var _a;
    return new ZodBigInt$1({
        checks: [],
        typeName: ZodFirstPartyTypeKind$1.ZodBigInt,
        coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
        ...processCreateParams$1(params),
    });
};
let ZodBoolean$1 = class ZodBoolean extends ZodType$1 {
    _parse(input) {
        if (this._def.coerce) {
            input.data = Boolean(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$1.boolean) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.boolean,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        return OK$1(input.data);
    }
};
ZodBoolean$1.create = (params) => {
    return new ZodBoolean$1({
        typeName: ZodFirstPartyTypeKind$1.ZodBoolean,
        coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
        ...processCreateParams$1(params),
    });
};
let ZodDate$1 = class ZodDate extends ZodType$1 {
    _parse(input) {
        if (this._def.coerce) {
            input.data = new Date(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$1.date) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.date,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        if (isNaN(input.data.getTime())) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_date,
            });
            return INVALID$1;
        }
        const status = new ParseStatus$1();
        let ctx = undefined;
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                if (input.data.getTime() < check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.too_small,
                        message: check.message,
                        inclusive: true,
                        exact: false,
                        minimum: check.value,
                        type: "date",
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                if (input.data.getTime() > check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.too_big,
                        message: check.message,
                        inclusive: true,
                        exact: false,
                        maximum: check.value,
                        type: "date",
                    });
                    status.dirty();
                }
            }
            else {
                util$1.assertNever(check);
            }
        }
        return {
            status: status.value,
            value: new Date(input.data.getTime()),
        };
    }
    _addCheck(check) {
        return new ZodDate({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    min(minDate, message) {
        return this._addCheck({
            kind: "min",
            value: minDate.getTime(),
            message: errorUtil$1.toString(message),
        });
    }
    max(maxDate, message) {
        return this._addCheck({
            kind: "max",
            value: maxDate.getTime(),
            message: errorUtil$1.toString(message),
        });
    }
    get minDate() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min != null ? new Date(min) : null;
    }
    get maxDate() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max != null ? new Date(max) : null;
    }
};
ZodDate$1.create = (params) => {
    return new ZodDate$1({
        checks: [],
        coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
        typeName: ZodFirstPartyTypeKind$1.ZodDate,
        ...processCreateParams$1(params),
    });
};
let ZodSymbol$1 = class ZodSymbol extends ZodType$1 {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$1.symbol) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.symbol,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        return OK$1(input.data);
    }
};
ZodSymbol$1.create = (params) => {
    return new ZodSymbol$1({
        typeName: ZodFirstPartyTypeKind$1.ZodSymbol,
        ...processCreateParams$1(params),
    });
};
let ZodUndefined$1 = class ZodUndefined extends ZodType$1 {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$1.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.undefined,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        return OK$1(input.data);
    }
};
ZodUndefined$1.create = (params) => {
    return new ZodUndefined$1({
        typeName: ZodFirstPartyTypeKind$1.ZodUndefined,
        ...processCreateParams$1(params),
    });
};
let ZodNull$1 = class ZodNull extends ZodType$1 {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$1.null) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.null,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        return OK$1(input.data);
    }
};
ZodNull$1.create = (params) => {
    return new ZodNull$1({
        typeName: ZodFirstPartyTypeKind$1.ZodNull,
        ...processCreateParams$1(params),
    });
};
let ZodAny$1 = class ZodAny extends ZodType$1 {
    constructor() {
        super(...arguments);
        // to prevent instances of other classes from extending ZodAny. this causes issues with catchall in ZodObject.
        this._any = true;
    }
    _parse(input) {
        return OK$1(input.data);
    }
};
ZodAny$1.create = (params) => {
    return new ZodAny$1({
        typeName: ZodFirstPartyTypeKind$1.ZodAny,
        ...processCreateParams$1(params),
    });
};
let ZodUnknown$1 = class ZodUnknown extends ZodType$1 {
    constructor() {
        super(...arguments);
        // required
        this._unknown = true;
    }
    _parse(input) {
        return OK$1(input.data);
    }
};
ZodUnknown$1.create = (params) => {
    return new ZodUnknown$1({
        typeName: ZodFirstPartyTypeKind$1.ZodUnknown,
        ...processCreateParams$1(params),
    });
};
let ZodNever$1 = class ZodNever extends ZodType$1 {
    _parse(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext$1(ctx, {
            code: ZodIssueCode$1.invalid_type,
            expected: ZodParsedType$1.never,
            received: ctx.parsedType,
        });
        return INVALID$1;
    }
};
ZodNever$1.create = (params) => {
    return new ZodNever$1({
        typeName: ZodFirstPartyTypeKind$1.ZodNever,
        ...processCreateParams$1(params),
    });
};
let ZodVoid$1 = class ZodVoid extends ZodType$1 {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$1.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.void,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        return OK$1(input.data);
    }
};
ZodVoid$1.create = (params) => {
    return new ZodVoid$1({
        typeName: ZodFirstPartyTypeKind$1.ZodVoid,
        ...processCreateParams$1(params),
    });
};
let ZodArray$1 = class ZodArray extends ZodType$1 {
    _parse(input) {
        const { ctx, status } = this._processInputParams(input);
        const def = this._def;
        if (ctx.parsedType !== ZodParsedType$1.array) {
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.array,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        if (def.exactLength !== null) {
            const tooBig = ctx.data.length > def.exactLength.value;
            const tooSmall = ctx.data.length < def.exactLength.value;
            if (tooBig || tooSmall) {
                addIssueToContext$1(ctx, {
                    code: tooBig ? ZodIssueCode$1.too_big : ZodIssueCode$1.too_small,
                    minimum: (tooSmall ? def.exactLength.value : undefined),
                    maximum: (tooBig ? def.exactLength.value : undefined),
                    type: "array",
                    inclusive: true,
                    exact: true,
                    message: def.exactLength.message,
                });
                status.dirty();
            }
        }
        if (def.minLength !== null) {
            if (ctx.data.length < def.minLength.value) {
                addIssueToContext$1(ctx, {
                    code: ZodIssueCode$1.too_small,
                    minimum: def.minLength.value,
                    type: "array",
                    inclusive: true,
                    exact: false,
                    message: def.minLength.message,
                });
                status.dirty();
            }
        }
        if (def.maxLength !== null) {
            if (ctx.data.length > def.maxLength.value) {
                addIssueToContext$1(ctx, {
                    code: ZodIssueCode$1.too_big,
                    maximum: def.maxLength.value,
                    type: "array",
                    inclusive: true,
                    exact: false,
                    message: def.maxLength.message,
                });
                status.dirty();
            }
        }
        if (ctx.common.async) {
            return Promise.all([...ctx.data].map((item, i) => {
                return def.type._parseAsync(new ParseInputLazyPath$1(ctx, item, ctx.path, i));
            })).then((result) => {
                return ParseStatus$1.mergeArray(status, result);
            });
        }
        const result = [...ctx.data].map((item, i) => {
            return def.type._parseSync(new ParseInputLazyPath$1(ctx, item, ctx.path, i));
        });
        return ParseStatus$1.mergeArray(status, result);
    }
    get element() {
        return this._def.type;
    }
    min(minLength, message) {
        return new ZodArray({
            ...this._def,
            minLength: { value: minLength, message: errorUtil$1.toString(message) },
        });
    }
    max(maxLength, message) {
        return new ZodArray({
            ...this._def,
            maxLength: { value: maxLength, message: errorUtil$1.toString(message) },
        });
    }
    length(len, message) {
        return new ZodArray({
            ...this._def,
            exactLength: { value: len, message: errorUtil$1.toString(message) },
        });
    }
    nonempty(message) {
        return this.min(1, message);
    }
};
ZodArray$1.create = (schema, params) => {
    return new ZodArray$1({
        type: schema,
        minLength: null,
        maxLength: null,
        exactLength: null,
        typeName: ZodFirstPartyTypeKind$1.ZodArray,
        ...processCreateParams$1(params),
    });
};
function deepPartialify$1(schema) {
    if (schema instanceof ZodObject$1) {
        const newShape = {};
        for (const key in schema.shape) {
            const fieldSchema = schema.shape[key];
            newShape[key] = ZodOptional$1.create(deepPartialify$1(fieldSchema));
        }
        return new ZodObject$1({
            ...schema._def,
            shape: () => newShape,
        });
    }
    else if (schema instanceof ZodArray$1) {
        return new ZodArray$1({
            ...schema._def,
            type: deepPartialify$1(schema.element),
        });
    }
    else if (schema instanceof ZodOptional$1) {
        return ZodOptional$1.create(deepPartialify$1(schema.unwrap()));
    }
    else if (schema instanceof ZodNullable$1) {
        return ZodNullable$1.create(deepPartialify$1(schema.unwrap()));
    }
    else if (schema instanceof ZodTuple$1) {
        return ZodTuple$1.create(schema.items.map((item) => deepPartialify$1(item)));
    }
    else {
        return schema;
    }
}
let ZodObject$1 = class ZodObject extends ZodType$1 {
    constructor() {
        super(...arguments);
        this._cached = null;
        /**
         * @deprecated In most cases, this is no longer needed - unknown properties are now silently stripped.
         * If you want to pass through unknown properties, use `.passthrough()` instead.
         */
        this.nonstrict = this.passthrough;
        // extend<
        //   Augmentation extends ZodRawShape,
        //   NewOutput extends util.flatten<{
        //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
        //       ? Augmentation[k]["_output"]
        //       : k extends keyof Output
        //       ? Output[k]
        //       : never;
        //   }>,
        //   NewInput extends util.flatten<{
        //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
        //       ? Augmentation[k]["_input"]
        //       : k extends keyof Input
        //       ? Input[k]
        //       : never;
        //   }>
        // >(
        //   augmentation: Augmentation
        // ): ZodObject<
        //   extendShape<T, Augmentation>,
        //   UnknownKeys,
        //   Catchall,
        //   NewOutput,
        //   NewInput
        // > {
        //   return new ZodObject({
        //     ...this._def,
        //     shape: () => ({
        //       ...this._def.shape(),
        //       ...augmentation,
        //     }),
        //   }) as any;
        // }
        /**
         * @deprecated Use `.extend` instead
         *  */
        this.augment = this.extend;
    }
    _getCached() {
        if (this._cached !== null)
            return this._cached;
        const shape = this._def.shape();
        const keys = util$1.objectKeys(shape);
        return (this._cached = { shape, keys });
    }
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$1.object) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.object,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        const { status, ctx } = this._processInputParams(input);
        const { shape, keys: shapeKeys } = this._getCached();
        const extraKeys = [];
        if (!(this._def.catchall instanceof ZodNever$1 &&
            this._def.unknownKeys === "strip")) {
            for (const key in ctx.data) {
                if (!shapeKeys.includes(key)) {
                    extraKeys.push(key);
                }
            }
        }
        const pairs = [];
        for (const key of shapeKeys) {
            const keyValidator = shape[key];
            const value = ctx.data[key];
            pairs.push({
                key: { status: "valid", value: key },
                value: keyValidator._parse(new ParseInputLazyPath$1(ctx, value, ctx.path, key)),
                alwaysSet: key in ctx.data,
            });
        }
        if (this._def.catchall instanceof ZodNever$1) {
            const unknownKeys = this._def.unknownKeys;
            if (unknownKeys === "passthrough") {
                for (const key of extraKeys) {
                    pairs.push({
                        key: { status: "valid", value: key },
                        value: { status: "valid", value: ctx.data[key] },
                    });
                }
            }
            else if (unknownKeys === "strict") {
                if (extraKeys.length > 0) {
                    addIssueToContext$1(ctx, {
                        code: ZodIssueCode$1.unrecognized_keys,
                        keys: extraKeys,
                    });
                    status.dirty();
                }
            }
            else if (unknownKeys === "strip") ;
            else {
                throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
            }
        }
        else {
            // run catchall validation
            const catchall = this._def.catchall;
            for (const key of extraKeys) {
                const value = ctx.data[key];
                pairs.push({
                    key: { status: "valid", value: key },
                    value: catchall._parse(new ParseInputLazyPath$1(ctx, value, ctx.path, key) //, ctx.child(key), value, getParsedType(value)
                    ),
                    alwaysSet: key in ctx.data,
                });
            }
        }
        if (ctx.common.async) {
            return Promise.resolve()
                .then(async () => {
                const syncPairs = [];
                for (const pair of pairs) {
                    const key = await pair.key;
                    const value = await pair.value;
                    syncPairs.push({
                        key,
                        value,
                        alwaysSet: pair.alwaysSet,
                    });
                }
                return syncPairs;
            })
                .then((syncPairs) => {
                return ParseStatus$1.mergeObjectSync(status, syncPairs);
            });
        }
        else {
            return ParseStatus$1.mergeObjectSync(status, pairs);
        }
    }
    get shape() {
        return this._def.shape();
    }
    strict(message) {
        errorUtil$1.errToObj;
        return new ZodObject({
            ...this._def,
            unknownKeys: "strict",
            ...(message !== undefined
                ? {
                    errorMap: (issue, ctx) => {
                        var _a, _b, _c, _d;
                        const defaultError = (_c = (_b = (_a = this._def).errorMap) === null || _b === void 0 ? void 0 : _b.call(_a, issue, ctx).message) !== null && _c !== void 0 ? _c : ctx.defaultError;
                        if (issue.code === "unrecognized_keys")
                            return {
                                message: (_d = errorUtil$1.errToObj(message).message) !== null && _d !== void 0 ? _d : defaultError,
                            };
                        return {
                            message: defaultError,
                        };
                    },
                }
                : {}),
        });
    }
    strip() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "strip",
        });
    }
    passthrough() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "passthrough",
        });
    }
    // const AugmentFactory =
    //   <Def extends ZodObjectDef>(def: Def) =>
    //   <Augmentation extends ZodRawShape>(
    //     augmentation: Augmentation
    //   ): ZodObject<
    //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
    //     Def["unknownKeys"],
    //     Def["catchall"]
    //   > => {
    //     return new ZodObject({
    //       ...def,
    //       shape: () => ({
    //         ...def.shape(),
    //         ...augmentation,
    //       }),
    //     }) as any;
    //   };
    extend(augmentation) {
        return new ZodObject({
            ...this._def,
            shape: () => ({
                ...this._def.shape(),
                ...augmentation,
            }),
        });
    }
    /**
     * Prior to zod@1.0.12 there was a bug in the
     * inferred type of merged objects. Please
     * upgrade if you are experiencing issues.
     */
    merge(merging) {
        const merged = new ZodObject({
            unknownKeys: merging._def.unknownKeys,
            catchall: merging._def.catchall,
            shape: () => ({
                ...this._def.shape(),
                ...merging._def.shape(),
            }),
            typeName: ZodFirstPartyTypeKind$1.ZodObject,
        });
        return merged;
    }
    // merge<
    //   Incoming extends AnyZodObject,
    //   Augmentation extends Incoming["shape"],
    //   NewOutput extends {
    //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
    //       ? Augmentation[k]["_output"]
    //       : k extends keyof Output
    //       ? Output[k]
    //       : never;
    //   },
    //   NewInput extends {
    //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
    //       ? Augmentation[k]["_input"]
    //       : k extends keyof Input
    //       ? Input[k]
    //       : never;
    //   }
    // >(
    //   merging: Incoming
    // ): ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"],
    //   NewOutput,
    //   NewInput
    // > {
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    setKey(key, schema) {
        return this.augment({ [key]: schema });
    }
    // merge<Incoming extends AnyZodObject>(
    //   merging: Incoming
    // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
    // ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"]
    // > {
    //   // const mergedShape = objectUtil.mergeShapes(
    //   //   this._def.shape(),
    //   //   merging._def.shape()
    //   // );
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    catchall(index) {
        return new ZodObject({
            ...this._def,
            catchall: index,
        });
    }
    pick(mask) {
        const shape = {};
        util$1.objectKeys(mask).forEach((key) => {
            if (mask[key] && this.shape[key]) {
                shape[key] = this.shape[key];
            }
        });
        return new ZodObject({
            ...this._def,
            shape: () => shape,
        });
    }
    omit(mask) {
        const shape = {};
        util$1.objectKeys(this.shape).forEach((key) => {
            if (!mask[key]) {
                shape[key] = this.shape[key];
            }
        });
        return new ZodObject({
            ...this._def,
            shape: () => shape,
        });
    }
    /**
     * @deprecated
     */
    deepPartial() {
        return deepPartialify$1(this);
    }
    partial(mask) {
        const newShape = {};
        util$1.objectKeys(this.shape).forEach((key) => {
            const fieldSchema = this.shape[key];
            if (mask && !mask[key]) {
                newShape[key] = fieldSchema;
            }
            else {
                newShape[key] = fieldSchema.optional();
            }
        });
        return new ZodObject({
            ...this._def,
            shape: () => newShape,
        });
    }
    required(mask) {
        const newShape = {};
        util$1.objectKeys(this.shape).forEach((key) => {
            if (mask && !mask[key]) {
                newShape[key] = this.shape[key];
            }
            else {
                const fieldSchema = this.shape[key];
                let newField = fieldSchema;
                while (newField instanceof ZodOptional$1) {
                    newField = newField._def.innerType;
                }
                newShape[key] = newField;
            }
        });
        return new ZodObject({
            ...this._def,
            shape: () => newShape,
        });
    }
    keyof() {
        return createZodEnum$1(util$1.objectKeys(this.shape));
    }
};
ZodObject$1.create = (shape, params) => {
    return new ZodObject$1({
        shape: () => shape,
        unknownKeys: "strip",
        catchall: ZodNever$1.create(),
        typeName: ZodFirstPartyTypeKind$1.ZodObject,
        ...processCreateParams$1(params),
    });
};
ZodObject$1.strictCreate = (shape, params) => {
    return new ZodObject$1({
        shape: () => shape,
        unknownKeys: "strict",
        catchall: ZodNever$1.create(),
        typeName: ZodFirstPartyTypeKind$1.ZodObject,
        ...processCreateParams$1(params),
    });
};
ZodObject$1.lazycreate = (shape, params) => {
    return new ZodObject$1({
        shape,
        unknownKeys: "strip",
        catchall: ZodNever$1.create(),
        typeName: ZodFirstPartyTypeKind$1.ZodObject,
        ...processCreateParams$1(params),
    });
};
let ZodUnion$1 = class ZodUnion extends ZodType$1 {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const options = this._def.options;
        function handleResults(results) {
            // return first issue-free validation if it exists
            for (const result of results) {
                if (result.result.status === "valid") {
                    return result.result;
                }
            }
            for (const result of results) {
                if (result.result.status === "dirty") {
                    // add issues from dirty option
                    ctx.common.issues.push(...result.ctx.common.issues);
                    return result.result;
                }
            }
            // return invalid
            const unionErrors = results.map((result) => new ZodError$1(result.ctx.common.issues));
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_union,
                unionErrors,
            });
            return INVALID$1;
        }
        if (ctx.common.async) {
            return Promise.all(options.map(async (option) => {
                const childCtx = {
                    ...ctx,
                    common: {
                        ...ctx.common,
                        issues: [],
                    },
                    parent: null,
                };
                return {
                    result: await option._parseAsync({
                        data: ctx.data,
                        path: ctx.path,
                        parent: childCtx,
                    }),
                    ctx: childCtx,
                };
            })).then(handleResults);
        }
        else {
            let dirty = undefined;
            const issues = [];
            for (const option of options) {
                const childCtx = {
                    ...ctx,
                    common: {
                        ...ctx.common,
                        issues: [],
                    },
                    parent: null,
                };
                const result = option._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: childCtx,
                });
                if (result.status === "valid") {
                    return result;
                }
                else if (result.status === "dirty" && !dirty) {
                    dirty = { result, ctx: childCtx };
                }
                if (childCtx.common.issues.length) {
                    issues.push(childCtx.common.issues);
                }
            }
            if (dirty) {
                ctx.common.issues.push(...dirty.ctx.common.issues);
                return dirty.result;
            }
            const unionErrors = issues.map((issues) => new ZodError$1(issues));
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_union,
                unionErrors,
            });
            return INVALID$1;
        }
    }
    get options() {
        return this._def.options;
    }
};
ZodUnion$1.create = (types, params) => {
    return new ZodUnion$1({
        options: types,
        typeName: ZodFirstPartyTypeKind$1.ZodUnion,
        ...processCreateParams$1(params),
    });
};
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
//////////                                 //////////
//////////      ZodDiscriminatedUnion      //////////
//////////                                 //////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
const getDiscriminator$1 = (type) => {
    if (type instanceof ZodLazy$1) {
        return getDiscriminator$1(type.schema);
    }
    else if (type instanceof ZodEffects$1) {
        return getDiscriminator$1(type.innerType());
    }
    else if (type instanceof ZodLiteral$1) {
        return [type.value];
    }
    else if (type instanceof ZodEnum$1) {
        return type.options;
    }
    else if (type instanceof ZodNativeEnum$1) {
        // eslint-disable-next-line ban/ban
        return util$1.objectValues(type.enum);
    }
    else if (type instanceof ZodDefault$1) {
        return getDiscriminator$1(type._def.innerType);
    }
    else if (type instanceof ZodUndefined$1) {
        return [undefined];
    }
    else if (type instanceof ZodNull$1) {
        return [null];
    }
    else if (type instanceof ZodOptional$1) {
        return [undefined, ...getDiscriminator$1(type.unwrap())];
    }
    else if (type instanceof ZodNullable$1) {
        return [null, ...getDiscriminator$1(type.unwrap())];
    }
    else if (type instanceof ZodBranded$1) {
        return getDiscriminator$1(type.unwrap());
    }
    else if (type instanceof ZodReadonly$1) {
        return getDiscriminator$1(type.unwrap());
    }
    else if (type instanceof ZodCatch$1) {
        return getDiscriminator$1(type._def.innerType);
    }
    else {
        return [];
    }
};
let ZodDiscriminatedUnion$1 = class ZodDiscriminatedUnion extends ZodType$1 {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType$1.object) {
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.object,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        const discriminator = this.discriminator;
        const discriminatorValue = ctx.data[discriminator];
        const option = this.optionsMap.get(discriminatorValue);
        if (!option) {
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_union_discriminator,
                options: Array.from(this.optionsMap.keys()),
                path: [discriminator],
            });
            return INVALID$1;
        }
        if (ctx.common.async) {
            return option._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
        }
        else {
            return option._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
        }
    }
    get discriminator() {
        return this._def.discriminator;
    }
    get options() {
        return this._def.options;
    }
    get optionsMap() {
        return this._def.optionsMap;
    }
    /**
     * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
     * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
     * have a different value for each object in the union.
     * @param discriminator the name of the discriminator property
     * @param types an array of object schemas
     * @param params
     */
    static create(discriminator, options, params) {
        // Get all the valid discriminator values
        const optionsMap = new Map();
        // try {
        for (const type of options) {
            const discriminatorValues = getDiscriminator$1(type.shape[discriminator]);
            if (!discriminatorValues.length) {
                throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
            }
            for (const value of discriminatorValues) {
                if (optionsMap.has(value)) {
                    throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
                }
                optionsMap.set(value, type);
            }
        }
        return new ZodDiscriminatedUnion({
            typeName: ZodFirstPartyTypeKind$1.ZodDiscriminatedUnion,
            discriminator,
            options,
            optionsMap,
            ...processCreateParams$1(params),
        });
    }
};
function mergeValues$1(a, b) {
    const aType = getParsedType$1(a);
    const bType = getParsedType$1(b);
    if (a === b) {
        return { valid: true, data: a };
    }
    else if (aType === ZodParsedType$1.object && bType === ZodParsedType$1.object) {
        const bKeys = util$1.objectKeys(b);
        const sharedKeys = util$1
            .objectKeys(a)
            .filter((key) => bKeys.indexOf(key) !== -1);
        const newObj = { ...a, ...b };
        for (const key of sharedKeys) {
            const sharedValue = mergeValues$1(a[key], b[key]);
            if (!sharedValue.valid) {
                return { valid: false };
            }
            newObj[key] = sharedValue.data;
        }
        return { valid: true, data: newObj };
    }
    else if (aType === ZodParsedType$1.array && bType === ZodParsedType$1.array) {
        if (a.length !== b.length) {
            return { valid: false };
        }
        const newArray = [];
        for (let index = 0; index < a.length; index++) {
            const itemA = a[index];
            const itemB = b[index];
            const sharedValue = mergeValues$1(itemA, itemB);
            if (!sharedValue.valid) {
                return { valid: false };
            }
            newArray.push(sharedValue.data);
        }
        return { valid: true, data: newArray };
    }
    else if (aType === ZodParsedType$1.date &&
        bType === ZodParsedType$1.date &&
        +a === +b) {
        return { valid: true, data: a };
    }
    else {
        return { valid: false };
    }
}
let ZodIntersection$1 = class ZodIntersection extends ZodType$1 {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const handleParsed = (parsedLeft, parsedRight) => {
            if (isAborted$1(parsedLeft) || isAborted$1(parsedRight)) {
                return INVALID$1;
            }
            const merged = mergeValues$1(parsedLeft.value, parsedRight.value);
            if (!merged.valid) {
                addIssueToContext$1(ctx, {
                    code: ZodIssueCode$1.invalid_intersection_types,
                });
                return INVALID$1;
            }
            if (isDirty$1(parsedLeft) || isDirty$1(parsedRight)) {
                status.dirty();
            }
            return { status: status.value, value: merged.data };
        };
        if (ctx.common.async) {
            return Promise.all([
                this._def.left._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                }),
                this._def.right._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                }),
            ]).then(([left, right]) => handleParsed(left, right));
        }
        else {
            return handleParsed(this._def.left._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            }), this._def.right._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            }));
        }
    }
};
ZodIntersection$1.create = (left, right, params) => {
    return new ZodIntersection$1({
        left: left,
        right: right,
        typeName: ZodFirstPartyTypeKind$1.ZodIntersection,
        ...processCreateParams$1(params),
    });
};
let ZodTuple$1 = class ZodTuple extends ZodType$1 {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType$1.array) {
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.array,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        if (ctx.data.length < this._def.items.length) {
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.too_small,
                minimum: this._def.items.length,
                inclusive: true,
                exact: false,
                type: "array",
            });
            return INVALID$1;
        }
        const rest = this._def.rest;
        if (!rest && ctx.data.length > this._def.items.length) {
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.too_big,
                maximum: this._def.items.length,
                inclusive: true,
                exact: false,
                type: "array",
            });
            status.dirty();
        }
        const items = [...ctx.data]
            .map((item, itemIndex) => {
            const schema = this._def.items[itemIndex] || this._def.rest;
            if (!schema)
                return null;
            return schema._parse(new ParseInputLazyPath$1(ctx, item, ctx.path, itemIndex));
        })
            .filter((x) => !!x); // filter nulls
        if (ctx.common.async) {
            return Promise.all(items).then((results) => {
                return ParseStatus$1.mergeArray(status, results);
            });
        }
        else {
            return ParseStatus$1.mergeArray(status, items);
        }
    }
    get items() {
        return this._def.items;
    }
    rest(rest) {
        return new ZodTuple({
            ...this._def,
            rest,
        });
    }
};
ZodTuple$1.create = (schemas, params) => {
    if (!Array.isArray(schemas)) {
        throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    }
    return new ZodTuple$1({
        items: schemas,
        typeName: ZodFirstPartyTypeKind$1.ZodTuple,
        rest: null,
        ...processCreateParams$1(params),
    });
};
let ZodRecord$1 = class ZodRecord extends ZodType$1 {
    get keySchema() {
        return this._def.keyType;
    }
    get valueSchema() {
        return this._def.valueType;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType$1.object) {
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.object,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        const pairs = [];
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        for (const key in ctx.data) {
            pairs.push({
                key: keyType._parse(new ParseInputLazyPath$1(ctx, key, ctx.path, key)),
                value: valueType._parse(new ParseInputLazyPath$1(ctx, ctx.data[key], ctx.path, key)),
                alwaysSet: key in ctx.data,
            });
        }
        if (ctx.common.async) {
            return ParseStatus$1.mergeObjectAsync(status, pairs);
        }
        else {
            return ParseStatus$1.mergeObjectSync(status, pairs);
        }
    }
    get element() {
        return this._def.valueType;
    }
    static create(first, second, third) {
        if (second instanceof ZodType$1) {
            return new ZodRecord({
                keyType: first,
                valueType: second,
                typeName: ZodFirstPartyTypeKind$1.ZodRecord,
                ...processCreateParams$1(third),
            });
        }
        return new ZodRecord({
            keyType: ZodString$1.create(),
            valueType: first,
            typeName: ZodFirstPartyTypeKind$1.ZodRecord,
            ...processCreateParams$1(second),
        });
    }
};
let ZodMap$1 = class ZodMap extends ZodType$1 {
    get keySchema() {
        return this._def.keyType;
    }
    get valueSchema() {
        return this._def.valueType;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType$1.map) {
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.map,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        const pairs = [...ctx.data.entries()].map(([key, value], index) => {
            return {
                key: keyType._parse(new ParseInputLazyPath$1(ctx, key, ctx.path, [index, "key"])),
                value: valueType._parse(new ParseInputLazyPath$1(ctx, value, ctx.path, [index, "value"])),
            };
        });
        if (ctx.common.async) {
            const finalMap = new Map();
            return Promise.resolve().then(async () => {
                for (const pair of pairs) {
                    const key = await pair.key;
                    const value = await pair.value;
                    if (key.status === "aborted" || value.status === "aborted") {
                        return INVALID$1;
                    }
                    if (key.status === "dirty" || value.status === "dirty") {
                        status.dirty();
                    }
                    finalMap.set(key.value, value.value);
                }
                return { status: status.value, value: finalMap };
            });
        }
        else {
            const finalMap = new Map();
            for (const pair of pairs) {
                const key = pair.key;
                const value = pair.value;
                if (key.status === "aborted" || value.status === "aborted") {
                    return INVALID$1;
                }
                if (key.status === "dirty" || value.status === "dirty") {
                    status.dirty();
                }
                finalMap.set(key.value, value.value);
            }
            return { status: status.value, value: finalMap };
        }
    }
};
ZodMap$1.create = (keyType, valueType, params) => {
    return new ZodMap$1({
        valueType,
        keyType,
        typeName: ZodFirstPartyTypeKind$1.ZodMap,
        ...processCreateParams$1(params),
    });
};
let ZodSet$1 = class ZodSet extends ZodType$1 {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType$1.set) {
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.set,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        const def = this._def;
        if (def.minSize !== null) {
            if (ctx.data.size < def.minSize.value) {
                addIssueToContext$1(ctx, {
                    code: ZodIssueCode$1.too_small,
                    minimum: def.minSize.value,
                    type: "set",
                    inclusive: true,
                    exact: false,
                    message: def.minSize.message,
                });
                status.dirty();
            }
        }
        if (def.maxSize !== null) {
            if (ctx.data.size > def.maxSize.value) {
                addIssueToContext$1(ctx, {
                    code: ZodIssueCode$1.too_big,
                    maximum: def.maxSize.value,
                    type: "set",
                    inclusive: true,
                    exact: false,
                    message: def.maxSize.message,
                });
                status.dirty();
            }
        }
        const valueType = this._def.valueType;
        function finalizeSet(elements) {
            const parsedSet = new Set();
            for (const element of elements) {
                if (element.status === "aborted")
                    return INVALID$1;
                if (element.status === "dirty")
                    status.dirty();
                parsedSet.add(element.value);
            }
            return { status: status.value, value: parsedSet };
        }
        const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath$1(ctx, item, ctx.path, i)));
        if (ctx.common.async) {
            return Promise.all(elements).then((elements) => finalizeSet(elements));
        }
        else {
            return finalizeSet(elements);
        }
    }
    min(minSize, message) {
        return new ZodSet({
            ...this._def,
            minSize: { value: minSize, message: errorUtil$1.toString(message) },
        });
    }
    max(maxSize, message) {
        return new ZodSet({
            ...this._def,
            maxSize: { value: maxSize, message: errorUtil$1.toString(message) },
        });
    }
    size(size, message) {
        return this.min(size, message).max(size, message);
    }
    nonempty(message) {
        return this.min(1, message);
    }
};
ZodSet$1.create = (valueType, params) => {
    return new ZodSet$1({
        valueType,
        minSize: null,
        maxSize: null,
        typeName: ZodFirstPartyTypeKind$1.ZodSet,
        ...processCreateParams$1(params),
    });
};
class ZodFunction extends ZodType$1 {
    constructor() {
        super(...arguments);
        this.validate = this.implement;
    }
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType$1.function) {
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.function,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        function makeArgsIssue(args, error) {
            return makeIssue$1({
                data: args,
                path: ctx.path,
                errorMaps: [
                    ctx.common.contextualErrorMap,
                    ctx.schemaErrorMap,
                    getErrorMap$1(),
                    errorMap$1,
                ].filter((x) => !!x),
                issueData: {
                    code: ZodIssueCode$1.invalid_arguments,
                    argumentsError: error,
                },
            });
        }
        function makeReturnsIssue(returns, error) {
            return makeIssue$1({
                data: returns,
                path: ctx.path,
                errorMaps: [
                    ctx.common.contextualErrorMap,
                    ctx.schemaErrorMap,
                    getErrorMap$1(),
                    errorMap$1,
                ].filter((x) => !!x),
                issueData: {
                    code: ZodIssueCode$1.invalid_return_type,
                    returnTypeError: error,
                },
            });
        }
        const params = { errorMap: ctx.common.contextualErrorMap };
        const fn = ctx.data;
        if (this._def.returns instanceof ZodPromise$1) {
            // Would love a way to avoid disabling this rule, but we need
            // an alias (using an arrow function was what caused 2651).
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const me = this;
            return OK$1(async function (...args) {
                const error = new ZodError$1([]);
                const parsedArgs = await me._def.args
                    .parseAsync(args, params)
                    .catch((e) => {
                    error.addIssue(makeArgsIssue(args, e));
                    throw error;
                });
                const result = await Reflect.apply(fn, this, parsedArgs);
                const parsedReturns = await me._def.returns._def.type
                    .parseAsync(result, params)
                    .catch((e) => {
                    error.addIssue(makeReturnsIssue(result, e));
                    throw error;
                });
                return parsedReturns;
            });
        }
        else {
            // Would love a way to avoid disabling this rule, but we need
            // an alias (using an arrow function was what caused 2651).
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const me = this;
            return OK$1(function (...args) {
                const parsedArgs = me._def.args.safeParse(args, params);
                if (!parsedArgs.success) {
                    throw new ZodError$1([makeArgsIssue(args, parsedArgs.error)]);
                }
                const result = Reflect.apply(fn, this, parsedArgs.data);
                const parsedReturns = me._def.returns.safeParse(result, params);
                if (!parsedReturns.success) {
                    throw new ZodError$1([makeReturnsIssue(result, parsedReturns.error)]);
                }
                return parsedReturns.data;
            });
        }
    }
    parameters() {
        return this._def.args;
    }
    returnType() {
        return this._def.returns;
    }
    args(...items) {
        return new ZodFunction({
            ...this._def,
            args: ZodTuple$1.create(items).rest(ZodUnknown$1.create()),
        });
    }
    returns(returnType) {
        return new ZodFunction({
            ...this._def,
            returns: returnType,
        });
    }
    implement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
    }
    strictImplement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
    }
    static create(args, returns, params) {
        return new ZodFunction({
            args: (args
                ? args
                : ZodTuple$1.create([]).rest(ZodUnknown$1.create())),
            returns: returns || ZodUnknown$1.create(),
            typeName: ZodFirstPartyTypeKind$1.ZodFunction,
            ...processCreateParams$1(params),
        });
    }
}
let ZodLazy$1 = class ZodLazy extends ZodType$1 {
    get schema() {
        return this._def.getter();
    }
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const lazySchema = this._def.getter();
        return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
    }
};
ZodLazy$1.create = (getter, params) => {
    return new ZodLazy$1({
        getter: getter,
        typeName: ZodFirstPartyTypeKind$1.ZodLazy,
        ...processCreateParams$1(params),
    });
};
let ZodLiteral$1 = class ZodLiteral extends ZodType$1 {
    _parse(input) {
        if (input.data !== this._def.value) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$1(ctx, {
                received: ctx.data,
                code: ZodIssueCode$1.invalid_literal,
                expected: this._def.value,
            });
            return INVALID$1;
        }
        return { status: "valid", value: input.data };
    }
    get value() {
        return this._def.value;
    }
};
ZodLiteral$1.create = (value, params) => {
    return new ZodLiteral$1({
        value: value,
        typeName: ZodFirstPartyTypeKind$1.ZodLiteral,
        ...processCreateParams$1(params),
    });
};
function createZodEnum$1(values, params) {
    return new ZodEnum$1({
        values,
        typeName: ZodFirstPartyTypeKind$1.ZodEnum,
        ...processCreateParams$1(params),
    });
}
let ZodEnum$1 = class ZodEnum extends ZodType$1 {
    constructor() {
        super(...arguments);
        _ZodEnum_cache.set(this, void 0);
    }
    _parse(input) {
        if (typeof input.data !== "string") {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext$1(ctx, {
                expected: util$1.joinValues(expectedValues),
                received: ctx.parsedType,
                code: ZodIssueCode$1.invalid_type,
            });
            return INVALID$1;
        }
        if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f")) {
            __classPrivateFieldSet(this, _ZodEnum_cache, new Set(this._def.values), "f");
        }
        if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f").has(input.data)) {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext$1(ctx, {
                received: ctx.data,
                code: ZodIssueCode$1.invalid_enum_value,
                options: expectedValues,
            });
            return INVALID$1;
        }
        return OK$1(input.data);
    }
    get options() {
        return this._def.values;
    }
    get enum() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    get Values() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    get Enum() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    extract(values, newDef = this._def) {
        return ZodEnum.create(values, {
            ...this._def,
            ...newDef,
        });
    }
    exclude(values, newDef = this._def) {
        return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
            ...this._def,
            ...newDef,
        });
    }
};
_ZodEnum_cache = new WeakMap();
ZodEnum$1.create = createZodEnum$1;
let ZodNativeEnum$1 = class ZodNativeEnum extends ZodType$1 {
    constructor() {
        super(...arguments);
        _ZodNativeEnum_cache.set(this, void 0);
    }
    _parse(input) {
        const nativeEnumValues = util$1.getValidEnumValues(this._def.values);
        const ctx = this._getOrReturnCtx(input);
        if (ctx.parsedType !== ZodParsedType$1.string &&
            ctx.parsedType !== ZodParsedType$1.number) {
            const expectedValues = util$1.objectValues(nativeEnumValues);
            addIssueToContext$1(ctx, {
                expected: util$1.joinValues(expectedValues),
                received: ctx.parsedType,
                code: ZodIssueCode$1.invalid_type,
            });
            return INVALID$1;
        }
        if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f")) {
            __classPrivateFieldSet(this, _ZodNativeEnum_cache, new Set(util$1.getValidEnumValues(this._def.values)), "f");
        }
        if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f").has(input.data)) {
            const expectedValues = util$1.objectValues(nativeEnumValues);
            addIssueToContext$1(ctx, {
                received: ctx.data,
                code: ZodIssueCode$1.invalid_enum_value,
                options: expectedValues,
            });
            return INVALID$1;
        }
        return OK$1(input.data);
    }
    get enum() {
        return this._def.values;
    }
};
_ZodNativeEnum_cache = new WeakMap();
ZodNativeEnum$1.create = (values, params) => {
    return new ZodNativeEnum$1({
        values: values,
        typeName: ZodFirstPartyTypeKind$1.ZodNativeEnum,
        ...processCreateParams$1(params),
    });
};
let ZodPromise$1 = class ZodPromise extends ZodType$1 {
    unwrap() {
        return this._def.type;
    }
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType$1.promise &&
            ctx.common.async === false) {
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.promise,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        const promisified = ctx.parsedType === ZodParsedType$1.promise
            ? ctx.data
            : Promise.resolve(ctx.data);
        return OK$1(promisified.then((data) => {
            return this._def.type.parseAsync(data, {
                path: ctx.path,
                errorMap: ctx.common.contextualErrorMap,
            });
        }));
    }
};
ZodPromise$1.create = (schema, params) => {
    return new ZodPromise$1({
        type: schema,
        typeName: ZodFirstPartyTypeKind$1.ZodPromise,
        ...processCreateParams$1(params),
    });
};
let ZodEffects$1 = class ZodEffects extends ZodType$1 {
    innerType() {
        return this._def.schema;
    }
    sourceType() {
        return this._def.schema._def.typeName === ZodFirstPartyTypeKind$1.ZodEffects
            ? this._def.schema.sourceType()
            : this._def.schema;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const effect = this._def.effect || null;
        const checkCtx = {
            addIssue: (arg) => {
                addIssueToContext$1(ctx, arg);
                if (arg.fatal) {
                    status.abort();
                }
                else {
                    status.dirty();
                }
            },
            get path() {
                return ctx.path;
            },
        };
        checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
        if (effect.type === "preprocess") {
            const processed = effect.transform(ctx.data, checkCtx);
            if (ctx.common.async) {
                return Promise.resolve(processed).then(async (processed) => {
                    if (status.value === "aborted")
                        return INVALID$1;
                    const result = await this._def.schema._parseAsync({
                        data: processed,
                        path: ctx.path,
                        parent: ctx,
                    });
                    if (result.status === "aborted")
                        return INVALID$1;
                    if (result.status === "dirty")
                        return DIRTY$1(result.value);
                    if (status.value === "dirty")
                        return DIRTY$1(result.value);
                    return result;
                });
            }
            else {
                if (status.value === "aborted")
                    return INVALID$1;
                const result = this._def.schema._parseSync({
                    data: processed,
                    path: ctx.path,
                    parent: ctx,
                });
                if (result.status === "aborted")
                    return INVALID$1;
                if (result.status === "dirty")
                    return DIRTY$1(result.value);
                if (status.value === "dirty")
                    return DIRTY$1(result.value);
                return result;
            }
        }
        if (effect.type === "refinement") {
            const executeRefinement = (acc) => {
                const result = effect.refinement(acc, checkCtx);
                if (ctx.common.async) {
                    return Promise.resolve(result);
                }
                if (result instanceof Promise) {
                    throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
                }
                return acc;
            };
            if (ctx.common.async === false) {
                const inner = this._def.schema._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (inner.status === "aborted")
                    return INVALID$1;
                if (inner.status === "dirty")
                    status.dirty();
                // return value is ignored
                executeRefinement(inner.value);
                return { status: status.value, value: inner.value };
            }
            else {
                return this._def.schema
                    ._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx })
                    .then((inner) => {
                    if (inner.status === "aborted")
                        return INVALID$1;
                    if (inner.status === "dirty")
                        status.dirty();
                    return executeRefinement(inner.value).then(() => {
                        return { status: status.value, value: inner.value };
                    });
                });
            }
        }
        if (effect.type === "transform") {
            if (ctx.common.async === false) {
                const base = this._def.schema._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (!isValid$1(base))
                    return base;
                const result = effect.transform(base.value, checkCtx);
                if (result instanceof Promise) {
                    throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
                }
                return { status: status.value, value: result };
            }
            else {
                return this._def.schema
                    ._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx })
                    .then((base) => {
                    if (!isValid$1(base))
                        return base;
                    return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({ status: status.value, value: result }));
                });
            }
        }
        util$1.assertNever(effect);
    }
};
ZodEffects$1.create = (schema, effect, params) => {
    return new ZodEffects$1({
        schema,
        typeName: ZodFirstPartyTypeKind$1.ZodEffects,
        effect,
        ...processCreateParams$1(params),
    });
};
ZodEffects$1.createWithPreprocess = (preprocess, schema, params) => {
    return new ZodEffects$1({
        schema,
        effect: { type: "preprocess", transform: preprocess },
        typeName: ZodFirstPartyTypeKind$1.ZodEffects,
        ...processCreateParams$1(params),
    });
};
let ZodOptional$1 = class ZodOptional extends ZodType$1 {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType$1.undefined) {
            return OK$1(undefined);
        }
        return this._def.innerType._parse(input);
    }
    unwrap() {
        return this._def.innerType;
    }
};
ZodOptional$1.create = (type, params) => {
    return new ZodOptional$1({
        innerType: type,
        typeName: ZodFirstPartyTypeKind$1.ZodOptional,
        ...processCreateParams$1(params),
    });
};
let ZodNullable$1 = class ZodNullable extends ZodType$1 {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType$1.null) {
            return OK$1(null);
        }
        return this._def.innerType._parse(input);
    }
    unwrap() {
        return this._def.innerType;
    }
};
ZodNullable$1.create = (type, params) => {
    return new ZodNullable$1({
        innerType: type,
        typeName: ZodFirstPartyTypeKind$1.ZodNullable,
        ...processCreateParams$1(params),
    });
};
let ZodDefault$1 = class ZodDefault extends ZodType$1 {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        let data = ctx.data;
        if (ctx.parsedType === ZodParsedType$1.undefined) {
            data = this._def.defaultValue();
        }
        return this._def.innerType._parse({
            data,
            path: ctx.path,
            parent: ctx,
        });
    }
    removeDefault() {
        return this._def.innerType;
    }
};
ZodDefault$1.create = (type, params) => {
    return new ZodDefault$1({
        innerType: type,
        typeName: ZodFirstPartyTypeKind$1.ZodDefault,
        defaultValue: typeof params.default === "function"
            ? params.default
            : () => params.default,
        ...processCreateParams$1(params),
    });
};
let ZodCatch$1 = class ZodCatch extends ZodType$1 {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        // newCtx is used to not collect issues from inner types in ctx
        const newCtx = {
            ...ctx,
            common: {
                ...ctx.common,
                issues: [],
            },
        };
        const result = this._def.innerType._parse({
            data: newCtx.data,
            path: newCtx.path,
            parent: {
                ...newCtx,
            },
        });
        if (isAsync$1(result)) {
            return result.then((result) => {
                return {
                    status: "valid",
                    value: result.status === "valid"
                        ? result.value
                        : this._def.catchValue({
                            get error() {
                                return new ZodError$1(newCtx.common.issues);
                            },
                            input: newCtx.data,
                        }),
                };
            });
        }
        else {
            return {
                status: "valid",
                value: result.status === "valid"
                    ? result.value
                    : this._def.catchValue({
                        get error() {
                            return new ZodError$1(newCtx.common.issues);
                        },
                        input: newCtx.data,
                    }),
            };
        }
    }
    removeCatch() {
        return this._def.innerType;
    }
};
ZodCatch$1.create = (type, params) => {
    return new ZodCatch$1({
        innerType: type,
        typeName: ZodFirstPartyTypeKind$1.ZodCatch,
        catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
        ...processCreateParams$1(params),
    });
};
let ZodNaN$1 = class ZodNaN extends ZodType$1 {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType$1.nan) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext$1(ctx, {
                code: ZodIssueCode$1.invalid_type,
                expected: ZodParsedType$1.nan,
                received: ctx.parsedType,
            });
            return INVALID$1;
        }
        return { status: "valid", value: input.data };
    }
};
ZodNaN$1.create = (params) => {
    return new ZodNaN$1({
        typeName: ZodFirstPartyTypeKind$1.ZodNaN,
        ...processCreateParams$1(params),
    });
};
const BRAND = Symbol("zod_brand");
let ZodBranded$1 = class ZodBranded extends ZodType$1 {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const data = ctx.data;
        return this._def.type._parse({
            data,
            path: ctx.path,
            parent: ctx,
        });
    }
    unwrap() {
        return this._def.type;
    }
};
let ZodPipeline$1 = class ZodPipeline extends ZodType$1 {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.common.async) {
            const handleAsync = async () => {
                const inResult = await this._def.in._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (inResult.status === "aborted")
                    return INVALID$1;
                if (inResult.status === "dirty") {
                    status.dirty();
                    return DIRTY$1(inResult.value);
                }
                else {
                    return this._def.out._parseAsync({
                        data: inResult.value,
                        path: ctx.path,
                        parent: ctx,
                    });
                }
            };
            return handleAsync();
        }
        else {
            const inResult = this._def.in._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
            if (inResult.status === "aborted")
                return INVALID$1;
            if (inResult.status === "dirty") {
                status.dirty();
                return {
                    status: "dirty",
                    value: inResult.value,
                };
            }
            else {
                return this._def.out._parseSync({
                    data: inResult.value,
                    path: ctx.path,
                    parent: ctx,
                });
            }
        }
    }
    static create(a, b) {
        return new ZodPipeline({
            in: a,
            out: b,
            typeName: ZodFirstPartyTypeKind$1.ZodPipeline,
        });
    }
};
let ZodReadonly$1 = class ZodReadonly extends ZodType$1 {
    _parse(input) {
        const result = this._def.innerType._parse(input);
        const freeze = (data) => {
            if (isValid$1(data)) {
                data.value = Object.freeze(data.value);
            }
            return data;
        };
        return isAsync$1(result)
            ? result.then((data) => freeze(data))
            : freeze(result);
    }
    unwrap() {
        return this._def.innerType;
    }
};
ZodReadonly$1.create = (type, params) => {
    return new ZodReadonly$1({
        innerType: type,
        typeName: ZodFirstPartyTypeKind$1.ZodReadonly,
        ...processCreateParams$1(params),
    });
};
////////////////////////////////////////
////////////////////////////////////////
//////////                    //////////
//////////      z.custom      //////////
//////////                    //////////
////////////////////////////////////////
////////////////////////////////////////
function cleanParams(params, data) {
    const p = typeof params === "function"
        ? params(data)
        : typeof params === "string"
            ? { message: params }
            : params;
    const p2 = typeof p === "string" ? { message: p } : p;
    return p2;
}
function custom(check, _params = {}, 
/**
 * @deprecated
 *
 * Pass `fatal` into the params object instead:
 *
 * ```ts
 * z.string().custom((val) => val.length > 5, { fatal: false })
 * ```
 *
 */
fatal) {
    if (check)
        return ZodAny$1.create().superRefine((data, ctx) => {
            var _a, _b;
            const r = check(data);
            if (r instanceof Promise) {
                return r.then((r) => {
                    var _a, _b;
                    if (!r) {
                        const params = cleanParams(_params, data);
                        const _fatal = (_b = (_a = params.fatal) !== null && _a !== void 0 ? _a : fatal) !== null && _b !== void 0 ? _b : true;
                        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
                    }
                });
            }
            if (!r) {
                const params = cleanParams(_params, data);
                const _fatal = (_b = (_a = params.fatal) !== null && _a !== void 0 ? _a : fatal) !== null && _b !== void 0 ? _b : true;
                ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
            }
            return;
        });
    return ZodAny$1.create();
}
const late = {
    object: ZodObject$1.lazycreate,
};
var ZodFirstPartyTypeKind$1;
(function (ZodFirstPartyTypeKind) {
    ZodFirstPartyTypeKind["ZodString"] = "ZodString";
    ZodFirstPartyTypeKind["ZodNumber"] = "ZodNumber";
    ZodFirstPartyTypeKind["ZodNaN"] = "ZodNaN";
    ZodFirstPartyTypeKind["ZodBigInt"] = "ZodBigInt";
    ZodFirstPartyTypeKind["ZodBoolean"] = "ZodBoolean";
    ZodFirstPartyTypeKind["ZodDate"] = "ZodDate";
    ZodFirstPartyTypeKind["ZodSymbol"] = "ZodSymbol";
    ZodFirstPartyTypeKind["ZodUndefined"] = "ZodUndefined";
    ZodFirstPartyTypeKind["ZodNull"] = "ZodNull";
    ZodFirstPartyTypeKind["ZodAny"] = "ZodAny";
    ZodFirstPartyTypeKind["ZodUnknown"] = "ZodUnknown";
    ZodFirstPartyTypeKind["ZodNever"] = "ZodNever";
    ZodFirstPartyTypeKind["ZodVoid"] = "ZodVoid";
    ZodFirstPartyTypeKind["ZodArray"] = "ZodArray";
    ZodFirstPartyTypeKind["ZodObject"] = "ZodObject";
    ZodFirstPartyTypeKind["ZodUnion"] = "ZodUnion";
    ZodFirstPartyTypeKind["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
    ZodFirstPartyTypeKind["ZodIntersection"] = "ZodIntersection";
    ZodFirstPartyTypeKind["ZodTuple"] = "ZodTuple";
    ZodFirstPartyTypeKind["ZodRecord"] = "ZodRecord";
    ZodFirstPartyTypeKind["ZodMap"] = "ZodMap";
    ZodFirstPartyTypeKind["ZodSet"] = "ZodSet";
    ZodFirstPartyTypeKind["ZodFunction"] = "ZodFunction";
    ZodFirstPartyTypeKind["ZodLazy"] = "ZodLazy";
    ZodFirstPartyTypeKind["ZodLiteral"] = "ZodLiteral";
    ZodFirstPartyTypeKind["ZodEnum"] = "ZodEnum";
    ZodFirstPartyTypeKind["ZodEffects"] = "ZodEffects";
    ZodFirstPartyTypeKind["ZodNativeEnum"] = "ZodNativeEnum";
    ZodFirstPartyTypeKind["ZodOptional"] = "ZodOptional";
    ZodFirstPartyTypeKind["ZodNullable"] = "ZodNullable";
    ZodFirstPartyTypeKind["ZodDefault"] = "ZodDefault";
    ZodFirstPartyTypeKind["ZodCatch"] = "ZodCatch";
    ZodFirstPartyTypeKind["ZodPromise"] = "ZodPromise";
    ZodFirstPartyTypeKind["ZodBranded"] = "ZodBranded";
    ZodFirstPartyTypeKind["ZodPipeline"] = "ZodPipeline";
    ZodFirstPartyTypeKind["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind$1 || (ZodFirstPartyTypeKind$1 = {}));
const instanceOfType = (
// const instanceOfType = <T extends new (...args: any[]) => any>(
cls, params = {
    message: `Input not instance of ${cls.name}`,
}) => custom((data) => data instanceof cls, params);
const stringType$1 = ZodString$1.create;
const numberType$1 = ZodNumber$1.create;
const nanType = ZodNaN$1.create;
const bigIntType = ZodBigInt$1.create;
const booleanType$1 = ZodBoolean$1.create;
const dateType$1 = ZodDate$1.create;
const symbolType = ZodSymbol$1.create;
const undefinedType = ZodUndefined$1.create;
const nullType = ZodNull$1.create;
const anyType = ZodAny$1.create;
const unknownType$1 = ZodUnknown$1.create;
const neverType = ZodNever$1.create;
const voidType = ZodVoid$1.create;
const arrayType$1 = ZodArray$1.create;
const objectType$1 = ZodObject$1.create;
const strictObjectType = ZodObject$1.strictCreate;
const unionType = ZodUnion$1.create;
const discriminatedUnionType$1 = ZodDiscriminatedUnion$1.create;
const intersectionType = ZodIntersection$1.create;
const tupleType = ZodTuple$1.create;
const recordType$1 = ZodRecord$1.create;
const mapType = ZodMap$1.create;
const setType = ZodSet$1.create;
const functionType = ZodFunction.create;
const lazyType = ZodLazy$1.create;
const literalType$1 = ZodLiteral$1.create;
const enumType$1 = ZodEnum$1.create;
const nativeEnumType = ZodNativeEnum$1.create;
const promiseType = ZodPromise$1.create;
const effectsType = ZodEffects$1.create;
const optionalType = ZodOptional$1.create;
const nullableType = ZodNullable$1.create;
const preprocessType = ZodEffects$1.createWithPreprocess;
const pipelineType = ZodPipeline$1.create;
const ostring = () => stringType$1().optional();
const onumber = () => numberType$1().optional();
const oboolean = () => booleanType$1().optional();
const coerce = {
    string: ((arg) => ZodString$1.create({ ...arg, coerce: true })),
    number: ((arg) => ZodNumber$1.create({ ...arg, coerce: true })),
    boolean: ((arg) => ZodBoolean$1.create({
        ...arg,
        coerce: true,
    })),
    bigint: ((arg) => ZodBigInt$1.create({ ...arg, coerce: true })),
    date: ((arg) => ZodDate$1.create({ ...arg, coerce: true })),
};
const NEVER = INVALID$1;

var z = /*#__PURE__*/Object.freeze({
    __proto__: null,
    defaultErrorMap: errorMap$1,
    setErrorMap: setErrorMap,
    getErrorMap: getErrorMap$1,
    makeIssue: makeIssue$1,
    EMPTY_PATH: EMPTY_PATH,
    addIssueToContext: addIssueToContext$1,
    ParseStatus: ParseStatus$1,
    INVALID: INVALID$1,
    DIRTY: DIRTY$1,
    OK: OK$1,
    isAborted: isAborted$1,
    isDirty: isDirty$1,
    isValid: isValid$1,
    isAsync: isAsync$1,
    get util () { return util$1; },
    get objectUtil () { return objectUtil$1; },
    ZodParsedType: ZodParsedType$1,
    getParsedType: getParsedType$1,
    ZodType: ZodType$1,
    datetimeRegex: datetimeRegex$1,
    ZodString: ZodString$1,
    ZodNumber: ZodNumber$1,
    ZodBigInt: ZodBigInt$1,
    ZodBoolean: ZodBoolean$1,
    ZodDate: ZodDate$1,
    ZodSymbol: ZodSymbol$1,
    ZodUndefined: ZodUndefined$1,
    ZodNull: ZodNull$1,
    ZodAny: ZodAny$1,
    ZodUnknown: ZodUnknown$1,
    ZodNever: ZodNever$1,
    ZodVoid: ZodVoid$1,
    ZodArray: ZodArray$1,
    ZodObject: ZodObject$1,
    ZodUnion: ZodUnion$1,
    ZodDiscriminatedUnion: ZodDiscriminatedUnion$1,
    ZodIntersection: ZodIntersection$1,
    ZodTuple: ZodTuple$1,
    ZodRecord: ZodRecord$1,
    ZodMap: ZodMap$1,
    ZodSet: ZodSet$1,
    ZodFunction: ZodFunction,
    ZodLazy: ZodLazy$1,
    ZodLiteral: ZodLiteral$1,
    ZodEnum: ZodEnum$1,
    ZodNativeEnum: ZodNativeEnum$1,
    ZodPromise: ZodPromise$1,
    ZodEffects: ZodEffects$1,
    ZodTransformer: ZodEffects$1,
    ZodOptional: ZodOptional$1,
    ZodNullable: ZodNullable$1,
    ZodDefault: ZodDefault$1,
    ZodCatch: ZodCatch$1,
    ZodNaN: ZodNaN$1,
    BRAND: BRAND,
    ZodBranded: ZodBranded$1,
    ZodPipeline: ZodPipeline$1,
    ZodReadonly: ZodReadonly$1,
    custom: custom,
    Schema: ZodType$1,
    ZodSchema: ZodType$1,
    late: late,
    get ZodFirstPartyTypeKind () { return ZodFirstPartyTypeKind$1; },
    coerce: coerce,
    any: anyType,
    array: arrayType$1,
    bigint: bigIntType,
    boolean: booleanType$1,
    date: dateType$1,
    discriminatedUnion: discriminatedUnionType$1,
    effect: effectsType,
    'enum': enumType$1,
    'function': functionType,
    'instanceof': instanceOfType,
    intersection: intersectionType,
    lazy: lazyType,
    literal: literalType$1,
    map: mapType,
    nan: nanType,
    nativeEnum: nativeEnumType,
    never: neverType,
    'null': nullType,
    nullable: nullableType,
    number: numberType$1,
    object: objectType$1,
    oboolean: oboolean,
    onumber: onumber,
    optional: optionalType,
    ostring: ostring,
    pipeline: pipelineType,
    preprocess: preprocessType,
    promise: promiseType,
    record: recordType$1,
    set: setType,
    strictObject: strictObjectType,
    string: stringType$1,
    symbol: symbolType,
    transformer: effectsType,
    tuple: tupleType,
    'undefined': undefinedType,
    union: unionType,
    unknown: unknownType$1,
    'void': voidType,
    NEVER: NEVER,
    ZodIssueCode: ZodIssueCode$1,
    quotelessJson: quotelessJson,
    ZodError: ZodError$1
});

var util;
(function (util) {
    util.assertEqual = (_) => { };
    function assertIs(_arg) { }
    util.assertIs = assertIs;
    function assertNever(_x) {
        throw new Error();
    }
    util.assertNever = assertNever;
    util.arrayToEnum = (items) => {
        const obj = {};
        for (const item of items) {
            obj[item] = item;
        }
        return obj;
    };
    util.getValidEnumValues = (obj) => {
        const validKeys = util.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
        const filtered = {};
        for (const k of validKeys) {
            filtered[k] = obj[k];
        }
        return util.objectValues(filtered);
    };
    util.objectValues = (obj) => {
        return util.objectKeys(obj).map(function (e) {
            return obj[e];
        });
    };
    util.objectKeys = typeof Object.keys === "function" // eslint-disable-line ban/ban
        ? (obj) => Object.keys(obj) // eslint-disable-line ban/ban
        : (object) => {
            const keys = [];
            for (const key in object) {
                if (Object.prototype.hasOwnProperty.call(object, key)) {
                    keys.push(key);
                }
            }
            return keys;
        };
    util.find = (arr, checker) => {
        for (const item of arr) {
            if (checker(item))
                return item;
        }
        return undefined;
    };
    util.isInteger = typeof Number.isInteger === "function"
        ? (val) => Number.isInteger(val) // eslint-disable-line ban/ban
        : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
    function joinValues(array, separator = " | ") {
        return array.map((val) => (typeof val === "string" ? `'${val}'` : val)).join(separator);
    }
    util.joinValues = joinValues;
    util.jsonStringifyReplacer = (_, value) => {
        if (typeof value === "bigint") {
            return value.toString();
        }
        return value;
    };
})(util || (util = {}));
var objectUtil;
(function (objectUtil) {
    objectUtil.mergeShapes = (first, second) => {
        return {
            ...first,
            ...second, // second overwrites first
        };
    };
})(objectUtil || (objectUtil = {}));
const ZodParsedType = util.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set",
]);
const getParsedType = (data) => {
    const t = typeof data;
    switch (t) {
        case "undefined":
            return ZodParsedType.undefined;
        case "string":
            return ZodParsedType.string;
        case "number":
            return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
        case "boolean":
            return ZodParsedType.boolean;
        case "function":
            return ZodParsedType.function;
        case "bigint":
            return ZodParsedType.bigint;
        case "symbol":
            return ZodParsedType.symbol;
        case "object":
            if (Array.isArray(data)) {
                return ZodParsedType.array;
            }
            if (data === null) {
                return ZodParsedType.null;
            }
            if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
                return ZodParsedType.promise;
            }
            if (typeof Map !== "undefined" && data instanceof Map) {
                return ZodParsedType.map;
            }
            if (typeof Set !== "undefined" && data instanceof Set) {
                return ZodParsedType.set;
            }
            if (typeof Date !== "undefined" && data instanceof Date) {
                return ZodParsedType.date;
            }
            return ZodParsedType.object;
        default:
            return ZodParsedType.unknown;
    }
};

const ZodIssueCode = util.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of",
    "not_finite",
]);
class ZodError extends Error {
    get errors() {
        return this.issues;
    }
    constructor(issues) {
        super();
        this.issues = [];
        this.addIssue = (sub) => {
            this.issues = [...this.issues, sub];
        };
        this.addIssues = (subs = []) => {
            this.issues = [...this.issues, ...subs];
        };
        const actualProto = new.target.prototype;
        if (Object.setPrototypeOf) {
            // eslint-disable-next-line ban/ban
            Object.setPrototypeOf(this, actualProto);
        }
        else {
            this.__proto__ = actualProto;
        }
        this.name = "ZodError";
        this.issues = issues;
    }
    format(_mapper) {
        const mapper = _mapper ||
            function (issue) {
                return issue.message;
            };
        const fieldErrors = { _errors: [] };
        const processError = (error) => {
            for (const issue of error.issues) {
                if (issue.code === "invalid_union") {
                    issue.unionErrors.map(processError);
                }
                else if (issue.code === "invalid_return_type") {
                    processError(issue.returnTypeError);
                }
                else if (issue.code === "invalid_arguments") {
                    processError(issue.argumentsError);
                }
                else if (issue.path.length === 0) {
                    fieldErrors._errors.push(mapper(issue));
                }
                else {
                    let curr = fieldErrors;
                    let i = 0;
                    while (i < issue.path.length) {
                        const el = issue.path[i];
                        const terminal = i === issue.path.length - 1;
                        if (!terminal) {
                            curr[el] = curr[el] || { _errors: [] };
                            // if (typeof el === "string") {
                            //   curr[el] = curr[el] || { _errors: [] };
                            // } else if (typeof el === "number") {
                            //   const errorArray: any = [];
                            //   errorArray._errors = [];
                            //   curr[el] = curr[el] || errorArray;
                            // }
                        }
                        else {
                            curr[el] = curr[el] || { _errors: [] };
                            curr[el]._errors.push(mapper(issue));
                        }
                        curr = curr[el];
                        i++;
                    }
                }
            }
        };
        processError(this);
        return fieldErrors;
    }
    static assert(value) {
        if (!(value instanceof ZodError)) {
            throw new Error(`Not a ZodError: ${value}`);
        }
    }
    toString() {
        return this.message;
    }
    get message() {
        return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
        return this.issues.length === 0;
    }
    flatten(mapper = (issue) => issue.message) {
        const fieldErrors = {};
        const formErrors = [];
        for (const sub of this.issues) {
            if (sub.path.length > 0) {
                const firstEl = sub.path[0];
                fieldErrors[firstEl] = fieldErrors[firstEl] || [];
                fieldErrors[firstEl].push(mapper(sub));
            }
            else {
                formErrors.push(mapper(sub));
            }
        }
        return { formErrors, fieldErrors };
    }
    get formErrors() {
        return this.flatten();
    }
}
ZodError.create = (issues) => {
    const error = new ZodError(issues);
    return error;
};

const errorMap = (issue, _ctx) => {
    let message;
    switch (issue.code) {
        case ZodIssueCode.invalid_type:
            if (issue.received === ZodParsedType.undefined) {
                message = "Required";
            }
            else {
                message = `Expected ${issue.expected}, received ${issue.received}`;
            }
            break;
        case ZodIssueCode.invalid_literal:
            message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
            break;
        case ZodIssueCode.unrecognized_keys:
            message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
            break;
        case ZodIssueCode.invalid_union:
            message = `Invalid input`;
            break;
        case ZodIssueCode.invalid_union_discriminator:
            message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
            break;
        case ZodIssueCode.invalid_enum_value:
            message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
            break;
        case ZodIssueCode.invalid_arguments:
            message = `Invalid function arguments`;
            break;
        case ZodIssueCode.invalid_return_type:
            message = `Invalid function return type`;
            break;
        case ZodIssueCode.invalid_date:
            message = `Invalid date`;
            break;
        case ZodIssueCode.invalid_string:
            if (typeof issue.validation === "object") {
                if ("includes" in issue.validation) {
                    message = `Invalid input: must include "${issue.validation.includes}"`;
                    if (typeof issue.validation.position === "number") {
                        message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
                    }
                }
                else if ("startsWith" in issue.validation) {
                    message = `Invalid input: must start with "${issue.validation.startsWith}"`;
                }
                else if ("endsWith" in issue.validation) {
                    message = `Invalid input: must end with "${issue.validation.endsWith}"`;
                }
                else {
                    util.assertNever(issue.validation);
                }
            }
            else if (issue.validation !== "regex") {
                message = `Invalid ${issue.validation}`;
            }
            else {
                message = "Invalid";
            }
            break;
        case ZodIssueCode.too_small:
            if (issue.type === "array")
                message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
            else if (issue.type === "string")
                message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
            else if (issue.type === "number")
                message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
            else if (issue.type === "bigint")
                message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
            else if (issue.type === "date")
                message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
            else
                message = "Invalid input";
            break;
        case ZodIssueCode.too_big:
            if (issue.type === "array")
                message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
            else if (issue.type === "string")
                message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
            else if (issue.type === "number")
                message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
            else if (issue.type === "bigint")
                message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
            else if (issue.type === "date")
                message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
            else
                message = "Invalid input";
            break;
        case ZodIssueCode.custom:
            message = `Invalid input`;
            break;
        case ZodIssueCode.invalid_intersection_types:
            message = `Intersection results could not be merged`;
            break;
        case ZodIssueCode.not_multiple_of:
            message = `Number must be a multiple of ${issue.multipleOf}`;
            break;
        case ZodIssueCode.not_finite:
            message = "Number must be finite";
            break;
        default:
            message = _ctx.defaultError;
            util.assertNever(issue);
    }
    return { message };
};
var defaultErrorMap = errorMap;

let overrideErrorMap = defaultErrorMap;
function getErrorMap() {
    return overrideErrorMap;
}

const makeIssue = (params) => {
    const { data, path, errorMaps, issueData } = params;
    const fullPath = [...path, ...(issueData.path || [])];
    const fullIssue = {
        ...issueData,
        path: fullPath,
    };
    if (issueData.message !== undefined) {
        return {
            ...issueData,
            path: fullPath,
            message: issueData.message,
        };
    }
    let errorMessage = "";
    const maps = errorMaps
        .filter((m) => !!m)
        .slice()
        .reverse();
    for (const map of maps) {
        errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
    }
    return {
        ...issueData,
        path: fullPath,
        message: errorMessage,
    };
};
function addIssueToContext(ctx, issueData) {
    const overrideMap = getErrorMap();
    const issue = makeIssue({
        issueData: issueData,
        data: ctx.data,
        path: ctx.path,
        errorMaps: [
            ctx.common.contextualErrorMap, // contextual error map is first priority
            ctx.schemaErrorMap, // then schema-bound map if available
            overrideMap, // then global override map
            overrideMap === defaultErrorMap ? undefined : defaultErrorMap, // then global default map
        ].filter((x) => !!x),
    });
    ctx.common.issues.push(issue);
}
class ParseStatus {
    constructor() {
        this.value = "valid";
    }
    dirty() {
        if (this.value === "valid")
            this.value = "dirty";
    }
    abort() {
        if (this.value !== "aborted")
            this.value = "aborted";
    }
    static mergeArray(status, results) {
        const arrayValue = [];
        for (const s of results) {
            if (s.status === "aborted")
                return INVALID;
            if (s.status === "dirty")
                status.dirty();
            arrayValue.push(s.value);
        }
        return { status: status.value, value: arrayValue };
    }
    static async mergeObjectAsync(status, pairs) {
        const syncPairs = [];
        for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            syncPairs.push({
                key,
                value,
            });
        }
        return ParseStatus.mergeObjectSync(status, syncPairs);
    }
    static mergeObjectSync(status, pairs) {
        const finalObject = {};
        for (const pair of pairs) {
            const { key, value } = pair;
            if (key.status === "aborted")
                return INVALID;
            if (value.status === "aborted")
                return INVALID;
            if (key.status === "dirty")
                status.dirty();
            if (value.status === "dirty")
                status.dirty();
            if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
                finalObject[key.value] = value.value;
            }
        }
        return { status: status.value, value: finalObject };
    }
}
const INVALID = Object.freeze({
    status: "aborted",
});
const DIRTY = (value) => ({ status: "dirty", value });
const OK = (value) => ({ status: "valid", value });
const isAborted = (x) => x.status === "aborted";
const isDirty = (x) => x.status === "dirty";
const isValid = (x) => x.status === "valid";
const isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

var errorUtil;
(function (errorUtil) {
    errorUtil.errToObj = (message) => typeof message === "string" ? { message } : message || {};
    // biome-ignore lint:
    errorUtil.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

class ParseInputLazyPath {
    constructor(parent, value, path, key) {
        this._cachedPath = [];
        this.parent = parent;
        this.data = value;
        this._path = path;
        this._key = key;
    }
    get path() {
        if (!this._cachedPath.length) {
            if (Array.isArray(this._key)) {
                this._cachedPath.push(...this._path, ...this._key);
            }
            else {
                this._cachedPath.push(...this._path, this._key);
            }
        }
        return this._cachedPath;
    }
}
const handleResult = (ctx, result) => {
    if (isValid(result)) {
        return { success: true, data: result.value };
    }
    else {
        if (!ctx.common.issues.length) {
            throw new Error("Validation failed but no issues detected.");
        }
        return {
            success: false,
            get error() {
                if (this._error)
                    return this._error;
                const error = new ZodError(ctx.common.issues);
                this._error = error;
                return this._error;
            },
        };
    }
};
function processCreateParams(params) {
    if (!params)
        return {};
    const { errorMap, invalid_type_error, required_error, description } = params;
    if (errorMap && (invalid_type_error || required_error)) {
        throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap)
        return { errorMap: errorMap, description };
    const customMap = (iss, ctx) => {
        const { message } = params;
        if (iss.code === "invalid_enum_value") {
            return { message: message ?? ctx.defaultError };
        }
        if (typeof ctx.data === "undefined") {
            return { message: message ?? required_error ?? ctx.defaultError };
        }
        if (iss.code !== "invalid_type")
            return { message: ctx.defaultError };
        return { message: message ?? invalid_type_error ?? ctx.defaultError };
    };
    return { errorMap: customMap, description };
}
class ZodType {
    get description() {
        return this._def.description;
    }
    _getType(input) {
        return getParsedType(input.data);
    }
    _getOrReturnCtx(input, ctx) {
        return (ctx || {
            common: input.parent.common,
            data: input.data,
            parsedType: getParsedType(input.data),
            schemaErrorMap: this._def.errorMap,
            path: input.path,
            parent: input.parent,
        });
    }
    _processInputParams(input) {
        return {
            status: new ParseStatus(),
            ctx: {
                common: input.parent.common,
                data: input.data,
                parsedType: getParsedType(input.data),
                schemaErrorMap: this._def.errorMap,
                path: input.path,
                parent: input.parent,
            },
        };
    }
    _parseSync(input) {
        const result = this._parse(input);
        if (isAsync(result)) {
            throw new Error("Synchronous parse encountered promise.");
        }
        return result;
    }
    _parseAsync(input) {
        const result = this._parse(input);
        return Promise.resolve(result);
    }
    parse(data, params) {
        const result = this.safeParse(data, params);
        if (result.success)
            return result.data;
        throw result.error;
    }
    safeParse(data, params) {
        const ctx = {
            common: {
                issues: [],
                async: params?.async ?? false,
                contextualErrorMap: params?.errorMap,
            },
            path: params?.path || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data),
        };
        const result = this._parseSync({ data, path: ctx.path, parent: ctx });
        return handleResult(ctx, result);
    }
    "~validate"(data) {
        const ctx = {
            common: {
                issues: [],
                async: !!this["~standard"].async,
            },
            path: [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data),
        };
        if (!this["~standard"].async) {
            try {
                const result = this._parseSync({ data, path: [], parent: ctx });
                return isValid(result)
                    ? {
                        value: result.value,
                    }
                    : {
                        issues: ctx.common.issues,
                    };
            }
            catch (err) {
                if (err?.message?.toLowerCase()?.includes("encountered")) {
                    this["~standard"].async = true;
                }
                ctx.common = {
                    issues: [],
                    async: true,
                };
            }
        }
        return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result)
            ? {
                value: result.value,
            }
            : {
                issues: ctx.common.issues,
            });
    }
    async parseAsync(data, params) {
        const result = await this.safeParseAsync(data, params);
        if (result.success)
            return result.data;
        throw result.error;
    }
    async safeParseAsync(data, params) {
        const ctx = {
            common: {
                issues: [],
                contextualErrorMap: params?.errorMap,
                async: true,
            },
            path: params?.path || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data),
        };
        const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
        const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
        return handleResult(ctx, result);
    }
    refine(check, message) {
        const getIssueProperties = (val) => {
            if (typeof message === "string" || typeof message === "undefined") {
                return { message };
            }
            else if (typeof message === "function") {
                return message(val);
            }
            else {
                return message;
            }
        };
        return this._refinement((val, ctx) => {
            const result = check(val);
            const setError = () => ctx.addIssue({
                code: ZodIssueCode.custom,
                ...getIssueProperties(val),
            });
            if (typeof Promise !== "undefined" && result instanceof Promise) {
                return result.then((data) => {
                    if (!data) {
                        setError();
                        return false;
                    }
                    else {
                        return true;
                    }
                });
            }
            if (!result) {
                setError();
                return false;
            }
            else {
                return true;
            }
        });
    }
    refinement(check, refinementData) {
        return this._refinement((val, ctx) => {
            if (!check(val)) {
                ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
                return false;
            }
            else {
                return true;
            }
        });
    }
    _refinement(refinement) {
        return new ZodEffects({
            schema: this,
            typeName: ZodFirstPartyTypeKind.ZodEffects,
            effect: { type: "refinement", refinement },
        });
    }
    superRefine(refinement) {
        return this._refinement(refinement);
    }
    constructor(def) {
        /** Alias of safeParseAsync */
        this.spa = this.safeParseAsync;
        this._def = def;
        this.parse = this.parse.bind(this);
        this.safeParse = this.safeParse.bind(this);
        this.parseAsync = this.parseAsync.bind(this);
        this.safeParseAsync = this.safeParseAsync.bind(this);
        this.spa = this.spa.bind(this);
        this.refine = this.refine.bind(this);
        this.refinement = this.refinement.bind(this);
        this.superRefine = this.superRefine.bind(this);
        this.optional = this.optional.bind(this);
        this.nullable = this.nullable.bind(this);
        this.nullish = this.nullish.bind(this);
        this.array = this.array.bind(this);
        this.promise = this.promise.bind(this);
        this.or = this.or.bind(this);
        this.and = this.and.bind(this);
        this.transform = this.transform.bind(this);
        this.brand = this.brand.bind(this);
        this.default = this.default.bind(this);
        this.catch = this.catch.bind(this);
        this.describe = this.describe.bind(this);
        this.pipe = this.pipe.bind(this);
        this.readonly = this.readonly.bind(this);
        this.isNullable = this.isNullable.bind(this);
        this.isOptional = this.isOptional.bind(this);
        this["~standard"] = {
            version: 1,
            vendor: "zod",
            validate: (data) => this["~validate"](data),
        };
    }
    optional() {
        return ZodOptional.create(this, this._def);
    }
    nullable() {
        return ZodNullable.create(this, this._def);
    }
    nullish() {
        return this.nullable().optional();
    }
    array() {
        return ZodArray.create(this);
    }
    promise() {
        return ZodPromise.create(this, this._def);
    }
    or(option) {
        return ZodUnion.create([this, option], this._def);
    }
    and(incoming) {
        return ZodIntersection.create(this, incoming, this._def);
    }
    transform(transform) {
        return new ZodEffects({
            ...processCreateParams(this._def),
            schema: this,
            typeName: ZodFirstPartyTypeKind.ZodEffects,
            effect: { type: "transform", transform },
        });
    }
    default(def) {
        const defaultValueFunc = typeof def === "function" ? def : () => def;
        return new ZodDefault({
            ...processCreateParams(this._def),
            innerType: this,
            defaultValue: defaultValueFunc,
            typeName: ZodFirstPartyTypeKind.ZodDefault,
        });
    }
    brand() {
        return new ZodBranded({
            typeName: ZodFirstPartyTypeKind.ZodBranded,
            type: this,
            ...processCreateParams(this._def),
        });
    }
    catch(def) {
        const catchValueFunc = typeof def === "function" ? def : () => def;
        return new ZodCatch({
            ...processCreateParams(this._def),
            innerType: this,
            catchValue: catchValueFunc,
            typeName: ZodFirstPartyTypeKind.ZodCatch,
        });
    }
    describe(description) {
        const This = this.constructor;
        return new This({
            ...this._def,
            description,
        });
    }
    pipe(target) {
        return ZodPipeline.create(this, target);
    }
    readonly() {
        return ZodReadonly.create(this);
    }
    isOptional() {
        return this.safeParse(undefined).success;
    }
    isNullable() {
        return this.safeParse(null).success;
    }
}
const cuidRegex = /^c[^\s-]{8,}$/i;
const cuid2Regex = /^[0-9a-z]+$/;
const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
// const uuidRegex =
//   /^([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}|00000000-0000-0000-0000-000000000000)$/i;
const uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
const nanoidRegex = /^[a-z0-9_-]{21}$/i;
const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
const durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
// from https://stackoverflow.com/a/46181/1550155
// old version: too slow, didn't support unicode
// const emailRegex = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i;
//old email regex
// const emailRegex = /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@((?!-)([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{1,})[^-<>()[\].,;:\s@"]$/i;
// eslint-disable-next-line
// const emailRegex =
//   /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\])|(\[IPv6:(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))\])|([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])*(\.[A-Za-z]{2,})+))$/;
// const emailRegex =
//   /^[a-zA-Z0-9\.\!\#\$\%\&\'\*\+\/\=\?\^\_\`\{\|\}\~\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
// const emailRegex =
//   /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;
const emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
// const emailRegex =
//   /^[a-z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9\-]+)*$/i;
// from https://thekevinscott.com/emojis-in-javascript/#writing-a-regular-expression
const _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
let emojiRegex;
// faster, simpler, safer
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
// const ipv6Regex =
// /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/;
const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
const ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
// https://stackoverflow.com/questions/7860392/determine-if-string-is-in-base64-using-javascript
const base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
// https://base64.guru/standards/base64url
const base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
// simple
// const dateRegexSource = `\\d{4}-\\d{2}-\\d{2}`;
// no leap year validation
// const dateRegexSource = `\\d{4}-((0[13578]|10|12)-31|(0[13-9]|1[0-2])-30|(0[1-9]|1[0-2])-(0[1-9]|1\\d|2\\d))`;
// with leap year validation
const dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
const dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
    let secondsRegexSource = `[0-5]\\d`;
    if (args.precision) {
        secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
    }
    else if (args.precision == null) {
        secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
    }
    const secondsQuantifier = args.precision ? "+" : "?"; // require seconds if precision is nonzero
    return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
    return new RegExp(`^${timeRegexSource(args)}$`);
}
// Adapted from https://stackoverflow.com/a/3143231
function datetimeRegex(args) {
    let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
    const opts = [];
    opts.push(args.local ? `Z?` : `Z`);
    if (args.offset)
        opts.push(`([+-]\\d{2}:?\\d{2})`);
    regex = `${regex}(${opts.join("|")})`;
    return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
    if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
        return true;
    }
    if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
        return true;
    }
    return false;
}
function isValidJWT(jwt, alg) {
    if (!jwtRegex.test(jwt))
        return false;
    try {
        const [header] = jwt.split(".");
        if (!header)
            return false;
        // Convert base64url to base64
        const base64 = header
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(header.length + ((4 - (header.length % 4)) % 4), "=");
        const decoded = JSON.parse(atob(base64));
        if (typeof decoded !== "object" || decoded === null)
            return false;
        if ("typ" in decoded && decoded?.typ !== "JWT")
            return false;
        if (!decoded.alg)
            return false;
        if (alg && decoded.alg !== alg)
            return false;
        return true;
    }
    catch {
        return false;
    }
}
function isValidCidr(ip, version) {
    if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
        return true;
    }
    if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
        return true;
    }
    return false;
}
class ZodString extends ZodType {
    _parse(input) {
        if (this._def.coerce) {
            input.data = String(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.string) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.string,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const status = new ParseStatus();
        let ctx = undefined;
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                if (input.data.length < check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        minimum: check.value,
                        type: "string",
                        inclusive: true,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                if (input.data.length > check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        maximum: check.value,
                        type: "string",
                        inclusive: true,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "length") {
                const tooBig = input.data.length > check.value;
                const tooSmall = input.data.length < check.value;
                if (tooBig || tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    if (tooBig) {
                        addIssueToContext(ctx, {
                            code: ZodIssueCode.too_big,
                            maximum: check.value,
                            type: "string",
                            inclusive: true,
                            exact: true,
                            message: check.message,
                        });
                    }
                    else if (tooSmall) {
                        addIssueToContext(ctx, {
                            code: ZodIssueCode.too_small,
                            minimum: check.value,
                            type: "string",
                            inclusive: true,
                            exact: true,
                            message: check.message,
                        });
                    }
                    status.dirty();
                }
            }
            else if (check.kind === "email") {
                if (!emailRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "email",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "emoji") {
                if (!emojiRegex) {
                    emojiRegex = new RegExp(_emojiRegex, "u");
                }
                if (!emojiRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "emoji",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "uuid") {
                if (!uuidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "uuid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "nanoid") {
                if (!nanoidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "nanoid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cuid") {
                if (!cuidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "cuid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cuid2") {
                if (!cuid2Regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "cuid2",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "ulid") {
                if (!ulidRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "ulid",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "url") {
                try {
                    new URL(input.data);
                }
                catch {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "url",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "regex") {
                check.regex.lastIndex = 0;
                const testResult = check.regex.test(input.data);
                if (!testResult) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "regex",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "trim") {
                input.data = input.data.trim();
            }
            else if (check.kind === "includes") {
                if (!input.data.includes(check.value, check.position)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: { includes: check.value, position: check.position },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "toLowerCase") {
                input.data = input.data.toLowerCase();
            }
            else if (check.kind === "toUpperCase") {
                input.data = input.data.toUpperCase();
            }
            else if (check.kind === "startsWith") {
                if (!input.data.startsWith(check.value)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: { startsWith: check.value },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "endsWith") {
                if (!input.data.endsWith(check.value)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: { endsWith: check.value },
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "datetime") {
                const regex = datetimeRegex(check);
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: "datetime",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "date") {
                const regex = dateRegex;
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: "date",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "time") {
                const regex = timeRegex(check);
                if (!regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_string,
                        validation: "time",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "duration") {
                if (!durationRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "duration",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "ip") {
                if (!isValidIP(input.data, check.version)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "ip",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "jwt") {
                if (!isValidJWT(input.data, check.alg)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "jwt",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "cidr") {
                if (!isValidCidr(input.data, check.version)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "cidr",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "base64") {
                if (!base64Regex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "base64",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "base64url") {
                if (!base64urlRegex.test(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        validation: "base64url",
                        code: ZodIssueCode.invalid_string,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    _regex(regex, validation, message) {
        return this.refinement((data) => regex.test(data), {
            validation,
            code: ZodIssueCode.invalid_string,
            ...errorUtil.errToObj(message),
        });
    }
    _addCheck(check) {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    email(message) {
        return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
    }
    url(message) {
        return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
    }
    emoji(message) {
        return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
    }
    uuid(message) {
        return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
    }
    nanoid(message) {
        return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
    }
    cuid(message) {
        return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
    }
    cuid2(message) {
        return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
    }
    ulid(message) {
        return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
    }
    base64(message) {
        return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
    }
    base64url(message) {
        // base64url encoding is a modification of base64 that can safely be used in URLs and filenames
        return this._addCheck({
            kind: "base64url",
            ...errorUtil.errToObj(message),
        });
    }
    jwt(options) {
        return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
    }
    ip(options) {
        return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
    }
    cidr(options) {
        return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
    }
    datetime(options) {
        if (typeof options === "string") {
            return this._addCheck({
                kind: "datetime",
                precision: null,
                offset: false,
                local: false,
                message: options,
            });
        }
        return this._addCheck({
            kind: "datetime",
            precision: typeof options?.precision === "undefined" ? null : options?.precision,
            offset: options?.offset ?? false,
            local: options?.local ?? false,
            ...errorUtil.errToObj(options?.message),
        });
    }
    date(message) {
        return this._addCheck({ kind: "date", message });
    }
    time(options) {
        if (typeof options === "string") {
            return this._addCheck({
                kind: "time",
                precision: null,
                message: options,
            });
        }
        return this._addCheck({
            kind: "time",
            precision: typeof options?.precision === "undefined" ? null : options?.precision,
            ...errorUtil.errToObj(options?.message),
        });
    }
    duration(message) {
        return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
    }
    regex(regex, message) {
        return this._addCheck({
            kind: "regex",
            regex: regex,
            ...errorUtil.errToObj(message),
        });
    }
    includes(value, options) {
        return this._addCheck({
            kind: "includes",
            value: value,
            position: options?.position,
            ...errorUtil.errToObj(options?.message),
        });
    }
    startsWith(value, message) {
        return this._addCheck({
            kind: "startsWith",
            value: value,
            ...errorUtil.errToObj(message),
        });
    }
    endsWith(value, message) {
        return this._addCheck({
            kind: "endsWith",
            value: value,
            ...errorUtil.errToObj(message),
        });
    }
    min(minLength, message) {
        return this._addCheck({
            kind: "min",
            value: minLength,
            ...errorUtil.errToObj(message),
        });
    }
    max(maxLength, message) {
        return this._addCheck({
            kind: "max",
            value: maxLength,
            ...errorUtil.errToObj(message),
        });
    }
    length(len, message) {
        return this._addCheck({
            kind: "length",
            value: len,
            ...errorUtil.errToObj(message),
        });
    }
    /**
     * Equivalent to `.min(1)`
     */
    nonempty(message) {
        return this.min(1, errorUtil.errToObj(message));
    }
    trim() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "trim" }],
        });
    }
    toLowerCase() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "toLowerCase" }],
        });
    }
    toUpperCase() {
        return new ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "toUpperCase" }],
        });
    }
    get isDatetime() {
        return !!this._def.checks.find((ch) => ch.kind === "datetime");
    }
    get isDate() {
        return !!this._def.checks.find((ch) => ch.kind === "date");
    }
    get isTime() {
        return !!this._def.checks.find((ch) => ch.kind === "time");
    }
    get isDuration() {
        return !!this._def.checks.find((ch) => ch.kind === "duration");
    }
    get isEmail() {
        return !!this._def.checks.find((ch) => ch.kind === "email");
    }
    get isURL() {
        return !!this._def.checks.find((ch) => ch.kind === "url");
    }
    get isEmoji() {
        return !!this._def.checks.find((ch) => ch.kind === "emoji");
    }
    get isUUID() {
        return !!this._def.checks.find((ch) => ch.kind === "uuid");
    }
    get isNANOID() {
        return !!this._def.checks.find((ch) => ch.kind === "nanoid");
    }
    get isCUID() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid");
    }
    get isCUID2() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid2");
    }
    get isULID() {
        return !!this._def.checks.find((ch) => ch.kind === "ulid");
    }
    get isIP() {
        return !!this._def.checks.find((ch) => ch.kind === "ip");
    }
    get isCIDR() {
        return !!this._def.checks.find((ch) => ch.kind === "cidr");
    }
    get isBase64() {
        return !!this._def.checks.find((ch) => ch.kind === "base64");
    }
    get isBase64url() {
        // base64url encoding is a modification of base64 that can safely be used in URLs and filenames
        return !!this._def.checks.find((ch) => ch.kind === "base64url");
    }
    get minLength() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxLength() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
}
ZodString.create = (params) => {
    return new ZodString({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodString,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params),
    });
};
// https://stackoverflow.com/questions/3966484/why-does-modulus-operator-return-fractional-number-in-javascript/31711034#31711034
function floatSafeRemainder(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepDecCount = (step.toString().split(".")[1] || "").length;
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
    return (valInt % stepInt) / 10 ** decCount;
}
class ZodNumber extends ZodType {
    constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
        this.step = this.multipleOf;
    }
    _parse(input) {
        if (this._def.coerce) {
            input.data = Number(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.number) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.number,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        let ctx = undefined;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
            if (check.kind === "int") {
                if (!util.isInteger(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.invalid_type,
                        expected: "integer",
                        received: "float",
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "min") {
                const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
                if (tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        minimum: check.value,
                        type: "number",
                        inclusive: check.inclusive,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
                if (tooBig) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        maximum: check.value,
                        type: "number",
                        inclusive: check.inclusive,
                        exact: false,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "multipleOf") {
                if (floatSafeRemainder(input.data, check.value) !== 0) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.not_multiple_of,
                        multipleOf: check.value,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "finite") {
                if (!Number.isFinite(input.data)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.not_finite,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
        return new ZodNumber({
            ...this._def,
            checks: [
                ...this._def.checks,
                {
                    kind,
                    value,
                    inclusive,
                    message: errorUtil.toString(message),
                },
            ],
        });
    }
    _addCheck(check) {
        return new ZodNumber({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    int(message) {
        return this._addCheck({
            kind: "int",
            message: errorUtil.toString(message),
        });
    }
    positive(message) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    negative(message) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    nonpositive(message) {
        return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    nonnegative(message) {
        return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    multipleOf(value, message) {
        return this._addCheck({
            kind: "multipleOf",
            value: value,
            message: errorUtil.toString(message),
        });
    }
    finite(message) {
        return this._addCheck({
            kind: "finite",
            message: errorUtil.toString(message),
        });
    }
    safe(message) {
        return this._addCheck({
            kind: "min",
            inclusive: true,
            value: Number.MIN_SAFE_INTEGER,
            message: errorUtil.toString(message),
        })._addCheck({
            kind: "max",
            inclusive: true,
            value: Number.MAX_SAFE_INTEGER,
            message: errorUtil.toString(message),
        });
    }
    get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
    get isInt() {
        return !!this._def.checks.find((ch) => ch.kind === "int" || (ch.kind === "multipleOf" && util.isInteger(ch.value)));
    }
    get isFinite() {
        let max = null;
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
                return true;
            }
            else if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
            else if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return Number.isFinite(min) && Number.isFinite(max);
    }
}
ZodNumber.create = (params) => {
    return new ZodNumber({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodNumber,
        coerce: params?.coerce || false,
        ...processCreateParams(params),
    });
};
class ZodBigInt extends ZodType {
    constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
    }
    _parse(input) {
        if (this._def.coerce) {
            try {
                input.data = BigInt(input.data);
            }
            catch {
                return this._getInvalidInput(input);
            }
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.bigint) {
            return this._getInvalidInput(input);
        }
        let ctx = undefined;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
                if (tooSmall) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        type: "bigint",
                        minimum: check.value,
                        inclusive: check.inclusive,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
                if (tooBig) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        type: "bigint",
                        maximum: check.value,
                        inclusive: check.inclusive,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "multipleOf") {
                if (input.data % check.value !== BigInt(0)) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.not_multiple_of,
                        multipleOf: check.value,
                        message: check.message,
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return { status: status.value, value: input.data };
    }
    _getInvalidInput(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.bigint,
            received: ctx.parsedType,
        });
        return INVALID;
    }
    gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
        return new ZodBigInt({
            ...this._def,
            checks: [
                ...this._def.checks,
                {
                    kind,
                    value,
                    inclusive,
                    message: errorUtil.toString(message),
                },
            ],
        });
    }
    _addCheck(check) {
        return new ZodBigInt({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    positive(message) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    negative(message) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil.toString(message),
        });
    }
    nonpositive(message) {
        return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    nonnegative(message) {
        return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil.toString(message),
        });
    }
    multipleOf(value, message) {
        return this._addCheck({
            kind: "multipleOf",
            value,
            message: errorUtil.toString(message),
        });
    }
    get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min;
    }
    get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max;
    }
}
ZodBigInt.create = (params) => {
    return new ZodBigInt({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodBigInt,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params),
    });
};
class ZodBoolean extends ZodType {
    _parse(input) {
        if (this._def.coerce) {
            input.data = Boolean(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.boolean) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.boolean,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodBoolean.create = (params) => {
    return new ZodBoolean({
        typeName: ZodFirstPartyTypeKind.ZodBoolean,
        coerce: params?.coerce || false,
        ...processCreateParams(params),
    });
};
class ZodDate extends ZodType {
    _parse(input) {
        if (this._def.coerce) {
            input.data = new Date(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.date) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.date,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        if (Number.isNaN(input.data.getTime())) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_date,
            });
            return INVALID;
        }
        const status = new ParseStatus();
        let ctx = undefined;
        for (const check of this._def.checks) {
            if (check.kind === "min") {
                if (input.data.getTime() < check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_small,
                        message: check.message,
                        inclusive: true,
                        exact: false,
                        minimum: check.value,
                        type: "date",
                    });
                    status.dirty();
                }
            }
            else if (check.kind === "max") {
                if (input.data.getTime() > check.value) {
                    ctx = this._getOrReturnCtx(input, ctx);
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.too_big,
                        message: check.message,
                        inclusive: true,
                        exact: false,
                        maximum: check.value,
                        type: "date",
                    });
                    status.dirty();
                }
            }
            else {
                util.assertNever(check);
            }
        }
        return {
            status: status.value,
            value: new Date(input.data.getTime()),
        };
    }
    _addCheck(check) {
        return new ZodDate({
            ...this._def,
            checks: [...this._def.checks, check],
        });
    }
    min(minDate, message) {
        return this._addCheck({
            kind: "min",
            value: minDate.getTime(),
            message: errorUtil.toString(message),
        });
    }
    max(maxDate, message) {
        return this._addCheck({
            kind: "max",
            value: maxDate.getTime(),
            message: errorUtil.toString(message),
        });
    }
    get minDate() {
        let min = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "min") {
                if (min === null || ch.value > min)
                    min = ch.value;
            }
        }
        return min != null ? new Date(min) : null;
    }
    get maxDate() {
        let max = null;
        for (const ch of this._def.checks) {
            if (ch.kind === "max") {
                if (max === null || ch.value < max)
                    max = ch.value;
            }
        }
        return max != null ? new Date(max) : null;
    }
}
ZodDate.create = (params) => {
    return new ZodDate({
        checks: [],
        coerce: params?.coerce || false,
        typeName: ZodFirstPartyTypeKind.ZodDate,
        ...processCreateParams(params),
    });
};
class ZodSymbol extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.symbol) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.symbol,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodSymbol.create = (params) => {
    return new ZodSymbol({
        typeName: ZodFirstPartyTypeKind.ZodSymbol,
        ...processCreateParams(params),
    });
};
class ZodUndefined extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.undefined,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodUndefined.create = (params) => {
    return new ZodUndefined({
        typeName: ZodFirstPartyTypeKind.ZodUndefined,
        ...processCreateParams(params),
    });
};
class ZodNull extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.null) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.null,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodNull.create = (params) => {
    return new ZodNull({
        typeName: ZodFirstPartyTypeKind.ZodNull,
        ...processCreateParams(params),
    });
};
class ZodAny extends ZodType {
    constructor() {
        super(...arguments);
        // to prevent instances of other classes from extending ZodAny. this causes issues with catchall in ZodObject.
        this._any = true;
    }
    _parse(input) {
        return OK(input.data);
    }
}
ZodAny.create = (params) => {
    return new ZodAny({
        typeName: ZodFirstPartyTypeKind.ZodAny,
        ...processCreateParams(params),
    });
};
class ZodUnknown extends ZodType {
    constructor() {
        super(...arguments);
        // required
        this._unknown = true;
    }
    _parse(input) {
        return OK(input.data);
    }
}
ZodUnknown.create = (params) => {
    return new ZodUnknown({
        typeName: ZodFirstPartyTypeKind.ZodUnknown,
        ...processCreateParams(params),
    });
};
class ZodNever extends ZodType {
    _parse(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.never,
            received: ctx.parsedType,
        });
        return INVALID;
    }
}
ZodNever.create = (params) => {
    return new ZodNever({
        typeName: ZodFirstPartyTypeKind.ZodNever,
        ...processCreateParams(params),
    });
};
class ZodVoid extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.void,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return OK(input.data);
    }
}
ZodVoid.create = (params) => {
    return new ZodVoid({
        typeName: ZodFirstPartyTypeKind.ZodVoid,
        ...processCreateParams(params),
    });
};
class ZodArray extends ZodType {
    _parse(input) {
        const { ctx, status } = this._processInputParams(input);
        const def = this._def;
        if (ctx.parsedType !== ZodParsedType.array) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.array,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        if (def.exactLength !== null) {
            const tooBig = ctx.data.length > def.exactLength.value;
            const tooSmall = ctx.data.length < def.exactLength.value;
            if (tooBig || tooSmall) {
                addIssueToContext(ctx, {
                    code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
                    minimum: (tooSmall ? def.exactLength.value : undefined),
                    maximum: (tooBig ? def.exactLength.value : undefined),
                    type: "array",
                    inclusive: true,
                    exact: true,
                    message: def.exactLength.message,
                });
                status.dirty();
            }
        }
        if (def.minLength !== null) {
            if (ctx.data.length < def.minLength.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_small,
                    minimum: def.minLength.value,
                    type: "array",
                    inclusive: true,
                    exact: false,
                    message: def.minLength.message,
                });
                status.dirty();
            }
        }
        if (def.maxLength !== null) {
            if (ctx.data.length > def.maxLength.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_big,
                    maximum: def.maxLength.value,
                    type: "array",
                    inclusive: true,
                    exact: false,
                    message: def.maxLength.message,
                });
                status.dirty();
            }
        }
        if (ctx.common.async) {
            return Promise.all([...ctx.data].map((item, i) => {
                return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
            })).then((result) => {
                return ParseStatus.mergeArray(status, result);
            });
        }
        const result = [...ctx.data].map((item, i) => {
            return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        });
        return ParseStatus.mergeArray(status, result);
    }
    get element() {
        return this._def.type;
    }
    min(minLength, message) {
        return new ZodArray({
            ...this._def,
            minLength: { value: minLength, message: errorUtil.toString(message) },
        });
    }
    max(maxLength, message) {
        return new ZodArray({
            ...this._def,
            maxLength: { value: maxLength, message: errorUtil.toString(message) },
        });
    }
    length(len, message) {
        return new ZodArray({
            ...this._def,
            exactLength: { value: len, message: errorUtil.toString(message) },
        });
    }
    nonempty(message) {
        return this.min(1, message);
    }
}
ZodArray.create = (schema, params) => {
    return new ZodArray({
        type: schema,
        minLength: null,
        maxLength: null,
        exactLength: null,
        typeName: ZodFirstPartyTypeKind.ZodArray,
        ...processCreateParams(params),
    });
};
function deepPartialify(schema) {
    if (schema instanceof ZodObject) {
        const newShape = {};
        for (const key in schema.shape) {
            const fieldSchema = schema.shape[key];
            newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
        }
        return new ZodObject({
            ...schema._def,
            shape: () => newShape,
        });
    }
    else if (schema instanceof ZodArray) {
        return new ZodArray({
            ...schema._def,
            type: deepPartialify(schema.element),
        });
    }
    else if (schema instanceof ZodOptional) {
        return ZodOptional.create(deepPartialify(schema.unwrap()));
    }
    else if (schema instanceof ZodNullable) {
        return ZodNullable.create(deepPartialify(schema.unwrap()));
    }
    else if (schema instanceof ZodTuple) {
        return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
    }
    else {
        return schema;
    }
}
class ZodObject extends ZodType {
    constructor() {
        super(...arguments);
        this._cached = null;
        /**
         * @deprecated In most cases, this is no longer needed - unknown properties are now silently stripped.
         * If you want to pass through unknown properties, use `.passthrough()` instead.
         */
        this.nonstrict = this.passthrough;
        // extend<
        //   Augmentation extends ZodRawShape,
        //   NewOutput extends util.flatten<{
        //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
        //       ? Augmentation[k]["_output"]
        //       : k extends keyof Output
        //       ? Output[k]
        //       : never;
        //   }>,
        //   NewInput extends util.flatten<{
        //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
        //       ? Augmentation[k]["_input"]
        //       : k extends keyof Input
        //       ? Input[k]
        //       : never;
        //   }>
        // >(
        //   augmentation: Augmentation
        // ): ZodObject<
        //   extendShape<T, Augmentation>,
        //   UnknownKeys,
        //   Catchall,
        //   NewOutput,
        //   NewInput
        // > {
        //   return new ZodObject({
        //     ...this._def,
        //     shape: () => ({
        //       ...this._def.shape(),
        //       ...augmentation,
        //     }),
        //   }) as any;
        // }
        /**
         * @deprecated Use `.extend` instead
         *  */
        this.augment = this.extend;
    }
    _getCached() {
        if (this._cached !== null)
            return this._cached;
        const shape = this._def.shape();
        const keys = util.objectKeys(shape);
        this._cached = { shape, keys };
        return this._cached;
    }
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.object) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const { status, ctx } = this._processInputParams(input);
        const { shape, keys: shapeKeys } = this._getCached();
        const extraKeys = [];
        if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
            for (const key in ctx.data) {
                if (!shapeKeys.includes(key)) {
                    extraKeys.push(key);
                }
            }
        }
        const pairs = [];
        for (const key of shapeKeys) {
            const keyValidator = shape[key];
            const value = ctx.data[key];
            pairs.push({
                key: { status: "valid", value: key },
                value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
                alwaysSet: key in ctx.data,
            });
        }
        if (this._def.catchall instanceof ZodNever) {
            const unknownKeys = this._def.unknownKeys;
            if (unknownKeys === "passthrough") {
                for (const key of extraKeys) {
                    pairs.push({
                        key: { status: "valid", value: key },
                        value: { status: "valid", value: ctx.data[key] },
                    });
                }
            }
            else if (unknownKeys === "strict") {
                if (extraKeys.length > 0) {
                    addIssueToContext(ctx, {
                        code: ZodIssueCode.unrecognized_keys,
                        keys: extraKeys,
                    });
                    status.dirty();
                }
            }
            else if (unknownKeys === "strip") ;
            else {
                throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
            }
        }
        else {
            // run catchall validation
            const catchall = this._def.catchall;
            for (const key of extraKeys) {
                const value = ctx.data[key];
                pairs.push({
                    key: { status: "valid", value: key },
                    value: catchall._parse(new ParseInputLazyPath(ctx, value, ctx.path, key) //, ctx.child(key), value, getParsedType(value)
                    ),
                    alwaysSet: key in ctx.data,
                });
            }
        }
        if (ctx.common.async) {
            return Promise.resolve()
                .then(async () => {
                const syncPairs = [];
                for (const pair of pairs) {
                    const key = await pair.key;
                    const value = await pair.value;
                    syncPairs.push({
                        key,
                        value,
                        alwaysSet: pair.alwaysSet,
                    });
                }
                return syncPairs;
            })
                .then((syncPairs) => {
                return ParseStatus.mergeObjectSync(status, syncPairs);
            });
        }
        else {
            return ParseStatus.mergeObjectSync(status, pairs);
        }
    }
    get shape() {
        return this._def.shape();
    }
    strict(message) {
        errorUtil.errToObj;
        return new ZodObject({
            ...this._def,
            unknownKeys: "strict",
            ...(message !== undefined
                ? {
                    errorMap: (issue, ctx) => {
                        const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
                        if (issue.code === "unrecognized_keys")
                            return {
                                message: errorUtil.errToObj(message).message ?? defaultError,
                            };
                        return {
                            message: defaultError,
                        };
                    },
                }
                : {}),
        });
    }
    strip() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "strip",
        });
    }
    passthrough() {
        return new ZodObject({
            ...this._def,
            unknownKeys: "passthrough",
        });
    }
    // const AugmentFactory =
    //   <Def extends ZodObjectDef>(def: Def) =>
    //   <Augmentation extends ZodRawShape>(
    //     augmentation: Augmentation
    //   ): ZodObject<
    //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
    //     Def["unknownKeys"],
    //     Def["catchall"]
    //   > => {
    //     return new ZodObject({
    //       ...def,
    //       shape: () => ({
    //         ...def.shape(),
    //         ...augmentation,
    //       }),
    //     }) as any;
    //   };
    extend(augmentation) {
        return new ZodObject({
            ...this._def,
            shape: () => ({
                ...this._def.shape(),
                ...augmentation,
            }),
        });
    }
    /**
     * Prior to zod@1.0.12 there was a bug in the
     * inferred type of merged objects. Please
     * upgrade if you are experiencing issues.
     */
    merge(merging) {
        const merged = new ZodObject({
            unknownKeys: merging._def.unknownKeys,
            catchall: merging._def.catchall,
            shape: () => ({
                ...this._def.shape(),
                ...merging._def.shape(),
            }),
            typeName: ZodFirstPartyTypeKind.ZodObject,
        });
        return merged;
    }
    // merge<
    //   Incoming extends AnyZodObject,
    //   Augmentation extends Incoming["shape"],
    //   NewOutput extends {
    //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
    //       ? Augmentation[k]["_output"]
    //       : k extends keyof Output
    //       ? Output[k]
    //       : never;
    //   },
    //   NewInput extends {
    //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
    //       ? Augmentation[k]["_input"]
    //       : k extends keyof Input
    //       ? Input[k]
    //       : never;
    //   }
    // >(
    //   merging: Incoming
    // ): ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"],
    //   NewOutput,
    //   NewInput
    // > {
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    setKey(key, schema) {
        return this.augment({ [key]: schema });
    }
    // merge<Incoming extends AnyZodObject>(
    //   merging: Incoming
    // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
    // ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"]
    // > {
    //   // const mergedShape = objectUtil.mergeShapes(
    //   //   this._def.shape(),
    //   //   merging._def.shape()
    //   // );
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    catchall(index) {
        return new ZodObject({
            ...this._def,
            catchall: index,
        });
    }
    pick(mask) {
        const shape = {};
        for (const key of util.objectKeys(mask)) {
            if (mask[key] && this.shape[key]) {
                shape[key] = this.shape[key];
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => shape,
        });
    }
    omit(mask) {
        const shape = {};
        for (const key of util.objectKeys(this.shape)) {
            if (!mask[key]) {
                shape[key] = this.shape[key];
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => shape,
        });
    }
    /**
     * @deprecated
     */
    deepPartial() {
        return deepPartialify(this);
    }
    partial(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
            const fieldSchema = this.shape[key];
            if (mask && !mask[key]) {
                newShape[key] = fieldSchema;
            }
            else {
                newShape[key] = fieldSchema.optional();
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => newShape,
        });
    }
    required(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
            if (mask && !mask[key]) {
                newShape[key] = this.shape[key];
            }
            else {
                const fieldSchema = this.shape[key];
                let newField = fieldSchema;
                while (newField instanceof ZodOptional) {
                    newField = newField._def.innerType;
                }
                newShape[key] = newField;
            }
        }
        return new ZodObject({
            ...this._def,
            shape: () => newShape,
        });
    }
    keyof() {
        return createZodEnum(util.objectKeys(this.shape));
    }
}
ZodObject.create = (shape, params) => {
    return new ZodObject({
        shape: () => shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params),
    });
};
ZodObject.strictCreate = (shape, params) => {
    return new ZodObject({
        shape: () => shape,
        unknownKeys: "strict",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params),
    });
};
ZodObject.lazycreate = (shape, params) => {
    return new ZodObject({
        shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params),
    });
};
class ZodUnion extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const options = this._def.options;
        function handleResults(results) {
            // return first issue-free validation if it exists
            for (const result of results) {
                if (result.result.status === "valid") {
                    return result.result;
                }
            }
            for (const result of results) {
                if (result.result.status === "dirty") {
                    // add issues from dirty option
                    ctx.common.issues.push(...result.ctx.common.issues);
                    return result.result;
                }
            }
            // return invalid
            const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_union,
                unionErrors,
            });
            return INVALID;
        }
        if (ctx.common.async) {
            return Promise.all(options.map(async (option) => {
                const childCtx = {
                    ...ctx,
                    common: {
                        ...ctx.common,
                        issues: [],
                    },
                    parent: null,
                };
                return {
                    result: await option._parseAsync({
                        data: ctx.data,
                        path: ctx.path,
                        parent: childCtx,
                    }),
                    ctx: childCtx,
                };
            })).then(handleResults);
        }
        else {
            let dirty = undefined;
            const issues = [];
            for (const option of options) {
                const childCtx = {
                    ...ctx,
                    common: {
                        ...ctx.common,
                        issues: [],
                    },
                    parent: null,
                };
                const result = option._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: childCtx,
                });
                if (result.status === "valid") {
                    return result;
                }
                else if (result.status === "dirty" && !dirty) {
                    dirty = { result, ctx: childCtx };
                }
                if (childCtx.common.issues.length) {
                    issues.push(childCtx.common.issues);
                }
            }
            if (dirty) {
                ctx.common.issues.push(...dirty.ctx.common.issues);
                return dirty.result;
            }
            const unionErrors = issues.map((issues) => new ZodError(issues));
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_union,
                unionErrors,
            });
            return INVALID;
        }
    }
    get options() {
        return this._def.options;
    }
}
ZodUnion.create = (types, params) => {
    return new ZodUnion({
        options: types,
        typeName: ZodFirstPartyTypeKind.ZodUnion,
        ...processCreateParams(params),
    });
};
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
//////////                                 //////////
//////////      ZodDiscriminatedUnion      //////////
//////////                                 //////////
/////////////////////////////////////////////////////
/////////////////////////////////////////////////////
const getDiscriminator = (type) => {
    if (type instanceof ZodLazy) {
        return getDiscriminator(type.schema);
    }
    else if (type instanceof ZodEffects) {
        return getDiscriminator(type.innerType());
    }
    else if (type instanceof ZodLiteral) {
        return [type.value];
    }
    else if (type instanceof ZodEnum) {
        return type.options;
    }
    else if (type instanceof ZodNativeEnum) {
        // eslint-disable-next-line ban/ban
        return util.objectValues(type.enum);
    }
    else if (type instanceof ZodDefault) {
        return getDiscriminator(type._def.innerType);
    }
    else if (type instanceof ZodUndefined) {
        return [undefined];
    }
    else if (type instanceof ZodNull) {
        return [null];
    }
    else if (type instanceof ZodOptional) {
        return [undefined, ...getDiscriminator(type.unwrap())];
    }
    else if (type instanceof ZodNullable) {
        return [null, ...getDiscriminator(type.unwrap())];
    }
    else if (type instanceof ZodBranded) {
        return getDiscriminator(type.unwrap());
    }
    else if (type instanceof ZodReadonly) {
        return getDiscriminator(type.unwrap());
    }
    else if (type instanceof ZodCatch) {
        return getDiscriminator(type._def.innerType);
    }
    else {
        return [];
    }
};
class ZodDiscriminatedUnion extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const discriminator = this.discriminator;
        const discriminatorValue = ctx.data[discriminator];
        const option = this.optionsMap.get(discriminatorValue);
        if (!option) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_union_discriminator,
                options: Array.from(this.optionsMap.keys()),
                path: [discriminator],
            });
            return INVALID;
        }
        if (ctx.common.async) {
            return option._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
        }
        else {
            return option._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
        }
    }
    get discriminator() {
        return this._def.discriminator;
    }
    get options() {
        return this._def.options;
    }
    get optionsMap() {
        return this._def.optionsMap;
    }
    /**
     * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
     * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
     * have a different value for each object in the union.
     * @param discriminator the name of the discriminator property
     * @param types an array of object schemas
     * @param params
     */
    static create(discriminator, options, params) {
        // Get all the valid discriminator values
        const optionsMap = new Map();
        // try {
        for (const type of options) {
            const discriminatorValues = getDiscriminator(type.shape[discriminator]);
            if (!discriminatorValues.length) {
                throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
            }
            for (const value of discriminatorValues) {
                if (optionsMap.has(value)) {
                    throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
                }
                optionsMap.set(value, type);
            }
        }
        return new ZodDiscriminatedUnion({
            typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
            discriminator,
            options,
            optionsMap,
            ...processCreateParams(params),
        });
    }
}
function mergeValues(a, b) {
    const aType = getParsedType(a);
    const bType = getParsedType(b);
    if (a === b) {
        return { valid: true, data: a };
    }
    else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
        const bKeys = util.objectKeys(b);
        const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
        const newObj = { ...a, ...b };
        for (const key of sharedKeys) {
            const sharedValue = mergeValues(a[key], b[key]);
            if (!sharedValue.valid) {
                return { valid: false };
            }
            newObj[key] = sharedValue.data;
        }
        return { valid: true, data: newObj };
    }
    else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
        if (a.length !== b.length) {
            return { valid: false };
        }
        const newArray = [];
        for (let index = 0; index < a.length; index++) {
            const itemA = a[index];
            const itemB = b[index];
            const sharedValue = mergeValues(itemA, itemB);
            if (!sharedValue.valid) {
                return { valid: false };
            }
            newArray.push(sharedValue.data);
        }
        return { valid: true, data: newArray };
    }
    else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
        return { valid: true, data: a };
    }
    else {
        return { valid: false };
    }
}
class ZodIntersection extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const handleParsed = (parsedLeft, parsedRight) => {
            if (isAborted(parsedLeft) || isAborted(parsedRight)) {
                return INVALID;
            }
            const merged = mergeValues(parsedLeft.value, parsedRight.value);
            if (!merged.valid) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.invalid_intersection_types,
                });
                return INVALID;
            }
            if (isDirty(parsedLeft) || isDirty(parsedRight)) {
                status.dirty();
            }
            return { status: status.value, value: merged.data };
        };
        if (ctx.common.async) {
            return Promise.all([
                this._def.left._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                }),
                this._def.right._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                }),
            ]).then(([left, right]) => handleParsed(left, right));
        }
        else {
            return handleParsed(this._def.left._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            }), this._def.right._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            }));
        }
    }
}
ZodIntersection.create = (left, right, params) => {
    return new ZodIntersection({
        left: left,
        right: right,
        typeName: ZodFirstPartyTypeKind.ZodIntersection,
        ...processCreateParams(params),
    });
};
// type ZodTupleItems = [ZodTypeAny, ...ZodTypeAny[]];
class ZodTuple extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.array) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.array,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        if (ctx.data.length < this._def.items.length) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: this._def.items.length,
                inclusive: true,
                exact: false,
                type: "array",
            });
            return INVALID;
        }
        const rest = this._def.rest;
        if (!rest && ctx.data.length > this._def.items.length) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: this._def.items.length,
                inclusive: true,
                exact: false,
                type: "array",
            });
            status.dirty();
        }
        const items = [...ctx.data]
            .map((item, itemIndex) => {
            const schema = this._def.items[itemIndex] || this._def.rest;
            if (!schema)
                return null;
            return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
        })
            .filter((x) => !!x); // filter nulls
        if (ctx.common.async) {
            return Promise.all(items).then((results) => {
                return ParseStatus.mergeArray(status, results);
            });
        }
        else {
            return ParseStatus.mergeArray(status, items);
        }
    }
    get items() {
        return this._def.items;
    }
    rest(rest) {
        return new ZodTuple({
            ...this._def,
            rest,
        });
    }
}
ZodTuple.create = (schemas, params) => {
    if (!Array.isArray(schemas)) {
        throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    }
    return new ZodTuple({
        items: schemas,
        typeName: ZodFirstPartyTypeKind.ZodTuple,
        rest: null,
        ...processCreateParams(params),
    });
};
class ZodRecord extends ZodType {
    get keySchema() {
        return this._def.keyType;
    }
    get valueSchema() {
        return this._def.valueType;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.object,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const pairs = [];
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        for (const key in ctx.data) {
            pairs.push({
                key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
                value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
                alwaysSet: key in ctx.data,
            });
        }
        if (ctx.common.async) {
            return ParseStatus.mergeObjectAsync(status, pairs);
        }
        else {
            return ParseStatus.mergeObjectSync(status, pairs);
        }
    }
    get element() {
        return this._def.valueType;
    }
    static create(first, second, third) {
        if (second instanceof ZodType) {
            return new ZodRecord({
                keyType: first,
                valueType: second,
                typeName: ZodFirstPartyTypeKind.ZodRecord,
                ...processCreateParams(third),
            });
        }
        return new ZodRecord({
            keyType: ZodString.create(),
            valueType: first,
            typeName: ZodFirstPartyTypeKind.ZodRecord,
            ...processCreateParams(second),
        });
    }
}
class ZodMap extends ZodType {
    get keySchema() {
        return this._def.keyType;
    }
    get valueSchema() {
        return this._def.valueType;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.map) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.map,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        const pairs = [...ctx.data.entries()].map(([key, value], index) => {
            return {
                key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
                value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"])),
            };
        });
        if (ctx.common.async) {
            const finalMap = new Map();
            return Promise.resolve().then(async () => {
                for (const pair of pairs) {
                    const key = await pair.key;
                    const value = await pair.value;
                    if (key.status === "aborted" || value.status === "aborted") {
                        return INVALID;
                    }
                    if (key.status === "dirty" || value.status === "dirty") {
                        status.dirty();
                    }
                    finalMap.set(key.value, value.value);
                }
                return { status: status.value, value: finalMap };
            });
        }
        else {
            const finalMap = new Map();
            for (const pair of pairs) {
                const key = pair.key;
                const value = pair.value;
                if (key.status === "aborted" || value.status === "aborted") {
                    return INVALID;
                }
                if (key.status === "dirty" || value.status === "dirty") {
                    status.dirty();
                }
                finalMap.set(key.value, value.value);
            }
            return { status: status.value, value: finalMap };
        }
    }
}
ZodMap.create = (keyType, valueType, params) => {
    return new ZodMap({
        valueType,
        keyType,
        typeName: ZodFirstPartyTypeKind.ZodMap,
        ...processCreateParams(params),
    });
};
class ZodSet extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.set) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.set,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const def = this._def;
        if (def.minSize !== null) {
            if (ctx.data.size < def.minSize.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_small,
                    minimum: def.minSize.value,
                    type: "set",
                    inclusive: true,
                    exact: false,
                    message: def.minSize.message,
                });
                status.dirty();
            }
        }
        if (def.maxSize !== null) {
            if (ctx.data.size > def.maxSize.value) {
                addIssueToContext(ctx, {
                    code: ZodIssueCode.too_big,
                    maximum: def.maxSize.value,
                    type: "set",
                    inclusive: true,
                    exact: false,
                    message: def.maxSize.message,
                });
                status.dirty();
            }
        }
        const valueType = this._def.valueType;
        function finalizeSet(elements) {
            const parsedSet = new Set();
            for (const element of elements) {
                if (element.status === "aborted")
                    return INVALID;
                if (element.status === "dirty")
                    status.dirty();
                parsedSet.add(element.value);
            }
            return { status: status.value, value: parsedSet };
        }
        const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
        if (ctx.common.async) {
            return Promise.all(elements).then((elements) => finalizeSet(elements));
        }
        else {
            return finalizeSet(elements);
        }
    }
    min(minSize, message) {
        return new ZodSet({
            ...this._def,
            minSize: { value: minSize, message: errorUtil.toString(message) },
        });
    }
    max(maxSize, message) {
        return new ZodSet({
            ...this._def,
            maxSize: { value: maxSize, message: errorUtil.toString(message) },
        });
    }
    size(size, message) {
        return this.min(size, message).max(size, message);
    }
    nonempty(message) {
        return this.min(1, message);
    }
}
ZodSet.create = (valueType, params) => {
    return new ZodSet({
        valueType,
        minSize: null,
        maxSize: null,
        typeName: ZodFirstPartyTypeKind.ZodSet,
        ...processCreateParams(params),
    });
};
class ZodLazy extends ZodType {
    get schema() {
        return this._def.getter();
    }
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const lazySchema = this._def.getter();
        return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
    }
}
ZodLazy.create = (getter, params) => {
    return new ZodLazy({
        getter: getter,
        typeName: ZodFirstPartyTypeKind.ZodLazy,
        ...processCreateParams(params),
    });
};
class ZodLiteral extends ZodType {
    _parse(input) {
        if (input.data !== this._def.value) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                received: ctx.data,
                code: ZodIssueCode.invalid_literal,
                expected: this._def.value,
            });
            return INVALID;
        }
        return { status: "valid", value: input.data };
    }
    get value() {
        return this._def.value;
    }
}
ZodLiteral.create = (value, params) => {
    return new ZodLiteral({
        value: value,
        typeName: ZodFirstPartyTypeKind.ZodLiteral,
        ...processCreateParams(params),
    });
};
function createZodEnum(values, params) {
    return new ZodEnum({
        values,
        typeName: ZodFirstPartyTypeKind.ZodEnum,
        ...processCreateParams(params),
    });
}
class ZodEnum extends ZodType {
    _parse(input) {
        if (typeof input.data !== "string") {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext(ctx, {
                expected: util.joinValues(expectedValues),
                received: ctx.parsedType,
                code: ZodIssueCode.invalid_type,
            });
            return INVALID;
        }
        if (!this._cache) {
            this._cache = new Set(this._def.values);
        }
        if (!this._cache.has(input.data)) {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext(ctx, {
                received: ctx.data,
                code: ZodIssueCode.invalid_enum_value,
                options: expectedValues,
            });
            return INVALID;
        }
        return OK(input.data);
    }
    get options() {
        return this._def.values;
    }
    get enum() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    get Values() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    get Enum() {
        const enumValues = {};
        for (const val of this._def.values) {
            enumValues[val] = val;
        }
        return enumValues;
    }
    extract(values, newDef = this._def) {
        return ZodEnum.create(values, {
            ...this._def,
            ...newDef,
        });
    }
    exclude(values, newDef = this._def) {
        return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
            ...this._def,
            ...newDef,
        });
    }
}
ZodEnum.create = createZodEnum;
class ZodNativeEnum extends ZodType {
    _parse(input) {
        const nativeEnumValues = util.getValidEnumValues(this._def.values);
        const ctx = this._getOrReturnCtx(input);
        if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
            const expectedValues = util.objectValues(nativeEnumValues);
            addIssueToContext(ctx, {
                expected: util.joinValues(expectedValues),
                received: ctx.parsedType,
                code: ZodIssueCode.invalid_type,
            });
            return INVALID;
        }
        if (!this._cache) {
            this._cache = new Set(util.getValidEnumValues(this._def.values));
        }
        if (!this._cache.has(input.data)) {
            const expectedValues = util.objectValues(nativeEnumValues);
            addIssueToContext(ctx, {
                received: ctx.data,
                code: ZodIssueCode.invalid_enum_value,
                options: expectedValues,
            });
            return INVALID;
        }
        return OK(input.data);
    }
    get enum() {
        return this._def.values;
    }
}
ZodNativeEnum.create = (values, params) => {
    return new ZodNativeEnum({
        values: values,
        typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
        ...processCreateParams(params),
    });
};
class ZodPromise extends ZodType {
    unwrap() {
        return this._def.type;
    }
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.promise,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
        return OK(promisified.then((data) => {
            return this._def.type.parseAsync(data, {
                path: ctx.path,
                errorMap: ctx.common.contextualErrorMap,
            });
        }));
    }
}
ZodPromise.create = (schema, params) => {
    return new ZodPromise({
        type: schema,
        typeName: ZodFirstPartyTypeKind.ZodPromise,
        ...processCreateParams(params),
    });
};
class ZodEffects extends ZodType {
    innerType() {
        return this._def.schema;
    }
    sourceType() {
        return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects
            ? this._def.schema.sourceType()
            : this._def.schema;
    }
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const effect = this._def.effect || null;
        const checkCtx = {
            addIssue: (arg) => {
                addIssueToContext(ctx, arg);
                if (arg.fatal) {
                    status.abort();
                }
                else {
                    status.dirty();
                }
            },
            get path() {
                return ctx.path;
            },
        };
        checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
        if (effect.type === "preprocess") {
            const processed = effect.transform(ctx.data, checkCtx);
            if (ctx.common.async) {
                return Promise.resolve(processed).then(async (processed) => {
                    if (status.value === "aborted")
                        return INVALID;
                    const result = await this._def.schema._parseAsync({
                        data: processed,
                        path: ctx.path,
                        parent: ctx,
                    });
                    if (result.status === "aborted")
                        return INVALID;
                    if (result.status === "dirty")
                        return DIRTY(result.value);
                    if (status.value === "dirty")
                        return DIRTY(result.value);
                    return result;
                });
            }
            else {
                if (status.value === "aborted")
                    return INVALID;
                const result = this._def.schema._parseSync({
                    data: processed,
                    path: ctx.path,
                    parent: ctx,
                });
                if (result.status === "aborted")
                    return INVALID;
                if (result.status === "dirty")
                    return DIRTY(result.value);
                if (status.value === "dirty")
                    return DIRTY(result.value);
                return result;
            }
        }
        if (effect.type === "refinement") {
            const executeRefinement = (acc) => {
                const result = effect.refinement(acc, checkCtx);
                if (ctx.common.async) {
                    return Promise.resolve(result);
                }
                if (result instanceof Promise) {
                    throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
                }
                return acc;
            };
            if (ctx.common.async === false) {
                const inner = this._def.schema._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (inner.status === "aborted")
                    return INVALID;
                if (inner.status === "dirty")
                    status.dirty();
                // return value is ignored
                executeRefinement(inner.value);
                return { status: status.value, value: inner.value };
            }
            else {
                return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
                    if (inner.status === "aborted")
                        return INVALID;
                    if (inner.status === "dirty")
                        status.dirty();
                    return executeRefinement(inner.value).then(() => {
                        return { status: status.value, value: inner.value };
                    });
                });
            }
        }
        if (effect.type === "transform") {
            if (ctx.common.async === false) {
                const base = this._def.schema._parseSync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (!isValid(base))
                    return INVALID;
                const result = effect.transform(base.value, checkCtx);
                if (result instanceof Promise) {
                    throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
                }
                return { status: status.value, value: result };
            }
            else {
                return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
                    if (!isValid(base))
                        return INVALID;
                    return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
                        status: status.value,
                        value: result,
                    }));
                });
            }
        }
        util.assertNever(effect);
    }
}
ZodEffects.create = (schema, effect, params) => {
    return new ZodEffects({
        schema,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect,
        ...processCreateParams(params),
    });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
    return new ZodEffects({
        schema,
        effect: { type: "preprocess", transform: preprocess },
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        ...processCreateParams(params),
    });
};
class ZodOptional extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.undefined) {
            return OK(undefined);
        }
        return this._def.innerType._parse(input);
    }
    unwrap() {
        return this._def.innerType;
    }
}
ZodOptional.create = (type, params) => {
    return new ZodOptional({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodOptional,
        ...processCreateParams(params),
    });
};
class ZodNullable extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.null) {
            return OK(null);
        }
        return this._def.innerType._parse(input);
    }
    unwrap() {
        return this._def.innerType;
    }
}
ZodNullable.create = (type, params) => {
    return new ZodNullable({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodNullable,
        ...processCreateParams(params),
    });
};
class ZodDefault extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        let data = ctx.data;
        if (ctx.parsedType === ZodParsedType.undefined) {
            data = this._def.defaultValue();
        }
        return this._def.innerType._parse({
            data,
            path: ctx.path,
            parent: ctx,
        });
    }
    removeDefault() {
        return this._def.innerType;
    }
}
ZodDefault.create = (type, params) => {
    return new ZodDefault({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodDefault,
        defaultValue: typeof params.default === "function" ? params.default : () => params.default,
        ...processCreateParams(params),
    });
};
class ZodCatch extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        // newCtx is used to not collect issues from inner types in ctx
        const newCtx = {
            ...ctx,
            common: {
                ...ctx.common,
                issues: [],
            },
        };
        const result = this._def.innerType._parse({
            data: newCtx.data,
            path: newCtx.path,
            parent: {
                ...newCtx,
            },
        });
        if (isAsync(result)) {
            return result.then((result) => {
                return {
                    status: "valid",
                    value: result.status === "valid"
                        ? result.value
                        : this._def.catchValue({
                            get error() {
                                return new ZodError(newCtx.common.issues);
                            },
                            input: newCtx.data,
                        }),
                };
            });
        }
        else {
            return {
                status: "valid",
                value: result.status === "valid"
                    ? result.value
                    : this._def.catchValue({
                        get error() {
                            return new ZodError(newCtx.common.issues);
                        },
                        input: newCtx.data,
                    }),
            };
        }
    }
    removeCatch() {
        return this._def.innerType;
    }
}
ZodCatch.create = (type, params) => {
    return new ZodCatch({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodCatch,
        catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
        ...processCreateParams(params),
    });
};
class ZodNaN extends ZodType {
    _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.nan) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.nan,
                received: ctx.parsedType,
            });
            return INVALID;
        }
        return { status: "valid", value: input.data };
    }
}
ZodNaN.create = (params) => {
    return new ZodNaN({
        typeName: ZodFirstPartyTypeKind.ZodNaN,
        ...processCreateParams(params),
    });
};
class ZodBranded extends ZodType {
    _parse(input) {
        const { ctx } = this._processInputParams(input);
        const data = ctx.data;
        return this._def.type._parse({
            data,
            path: ctx.path,
            parent: ctx,
        });
    }
    unwrap() {
        return this._def.type;
    }
}
class ZodPipeline extends ZodType {
    _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.common.async) {
            const handleAsync = async () => {
                const inResult = await this._def.in._parseAsync({
                    data: ctx.data,
                    path: ctx.path,
                    parent: ctx,
                });
                if (inResult.status === "aborted")
                    return INVALID;
                if (inResult.status === "dirty") {
                    status.dirty();
                    return DIRTY(inResult.value);
                }
                else {
                    return this._def.out._parseAsync({
                        data: inResult.value,
                        path: ctx.path,
                        parent: ctx,
                    });
                }
            };
            return handleAsync();
        }
        else {
            const inResult = this._def.in._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx,
            });
            if (inResult.status === "aborted")
                return INVALID;
            if (inResult.status === "dirty") {
                status.dirty();
                return {
                    status: "dirty",
                    value: inResult.value,
                };
            }
            else {
                return this._def.out._parseSync({
                    data: inResult.value,
                    path: ctx.path,
                    parent: ctx,
                });
            }
        }
    }
    static create(a, b) {
        return new ZodPipeline({
            in: a,
            out: b,
            typeName: ZodFirstPartyTypeKind.ZodPipeline,
        });
    }
}
class ZodReadonly extends ZodType {
    _parse(input) {
        const result = this._def.innerType._parse(input);
        const freeze = (data) => {
            if (isValid(data)) {
                data.value = Object.freeze(data.value);
            }
            return data;
        };
        return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
    }
    unwrap() {
        return this._def.innerType;
    }
}
ZodReadonly.create = (type, params) => {
    return new ZodReadonly({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodReadonly,
        ...processCreateParams(params),
    });
};
({
    object: ZodObject.lazycreate,
});
var ZodFirstPartyTypeKind;
(function (ZodFirstPartyTypeKind) {
    ZodFirstPartyTypeKind["ZodString"] = "ZodString";
    ZodFirstPartyTypeKind["ZodNumber"] = "ZodNumber";
    ZodFirstPartyTypeKind["ZodNaN"] = "ZodNaN";
    ZodFirstPartyTypeKind["ZodBigInt"] = "ZodBigInt";
    ZodFirstPartyTypeKind["ZodBoolean"] = "ZodBoolean";
    ZodFirstPartyTypeKind["ZodDate"] = "ZodDate";
    ZodFirstPartyTypeKind["ZodSymbol"] = "ZodSymbol";
    ZodFirstPartyTypeKind["ZodUndefined"] = "ZodUndefined";
    ZodFirstPartyTypeKind["ZodNull"] = "ZodNull";
    ZodFirstPartyTypeKind["ZodAny"] = "ZodAny";
    ZodFirstPartyTypeKind["ZodUnknown"] = "ZodUnknown";
    ZodFirstPartyTypeKind["ZodNever"] = "ZodNever";
    ZodFirstPartyTypeKind["ZodVoid"] = "ZodVoid";
    ZodFirstPartyTypeKind["ZodArray"] = "ZodArray";
    ZodFirstPartyTypeKind["ZodObject"] = "ZodObject";
    ZodFirstPartyTypeKind["ZodUnion"] = "ZodUnion";
    ZodFirstPartyTypeKind["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
    ZodFirstPartyTypeKind["ZodIntersection"] = "ZodIntersection";
    ZodFirstPartyTypeKind["ZodTuple"] = "ZodTuple";
    ZodFirstPartyTypeKind["ZodRecord"] = "ZodRecord";
    ZodFirstPartyTypeKind["ZodMap"] = "ZodMap";
    ZodFirstPartyTypeKind["ZodSet"] = "ZodSet";
    ZodFirstPartyTypeKind["ZodFunction"] = "ZodFunction";
    ZodFirstPartyTypeKind["ZodLazy"] = "ZodLazy";
    ZodFirstPartyTypeKind["ZodLiteral"] = "ZodLiteral";
    ZodFirstPartyTypeKind["ZodEnum"] = "ZodEnum";
    ZodFirstPartyTypeKind["ZodEffects"] = "ZodEffects";
    ZodFirstPartyTypeKind["ZodNativeEnum"] = "ZodNativeEnum";
    ZodFirstPartyTypeKind["ZodOptional"] = "ZodOptional";
    ZodFirstPartyTypeKind["ZodNullable"] = "ZodNullable";
    ZodFirstPartyTypeKind["ZodDefault"] = "ZodDefault";
    ZodFirstPartyTypeKind["ZodCatch"] = "ZodCatch";
    ZodFirstPartyTypeKind["ZodPromise"] = "ZodPromise";
    ZodFirstPartyTypeKind["ZodBranded"] = "ZodBranded";
    ZodFirstPartyTypeKind["ZodPipeline"] = "ZodPipeline";
    ZodFirstPartyTypeKind["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
const stringType = ZodString.create;
const numberType = ZodNumber.create;
ZodNaN.create;
ZodBigInt.create;
const booleanType = ZodBoolean.create;
const dateType = ZodDate.create;
ZodSymbol.create;
ZodUndefined.create;
ZodNull.create;
ZodAny.create;
const unknownType = ZodUnknown.create;
ZodNever.create;
ZodVoid.create;
const arrayType = ZodArray.create;
const objectType = ZodObject.create;
ZodObject.strictCreate;
ZodUnion.create;
const discriminatedUnionType = ZodDiscriminatedUnion.create;
ZodIntersection.create;
ZodTuple.create;
const recordType = ZodRecord.create;
ZodMap.create;
ZodSet.create;
ZodLazy.create;
const literalType = ZodLiteral.create;
const enumType = ZodEnum.create;
ZodNativeEnum.create;
ZodPromise.create;
ZodEffects.create;
ZodOptional.create;
ZodNullable.create;
ZodEffects.createWithPreprocess;

const indexedChunkSourceTypes = ['repo', 'docs_site', 'website', 'github', 'stackoverflow'];
const indexedChunkTrustTiers = ['official_docs', 'repo', 'community', 'external'];
const rankingAdjustmentSignals = ['trust', 'freshness'];
const rankingAdjustmentDirections = ['boost', 'penalty', 'neutral'];
const rankingAdjustmentBases = ['trust_tier', 'last_modified', 'volatile_content'];
const freshnessProfiles = ['standard', 'volatile'];
const evidencePackStatuses = ['ready', 'insufficient_evidence'];
const evidencePackReasons = ['below_minimum_evidence'];
const supportQueryIntents = [
    'install',
    'cli',
    'scripting',
    'auth',
    'pricing',
    'troubleshooting',
    'version_release',
    'unknown'
];
const classifierOverrideMatchModes = ['all', 'any'];
const indexedChunkSourceTypeSchema = literalType(indexedChunkSourceTypes[0])
    .or(literalType(indexedChunkSourceTypes[1]))
    .or(literalType(indexedChunkSourceTypes[2]))
    .or(literalType(indexedChunkSourceTypes[3]))
    .or(literalType(indexedChunkSourceTypes[4]));
const indexedChunkTrustTierSchema = literalType(indexedChunkTrustTiers[0])
    .or(literalType(indexedChunkTrustTiers[1]))
    .or(literalType(indexedChunkTrustTiers[2]))
    .or(literalType(indexedChunkTrustTiers[3]));
const rankingAdjustmentSignalSchema = enumType(rankingAdjustmentSignals);
const rankingAdjustmentDirectionSchema = enumType(rankingAdjustmentDirections);
const rankingAdjustmentBasisSchema = enumType(rankingAdjustmentBases);
const freshnessProfileSchema = enumType(freshnessProfiles);
enumType(evidencePackStatuses);
enumType(evidencePackReasons);
const supportQueryIntentSchema = enumType(supportQueryIntents);
const classifierOverrideMatchModeSchema = enumType(classifierOverrideMatchModes);
const searchModeSchema = literalType('vector').or(literalType('keyword')).or(literalType('hybrid'));
const filterOptionsSchema = objectType({
    sourceTypes: arrayType(indexedChunkSourceTypeSchema).optional(),
    trustTiers: arrayType(indexedChunkTrustTierSchema).optional(),
    minDate: dateType().optional()
});
const indexedChunkSchema = objectType({
    id: stringType(),
    documentId: stringType(),
    content: stringType(),
    contentHash: stringType(),
    headingAnchor: stringType().optional(),
    chunkIndex: numberType().int().nonnegative(),
    metadata: recordType(stringType(), unknownType()),
    embedding: arrayType(numberType()),
    sourceType: indexedChunkSourceTypeSchema,
    trustTier: indexedChunkTrustTierSchema,
    lastModified: dateType()
});
const trustTierScoreOverridesSchema = objectType({
    official_docs: numberType().min(0).max(1).optional(),
    repo: numberType().min(0).max(1).optional(),
    community: numberType().min(0).max(1).optional(),
    external: numberType().min(0).max(1).optional()
});
const rankingAdjustmentSchema = objectType({
    signal: rankingAdjustmentSignalSchema,
    basis: rankingAdjustmentBasisSchema,
    score: numberType(),
    weight: numberType(),
    baseline: numberType(),
    contribution: numberType(),
    direction: rankingAdjustmentDirectionSchema
});
const rankingRationaleSchema = objectType({
    baseScore: numberType(),
    finalScore: numberType(),
    trustScore: numberType(),
    freshnessScore: numberType(),
    trustTier: indexedChunkTrustTierSchema,
    ageDays: numberType().nonnegative(),
    freshnessProfile: freshnessProfileSchema,
    freshnessHalfLifeDays: numberType().positive(),
    matchedVolatilityIndicators: arrayType(stringType()),
    adjustments: arrayType(rankingAdjustmentSchema)
});
const rankingOptionsSchema = objectType({
    enabled: booleanType().optional(),
    trustWeight: numberType().min(0).optional(),
    freshnessWeight: numberType().min(0).optional(),
    trustTierScores: trustTierScoreOverridesSchema.optional(),
    freshnessHalfLifeDays: numberType().positive().optional(),
    volatileFreshnessHalfLifeDays: numberType().positive().optional(),
    volatilityIndicators: arrayType(stringType().min(1)).optional(),
    now: dateType().optional()
});
objectType({
    chunk: indexedChunkSchema,
    score: numberType(),
    vectorScore: numberType().optional(),
    keywordScore: numberType().optional(),
    ranking: rankingRationaleSchema.optional()
});
const searchOptionsSchema = objectType({
    mode: searchModeSchema,
    topK: numberType().int().positive().optional(),
    vectorWeight: numberType().min(0).max(1).optional(),
    keywordWeight: numberType().min(0).max(1).optional(),
    filter: filterOptionsSchema.optional(),
    ranking: rankingOptionsSchema.optional()
});
const evidenceDocumentReferenceSchema = objectType({
    title: stringType().min(1).optional(),
    url: stringType().url().optional(),
    sourcePath: stringType().min(1).optional()
});
const evidenceBundleSchema = objectType({
    documentId: stringType(),
    sourceType: indexedChunkSourceTypeSchema,
    title: stringType(),
    headingAnchor: stringType().optional(),
    trustTier: indexedChunkTrustTierSchema,
    retrievalScore: numberType(),
    ranking: rankingRationaleSchema.optional(),
    supportCount: numberType().int().positive(),
    supportingChunkIds: arrayType(stringType()),
    url: stringType().url().optional(),
    sourcePath: stringType().min(1).optional()
})
    .refine((value) => Number(Boolean(value.url)) + Number(Boolean(value.sourcePath)) === 1, {
    message: 'EvidenceBundle requires exactly one of url or sourcePath'
});
objectType({
    minEvidence: numberType().int().nonnegative().optional(),
    maxEvidence: numberType().int().nonnegative().optional(),
    documentsById: recordType(stringType(), evidenceDocumentReferenceSchema).optional()
});
const supportQueryIntentScoresSchema = objectType({
    install: numberType().nonnegative(),
    cli: numberType().nonnegative(),
    scripting: numberType().nonnegative(),
    auth: numberType().nonnegative(),
    pricing: numberType().nonnegative(),
    troubleshooting: numberType().nonnegative(),
    version_release: numberType().nonnegative(),
    unknown: numberType().nonnegative()
});
const supportQueryClassificationSchema = objectType({
    intent: supportQueryIntentSchema,
    score: numberType().nonnegative(),
    matchedSignals: arrayType(stringType()),
    scores: supportQueryIntentScoresSchema,
    isFallback: booleanType()
});
const supportQueryIntentTermOverridesSchema = objectType({
    install: arrayType(stringType().min(1)).optional(),
    cli: arrayType(stringType().min(1)).optional(),
    scripting: arrayType(stringType().min(1)).optional(),
    auth: arrayType(stringType().min(1)).optional(),
    pricing: arrayType(stringType().min(1)).optional(),
    troubleshooting: arrayType(stringType().min(1)).optional(),
    version_release: arrayType(stringType().min(1)).optional()
});
const supportQueryClassifierOverrideSchema = objectType({
    intent: supportQueryIntentSchema,
    terms: arrayType(stringType().min(1)).min(1),
    matchMode: classifierOverrideMatchModeSchema.optional()
});
const supportQueryClassifierConfigSchema = objectType({
    minimumScore: numberType().nonnegative().optional(),
    minimumMargin: numberType().nonnegative().optional(),
    overrides: arrayType(supportQueryClassifierOverrideSchema).optional(),
    extraTermsByIntent: supportQueryIntentTermOverridesSchema.optional()
});
const routedEvidenceOptionsSchema = objectType({
    minEvidence: numberType().int().nonnegative().optional(),
    maxEvidence: numberType().int().nonnegative().optional()
});
objectType({
    search: searchOptionsSchema,
    evidence: routedEvidenceOptionsSchema.optional()
});
const supportQueryRoutingRuleOverrideSchema = objectType({
    search: searchOptionsSchema.partial().optional(),
    evidence: routedEvidenceOptionsSchema.optional()
});
const supportQueryRouteOverridesSchema = objectType({
    install: supportQueryRoutingRuleOverrideSchema.optional(),
    cli: supportQueryRoutingRuleOverrideSchema.optional(),
    scripting: supportQueryRoutingRuleOverrideSchema.optional(),
    auth: supportQueryRoutingRuleOverrideSchema.optional(),
    pricing: supportQueryRoutingRuleOverrideSchema.optional(),
    troubleshooting: supportQueryRoutingRuleOverrideSchema.optional(),
    version_release: supportQueryRoutingRuleOverrideSchema.optional(),
    unknown: supportQueryRoutingRuleOverrideSchema.optional()
});
const supportQueryRoutingConfigSchema = objectType({
    classifier: supportQueryClassifierConfigSchema.optional(),
    routeOverrides: supportQueryRouteOverridesSchema.optional()
});
const supportQueryRoutePlanSchema = objectType({
    query: stringType(),
    intent: supportQueryIntentSchema,
    classification: supportQueryClassificationSchema,
    search: searchOptionsSchema,
    evidence: routedEvidenceOptionsSchema.optional()
});
const readyEvidencePackResultSchema = objectType({
    status: literalType('ready'),
    evidence: arrayType(evidenceBundleSchema),
    totalHits: numberType().int().nonnegative(),
    packedEvidenceCount: numberType().int().nonnegative(),
    minEvidence: numberType().int().nonnegative()
});
const insufficientEvidencePackResultSchema = objectType({
    status: literalType('insufficient_evidence'),
    reason: literalType('below_minimum_evidence'),
    evidence: arrayType(evidenceBundleSchema).length(0),
    totalHits: numberType().int().nonnegative(),
    packedEvidenceCount: numberType().int().nonnegative(),
    minEvidence: numberType().int().nonnegative()
});
const evidencePackResultSchema = discriminatedUnionType('status', [
    readyEvidencePackResultSchema,
    insufficientEvidencePackResultSchema
]);

const apiErrorCodeSchema = z.enum(['validation_error', 'method_not_allowed', 'not_found', 'internal_error']);
const apiValidationIssueSchema = z
    .object({
    path: z.string(),
    message: z.string(),
    code: z.string()
})
    .strict();
const apiErrorResponseSchema = z
    .object({
    ok: z.literal(false),
    error: z
        .object({
        code: apiErrorCodeSchema,
        message: z.string(),
        details: z.array(apiValidationIssueSchema).optional()
    })
        .strict()
})
    .strict();
const nonEmptyQuerySchema = z.string().trim().min(1, 'Query is required.');
const sourcesRequestSchema = z
    .object({
    query: nonEmptyQuerySchema
})
    .strict();
const chatRequestSchema = z
    .object({
    query: nonEmptyQuerySchema,
    fallbackMessage: z.string().trim().min(1, 'Fallback message must not be empty.').optional()
})
    .strict();
const routeSearchFilterSchema = z
    .object({
    sourceTypes: z.array(indexedChunkSourceTypeSchema).optional(),
    trustTiers: z.array(indexedChunkTrustTierSchema).optional()
})
    .strict();
const routeSearchRankingSchema = z
    .object({
    trustWeight: z.number().min(0).optional(),
    freshnessWeight: z.number().min(0).optional(),
    freshnessHalfLifeDays: z.number().positive().optional(),
    volatileFreshnessHalfLifeDays: z.number().positive().optional(),
    volatilityIndicators: z.array(z.string().min(1)).optional()
})
    .strict();
const routeSearchSummarySchema = z
    .object({
    mode: searchModeSchema,
    topK: z.number().int().positive().optional(),
    vectorWeight: z.number().min(0).max(1).optional(),
    keywordWeight: z.number().min(0).max(1).optional(),
    filter: routeSearchFilterSchema.optional(),
    ranking: routeSearchRankingSchema.optional()
})
    .strict();
const supportQueryRouteSummarySchema = z
    .object({
    query: z.string(),
    intent: supportQueryIntentSchema,
    classification: supportQueryClassificationSchema,
    search: routeSearchSummarySchema,
    evidence: routedEvidenceOptionsSchema.optional()
})
    .strict();
const healthResponseSchema = z
    .object({
    ok: z.literal(true),
    service: z.string().min(1),
    status: z.literal('ok'),
    policyVersion: z.string().min(1),
    timestamp: z.string().datetime()
})
    .strict();
const answerGenerationModeSchema = z.enum(['grounded', 'fallback']);
const supportAnswerConfidenceLabelSchema = z.enum(['high', 'medium', 'low', 'insufficient']);
const fallbackReasonSchema = z.enum(['weak_evidence', 'insufficient_evidence', 'security_sensitive']);
const supportAnswerSafetyClassificationSchema = z.enum([
    'normal',
    'low_confidence',
    'insufficient_evidence',
    'security_sensitive'
]);
z.enum([
    'none',
    'security_email',
    'docs',
    'github_discussions',
    'github_issues',
    'pricing',
    'downloads'
]);
const supportAnswerActiveEscalationChannelSchema = z.enum([
    'security_email',
    'docs',
    'github_discussions',
    'github_issues',
    'pricing',
    'downloads'
]);
const supportAnswerCitationBaseSchema = z
    .object({
    documentId: z.string(),
    sourceType: indexedChunkSourceTypeSchema,
    title: z.string(),
    headingAnchor: z.string().optional(),
    trustTier: trustTierSchema,
    retrievalScore: z.number(),
    supportCount: z.number().int().positive()
})
    .strict();
const apiSupportAnswerUrlCitationSchema = supportAnswerCitationBaseSchema.extend({
    url: z.string().url()
});
const apiSupportAnswerRepoCitationSchema = supportAnswerCitationBaseSchema.extend({
    sourcePath: z.string().min(1)
});
const apiSupportAnswerCitationSchema = z.union([
    apiSupportAnswerUrlCitationSchema,
    apiSupportAnswerRepoCitationSchema
]);
const apiSupportAnswerSafetySchema = z
    .object({
    classification: supportAnswerSafetyClassificationSchema,
    requiresFallback: z.boolean(),
    fallbackReason: fallbackReasonSchema.optional()
})
    .strict();
const apiSupportAnswerNoEscalationSchema = z
    .object({
    channel: z.literal('none'),
    shouldEscalate: z.literal(false)
})
    .strict();
const apiSupportAnswerActiveEscalationSchema = z
    .object({
    channel: supportAnswerActiveEscalationChannelSchema,
    shouldEscalate: z.literal(true),
    destination: z.string().min(1),
    label: z.string().min(1),
    message: z.string().min(1)
})
    .strict();
const apiSupportAnswerEscalationSchema = z.union([
    apiSupportAnswerNoEscalationSchema,
    apiSupportAnswerActiveEscalationSchema
]);
const apiSupportAnswerSchema = z
    .object({
    id: z.string(),
    query: z.string(),
    shortAnswer: z.string(),
    content: z.string(),
    steps: z.array(z.string()),
    commands: z.array(z.string()),
    citations: z.array(apiSupportAnswerCitationSchema),
    confidence: z.number().min(0).max(1),
    confidenceLabel: supportAnswerConfidenceLabelSchema,
    generatedAt: z.string().datetime(),
    modelVersion: z.string().optional(),
    policyVersion: z.string(),
    mode: answerGenerationModeSchema,
    safety: apiSupportAnswerSafetySchema,
    escalation: apiSupportAnswerEscalationSchema,
    uncertainty: z.string().optional(),
    fallbackReason: fallbackReasonSchema.optional()
})
    .strict();
const sourcesResponseSchema = z
    .object({
    ok: z.literal(true),
    query: z.string(),
    route: supportQueryRouteSummarySchema,
    evidence: evidencePackResultSchema,
    sources: z.array(evidenceBundleSchema)
})
    .strict();
const chatAnswerResponseSchema = z
    .object({
    ok: z.literal(true),
    result: z.literal('answer'),
    query: z.string(),
    route: supportQueryRouteSummarySchema,
    evidence: evidencePackResultSchema,
    answer: apiSupportAnswerSchema
})
    .strict();
const chatFallbackResponseSchema = z
    .object({
    ok: z.literal(true),
    result: z.literal('fallback'),
    query: z.string(),
    route: supportQueryRouteSummarySchema,
    evidence: evidencePackResultSchema,
    answer: apiSupportAnswerSchema,
    skippedGeneration: z.literal(true),
    reason: fallbackReasonSchema
})
    .strict();
const chatResponseSchema = z.discriminatedUnion('result', [
    chatAnswerResponseSchema,
    chatFallbackResponseSchema
]);
const answerGenerationDraftSchema = z
    .object({
    shortAnswer: z.string(),
    steps: z.array(z.string()).optional(),
    commands: z.array(z.string()).optional(),
    citedEvidenceIndexes: z.array(z.number().int().positive()).optional(),
    confidence: z.number().min(0).max(1).optional(),
    uncertainty: z.string().optional()
})
    .strict();
function toSupportQueryRouteSummary(route) {
    return supportQueryRouteSummarySchema.parse({
        query: route.query,
        intent: route.intent,
        classification: route.classification,
        search: {
            mode: route.search.mode,
            topK: route.search.topK,
            vectorWeight: route.search.vectorWeight,
            keywordWeight: route.search.keywordWeight,
            filter: route.search.filter
                ? {
                    sourceTypes: route.search.filter.sourceTypes,
                    trustTiers: route.search.filter.trustTiers
                }
                : undefined,
            ranking: route.search.ranking
                ? {
                    trustWeight: route.search.ranking.trustWeight,
                    freshnessWeight: route.search.ranking.freshnessWeight,
                    freshnessHalfLifeDays: route.search.ranking.freshnessHalfLifeDays,
                    volatileFreshnessHalfLifeDays: route.search.ranking.volatileFreshnessHalfLifeDays,
                    volatilityIndicators: route.search.ranking.volatilityIndicators
                }
                : undefined
        },
        evidence: route.evidence
    });
}
function toApiSupportAnswer(answer) {
    return apiSupportAnswerSchema.parse({
        ...answer,
        generatedAt: answer.generatedAt.toISOString()
    });
}

function formatPath(path) {
    return path.length > 0 ? path.map(String).join('.') : '(root)';
}
function formatIssue(issue) {
    return {
        path: formatPath(issue.path),
        message: issue.message,
        code: issue.code
    };
}
function formatIssues(issues) {
    return issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`).join('; ');
}
class ApiValidationError extends Error {
    constructor(message, issues) {
        super(message);
        this.name = 'ApiValidationError';
        this.issues = issues;
    }
}
function createValidationError(path, message, code = 'custom') {
    return new ApiValidationError(message, [{ path, message, code }]);
}
function parseWithSchema(schema, data, message = 'Request validation failed.') {
    const result = schema.safeParse(data);
    if (result.success) {
        return result.data;
    }
    throw new ApiValidationError(message, result.error.issues.map(formatIssue));
}
function validateWithSchema(schema, data, message) {
    const result = schema.safeParse(data);
    if (result.success) {
        return result.data;
    }
    throw new Error(`${message}: ${formatIssues(result.error.issues)}`);
}

const ROUTABLE_INTENTS = [
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
const DEFAULT_INTENT_SIGNALS = {
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
const DEFAULT_SUPPORT_QUERY_ROUTING_RULES = {
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
function createEmptyScores() {
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
function normalizeText(value) {
    return value.toLowerCase().replace(/[^a-z0-9'\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function matchesTerms(query, terms, matchMode = 'any') {
    const normalizedTerms = terms.map((term) => normalizeText(term)).filter((term) => term.length > 0);
    if (normalizedTerms.length === 0) {
        return false;
    }
    return matchMode === 'all'
        ? normalizedTerms.every((term) => query.includes(term))
        : normalizedTerms.some((term) => query.includes(term));
}
function buildIntentSignals(config) {
    const signals = Object.fromEntries(ROUTABLE_INTENTS.map((intent) => [intent, DEFAULT_INTENT_SIGNALS[intent].map((signal) => ({ ...signal }))]));
    if (!(config === null || config === void 0 ? void 0 : config.extraTermsByIntent)) {
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
function cloneSearchOptions(search) {
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
function cloneEvidenceOptions(evidence) {
    return evidence ? { ...evidence } : undefined;
}
function mergeSearchOptions(base, override) {
    var _a, _b;
    if (!override) {
        return cloneSearchOptions(base);
    }
    return {
        ...cloneSearchOptions(base),
        ...override,
        filter: override.filter ? { ...((_a = base.filter) !== null && _a !== void 0 ? _a : {}), ...override.filter } : cloneSearchOptions(base).filter,
        ranking: override.ranking ? { ...((_b = base.ranking) !== null && _b !== void 0 ? _b : {}), ...override.ranking } : cloneSearchOptions(base).ranking
    };
}
function mergeEvidenceOptions(base, override) {
    if (!base && !override) {
        return undefined;
    }
    return {
        ...(base !== null && base !== void 0 ? base : {}),
        ...(override !== null && override !== void 0 ? override : {})
    };
}
function mergeRoutingRule(base, override) {
    return {
        search: mergeSearchOptions(base.search, override === null || override === void 0 ? void 0 : override.search),
        evidence: mergeEvidenceOptions(base.evidence, override === null || override === void 0 ? void 0 : override.evidence)
    };
}
function getDefaultSupportQueryRoutingRules() {
    return Object.fromEntries(Object.entries(DEFAULT_SUPPORT_QUERY_ROUTING_RULES).map(([intent, rule]) => [
        intent,
        {
            search: cloneSearchOptions(rule.search),
            evidence: cloneEvidenceOptions(rule.evidence)
        }
    ]));
}
function classifySupportQuery(query, config) {
    var _a, _b, _c, _d;
    const validatedConfig = supportQueryClassifierConfigSchema.parse(config !== null && config !== void 0 ? config : {});
    const normalizedQuery = normalizeText(query);
    const scores = createEmptyScores();
    const matchedSignals = ROUTABLE_INTENTS.reduce((accumulator, intent) => {
        accumulator[intent] = [];
        return accumulator;
    }, {
        install: [],
        cli: [],
        scripting: [],
        auth: [],
        pricing: [],
        troubleshooting: [],
        version_release: []
    });
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
    for (const override of (_a = validatedConfig.overrides) !== null && _a !== void 0 ? _a : []) {
        if (!matchesTerms(normalizedQuery, override.terms, (_b = override.matchMode) !== null && _b !== void 0 ? _b : 'all')) {
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
    const minimumScore = (_c = validatedConfig.minimumScore) !== null && _c !== void 0 ? _c : DEFAULT_MINIMUM_SCORE;
    const minimumMargin = (_d = validatedConfig.minimumMargin) !== null && _d !== void 0 ? _d : DEFAULT_MINIMUM_MARGIN;
    const isFallback = topScore < minimumScore || topScore - secondScore < minimumMargin;
    return supportQueryClassificationSchema.parse({
        intent: isFallback ? 'unknown' : topIntent,
        score: isFallback ? 0 : topScore,
        matchedSignals: matchedSignals[topIntent],
        scores,
        isFallback
    });
}
function planSupportQueryRoute(query, config) {
    var _a;
    const validatedConfig = supportQueryRoutingConfigSchema.parse(config !== null && config !== void 0 ? config : {});
    const classification = classifySupportQuery(query, validatedConfig.classifier);
    const defaultRule = getDefaultSupportQueryRoutingRules()[classification.intent];
    const route = mergeRoutingRule(defaultRule, (_a = validatedConfig.routeOverrides) === null || _a === void 0 ? void 0 : _a[classification.intent]);
    return supportQueryRoutePlanSchema.parse({
        query,
        intent: classification.intent,
        classification,
        search: route.search,
        evidence: route.evidence
    });
}

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_REGEX = /\b(?:https?:\/\/|mailto:)[^\s<>()]+/gi;
const WINDOWS_PATH_REGEX = /\b[A-Za-z]:\\[^\s<>"']+/g;
const UNIX_PATH_REGEX = /(^|[\s(])((?:\.{1,2}\/|\/)[^\s)<>"']+)/g;
const TOKEN_REGEX = /\b[a-zA-Z0-9._-]{20,}\b/g;
function replaceMatches(value, pattern, kind, replacement, state) {
    return value.replace(pattern, (...args) => {
        state.count += 1;
        state.kinds.add(kind);
        return typeof replacement === 'function' ? replacement(args[0], ...args.slice(1, -2)) : replacement;
    });
}
function redactSupportBotText(value, maxLength = 160) {
    const normalized = value.trim();
    const state = { count: 0, kinds: new Set() };
    let text = replaceMatches(normalized, EMAIL_REGEX, 'email', '[redacted:email]', state);
    text = replaceMatches(text, URL_REGEX, 'url', '[redacted:url]', state);
    text = replaceMatches(text, WINDOWS_PATH_REGEX, 'path', '[redacted:path]', state);
    text = replaceMatches(text, UNIX_PATH_REGEX, 'path', (_substring, prefix) => `${prefix}[redacted:path]`, state);
    text = replaceMatches(text, TOKEN_REGEX, 'token', '[redacted:token]', state);
    const truncated = text.length > maxLength;
    return {
        text: truncated ? `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : text,
        redactionCount: state.count,
        redactionKinds: Array.from(state.kinds.values()).sort(),
        truncated
    };
}
function summarizeSupportBotText(value) {
    const normalized = value.trim();
    const redacted = redactSupportBotText(normalized);
    return {
        charCount: normalized.length,
        wordCount: normalized.length === 0 ? 0 : normalized.split(/\s+/).length,
        redactionApplied: redacted.redactionCount > 0,
        redactionCount: redacted.redactionCount,
        redactionKinds: redacted.redactionKinds
    };
}
function summarizeSupportBotRoute(route) {
    return {
        intent: route.intent,
        classificationScore: route.classification.score,
        classificationFallback: route.classification.isFallback,
        matchedSignalCount: route.classification.matchedSignals.length
    };
}
function incrementCount(counts, key) {
    var _a;
    counts[key] = ((_a = counts[key]) !== null && _a !== void 0 ? _a : 0) + 1;
}
function summarizeSupportBotEvidence(result, sources) {
    const sourceTypeCounts = {};
    const trustTierCounts = {};
    sources.forEach((source) => {
        incrementCount(sourceTypeCounts, source.sourceType);
        incrementCount(trustTierCounts, source.trustTier);
    });
    return {
        status: result.status,
        totalHits: result.totalHits,
        packedEvidenceCount: result.packedEvidenceCount,
        minEvidence: result.minEvidence,
        sourceCount: sources.length,
        sourceTypeCounts,
        trustTierCounts
    };
}
function summarizeSupportBotAssessment(assessment) {
    return {
        strength: assessment.strength,
        reason: assessment.reason,
        evidenceCount: assessment.evidenceCount,
        qualifyingEvidenceCount: assessment.qualifyingEvidenceCount,
        strongestEvidenceScore: assessment.strongestEvidenceScore
    };
}
function summarizeSupportBotError(error) {
    const name = error instanceof Error && error.name.trim().length > 0 ? error.name : 'Error';
    const message = error instanceof Error ? error.message : 'Unexpected internal error.';
    const redacted = redactSupportBotText(message);
    return {
        name,
        message: redacted.text,
        redactionApplied: redacted.redactionCount > 0,
        redactionCount: redacted.redactionCount,
        redactionKinds: redacted.redactionKinds
    };
}
function determineSupportBotCitationSignal(request, answer) {
    if (request.mode !== 'grounded' || request.evidence.length === 0) {
        return 'not_applicable';
    }
    if (answer.citations.length === 0) {
        return 'citation_miss';
    }
    if (request.evidence.length > 1 && answer.citations.length < Math.min(2, request.evidence.length)) {
        return 'low_citation';
    }
    return 'sufficient';
}
async function emitSupportBotTelemetry(sink, event) {
    if (!sink) {
        return;
    }
    try {
        await sink.emit(event);
    }
    catch {
        // Telemetry must never break request handling.
    }
}

const JSON_HEADERS = {
    'content-type': 'application/json; charset=utf-8'
};
let telemetryRequestSequence = 0;
function getNow(dependencies) {
    return dependencies.now ? dependencies.now() : new Date();
}
function getModelVersion(dependencies) {
    return typeof dependencies.modelVersion === 'function' ? dependencies.modelVersion() : dependencies.modelVersion;
}
function getServiceName(dependencies) {
    var _a;
    return (_a = dependencies.serviceName) !== null && _a !== void 0 ? _a : 'support-bot-api';
}
function getAnswerId(dependencies, input) {
    return dependencies.createAnswerId ? dependencies.createAnswerId(input) : `support-answer-${input.generatedAt.toISOString()}`;
}
function createJsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: JSON_HEADERS,
        body
    };
}
function toTelemetryEndpoint(path) {
    if (path === '/chat') {
        return 'chat';
    }
    if (path === '/sources') {
        return 'sources';
    }
    return undefined;
}
function createTelemetryContext(request) {
    const endpoint = toTelemetryEndpoint(request.path);
    if (!endpoint) {
        return undefined;
    }
    telemetryRequestSequence += 1;
    return {
        requestId: `support-bot-request-${telemetryRequestSequence}`,
        endpoint,
        method: request.method,
        startedAtMs: Date.now()
    };
}
function createTelemetryEventBase(dependencies, context, type) {
    return {
        type,
        schemaVersion: 1,
        timestamp: getNow(dependencies).toISOString(),
        service: getServiceName(dependencies),
        requestId: context.requestId,
        endpoint: context.endpoint,
        method: context.method
    };
}
function tagErrorStage(error, stage) {
    if (error instanceof Error) {
        error.supportBotTelemetryStage = stage;
        return error;
    }
    const wrappedError = new Error('Unexpected internal error.');
    wrappedError.supportBotTelemetryStage = stage;
    return wrappedError;
}
function getErrorStage(error) {
    var _a;
    if (error instanceof Error && error.supportBotTelemetryStage) {
        return (_a = error.supportBotTelemetryStage) !== null && _a !== void 0 ? _a : 'unknown';
    }
    return error instanceof ApiValidationError ? 'request_validation' : 'unknown';
}
async function emitRequestStartedTelemetry(dependencies, context) {
    await emitSupportBotTelemetry(dependencies.telemetry, createTelemetryEventBase(dependencies, context, 'support_bot.request.started'));
}
async function emitRequestCompletedTelemetry(dependencies, context, response) {
    var _a;
    if (response.statusCode >= 400) {
        return;
    }
    const chatBody = context.endpoint === 'chat' ? response.body : undefined;
    const availableEvidenceCount = (chatBody === null || chatBody === void 0 ? void 0 : chatBody.result) === 'answer' && chatBody.evidence.status === 'ready' ? chatBody.evidence.evidence.length : 0;
    const outcome = context.endpoint === 'sources' ? 'sources' : (_a = chatBody === null || chatBody === void 0 ? void 0 : chatBody.result) !== null && _a !== void 0 ? _a : 'fallback';
    const fallbackReason = (chatBody === null || chatBody === void 0 ? void 0 : chatBody.result) === 'fallback' ? chatBody.reason : undefined;
    const citationSignal = (chatBody === null || chatBody === void 0 ? void 0 : chatBody.result) === 'answer'
        ? chatBody.answer.citations.length === 0
            ? 'citation_miss'
            : availableEvidenceCount > 1 && chatBody.answer.citations.length < Math.min(2, availableEvidenceCount)
                ? 'low_citation'
                : 'sufficient'
        : 'not_applicable';
    await emitSupportBotTelemetry(dependencies.telemetry, {
        ...createTelemetryEventBase(dependencies, context, 'support_bot.request.completed'),
        query: context.query,
        route: context.route,
        completion: {
            durationMs: Date.now() - context.startedAtMs,
            statusCode: response.statusCode,
            outcome,
            unanswered: outcome === 'fallback',
            fallbackReason,
            citationSignal
        }
    });
}
async function emitRequestFailedTelemetry(dependencies, context, error, statusCode) {
    await emitSupportBotTelemetry(dependencies.telemetry, {
        ...createTelemetryEventBase(dependencies, context, 'support_bot.request.failed'),
        query: context.query,
        route: context.route,
        failure: {
            durationMs: Date.now() - context.startedAtMs,
            statusCode,
            stage: getErrorStage(error),
            error: summarizeSupportBotError(error)
        }
    });
}
function createErrorResponse(statusCode, code, message, details) {
    return createJsonResponse(statusCode, validateWithSchema(apiErrorResponseSchema, {
        ok: false,
        error: {
            code,
            message,
            details
        }
    }, 'API error response validation failed'));
}
function getQueryValue(value) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}
function validateRetrievalResult(result) {
    return {
        evidence: validateWithSchema(evidencePackResultSchema, result.evidence, 'Retrieved evidence validation failed'),
        sources: validateWithSchema(evidenceBundleSchema.array(), result.sources, 'Retrieved sources validation failed')
    };
}
function isFallbackReason(value) {
    return value === 'weak_evidence' || value === 'insufficient_evidence' || value === 'security_sensitive';
}
function handleHealthRequest(dependencies) {
    var _a;
    const response = {
        ok: true,
        service: (_a = dependencies.serviceName) !== null && _a !== void 0 ? _a : 'support-bot-api',
        status: 'ok',
        policyVersion: GROUNDED_PROMPT_POLICY_VERSION,
        timestamp: getNow(dependencies).toISOString()
    };
    return validateWithSchema(healthResponseSchema, response, 'Health response validation failed');
}
async function handleSourcesRequestInternal(payload, dependencies, telemetryContext) {
    let request;
    try {
        request = parseWithSchema(sourcesRequestSchema, payload, 'Sources request validation failed.');
    }
    catch (error) {
        throw tagErrorStage(error, 'request_validation');
    }
    const route = planSupportQueryRoute(request.query);
    if (telemetryContext) {
        telemetryContext.query = summarizeSupportBotText(request.query);
        telemetryContext.route = summarizeSupportBotRoute(route);
    }
    const retrievalStartedAtMs = Date.now();
    let retrieval;
    try {
        retrieval = validateRetrievalResult(await dependencies.retriever.retrieve({ query: request.query, route }));
    }
    catch (error) {
        throw tagErrorStage(error, 'retrieval');
    }
    if ((telemetryContext === null || telemetryContext === void 0 ? void 0 : telemetryContext.query) && telemetryContext.route) {
        await emitSupportBotTelemetry(dependencies.telemetry, {
            ...createTelemetryEventBase(dependencies, telemetryContext, 'support_bot.retrieval.completed'),
            query: telemetryContext.query,
            route: telemetryContext.route,
            retrieval: {
                durationMs: Date.now() - retrievalStartedAtMs,
                ...summarizeSupportBotEvidence(retrieval.evidence, retrieval.sources)
            }
        });
    }
    const response = {
        ok: true,
        query: request.query,
        route: toSupportQueryRouteSummary(route),
        evidence: retrieval.evidence,
        sources: retrieval.sources
    };
    try {
        return validateWithSchema(sourcesResponseSchema, response, 'Sources response validation failed');
    }
    catch (error) {
        throw tagErrorStage(error, 'response_validation');
    }
}
async function handleSourcesRequest(payload, dependencies) {
    return handleSourcesRequestInternal(payload, dependencies);
}
async function handleChatRequestInternal(payload, dependencies, telemetryContext) {
    let request;
    try {
        request = parseWithSchema(chatRequestSchema, payload, 'Chat request validation failed.');
    }
    catch (error) {
        throw tagErrorStage(error, 'request_validation');
    }
    const route = planSupportQueryRoute(request.query);
    if (telemetryContext) {
        telemetryContext.query = summarizeSupportBotText(request.query);
        telemetryContext.route = summarizeSupportBotRoute(route);
    }
    const retrievalStartedAtMs = Date.now();
    let retrieval;
    try {
        retrieval = validateRetrievalResult(await dependencies.retriever.retrieve({ query: request.query, route }));
    }
    catch (error) {
        throw tagErrorStage(error, 'retrieval');
    }
    if ((telemetryContext === null || telemetryContext === void 0 ? void 0 : telemetryContext.query) && telemetryContext.route) {
        await emitSupportBotTelemetry(dependencies.telemetry, {
            ...createTelemetryEventBase(dependencies, telemetryContext, 'support_bot.retrieval.completed'),
            query: telemetryContext.query,
            route: telemetryContext.route,
            retrieval: {
                durationMs: Date.now() - retrievalStartedAtMs,
                ...summarizeSupportBotEvidence(retrieval.evidence, retrieval.sources)
            }
        });
    }
    const generationRequest = buildAnswerGenerationRequest({
        query: request.query,
        routeIntent: route.intent,
        evidence: retrieval.evidence,
        fallbackMessage: request.fallbackMessage
    });
    const generatedAt = getNow(dependencies);
    const answerId = getAnswerId(dependencies, {
        query: request.query,
        mode: generationRequest.mode,
        route,
        evidence: retrieval.evidence,
        generatedAt
    });
    if (generationRequest.mode === 'fallback') {
        const fallbackReason = generationRequest.safety.fallbackReason;
        if (!fallbackReason || !isFallbackReason(fallbackReason)) {
            throw new Error(`Unexpected fallback reason: ${fallbackReason}`);
        }
        const answer = assembleSupportAnswer({
            request: generationRequest,
            draft: { shortAnswer: '' },
            answerId,
            generatedAt,
            modelVersion: getModelVersion(dependencies)
        });
        const response = {
            ok: true,
            result: 'fallback',
            query: request.query,
            route: toSupportQueryRouteSummary(route),
            evidence: retrieval.evidence,
            answer: toApiSupportAnswer(answer),
            skippedGeneration: true,
            reason: fallbackReason
        };
        try {
            return validateWithSchema(chatResponseSchema, response, 'Chat response validation failed');
        }
        catch (error) {
            throw tagErrorStage(error, 'response_validation');
        }
    }
    const generationStartedAtMs = Date.now();
    let draft;
    try {
        draft = validateWithSchema(answerGenerationDraftSchema, await dependencies.answerGenerator.generate(generationRequest), 'Answer generation draft validation failed');
    }
    catch (error) {
        throw tagErrorStage(error, 'generation');
    }
    const answer = assembleSupportAnswer({
        request: generationRequest,
        draft,
        answerId,
        generatedAt,
        modelVersion: getModelVersion(dependencies)
    });
    const citationSignal = determineSupportBotCitationSignal(generationRequest, answer);
    if ((telemetryContext === null || telemetryContext === void 0 ? void 0 : telemetryContext.query) && telemetryContext.route) {
        await emitSupportBotTelemetry(dependencies.telemetry, {
            ...createTelemetryEventBase(dependencies, telemetryContext, 'support_bot.generation.completed'),
            query: telemetryContext.query,
            route: telemetryContext.route,
            generation: {
                durationMs: Date.now() - generationStartedAtMs,
                mode: generationRequest.mode,
                assessment: summarizeSupportBotAssessment(generationRequest.assessment),
                citationCount: answer.citations.length,
                citationSignal,
                confidence: answer.confidence,
                confidenceLabel: answer.confidenceLabel
            }
        });
    }
    const response = {
        ok: true,
        result: 'answer',
        query: request.query,
        route: toSupportQueryRouteSummary(route),
        evidence: retrieval.evidence,
        answer: toApiSupportAnswer(answer)
    };
    try {
        return validateWithSchema(chatResponseSchema, response, 'Chat response validation failed');
    }
    catch (error) {
        throw tagErrorStage(error, 'response_validation');
    }
}
async function handleChatRequest(payload, dependencies) {
    return handleChatRequestInternal(payload, dependencies);
}
async function handleSupportBotApiRequest(request, dependencies) {
    var _a;
    let telemetryContext;
    try {
        if (request.path === '/health') {
            if (request.method !== 'GET') {
                return createErrorResponse(405, 'method_not_allowed', 'Method not allowed for /health.');
            }
            return createJsonResponse(200, handleHealthRequest(dependencies));
        }
        if (request.path === '/sources') {
            if (request.method === 'GET') {
                telemetryContext = createTelemetryContext(request);
                if (telemetryContext) {
                    await emitRequestStartedTelemetry(dependencies, telemetryContext);
                }
                const response = createJsonResponse(200, await handleSourcesRequestInternal({ query: getQueryValue((_a = request.query) === null || _a === void 0 ? void 0 : _a.query) }, dependencies, telemetryContext));
                if (telemetryContext) {
                    await emitRequestCompletedTelemetry(dependencies, telemetryContext, response);
                }
                return response;
            }
            if (request.method === 'POST') {
                telemetryContext = createTelemetryContext(request);
                if (telemetryContext) {
                    await emitRequestStartedTelemetry(dependencies, telemetryContext);
                }
                const response = createJsonResponse(200, await handleSourcesRequestInternal(request.body, dependencies, telemetryContext));
                if (telemetryContext) {
                    await emitRequestCompletedTelemetry(dependencies, telemetryContext, response);
                }
                return response;
            }
            return createErrorResponse(405, 'method_not_allowed', 'Method not allowed for /sources.');
        }
        if (request.path === '/chat') {
            if (request.method !== 'POST') {
                return createErrorResponse(405, 'method_not_allowed', 'Method not allowed for /chat.');
            }
            telemetryContext = createTelemetryContext(request);
            if (telemetryContext) {
                await emitRequestStartedTelemetry(dependencies, telemetryContext);
            }
            const response = createJsonResponse(200, await handleChatRequestInternal(request.body, dependencies, telemetryContext));
            if (telemetryContext) {
                await emitRequestCompletedTelemetry(dependencies, telemetryContext, response);
            }
            return response;
        }
        return createErrorResponse(404, 'not_found', `No route found for ${request.path}.`);
    }
    catch (error) {
        if (telemetryContext) {
            await emitRequestFailedTelemetry(dependencies, telemetryContext, error, error instanceof ApiValidationError ? 400 : 500);
        }
        if (error instanceof ApiValidationError) {
            return createErrorResponse(400, 'validation_error', error.message, error.issues);
        }
        const message = error instanceof Error ? error.message : 'Unexpected internal error.';
        return createErrorResponse(500, 'internal_error', message);
    }
}

function toQueryRecord(url) {
    var _a;
    const entries = new Map();
    for (const [key, value] of url.searchParams.entries()) {
        const existing = (_a = entries.get(key)) !== null && _a !== void 0 ? _a : [];
        existing.push(value);
        entries.set(key, existing);
    }
    return Object.fromEntries(Array.from(entries.entries()).map(([key, values]) => { var _a; return [key, values.length > 1 ? values : (_a = values[0]) !== null && _a !== void 0 ? _a : '']; }));
}
async function readRawBody(request) {
    const chunks = [];
    for await (const chunk of request) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}
async function parseRequestBody(request) {
    if (request.method !== 'POST' && request.method !== 'PUT' && request.method !== 'PATCH') {
        return undefined;
    }
    const rawBody = await readRawBody(request);
    if (rawBody.trim().length === 0) {
        return undefined;
    }
    try {
        return JSON.parse(rawBody);
    }
    catch {
        throw createValidationError('body', 'Request body must be valid JSON.', 'invalid_json');
    }
}
async function toApiRequest(request) {
    var _a, _b, _c;
    const url = new URL$1((_a = request.url) !== null && _a !== void 0 ? _a : '/', `http://${(_b = request.headers.host) !== null && _b !== void 0 ? _b : 'localhost'}`);
    return {
        method: (_c = request.method) !== null && _c !== void 0 ? _c : 'GET',
        path: url.pathname,
        query: toQueryRecord(url),
        body: await parseRequestBody(request)
    };
}
function createJsonErrorResponse(statusCode, code, message, details) {
    return {
        statusCode,
        headers: {
            'content-type': 'application/json; charset=utf-8'
        },
        body: apiErrorResponseSchema.parse({
            ok: false,
            error: {
                code,
                message,
                details
            }
        })
    };
}
function writeResponse(response, apiResponse) {
    response.statusCode = apiResponse.statusCode;
    for (const [name, value] of Object.entries(apiResponse.headers)) {
        response.setHeader(name, value);
    }
    response.end(JSON.stringify(apiResponse.body));
}
async function handleNodeHttpRequest(request, dependencies) {
    try {
        return await handleSupportBotApiRequest(await toApiRequest(request), dependencies);
    }
    catch (error) {
        if (error instanceof ApiValidationError) {
            return createJsonErrorResponse(400, 'validation_error', error.message, error.issues);
        }
        const message = error instanceof Error ? error.message : 'Unexpected internal error.';
        return createJsonErrorResponse(500, 'internal_error', message);
    }
}
function createSupportBotApiServer(dependencies) {
    return createServer(async (request, response) => {
        const apiResponse = await handleNodeHttpRequest(request, dependencies);
        writeResponse(response, apiResponse);
    });
}

const supportBotApi = {
    DEFAULT_GROUNDED_PROMPT_POLICY,
    GROUNDED_PROMPT_POLICY_VERSION,
    assessEvidenceStrength,
    OpenAIAnswerGenerationAdapter,
    buildAnswerGenerationRequest,
    assembleSupportAnswer,
    classifySafetyAndEscalation,
    buildFallbackMessage,
    OFFICIAL_BRUNO_DESTINATIONS,
    toSharedAnswer,
    toSharedCitation,
    redactSupportBotText,
    summarizeSupportBotText,
    determineSupportBotCitationSignal,
    handleHealthRequest,
    handleSourcesRequest,
    handleChatRequest,
    handleSupportBotApiRequest,
    createSupportBotApiServer
};

export { ApiValidationError, DEFAULT_GROUNDED_PROMPT_POLICY, GROUNDED_PROMPT_POLICY_VERSION, OFFICIAL_BRUNO_DESTINATIONS, OpenAIAnswerGenerationAdapter, answerGenerationDraftSchema, apiErrorCodeSchema, apiErrorResponseSchema, apiSupportAnswerCitationSchema, apiSupportAnswerEscalationSchema, apiSupportAnswerSafetySchema, apiSupportAnswerSchema, apiValidationIssueSchema, assembleSupportAnswer, assessEvidenceStrength, buildAnswerGenerationRequest, buildFallbackMessage, chatRequestSchema, chatResponseSchema, classifySafetyAndEscalation, createSupportBotApiServer, createValidationError, determineSupportBotCitationSignal, emitSupportBotTelemetry, handleChatRequest, handleHealthRequest, handleNodeHttpRequest, handleSourcesRequest, handleSupportBotApiRequest, healthResponseSchema, parseWithSchema, redactSupportBotText, sourcesRequestSchema, sourcesResponseSchema, summarizeSupportBotAssessment, summarizeSupportBotError, summarizeSupportBotEvidence, summarizeSupportBotRoute, summarizeSupportBotText, supportBotApi, supportQueryRouteSummarySchema, toApiSupportAnswer, toSharedAnswer, toSharedCitation, toSupportQueryRouteSummary, validateWithSchema };
//# sourceMappingURL=index.js.map
