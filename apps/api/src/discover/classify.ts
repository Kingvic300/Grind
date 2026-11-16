/**
 * Tags a hackathon from its name, tags and description, so Discover can filter by
 * kind (Web3 or Web2), topic and tech stack. Simple keyword rules: fast, predictable,
 * and good enough for browsing. Not a guarantee of what an event allows.
 */

export const CATEGORIES = [
  'web3', 'ai', 'mobile', 'gaming', 'hardware', 'data', 'security', 'fintech', 'health', 'climate', 'education', 'social', 'beginner',
] as const;
export type Category = (typeof CATEGORIES)[number];

const CATEGORY_RULES: Record<Category, RegExp> = {
  web3: /\b(web3|web 3|blockchain|crypto|cryptocurrenc\w*|defi|nfts?|solidity|ethereum|eth|solana|smart contracts?|dao|on-?chain|dapps?|stablecoins?|bitcoin|btc|layer ?2|l2s?|zk|zero[- ]knowledge|evm|polygon|arbitrum|optimism|starknet|sui|aptos|cosmos|polkadot|avalanche|chainlink|ipfs|tokeni[sz]\w*|wallets?|rollups?|move language|near protocol|ton blockchain)\b/i,
  ai: /\b(ai|a\.i\.|artificial intelligence|machine learning|ml|llms?|gpt\w*|genai|generative|deep learning|neural|nlp|computer vision|ai agents?|agentic|chatbots?|openai|gemini|claude|langchain|hugging ?face|rag)\b/i,
  mobile: /\b(mobile|ios|android|flutter|react native|swiftui|kotlin|mobile apps?)\b/i,
  gaming: /\b(games?|gaming|game ?jam|unity|unreal|godot|esports|gamedev)\b/i,
  hardware: /\b(hardware|iot|internet of things|arduino|raspberry pi|robotics?|robots?|embedded|drones?|fpga|wearables?|sensors?)\b/i,
  data: /\b(data science|analytics|open data|datasets?|big data|data visuali[sz]ation|data engineering)\b/i,
  security: /\b(security|cyber ?security|ctf|capture the flag|privacy|infosec|encryption|vulnerabilit\w*)\b/i,
  fintech: /\b(fintech|payments?|banking|finance|financial|trading|insurtech|remittances?)\b/i,
  health: /\b(health|healthcare|medical|medicine|biotech|mental health|wellness|clinical|hospital)\b/i,
  climate: /\b(climate|sustainab\w*|renewable|clean energy|carbon|environment\w*|green tech|energy)\b/i,
  education: /\b(education|edtech|e-learning|learning platform|teaching|classroom)\b/i,
  social: /\b(social good|social impact|nonprofits?|non-profit|accessibility|a11y|humanitarian|civic|community impact|sdgs?)\b/i,
  beginner: /\b(beginners?|beginner[- ]friendly|first[- ]time|no experience|newbies?)\b/i,
};

