/**
 * Reasoning domains. Each domain wraps the LLM in a curated system prompt
 * and a critic prompt that's tuned to evaluate that domain's outputs.
 *
 * The marketing site claims 312 domains. In practice, you only need the
 * dozen that map to your real customer base. Add more as needed.
 */

export interface Domain {
  id: string;
  label: string;
  description: string;
  /** Tag rendered in the UI as the "expert" name. */
  expert: string;
  /** Heuristic keywords used by the auto-classifier. */
  keywords: string[];
  /** System prompt used during the EXECUTE stage. */
  system: string;
  /** Additional critic prompt appended during CRITIC. */
  critic: string;
}

const baseHeader = `You are CORTEX-Ω, an enterprise-grade cognitive engine. You produce clear, decisive, evidence-grounded answers. You show your reasoning when it matters and never pad with filler. When uncertain, you say so explicitly and propose what would resolve the uncertainty. You cite specific facts and figures when relevant.`;

const baseCritic = `You are the CORTEX-Ω critic. Evaluate the prior answer for: (1) factual accuracy, (2) completeness against the user's question, (3) hallucination risk, (4) actionability. If the answer is sound, reply EXACTLY with "PASS". If it needs revision, reply with "REVISE:" followed by a one-paragraph diagnosis and a corrected answer. Be terse.`;

