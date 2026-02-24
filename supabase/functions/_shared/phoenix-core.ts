// Phoenix AI Core - Shared between Web and WhatsApp
// This module provides unified AI capabilities across all platforms

export interface UserPreferences {
  preferred_style: 'formal' | 'casual' | 'witty';
  response_length: 'concise' | 'balanced' | 'detailed';
  expertise_level: 'beginner' | 'intermediate' | 'expert';
  interests: string[];
  language: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SearchResult {
  url: string;
  title: string;
  content: string;
  score?: number;
}

// Special commands for WhatsApp
export interface CommandResult {
  isCommand: boolean;
  command?: 'save' | 'clear' | 'reset' | 'language' | 'help' | 'poll' | 'sticker';
  language?: string;
  pollData?: { question: string; options: string[] };
}

// AI Models available - expanded selection for different tasks
export const AI_MODELS = {
  // Fast models for quick responses
  flash: 'google/gemini-2.5-flash',
  flashLite: 'google/gemini-2.5-flash-lite',
  
  // Smart models for complex reasoning
  pro: 'google/gemini-2.5-pro',
  gpt5: 'openai/gpt-5',
  gpt5Mini: 'openai/gpt-5-mini',
  
  // Specialized models
  vision: 'google/gemini-2.5-pro', // Use Pro for better image understanding
  reasoning: 'openai/gpt-5.2',     // Best for complex reasoning
  
  // Next-gen previews
  gemini3Pro: 'google/gemini-3-pro-preview',
  gemini3Flash: 'google/gemini-3-flash-preview',
  
  // Image generation models
  imageGen: 'google/gemini-2.5-flash-image-preview',      // Fast generation
  imageGenPro: 'google/gemini-3-pro-image-preview',       // Higher quality
} as const;

// Determine which model to use based on message complexity
export function selectModel(message: string, hasImage: boolean, hasAudio: boolean): string {
  if (hasAudio) return AI_MODELS.pro; // Better understanding for transcribed audio
  if (hasImage) return AI_MODELS.vision;
  
  const lowerMsg = message.toLowerCase();
  const msgLength = message.length;
  
  // Very short simple messages - use flash lite
  if (msgLength < 50 && !/\?|who|what|how|why|when|where/i.test(message)) {
    return AI_MODELS.flashLite;
  }
  
  // Use GPT-5.2 for the most complex reasoning tasks
  const advancedReasoningPatterns = [
    /step.by.step|chain.of.thought|think.*through/i,
    /prove|theorem|mathematical|equation/i,
    /logic.*puzzle|riddle|brainteaser/i,
    /complex.*problem|multi.?step/i,
    /philosophical|ethical.*dilemma/i,
  ];
  
  for (const pattern of advancedReasoningPatterns) {
    if (pattern.test(lowerMsg)) {
      return AI_MODELS.reasoning;
    }
  }
  
  // Use GPT-5 for current events, facts, and knowledge
  const factualPatterns = [
    /who is .*(president|minister|leader|ceo|founder|owner)/i,
    /current .*(president|leader|government|prime minister)/i,
    /\b(2024|2025|2026)\b/i,
    /latest|current|recent|today|now/i,
    /news|update|happening/i,
  ];
  
  for (const pattern of factualPatterns) {
    if (pattern.test(lowerMsg)) {
      return AI_MODELS.gpt5;
    }
  }
  
  // Use Pro for complex reasoning and analysis
  const complexPatterns = [
    /explain .*(why|how|difference|compare)/i,
    /analyze|analysis|deep.?dive/i,
    /summarize|summary|breakdown/i,
    /what.*think|opinion|perspective/i,
    /code|programming|debug|algorithm|function|class/i,
    /calculate|compute|solve|formula/i,
    /compare|contrast|versus|vs\b/i,
    /research|investigate|explore/i,
  ];
  
  for (const pattern of complexPatterns) {
    if (pattern.test(lowerMsg)) {
      return AI_MODELS.pro;
    }
  }
  
  // Use GPT-5 Mini for medium complexity (good balance)
  if (msgLength > 100 || message.includes('?')) {
    return AI_MODELS.gpt5Mini;
  }
  
  // Default to flash for speed
  return AI_MODELS.flash;
}

// Time zones for real-time queries
const TIME_ZONES: Record<string, string> = {
  'nigeria': 'Africa/Lagos',
  'lagos': 'Africa/Lagos',
  'abuja': 'Africa/Lagos',
  'usa': 'America/New_York',
  'us': 'America/New_York',
  'america': 'America/New_York',
  'united states': 'America/New_York',
  'new york': 'America/New_York',
  'nyc': 'America/New_York',
  'los angeles': 'America/Los_Angeles',
  'la': 'America/Los_Angeles',
  'california': 'America/Los_Angeles',
  'chicago': 'America/Chicago',
  'miami': 'America/New_York',
  'houston': 'America/Chicago',
  'dallas': 'America/Chicago',
  'washington': 'America/New_York',
  'dc': 'America/New_York',
  'london': 'Europe/London',
  'uk': 'Europe/London',
  'england': 'Europe/London',
  'paris': 'Europe/Paris',
  'france': 'Europe/Paris',
  'germany': 'Europe/Berlin',
  'berlin': 'Europe/Berlin',
  'japan': 'Asia/Tokyo',
  'tokyo': 'Asia/Tokyo',
  'china': 'Asia/Shanghai',
  'beijing': 'Asia/Shanghai',
  'india': 'Asia/Kolkata',
  'mumbai': 'Asia/Kolkata',
  'delhi': 'Asia/Kolkata',
  'dubai': 'Asia/Dubai',
  'uae': 'Asia/Dubai',
  'australia': 'Australia/Sydney',
  'sydney': 'Australia/Sydney',
  'melbourne': 'Australia/Melbourne',
  'brazil': 'America/Sao_Paulo',
  'south africa': 'Africa/Johannesburg',
  'johannesburg': 'Africa/Johannesburg',
  'cape town': 'Africa/Johannesburg',
  'kenya': 'Africa/Nairobi',
  'nairobi': 'Africa/Nairobi',
  'ghana': 'Africa/Accra',
  'accra': 'Africa/Accra',
  'egypt': 'Africa/Cairo',
  'cairo': 'Africa/Cairo',
  'morocco': 'Africa/Casablanca',
  'singapore': 'Asia/Singapore',
  'hong kong': 'Asia/Hong_Kong',
  'korea': 'Asia/Seoul',
  'seoul': 'Asia/Seoul',
  'russia': 'Europe/Moscow',
  'moscow': 'Europe/Moscow',
  'canada': 'America/Toronto',
  'toronto': 'America/Toronto',
  'vancouver': 'America/Vancouver',
  'mexico': 'America/Mexico_City',
  'spain': 'Europe/Madrid',
  'madrid': 'Europe/Madrid',
  'italy': 'Europe/Rome',
  'rome': 'Europe/Rome',
  'netherlands': 'Europe/Amsterdam',
  'amsterdam': 'Europe/Amsterdam',
  'sweden': 'Europe/Stockholm',
  'norway': 'Europe/Oslo',
  'poland': 'Europe/Warsaw',
  'turkey': 'Europe/Istanbul',
  'istanbul': 'Europe/Istanbul',
  'saudi arabia': 'Asia/Riyadh',
  'riyadh': 'Asia/Riyadh',
  'qatar': 'Asia/Qatar',
  'doha': 'Asia/Qatar',
  'pakistan': 'Asia/Karachi',
  'karachi': 'Asia/Karachi',
  'bangladesh': 'Asia/Dhaka',
  'dhaka': 'Asia/Dhaka',
  'thailand': 'Asia/Bangkok',
  'bangkok': 'Asia/Bangkok',
  'vietnam': 'Asia/Ho_Chi_Minh',
  'philippines': 'Asia/Manila',
  'manila': 'Asia/Manila',
  'indonesia': 'Asia/Jakarta',
  'jakarta': 'Asia/Jakarta',
  'malaysia': 'Asia/Kuala_Lumpur',
  'new zealand': 'Pacific/Auckland',
  'auckland': 'Pacific/Auckland',
};

// Get real-time for a location
export function getTimeForLocation(location: string): string | null {
  const lowerLocation = location.toLowerCase().trim();
  
  for (const [key, tz] of Object.entries(TIME_ZONES)) {
    if (lowerLocation.includes(key)) {
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        const locationName = key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        return `The current time in ${locationName} (${tz}) is: ${formatter.format(now)}`;
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Detect time-related queries
export function isTimeQuery(message: string): { isTime: boolean; location?: string } {
  const lowerMsg = message.toLowerCase();
  
  const timePatterns = [
    /what('?s| is| the) ?(the )?(time|date|day) (in|at) ([a-zA-Z\s]+)/i,
    /time (in|at) ([a-zA-Z\s]+)/i,
    /current time (in|at) ([a-zA-Z\s]+)/i,
    /what time is it (in|at) ([a-zA-Z\s]+)/i,
    /what is the time (in|at) ([a-zA-Z\s]+)/i,
    /(in|at) ([a-zA-Z\s]+)[,.]? what('?s| is)? the time/i,
  ];

  for (const pattern of timePatterns) {
    const match = message.match(pattern);
    if (match) {
      const location = match[match.length - 1]?.trim();
      if (location && location.length > 1) {
        return { isTime: true, location };
      }
    }
  }

  // Check for simple patterns like "time in nigeria"
  for (const loc of Object.keys(TIME_ZONES)) {
    if (lowerMsg.includes('time') && lowerMsg.includes(loc)) {
      return { isTime: true, location: loc };
    }
  }

  return { isTime: false };
}

// Detect social media handles and generate search queries
export function extractSocialMediaQuery(message: string): { platform: string; handle: string; query: string } | null {
  const lowerMsg = message.toLowerCase();
  
  // Twitter/X handles - very specific detection
  const twitterMatch = message.match(/@([a-zA-Z0-9_]+)/);
  if (twitterMatch) {
    const handle = twitterMatch[1];
    return {
      platform: 'Twitter/X',
      handle,
      query: `"@${handle}" OR "${handle}" site:x.com OR site:twitter.com`,
    };
  }
  
  // Check for X/Twitter mentions without @
  if (lowerMsg.includes('twitter') || lowerMsg.includes('x handle') || lowerMsg.includes('x.com') || lowerMsg.includes('on x ')) {
    const words = message.split(/\s+/);
    for (const word of words) {
      if (/^[a-zA-Z][a-zA-Z0-9_]{2,15}$/.test(word) && !['twitter', 'check', 'find', 'search', 'this', 'that', 'handle', 'user', 'profile'].includes(word.toLowerCase())) {
        return {
          platform: 'Twitter/X',
          handle: word,
          query: `"@${word}" OR "${word}" site:x.com OR site:twitter.com Twitter profile`,
        };
      }
    }
  }

  // Instagram handles
  const instaMatch = message.match(/(?:instagram|ig)[:\s]*@?([a-zA-Z0-9_.]+)/i);
  if (instaMatch || lowerMsg.includes('instagram')) {
    const handle = instaMatch ? instaMatch[1] : '';
    return {
      platform: 'Instagram',
      handle,
      query: handle 
        ? `"${handle}" Instagram profile site:instagram.com` 
        : message,
    };
  }

  // YouTube
  if (lowerMsg.includes('youtube') || lowerMsg.includes('yt channel')) {
    return {
      platform: 'YouTube',
      handle: '',
      query: message.replace(/(check|look up|find|search|youtube|yt)/gi, '').trim() + ' YouTube channel site:youtube.com',
    };
  }

  // TikTok
  if (lowerMsg.includes('tiktok')) {
    return {
      platform: 'TikTok',
      handle: '',
      query: message.replace(/(check|look up|find|search|tiktok)/gi, '').trim() + ' TikTok profile site:tiktok.com',
    };
  }

  // LinkedIn
  if (lowerMsg.includes('linkedin')) {
    return {
      platform: 'LinkedIn',
      handle: '',
      query: message.replace(/(check|look up|find|search|linkedin)/gi, '').trim() + ' LinkedIn profile site:linkedin.com',
    };
  }

  // Facebook
  if (lowerMsg.includes('facebook') || lowerMsg.includes('fb')) {
    return {
      platform: 'Facebook',
      handle: '',
      query: message.replace(/(check|look up|find|search|facebook|fb)/gi, '').trim() + ' Facebook page site:facebook.com',
    };
  }

  return null;
}

// Enhanced URL detection - any URL type including social media
export function extractUrls(message: string): string[] {
  const urlPatterns = [
    // Standard URLs with protocol
    /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi,
    // URLs without protocol but with www
    /(www\.[^\s<>"{}|\\^`\[\]]+)/gi,
    // Short URLs
    /(t\.co\/[a-zA-Z0-9]+)/gi,
    /(bit\.ly\/[a-zA-Z0-9]+)/gi,
    /(youtu\.be\/[a-zA-Z0-9_-]+)/gi,
    /(goo\.gl\/[a-zA-Z0-9]+)/gi,
    // Domain patterns (be more specific)
    /(?<!\w)([a-zA-Z0-9][-a-zA-Z0-9]*\.(com|org|net|io|co|dev|app|ai|xyz|me|info|biz|edu|gov|ng|uk|ca|au|de|fr|jp|cn|in)(\/[^\s]*)?)/gi,
  ];

  const urls: string[] = [];
  for (const pattern of urlPatterns) {
    const matches = message.match(pattern);
    if (matches) {
      urls.push(...matches);
    }
  }

  // Dedupe and format
  return [...new Set(urls)].map(url => {
    if (!url.startsWith('http')) {
      return `https://${url}`;
    }
    return url;
  }).filter(url => {
    // Filter out invalid URLs
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });
}

// Detect special commands (for WhatsApp)
export function parseCommand(message: string): CommandResult {
  const lowerMsg = message.toLowerCase().trim();

  // Save conversation
  if (lowerMsg.includes('save this conversation') || lowerMsg.includes('save our chat') || lowerMsg.includes('save chat')) {
    return { isCommand: true, command: 'save' };
  }

  // Clear/forget everything
  if (lowerMsg.includes('clear everything') || lowerMsg.includes('forget everything') || 
      lowerMsg.includes('start fresh') || lowerMsg.includes('reset conversation') ||
      lowerMsg.includes('forget what we discussed') || lowerMsg.includes('clear our chat') ||
      lowerMsg.includes('delete history') || lowerMsg.includes('reset chat')) {
    return { isCommand: true, command: 'clear' };
  }

  // Language switching
  const langMatch = message.match(/(?:let'?s? )?(?:speak|talk|respond|switch|chat) (?:in |to )?([a-zA-Z]+)$/i) ||
                    message.match(/^(?:speak|talk|respond|switch|chat) (?:in |to )?([a-zA-Z]+)/i);
  if (langMatch) {
    const requestedLang = langMatch[1].toLowerCase();
    const langMap: Record<string, string> = {
      'english': 'en', 'french': 'fr', 'spanish': 'es', 'german': 'de',
      'portuguese': 'pt', 'chinese': 'zh', 'japanese': 'ja', 'arabic': 'ar',
      'hindi': 'hi', 'russian': 'ru', 'italian': 'it', 'dutch': 'nl',
      'korean': 'ko', 'turkish': 'tr', 'polish': 'pl', 'swahili': 'sw',
      'yoruba': 'yo', 'hausa': 'ha', 'igbo': 'ig', 'pidgin': 'pcm',
    };
    
    if (langMap[requestedLang]) {
      return { isCommand: true, command: 'language', language: langMap[requestedLang] };
    }
  }

  // Poll creation
  const pollMatch = message.match(/create (?:a )?poll[:\s]+(.+)/i);
  if (pollMatch || lowerMsg.startsWith('poll:')) {
    const pollContent = pollMatch ? pollMatch[1] : message.replace(/^poll:\s*/i, '');
    const parts = pollContent.split('?');
    if (parts.length >= 2) {
      const question = parts[0].trim() + '?';
      const options = parts[1].split(/[,;]/).map(o => o.trim()).filter(o => o.length > 0);
      if (options.length >= 2) {
        return { isCommand: true, command: 'poll', pollData: { question, options } };
      }
    }
  }

  // Help command
  if (lowerMsg === 'help' || lowerMsg === '/help' || lowerMsg === 'commands') {
    return { isCommand: true, command: 'help' };
  }

  return { isCommand: false };
}

// Detect if a message contains a proper noun (capitalized word that's not at start)
function containsProperNoun(message: string): boolean {
  // Split into words and check for capitalized words (not at sentence start)
  const words = message.split(/\s+/);
  
  // Single capitalized word is likely a proper noun/entity
  if (words.length === 1 && /^[A-Z][a-zA-Z]{2,}$/.test(message)) {
    return true;
  }
  
  // Check for capitalized words in the middle of sentences
  for (let i = 1; i < words.length; i++) {
    if (/^[A-Z][a-zA-Z]{2,}$/.test(words[i])) {
      return true;
    }
  }
  
  // Check for all-caps words (acronyms like RUGIPO, NASA, etc.)
  for (const word of words) {
    if (/^[A-Z]{3,}$/.test(word)) {
      return true;
    }
  }
  
  return false;
}

// Detect if message is casual/conversational (shouldn't trigger web search)
function isCasualMessage(message: string): boolean {
  const lowerMsg = message.toLowerCase().trim();
  
  // If it contains a proper noun or acronym, it's NOT casual - needs search
  if (containsProperNoun(message)) {
    console.log('📌 Proper noun/acronym detected, will search:', message);
    return false;
  }
  
  // Greetings and casual patterns - must be EXACT matches
  const casualPatterns = [
    /^(hi|hey|hello|sup|yo|waddup|wassup|hola|hii+|heya?)(\s|!|,|\.)*$/i,
    /^(good\s)?(morning|afternoon|evening|night)(\s|!|,|\.)*$/i,
    /^(ok|okay|cool|nice|great|thanks|thank you|thx|ty|alright|fine|sure)(\s|!|,|\.)*$/i,
    /^(lol|lmao|haha|hehe|rofl|😂|🤣|😭)+(\s|!|,|\.)*$/i,
    /^(yes|no|yeah|yep|nope|nah|yea|ya)(\s|!|,|\.)*$/i,
    /^(bye|goodbye|see you|later|cya|ttyl)(\s|!|,|\.)*$/i,
    /^(bruh|bro|dude|fam|man|sis|girl)(\s|!|,|\.)*$/i,
    /^(ikr|idk|nvm|smh|tbh|imo|fyi)(\s|!|,|\.)*$/i,
    /^(you know|right|innit|fella|boi|u know)\?*(\s|!|,|\.)*$/i,
    /^(same|mood|vibes|bet|facts|cap|no cap)(\s|!|,|\.)*$/i,
    /^(hmm+|uhh*|ahh*|ohh*|ehh*)(\s|!|,|\.|\?)*$/i,
    /^(what'?s? up|how are you|how r u|how u doin|how's it going)\?*$/i,
    /^(nothing much|not much|nm|chillin|chilling)(\s|!|,|\.)*$/i,
    /^(👋|🙏|❤️|🔥|👍|👎|😊|😁|😎)+$/,
  ];
  
  for (const pattern of casualPatterns) {
    if (pattern.test(lowerMsg)) {
      return true;
    }
  }
  
  return false;
}

// Universal search detection - VERY aggressive (but excludes casual messages)
export function needsWebSearch(message: string): { needed: boolean; query: string; searchType?: 'general' | 'social' | 'url' | 'time' } {
  const lowerMsg = message.toLowerCase();
  
  // FIRST: Exclude casual/conversational messages to prevent 400 errors
  if (isCasualMessage(message)) {
    console.log('💬 Casual message detected, skipping web search');
    return { needed: false, query: '' };
  }
  
  // Check for time queries first
  const timeCheck = isTimeQuery(message);
  if (timeCheck.isTime) {
    return { needed: true, query: message, searchType: 'time' };
  }

  // Check for social media queries
  const socialQuery = extractSocialMediaQuery(message);
  if (socialQuery) {
    return { needed: true, query: socialQuery.query, searchType: 'social' };
  }

  // Check for URLs
  const urls = extractUrls(message);
  if (urls.length > 0) {
    return { needed: true, query: urls[0], searchType: 'url' };
  }

  // Very comprehensive patterns - anything that needs current info
  const patterns = [
    // Time and date queries
    /what('?s| is) (the )?(time|date|day)/i,
    
    // Current events and real-time data  
    /what('?s| is) (the )?(latest|current|recent|today'?s?|new|happening)/i,
    /news (about|on|regarding|for)/i,
    /(price|stock|weather|score|result|update|rate|exchange|value) (of|for|on|in)/i,
    
    // People queries - WHO (especially for presidents, leaders)
    /who (is|was|are|were|will be) /i,
    /who (won|is winning|leads?|runs?|owns?|founded|created|invented|discovered)/i,
    /who .+ (president|minister|ceo|leader|founder|owner|king|queen|chancellor|governor|mayor|chairman)/i,
    /president of/i,
    /current president/i,
    /\b(president|prime minister|leader) of [a-zA-Z]+/i,
    
    // WHAT questions
    /what (is|are|was|were|happened|did|does|will)/i,
    /what .+ (capital|population|gdp|currency|language|country|city|called)/i,
    
    // WHERE and WHEN questions
    /where (is|are|was|were|did|does|can|do)/i,
    /when (did|does|will|is|was|were|are)/i,
    
    // HOW and WHY questions
    /how (many|much|old|tall|big|long|far|deep|wide|fast|slow|do|does|did|can|could|to)/i,
    /why (did|does|is|are|was|were|do|don't)/i,
    
    // Year references - 2024, 2025, 2026
    /(in |during |since |after |before )?(2024|2025|2026)/i,
    /(this year|last year|next year|recently|lately|currently)/i,
    
    // Real-time keywords
    /\b(latest|current|recent|trending|happening|breaking|live|now|today|right now)\b/i,
    
    // Search intent
    /\b(search|look up|find out|tell me about|explain|describe|define|meaning of)\b/i,
    /\b(check|verify|confirm|validate|lookup)\b/i,
    
    // Explicit questions - any question
    /^(who|what|where|when|why|how|is|are|was|were|did|does|can|could|will|would|should) /i,
    /\?$/,
    
    // Crypto, stocks, finance
    /\b(bitcoin|btc|ethereum|eth|crypto|stock|share|forex|dollar|euro|pound|naira|yen)\b/i,
    
    // Sports
    /\b(match|game|score|tournament|league|championship|world cup|premier league|champions league|nba|nfl|epl)\b/i,
    
    // Tech and products
    /\b(iphone|android|windows|mac|google|apple|microsoft|amazon|tesla|openai|chatgpt|ai model)\b/i,
    
    // Entertainment
    /\b(movie|film|show|series|album|song|artist|celebrity|actor|actress)\b.*(new|latest|released|coming)/i,
    
    // Company/organization queries
    /\b(company|organization|business|startup|corporation)\b/i,
    
    // Comparison queries
    /\b(vs|versus|compared to|difference between|better than|worse than)\b/i,
    
    // Lists and rankings
    /\b(top|best|worst|most|least|biggest|smallest|richest|poorest|highest|lowest)\b/i,
    
    // Countries and politics
    /\b(government|election|vote|politics|policy|law|legislation)\b/i,
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(lowerMsg) || pattern.test(message)) {
      let query = message
        .replace(/^(hey |hi |hello |okay |ok |please |can you |could you |yo |sup |)/i, '')
        .replace(/\?$/g, '')
        .trim();
      return { needed: true, query, searchType: 'general' };
    }
  }
  
  // If message contains proper nouns (capitalized words) and is a question, search
  if (message.includes('?') && /[A-Z][a-z]{2,}/.test(message)) {
    return { needed: true, query: message.replace(/\?$/g, '').trim(), searchType: 'general' };
  }
  
  // If message mentions checking or looking up something
  if (/check (this|that|out|on|up|the)/i.test(lowerMsg)) {
    return { needed: true, query: message, searchType: 'general' };
  }
  
  return { needed: false, query: '' };
}

// Perform Tavily search with enhanced options
export async function performTavilySearch(query: string, apiKey: string): Promise<{ results: SearchResult[]; answer?: string }> {
  try {
    console.log('🔍 Tavily search for:', query);
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        include_answer: true,
        include_raw_content: false,
        max_results: 10,
        include_domains: [],
        exclude_domains: [],
      }),
    });

    if (!response.ok) {
      console.error('Tavily search failed:', response.status, await response.text());
      return { results: [] };
    }

    const data = await response.json();
    console.log('✅ Tavily returned', data.results?.length || 0, 'results');
    
    return {
      results: data.results || [],
      answer: data.answer,
    };
  } catch (error) {
    console.error('Tavily search error:', error);
    return { results: [] };
  }
}

// ===========================================
// GLOBAL KNOWLEDGE BASE FUNCTIONS
// ===========================================

export interface KnowledgeEntry {
  id: string;
  query_pattern: string;
  verified_answer: string;
  source_url?: string;
  category: string;
  confidence_score: number;
  usage_count: number;
}

// Detect if user is making a correction (teaching the AI)
export function detectCorrection(
  userMessage: string, 
  previousAssistantMessage?: string
): { isCorrection: boolean; correctedInfo?: string } {
  const lowerMsg = userMessage.toLowerCase();
  
  // Patterns that indicate the user is correcting the AI
  const correctionPatterns = [
    /^no,?\s*(actually|it'?s|that'?s|the answer is)/i,
    /^wrong[,.]?\s*/i,
    /^incorrect[,.]?\s*/i,
    /^that'?s not (right|correct|true)/i,
    /^actually[,.]?\s*/i,
    /^the (correct|right|true) (answer|information|info) is/i,
    /^not exactly[,.]?\s*/i,
    /^you'?re wrong/i,
    /^you got (it|that) wrong/i,
    /^let me correct (you|that)/i,
    /^(save|learn|remember) this/i,
    /^(it|he|she|they) (is|are|was|were) (actually|really)/i,
  ];
  
  for (const pattern of correctionPatterns) {
    if (pattern.test(lowerMsg)) {
      // Extract the correction content
      const correctedInfo = userMessage
        .replace(/^(no,?\s*|wrong[,.]?\s*|incorrect[,.]?\s*|actually[,.]?\s*|that'?s not right[,.]?\s*|the correct answer is\s*|let me correct you[,.]?\s*|save this[,.]?\s*|learn this[,.]?\s*|remember this[,.]?\s*)/i, '')
        .trim();
      
      if (correctedInfo.length > 10) {
        return { isCorrection: true, correctedInfo };
      }
    }
  }
  
  return { isCorrection: false };
}

// Extract the topic/entity being corrected from context
export function extractQueryPattern(correctedInfo: string, previousMessages: ConversationMessage[]): string {
  // Try to extract the main subject from the correction
  // Look for patterns like "X is Y" or "The answer is Y"
  
  const isMatch = correctedInfo.match(/^(.+?)\s+(?:is|are|was|were)\s+/i);
  if (isMatch && isMatch[1].length > 2 && isMatch[1].length < 100) {
    return isMatch[1].toLowerCase().trim();
  }
  
  // Look at recent messages to find what was being asked
  for (let i = previousMessages.length - 1; i >= 0 && i >= previousMessages.length - 4; i--) {
    const msg = previousMessages[i];
    if (msg.role === 'user') {
      // Extract entities/keywords from the original question
      const words = msg.content.split(/\s+/).filter(w => 
        w.length > 3 && 
        /^[A-Z]/.test(w) || // Capitalized
        /^[A-Z]{2,}$/.test(w) // Acronym
      );
      if (words.length > 0) {
        return words.join(' ').toLowerCase();
      }
    }
  }
  
  // Fallback: use first significant words of the correction
  const words = correctedInfo.split(/\s+/).slice(0, 5).join(' ').toLowerCase();
  return words;
}

// Search knowledge base for relevant entries
export async function searchKnowledgeBase(
  supabase: any,
  query: string
): Promise<KnowledgeEntry | null> {
  try {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    if (searchTerms.length === 0) return null;
    
    // Search using text search
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .or(searchTerms.map(term => `query_pattern.ilike.%${term}%`).join(','))
      .order('usage_count', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Knowledge base search error:', error);
      return null;
    }
    
    if (data && data.length > 0) {
      console.log('📚 Found knowledge base entry:', data[0].query_pattern);
      
      // Increment usage count
      await supabase
        .from('knowledge_base')
        .update({ usage_count: data[0].usage_count + 1 })
        .eq('id', data[0].id);
      
      return data[0] as KnowledgeEntry;
    }
    
    return null;
  } catch (error) {
    console.error('Knowledge base search error:', error);
    return null;
  }
}

// Save a correction to the knowledge base
export async function saveToKnowledgeBase(
  supabase: any,
  queryPattern: string,
  verifiedAnswer: string,
  sourceUrl?: string,
  category: string = 'general'
): Promise<boolean> {
  try {
    console.log('💾 Saving to knowledge base:', queryPattern);
    
    // Upsert - update if exists, insert if not
    const { error } = await supabase
      .from('knowledge_base')
      .upsert({
        query_pattern: queryPattern.toLowerCase(),
        verified_answer: verifiedAnswer,
        source_url: sourceUrl,
        category,
        confidence_score: 1.0,
        usage_count: 1,
        created_by: 'user_correction',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'query_pattern',
        ignoreDuplicates: false,
      });
    
    if (error) {
      console.error('Knowledge base save error:', error);
      return false;
    }
    
    console.log('✅ Saved to knowledge base successfully');
    return true;
  } catch (error) {
    console.error('Knowledge base save error:', error);
    return false;
  }
}

// Store web search results as knowledge (auto-learning from verified sources)
export async function learnFromWebSearch(
  supabase: any,
  query: string,
  searchResults: { results: SearchResult[]; answer?: string },
  category: string = 'web_search'
): Promise<void> {
  try {
    // Only store if we got a clear answer
    if (!searchResults.answer || searchResults.answer.length < 20) return;
    
    const sourceUrl = searchResults.results[0]?.url;
    
    await saveToKnowledgeBase(
      supabase,
      query.toLowerCase(),
      searchResults.answer,
      sourceUrl,
      category
    );
  } catch (error) {
    console.error('Auto-learn error:', error);
  }
}


export async function scrapeUrl(url: string, apiKey: string): Promise<string | null> {
  try {
    console.log('📄 Scraping URL:', url);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 5000,
        timeout: 60000,
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl scrape failed:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const content = data.data?.markdown || data.markdown || null;
    if (content) {
      console.log('✅ Scraped', content.length, 'chars from', url);
    }
    return content;
  } catch (error) {
    console.error('URL scrape error:', error);
    return null;
  }
}

// Analyze image with Gemini Vision
export async function analyzeImage(imageUrl: string, caption: string | undefined, apiKey: string): Promise<string | null> {
  try {
    console.log('🖼️ Analyzing image with Gemini Vision');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODELS.vision,
        messages: [
          {
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: caption 
                  ? `The user sent this image with the caption: "${caption}". Analyze and respond to their request. Be helpful and detailed.`
                  : 'The user sent this image. Describe what you see in detail. What is shown? What are the key elements? Be helpful and informative.'
              },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.error('Vision API error:', response.status, await response.text());
      return null;
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    console.log('✅ Image analyzed successfully');
    return content || null;
  } catch (error) {
    console.error('Image analysis error:', error);
    return null;
  }
}

// Transcribe audio using ElevenLabs Speech-to-Text
export async function transcribeAudio(audioUrl: string, elevenLabsKey: string): Promise<string | null> {
  try {
    console.log('🎤 Transcribing audio with ElevenLabs');
    
    // First download the audio
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error('Failed to download audio:', audioResponse.status);
      return null;
    }
    
    const audioBlob = await audioResponse.blob();
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model_id', 'scribe_v1');
    formData.append('language_code', 'eng'); // Auto-detect or specific language
    
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
      },
      body: formData,
    });

    if (!response.ok) {
      console.error('ElevenLabs STT error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const transcription = data.text || data.transcription;
    console.log('✅ Audio transcribed:', transcription?.slice(0, 50) + '...');
    return transcription || null;
  } catch (error) {
    console.error('Transcription error:', error);
    return null;
  }
}

// Generate voice response using ElevenLabs TTS
export async function generateVoiceResponse(text: string, elevenLabsKey: string): Promise<ArrayBuffer | null> {
  try {
    console.log('🔊 Generating voice with ElevenLabs');
    
    // Use a good default voice - "Brian" which is natural sounding
    const voiceId = 'nPczCjzI2devNBz1zQrb';
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.slice(0, 5000), // Limit text length
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('ElevenLabs TTS error:', response.status, await response.text());
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    console.log('✅ Voice generated:', audioBuffer.byteLength, 'bytes');
    return audioBuffer;
  } catch (error) {
    console.error('Voice generation error:', error);
    return null;
  }
}

// Detect image generation request from user message
export function detectImageGenerationRequest(message: string): { 
  shouldGenerate: boolean; 
  prompt: string; 
  quality: 'fast' | 'high';
} {
  const lowerMsg = message.toLowerCase();
  
  // Patterns that indicate image generation request
  const generatePatterns = [
    /generate (?:an? )?(?:image|picture|photo|art|artwork|illustration|graphic)/i,
    /create (?:an? )?(?:image|picture|photo|art|artwork|illustration|graphic)/i,
    /make (?:me )?(?:an? )?(?:image|picture|photo|art|artwork|graphic)/i,
    /draw (?:me )?(?:an? )?(?:picture|image|artwork|graphic)/i,
    /(?:can you |please )?(?:visualize|illustrate)\b/i,
    /design (?:an? )?(?:logo|banner|poster|image|graphic|icon)/i,
    /^(?:image|picture|photo|art)(?:\s*:|\s+of)\s+/i,
    /paint (?:me )?(?:an? )?/i,
    /show me (?:an? )?(?:image|picture|art) of/i,
    /imagine (?:an? )?/i,
  ];
  
  // High quality indicators
  const highQualityPatterns = [
    /\b(high quality|hq|detailed|professional|best quality|4k|hd|ultra)\b/i,
    /\b(realistic|photorealistic|hyperrealistic)\b/i,
    /\b(premium|stunning|beautiful|amazing)\b/i,
  ];
  
  for (const pattern of generatePatterns) {
    if (pattern.test(message)) {
      // Extract the prompt (remove the command part)
      let prompt = message
        .replace(/^(generate|create|make|draw|design|show me|visualize|illustrate|paint|imagine)\s+(me\s+)?(an?\s+)?(image|picture|photo|art|artwork|illustration|logo|banner|poster|graphic|icon)(\s+of)?:?\s*/i, '')
        .trim();
      
      if (!prompt || prompt.length < 3) prompt = message; // Use full message if extraction fails
      
      const quality = highQualityPatterns.some(p => p.test(message)) ? 'high' : 'fast';
      
      return { shouldGenerate: true, prompt, quality };
    }
  }
  
  return { shouldGenerate: false, prompt: '', quality: 'fast' };
}

// Generate image using Lovable AI Gateway (Nano banana model)
export async function generateImage(
  prompt: string, 
  quality: 'fast' | 'high',
  apiKey: string
): Promise<{ success: boolean; imageBase64?: string; error?: string }> {
  try {
    console.log('🎨 Generating image with prompt:', prompt.slice(0, 100));
    
    // Use the correct model name for image generation
    // google/gemini-2.5-flash-image-preview is the "Nano banana" model for image generation
    const model = quality === 'high' 
      ? 'google/gemini-3-pro-image-preview'
      : 'google/gemini-2.5-flash-image-preview';
    
    console.log('🎨 Using model:', model);
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Image generation failed:', response.status, errorText);
      if (response.status === 429) {
        return { success: false, error: 'Rate limited - please wait a moment and try again' };
      }
      if (response.status === 402) {
        return { success: false, error: 'AI credits depleted' };
      }
      return { success: false, error: `Generation failed: ${response.status}` };
    }

    const data = await response.json();
    console.log('🎨 API Response structure:', Object.keys(data));
    
    // Check for images array in the response
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl) {
      if (imageUrl.startsWith('data:image')) {
        // Extract base64 from data URI
        const base64 = imageUrl.split(',')[1];
        console.log('✅ Image generated successfully (data URI)');
        return { success: true, imageBase64: base64 };
      } else {
        // It's a URL, we need to fetch and convert to base64
        console.log('🎨 Image URL received, fetching...');
        try {
          const imageResponse = await fetch(imageUrl);
          const imageBlob = await imageResponse.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBlob)));
          console.log('✅ Image fetched and converted to base64');
          return { success: true, imageBase64: base64 };
        } catch (fetchError) {
          console.error('Failed to fetch image URL:', fetchError);
          return { success: false, error: 'Failed to download generated image' };
        }
      }
    }
    
    // Log the full response for debugging
    console.error('No image in response. Full response:', JSON.stringify(data).slice(0, 500));
    
    // Check if the model returned text saying it can't generate images
    const textContent = data.choices?.[0]?.message?.content;
    if (textContent && typeof textContent === 'string') {
      console.log('Model returned text instead of image:', textContent.slice(0, 200));
    }
    
    return { success: false, error: 'No image was generated. The model may not support this request.' };
  } catch (error) {
    console.error('Image generation error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Generate time-specific context
function getTimeContext(): string {
  const now = new Date();
  return `
CURRENT DATE AND TIME:
- UTC: ${now.toUTCString()}
- Year: ${now.getFullYear()}
- Month: ${now.toLocaleString('en-US', { month: 'long' })}
- Day: ${now.toLocaleString('en-US', { weekday: 'long' })}, ${now.getDate()}

IMPORTANT: It is currently ${now.getFullYear()}. When answering questions about current events, leaders, presidents, etc., use the most recent information available from web search results. Do NOT rely on training data that may be outdated.

When users ask about time in specific locations, calculate it based on the timezone offset from UTC.`;
}

// Build system prompt - shared between web and WhatsApp
export function buildSystemPrompt(options: {
  senderName?: string;
  isWhatsApp?: boolean;
  preferences?: UserPreferences | null;
  savedLanguage?: string;
}): string {
  const { senderName, isWhatsApp, preferences, savedLanguage } = options;
  
  const basePrompt = `You are Phoenix AI, an intelligent and highly capable personal assistant created by IYANU and the Phoenix Team.

Your tagline: "Rising to every question, in real time."

${getTimeContext()}

CORE CAPABILITIES:
✅ Access LIVE web search via Tavily - you have REAL-TIME internet access
✅ Scrape and read ANY website including social media (Twitter/X, Instagram, YouTube, etc.)
✅ Check social media profiles and handles directly  
✅ Provide accurate current information (news, prices, scores, events, who is president, etc.)
✅ Generate content (blogs, tweets, summaries, reports)
✅ Analyze images when provided
✅ Transcribe and understand voice messages

CRITICAL RULES:
1. NEVER say you can't access websites or social media - YOU CAN via Firecrawl
2. NEVER say you don't have current information - YOU DO via Tavily search  
3. When web search results are provided, USE THEM to give accurate answers
4. ALWAYS cite sources with links when using web data
5. For time queries, use the calculated time from timezone data
6. For questions about current leaders, presidents, etc., ALWAYS use the search results provided
7. Be helpful, accurate, and engaging
8. READ MESSAGES CAREFULLY - understand exactly what the user is asking before responding

ANTI-HALLUCINATION RULES (CRITICAL - FOLLOW STRICTLY):
- ONLY reference information that is EXPLICITLY present in this conversation or search results provided
- NEVER mention platforms, websites, topics, or sources the user has NOT discussed in THIS conversation
- Example: Don't say "the Instagram results you shared" if Instagram was never mentioned by the user
- NEVER make up or assume context that wasn't provided
- If uncertain about something from the conversation, ASK rather than guess
- Before referencing ANY topic, verify it was ACTUALLY discussed in THIS specific conversation
- Do NOT confuse or mix up context from different topics
- Keep responses focused ONLY on what the user asked about
- NEVER invent past exchanges or pretend to remember things that weren't said
- If asked about something you don't have information on, say so honestly

MEMORY & CONTEXT:
- You remember the conversation history PROVIDED TO YOU in the messages - nothing more
- Refer back to previous messages naturally - but ONLY ones that ACTUALLY exist in the conversation
- Build on earlier discussions that ACTUALLY happened
- Remember user preferences and language choices mentioned in the conversation
- Stay consistent with what was ACTUALLY discussed before
- If user says to forget something, forget it and don't bring it up again
- NEVER hallucinate or invent past exchanges that didn't occur`;

  let platformSpecific = '';
  
  if (isWhatsApp) {
    platformSpecific = `

WHATSAPP-SPECIFIC RULES:
- User's name: ${senderName || 'User'}
- Format for WhatsApp: Use *bold* for emphasis (NOT **bold**)
- Use emojis naturally 🔥✨
- Keep responses readable on mobile (break long content into paragraphs)
- No markdown code blocks - explain code in plain text
- Maximum recommended length: ~2000 characters
- Be conversational like texting a knowledgeable friend

SPECIAL COMMANDS USER CAN USE:
- "save this conversation" - Acknowledge and confirm
- "clear everything" / "forget everything" - Reset and start fresh  
- "let's speak in [language]" - Switch language permanently
- "create poll: Question? Option1, Option2, Option3" - Create interactive poll
- "help" - Show available commands`;
  } else {
    platformSpecific = `

WEB INTERFACE RULES:
- Use proper markdown formatting
- Code blocks with syntax highlighting  
- Tables when presenting structured data
- Headers for organization
- Bullet points and numbered lists`;
  }

  let languageInstruction = '';
  const lang = savedLanguage || preferences?.language || 'en';
  
  const languageNames: Record<string, string> = {
    en: 'English', fr: 'French', es: 'Spanish', de: 'German',
    pt: 'Portuguese', zh: 'Chinese', ja: 'Japanese', ar: 'Arabic',
    hi: 'Hindi', ru: 'Russian', it: 'Italian', nl: 'Dutch',
    ko: 'Korean', tr: 'Turkish', pl: 'Polish', sw: 'Swahili',
    yo: 'Yoruba', ha: 'Hausa', ig: 'Igbo', pcm: 'Nigerian Pidgin',
  };

  languageInstruction = `\n\nLANGUAGE: ALWAYS respond in ${languageNames[lang] || 'English'}. This is the user's preferred language.`;

  let preferencesPrompt = '';
  if (preferences) {
    const styleMap: Record<string, string> = {
      formal: 'Use formal, professional tone.',
      casual: 'Use casual, friendly tone.',
      witty: 'Use witty, playful tone with humor.',
    };
    
    const lengthMap: Record<string, string> = {
      concise: 'Keep responses brief.',
      balanced: 'Use balanced detail.',
      detailed: 'Provide comprehensive responses.',
    };
    
    const expertiseMap: Record<string, string> = {
      beginner: 'Explain simply, avoid jargon.',
      intermediate: 'Use moderate technical language.',
      expert: 'Use technical terms freely.',
    };

    preferencesPrompt = `

USER PREFERENCES:
- ${styleMap[preferences.preferred_style] || styleMap.casual}
- ${lengthMap[preferences.response_length] || lengthMap.balanced}
- ${expertiseMap[preferences.expertise_level] || expertiseMap.intermediate}`;
    
    if (preferences.interests?.length > 0) {
      preferencesPrompt += `\n- Interests: ${preferences.interests.join(', ')}`;
    }
  }

  return basePrompt + platformSpecific + languageInstruction + preferencesPrompt;
}

// Format WhatsApp message (convert markdown to WhatsApp format)
export function formatForWhatsApp(text: string): string {
  return text
    // Convert ``` code blocks to readable format first (avoid formatting inside code)
    .replace(/```[a-z]*\n?([\s\S]*?)```/g, '「$1」')
    // Convert inline code
    .replace(/`([^`]+)`/g, '「$1」')
    // Convert **bold** to *bold* (WhatsApp style) - supports multiline
    .replace(/\*\*([\s\S]+?)\*\*/g, '*$1*')
    // Convert __bold__ to *bold*
    .replace(/__([\s\S]+?)__/g, '*$1*')
    // Clean up headers
    .replace(/^#{1,6}\s+/gm, '▸ ')
    // Clean up bullet points
    .replace(/^[-*]\s+/gm, '• ')
    // Ensure proper spacing
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Generate help message for WhatsApp
export function getHelpMessage(): string {
  return `🔥 *Phoenix AI Commands*

Here's what you can do:

📋 *General*
• Just send any message to chat
• Ask questions about anything
• Share links to read/summarize

🔍 *Search & Browse*
• Ask about current events, news, prices
• Check social media handles (@username)
• Share any URL to analyze

🗣️ *Language*
• "Let's speak in French" - Switch language
• Language stays until you change it

💾 *Memory*
• "Save this conversation" - Bookmark chat
• "Clear everything" - Start fresh

📊 *Interactive*  
• "Create poll: Question? Option1, Option2, Option3"

🎤 *Voice*
• Send voice messages - I'll transcribe and respond

🖼️ *Images*
• Send images - I'll analyze and describe them

Just type your question or request! 🚀`;
}

// Generate poll message for WhatsApp
export function formatPoll(question: string, options: string[]): string {
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  let poll = `📊 *${question}*\n\n`;
  
  options.forEach((opt, i) => {
    poll += `${emojis[i] || '▸'} ${opt}\n`;
  });
  
  poll += `\n_Reply with the number of your choice!_`;
  return poll;
}

// ===========================================
// USER MEMORY SYSTEM (Cross-Platform)
// ===========================================

export interface UserMemory {
  id: string;
  platform: string;
  platform_user_id: string;
  fact: string;
  category: string;
  created_at: string;
}

// Detect memory-related commands in user messages
export function detectMemoryCommand(message: string): {
  type: 'save' | 'recall' | 'forget' | 'none';
  fact?: string;
  forgetQuery?: string;
} {
  const lowerMsg = message.toLowerCase().trim();

  // Save / remember commands
  const savePatterns = [
    /^remember (?:that )?(.*)/i,
    /^(?:please )?(?:save|store|note|keep) (?:that )?(.*)/i,
    /^my (?:name|job|age|birthday|location|hobby|email|phone|number|address|company|school|university|favorite|fav) (?:is|are) (.*)/i,
    /^i (?:am|work|live|study|like|love|hate|prefer|enjoy) (.*)/i,
    /^i'm (.*)/i,
    /^call me (.*)/i,
  ];

  for (const pattern of savePatterns) {
    const match = message.match(pattern);
    if (match) {
      const fact = match[1]?.trim();
      if (fact && fact.length > 2) {
        // For "my X is Y" patterns, rebuild the full fact
        if (/^my /i.test(message)) return { type: 'save', fact: message.trim() };
        if (/^i /i.test(message) || /^i'm /i.test(message)) return { type: 'save', fact: message.trim() };
        if (/^call me /i.test(message)) return { type: 'save', fact: `User wants to be called ${fact}` };
        return { type: 'save', fact };
      }
    }
  }

  // Recall commands
  const recallPatterns = [
    /^what do you (?:know|remember) about me/i,
    /^what have you (?:saved|stored|remembered)/i,
    /^(?:show|list|tell) (?:me )?(?:my )?(?:memories|facts|info|saved)/i,
    /^do you remember/i,
    /^what did i tell you/i,
  ];

  for (const pattern of recallPatterns) {
    if (pattern.test(lowerMsg)) return { type: 'recall' };
  }

  // Forget commands
  const forgetPatterns = [
    /^forget (?:that )?(.*)/i,
    /^(?:delete|remove|erase) (?:the )?(?:memory|fact|info)[:\s]*(.*)/i,
    /^forget (?:everything|all) about me/i,
    /^(?:delete|clear|erase) (?:all )?(?:my )?(?:memories|facts|data)/i,
  ];

  for (const pattern of forgetPatterns) {
    const match = message.match(pattern);
    if (match) {
      const query = match[1]?.trim();
      if (/everything|all/i.test(lowerMsg)) return { type: 'forget', forgetQuery: '__all__' };
      return { type: 'forget', forgetQuery: query || '__all__' };
    }
  }

  return { type: 'none' };
}

// Save a user memory
export async function saveUserMemory(
  supabase: any,
  platform: string,
  platformUserId: string,
  fact: string,
  category: string = 'general'
): Promise<boolean> {
  try {
    console.log('🧠 Saving memory:', { platform, platformUserId, fact: fact.slice(0, 50) });
    const { error } = await supabase.from('user_memories').insert({
      platform,
      platform_user_id: platformUserId,
      fact,
      category,
    });
    if (error) {
      console.error('Memory save error:', error);
      return false;
    }
    console.log('✅ Memory saved');
    return true;
  } catch (error) {
    console.error('Memory save error:', error);
    return false;
  }
}

// Get all memories for a user
export async function getUserMemories(
  supabase: any,
  platform: string,
  platformUserId: string
): Promise<UserMemory[]> {
  try {
    const { data, error } = await supabase
      .from('user_memories')
      .select('*')
      .eq('platform', platform)
      .eq('platform_user_id', platformUserId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      console.error('Memory fetch error:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Memory fetch error:', error);
    return [];
  }
}

// Delete user memories
export async function deleteUserMemories(
  supabase: any,
  platform: string,
  platformUserId: string,
  query?: string
): Promise<number> {
  try {
    if (!query || query === '__all__') {
      const { data, error } = await supabase
        .from('user_memories')
        .delete()
        .eq('platform', platform)
        .eq('platform_user_id', platformUserId)
        .select('id');
      if (error) { console.error('Memory delete error:', error); return 0; }
      return data?.length || 0;
    }

    // Delete specific memory matching query
    const { data, error } = await supabase
      .from('user_memories')
      .delete()
      .eq('platform', platform)
      .eq('platform_user_id', platformUserId)
      .ilike('fact', `%${query}%`)
      .select('id');
    if (error) { console.error('Memory delete error:', error); return 0; }
    return data?.length || 0;
  } catch (error) {
    console.error('Memory delete error:', error);
    return 0;
  }
}

// Format memories for injection into system prompt
export function formatMemoriesForPrompt(memories: UserMemory[]): string {
  if (!memories || memories.length === 0) return '';
  const facts = memories.map(m => `• ${m.fact}`).join('\n');
  return `\n\nUSER PERSONAL MEMORIES (things the user told you to remember):\n${facts}\n\nUse these facts naturally in conversation. Don't list them unless asked.`;
}