/** Display name, then the pattern that finds it. Case-insensitive unless noted. */
const STACK_RULES: [string, RegExp][] = [
  ['Python', /\bpython\b/i],
  ['JavaScript', /\bjavascript\b/i],
  ['TypeScript', /\btypescript\b/i],
  ['React', /\breact(\.js|js)?\b(?! native)/i],
  ['Next.js', /\bnext\.?js\b/i],
  ['Node.js', /\bnode\.?js\b/i],
  ['Vue', /\bvue(\.js)?\b/i],
  ['Rust', /\brust\b/i],
  ['Go', /\b(golang|go language)\b/i],
  ['Java', /\bjava\b(?!script)/i],
  ['Kotlin', /\bkotlin\b/i],
  ['Swift', /\bswift(ui)?\b/i],
  ['Flutter', /\bflutter\b/i],
  ['React Native', /\breact native\b/i],
  ['C++', /(^|[^\w])c\+\+(?!\w)/i],
  ['Solidity', /\bsolidity\b/i],
  ['Move', /\bmove (language|lang|smart contracts?)\b/i],
  ['Cairo', /\bcairo\b/i],
  ['Foundry', /\bfoundry\b/i],
  ['Hardhat', /\bhardhat\b/i],
  ['Ethereum', /\bethereum\b/i],
  ['Solana', /\bsolana\b/i],
  ['Polygon', /\bpolygon\b/i],
  ['Arbitrum', /\barbitrum\b/i],
  ['Starknet', /\bstarknet\b/i],
  ['Sui', /\bsui\b/i],
  ['Aptos', /\baptos\b/i],
  ['Chainlink', /\bchainlink\b/i],
  ['IPFS', /\bipfs\b/i],
  ['OpenAI', /\bopenai\b/i],
  ['Gemini', /\bgemini\b/i],
  ['Claude', /\bclaude\b/i],
  ['LangChain', /\blangchain\b/i],
  ['Hugging Face', /\bhugging ?face\b/i],
  ['TensorFlow', /\btensorflow\b/i],
  ['PyTorch', /\bpytorch\b/i],
  ['AWS', /\b(aws|amazon web services)\b/i],
  ['Google Cloud', /\b(google cloud|gcp)\b/i],
  ['Azure', /\bazure\b/i],
  ['Firebase', /\bfirebase\b/i],
  ['Supabase', /\bsupabase\b/i],
  ['MongoDB', /\bmongo ?db\b/i],
  ['PostgreSQL', /\b(postgres(ql)?)\b/i],
  ['Docker', /\bdocker\b/i],
  ['Kubernetes', /\b(kubernetes|k8s)\b/i],
  ['Unity', /\bunity\b/i],
  ['Unreal', /\bunreal( engine)?\b/i],
  ['Three.js', /\bthree\.?js\b/i],
  ['Figma', /\bfigma\b/i],
  ['Arduino', /\barduino\b/i],
  ['Raspberry Pi', /\braspberry pi\b/i],
];

export function classify(text: string): { categories: Category[]; stack: string[] } {
  const categories = CATEGORIES.filter((c) => CATEGORY_RULES[c].test(text));
  const stack = STACK_RULES.filter(([, re]) => re.test(text)).map(([name]) => name);
  return { categories, stack };
}

type ListingFormat = 'ONLINE' | 'IN_PERSON' | 'HYBRID';

// Phrases, not single words: "online" alone shows up in "online banking", "venue" in sponsor blurbs.
const ONLINE_TEXT = /\b(fully online|100% online|online[- ]only|online (hackathon|event|competition|challenge|buildathon)|virtual (hackathon|event|competition|buildathon)|(held|hosted|takes? place|runs?|happening) (fully |entirely )?(online|virtually|remotely)|remote[- ](hackathon|event|first)|(participate|join|build|hack) (from anywhere|remotely|online)|open to (participants |builders )?worldwide)\b/i;
const IN_PERSON_TEXT = /\b(in[- ]person|on[- ]site|onsite|offline (hackathon|event)|irl|physical (event|venue|location)|at the venue)\b/i;
const HYBRID_TEXT = /\b(hybrid (hackathon|event|format|competition)|online and (in[- ]person|offline|on[- ]site)|(in[- ]person|offline|on[- ]site) and online|both online and)\b/i;

/**
 * Reads the event text for where it happens, since some sites leave the field blank
 * (which the fetchers read as in person) or mark online events with an in-person final.
 * Falls back to what the site said when the text does not say clearly.
 */
export function formatFromText(text: string, site: ListingFormat): ListingFormat {
  if (HYBRID_TEXT.test(text)) return 'HYBRID';
  const online = ONLINE_TEXT.test(text);
  const inPerson = IN_PERSON_TEXT.test(text);
  if (online && inPerson) return 'HYBRID';
  if (online) return site === 'HYBRID' ? 'HYBRID' : 'ONLINE';
  if (inPerson) return site === 'ONLINE' ? 'HYBRID' : site;
  return site;
}