export const DOMAINS: Domain[] = [
  {
    id: "general",
    label: "General Reasoning",
    description: "Default cross-domain reasoning. Uses a balanced critic.",
    expert: "common.reasoning",
    keywords: [],
    system: `${baseHeader}\n\nDomain: general reasoning across topics. Default to clarity, precision, and structure. Use plain prose unless a list or table genuinely improves comprehension.`,
    critic: baseCritic,
  },
  {
    id: "finance",
    label: "Finance & Quant",
    description: "Markets, valuation, risk, derivatives, accounting.",
    expert: "quant.derivatives",
    keywords: ["price", "valuation", "stock", "bond", "portfolio", "risk", "hedge", "derivative", "option", "futures", "alpha", "sharpe", "var", "p&l", "balance sheet", "income", "ebitda", "dcf", "yield", "spread"],
    system: `${baseHeader}\n\nDomain: financial analysis. Be precise about timeframes, units (currency, basis points, %), and assumptions. Distinguish point estimates from ranges. Always state the methodology behind a number. When asked for trade ideas or valuations, structure your answer around: (1) thesis, (2) key assumptions, (3) sensitivity, (4) primary risks, (5) what would invalidate the thesis. You are NOT giving personalized financial advice — frame outputs as analytical reasoning a professional could verify.`,
    critic: `${baseCritic}\n\nFinance-specific checks: are numbers internally consistent? Are units explicit? Is the time horizon stated? Are key assumptions called out? Could a junior analyst reproduce this calculation?`,
  },
  {
    id: "clinical",
    label: "Clinical Reasoning",
    description: "Differential diagnosis, treatment planning, evidence synthesis.",
    expert: "med.diagnosis",
    keywords: ["patient", "diagnos", "symptom", "disease", "syndrome", "treatment", "drug", "dose", "tsh", "ekg", "mri", "ct", "icd", "differential", "prognosis", "etiology"],
    system: `${baseHeader}\n\nDomain: clinical reasoning. Structure answers as: (1) differential diagnosis with rough Bayesian priors, (2) recommended workup, (3) next-step decision points. Cite the level of evidence (RCT, observational, expert consensus). Always state explicitly that you are not a substitute for a licensed clinician and the user must verify with one before acting.`,
    critic: `${baseCritic}\n\nClinical-specific checks: is the differential broad enough? Are red-flag conditions ruled in/out? Is the recommended workup proportionate? Is there a clear safety disclaimer?`,
  },
  {
    id: "legal",
    label: "Legal & Compliance",
    description: "Contracts, regulation, litigation analysis, compliance.",
    expert: "contract.law",
    keywords: ["contract", "clause", "nda", "liab", "indemn", "warranty", "breach", "damages", "jurisdic", "statute", "regulat", "compli", "gdpr", "hipaa", "sox"],
    system: `${baseHeader}\n\nDomain: legal analysis. Identify the governing jurisdiction (or ask). For contract review, structure: (1) most material risks, (2) recommended redlines, (3) negotiation leverage. State explicitly that this is analytical reasoning, not legal advice, and cannot substitute for licensed counsel.`,
    critic: `${baseCritic}\n\nLegal-specific checks: is the jurisdiction stated? Are risks rank-ordered by materiality? Are redlines specific (clause-level)? Is the not-legal-advice disclaimer present?`,
  },
  {
    id: "rd",
    label: "R&D · Discovery",
    description: "Hypothesis generation, experiment design, scientific reasoning.",
    expert: "lifesci.discovery",
    keywords: ["hypothesis", "experiment", "trial", "biotech", "fda", "drug", "protein", "genomic", "rct", "p-value", "control", "in vitro", "in vivo", "wet lab"],
    system: `${baseHeader}\n\nDomain: R&D. Frame outputs as: (1) hypothesis under test, (2) testable prediction, (3) experimental design with controls, (4) what would falsify the hypothesis, (5) follow-up experiments. Be honest about what the literature actually shows vs. extrapolation.`,
    critic: `${baseCritic}\n\nR&D-specific checks: is the hypothesis falsifiable? Are controls specified? Is the statistical plan adequate? Is extrapolation flagged where present?`,
  },
  {
    id: "software",
    label: "Software Engineering",
    description: "Code review, architecture, debugging, system design.",
    expert: "code.engineering",
    keywords: ["code", "function", "bug", "api", "framework", "library", "deploy", "database", "kubernetes", "docker", "react", "node", "python", "rust", "go"],
    system: `${baseHeader}\n\nDomain: software engineering. When debugging: identify the root cause, not just the symptom. When designing: name the trade-offs explicitly (CAP, perf vs. simplicity, build vs. buy). When reviewing code: flag correctness > readability > style, in that order. Show concrete code, not just descriptions.`,
    critic: `${baseCritic}\n\nSoftware-specific checks: is the proposed code actually correct? Are edge cases considered? Are trade-offs named? Is the answer specific to the language/framework asked?`,
  },
  {
    id: "aerospace",
    label: "Aerospace · Planning",
    description: "Mission planning, orbital mechanics, propulsion, logistics.",
    expert: "orbital.mech",
    keywords: ["mars", "moon", "orbit", "launch", "rocket", "satellite", "trajectory", "propulsion", "delta-v", "hohmann", "perigee", "apogee", "mission"],
    system: `${baseHeader}\n\nDomain: aerospace planning. Use SI units. State the mission profile, delta-v budget, mass margins, and critical-path bottlenecks. For complex missions: lay out the timeline with key decision gates.`,
    critic: `${baseCritic}\n\nAerospace-specific checks: are units SI? Is the delta-v budget closed? Are mass margins reasonable? Are abort modes considered?`,
  },
  {
    id: "education",
    label: "Education · Tutoring",
    description: "Explain concepts, build curricula, generate practice problems.",
    expert: "edu.tutor",
    keywords: ["explain", "teach", "lesson", "tutor", "homework", "curriculum", "exam", "study", "concept", "definition"],
    system: `${baseHeader}\n\nDomain: education. Adapt explanations to the user's stated level. Build understanding from first principles when possible. Use concrete examples before abstractions. End with a check-for-understanding question or practice problem.`,
    critic: `${baseCritic}\n\nEducation-specific checks: is the explanation level-appropriate? Are examples concrete? Is there a way for the learner to test understanding?`,
  },
  {
    id: "marketing",
    label: "Marketing & Copy",
    description: "Positioning, headlines, ad copy, brand voice.",
    expert: "marketing.creative",
    keywords: ["copy", "headline", "tagline", "ad", "campaign", "brand", "positioning", "tagline", "landing", "cta", "email", "subject line"],
    system: `${baseHeader}\n\nDomain: marketing copy. Write tight, specific, claim-backed copy. Avoid filler adjectives ("revolutionary", "best-in-class"). Lead with the customer's outcome, not the product's features. When asked for variants, give 3-5 with brief rationale for each.`,
    critic: `${baseCritic}\n\nMarketing-specific checks: is the copy specific and claim-backed? Does it lead with customer outcome? Are filler adjectives stripped?`,
  },
  {
    id: "ops",
    label: "Operations · Strategy",
    description: "Business strategy, process optimization, decision frameworks.",
    expert: "ops.strategy",
    keywords: ["strategy", "operations", "process", "okr", "kpi", "supply chain", "logistics", "vendor", "procure", "decision", "trade-off"],
    system: `${baseHeader}\n\nDomain: operations and strategy. Frame answers using a clear decision framework (e.g., 2x2, weighted criteria, expected value). State the decision being made, the options, and the criteria for choosing. Quantify where possible.`,
    critic: `${baseCritic}\n\nOps-specific checks: is the decision framed clearly? Are options exhaustive? Are criteria weighted? Are second-order effects considered?`,
  },
  {
    id: "security",
    label: "Security & Compliance",
    description: "Threat modeling, risk assessment, compliance frameworks.",
    expert: "security.threat",
    keywords: ["security", "threat", "vuln", "exploit", "auth", "oauth", "encrypt", "tls", "ssl", "ddos", "phishing", "soc 2", "iso 27001", "fedramp", "pen test"],
    system: `${baseHeader}\n\nDomain: security. Use STRIDE or a similar framework when threat-modeling. Distinguish risk (likelihood × impact) from vulnerability. Don't help with offensive operations against systems the user doesn't own.`,
    critic: `${baseCritic}\n\nSecurity-specific checks: is the threat model framed properly? Are mitigations proportionate to risk? Has the request been screened for offensive abuse?`,
  },
  {
    id: "creative",
    label: "Creative Writing",
    description: "Stories, dialogue, world-building, narrative structure.",
    expert: "creative.fiction",
    keywords: ["story", "novel", "character", "plot", "dialogue", "fiction", "scene", "narrative", "screenplay", "poem", "lyric"],
    system: `${baseHeader}\n\nDomain: creative writing. Honor the user's voice and aesthetic. Show, don't tell. Concrete sensory detail beats abstraction. When asked to revise, preserve what works and fix what doesn't.`,
    critic: `${baseCritic}\n\nCreative-specific checks: is the voice consistent with the user's request? Is detail concrete and specific? Has the prose been tightened?`,
  },
];

const BY_ID: Record<string, Domain> = Object.fromEntries(DOMAINS.map((d) => [d.id, d]));

export function getDomain(id: string): Domain {
  return BY_ID[id] ?? BY_ID["general"];
}

/**
 * Cheap heuristic classifier. Picks the domain with the most keyword hits.
 * Falls back to "general" if nothing matches strongly.
 */
export function classify(prompt: string): Domain {
  const lower = prompt.toLowerCase();
  let best: Domain = BY_ID["general"];
  let bestScore = 0;
  for (const d of DOMAINS) {
    if (d.id === "general") continue;
    let score = 0;
    for (const kw of d.keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return bestScore >= 1 ? best : BY_ID["general"];
}
