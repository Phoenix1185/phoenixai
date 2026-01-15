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

// Time zones for real-time queries
const TIME_ZONES: Record<string, string> = {
  'nigeria': 'Africa/Lagos',
  'usa': 'America/New_York',
  'us': 'America/New_York',
  'america': 'America/New_York',
  'new york': 'America/New_York',
  'los angeles': 'America/Los_Angeles',
  'la': 'America/Los_Angeles',
  'california': 'America/Los_Angeles',
  'chicago': 'America/Chicago',
  'london': 'Europe/London',
  'uk': 'Europe/London',
  'paris': 'France/Paris',
  'france': 'Europe/Paris',
  'germany': 'Europe/Berlin',
  'berlin': 'Europe/Berlin',
  'japan': 'Asia/Tokyo',
  'tokyo': 'Asia/Tokyo',
  'china': 'Asia/Shanghai',
  'beijing': 'Asia/Shanghai',
  'india': 'Asia/Kolkata',
  'dubai': 'Asia/Dubai',
  'australia': 'Australia/Sydney',
  'sydney': 'Australia/Sydney',
  'brazil': 'America/Sao_Paulo',
  'south africa': 'Africa/Johannesburg',
  'johannesburg': 'Africa/Johannesburg',
  'kenya': 'Africa/Nairobi',
  'nairobi': 'Africa/Nairobi',
  'ghana': 'Africa/Accra',
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
  const lowerLocation = location.toLowerCase();
  
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
        return `The current time in ${key.charAt(0).toUpperCase() + key.slice(1)} is: ${formatter.format(now)}`;
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Detect time-related queries
export function isTimeQuery(message: string): { isTime: boolean; location?: string } {
  const timePatterns = [
    /what('s| is) (the )?(time|date|day) (in|at) ([a-zA-Z\s]+)/i,
    /time (in|at) ([a-zA-Z\s]+)/i,
    /current time (in|at) ([a-zA-Z\s]+)/i,
    /what time is it (in|at) ([a-zA-Z\s]+)/i,
  ];

  for (const pattern of timePatterns) {
    const match = message.match(pattern);
    if (match) {
      // Extract location from the last capture group
      const location = match[match.length - 1]?.trim();
      return { isTime: true, location };
    }
  }

  return { isTime: false };
}

// Detect social media handles and generate search queries
export function extractSocialMediaQuery(message: string): { platform: string; handle: string; query: string } | null {
  const lowerMsg = message.toLowerCase();
  
  // Twitter/X handles
  const twitterMatch = message.match(/@([a-zA-Z0-9_]+)/);
  if (twitterMatch || lowerMsg.includes('twitter') || lowerMsg.includes('x handle') || lowerMsg.includes('x.com')) {
    const handle = twitterMatch ? twitterMatch[1] : '';
    return {
      platform: 'Twitter/X',
      handle: handle || 'unknown',
      query: handle 
        ? `${handle} Twitter X profile site:x.com OR site:twitter.com` 
        : message.replace(/(check|look up|find|search)/gi, '').trim(),
    };
  }

  // Instagram handles
  const instaMatch = message.match(/(?:instagram|ig)[:\s]*@?([a-zA-Z0-9_.]+)/i);
  if (instaMatch || lowerMsg.includes('instagram')) {
    const handle = instaMatch ? instaMatch[1] : '';
    return {
      platform: 'Instagram',
      handle,
      query: handle 
        ? `${handle} Instagram profile site:instagram.com` 
        : message,
    };
  }

  // YouTube
  if (lowerMsg.includes('youtube') || lowerMsg.includes('yt channel')) {
    return {
      platform: 'YouTube',
      handle: '',
      query: message.replace(/(check|look up|find|search|youtube|yt)/gi, '').trim() + ' YouTube channel',
    };
  }

  // TikTok
  if (lowerMsg.includes('tiktok')) {
    return {
      platform: 'TikTok',
      handle: '',
      query: message.replace(/(check|look up|find|search|tiktok)/gi, '').trim() + ' TikTok profile',
    };
  }

  // LinkedIn
  if (lowerMsg.includes('linkedin')) {
    return {
      platform: 'LinkedIn',
      handle: '',
      query: message.replace(/(check|look up|find|search|linkedin)/gi, '').trim() + ' LinkedIn profile',
    };
  }

  // Facebook
  if (lowerMsg.includes('facebook') || lowerMsg.includes('fb')) {
    return {
      platform: 'Facebook',
      handle: '',
      query: message.replace(/(check|look up|find|search|facebook|fb)/gi, '').trim() + ' Facebook page',
    };
  }

  return null;
}

// Enhanced URL detection - any URL type including social media
export function extractUrls(message: string): string[] {
  const urlPatterns = [
    // Standard URLs
    /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi,
    // URLs without protocol
    /(www\.[^\s<>"{}|\\^`\[\]]+)/gi,
    // Social media short URLs
    /(t\.co\/[a-zA-Z0-9]+)/gi,
    /(bit\.ly\/[a-zA-Z0-9]+)/gi,
    /(youtu\.be\/[a-zA-Z0-9_-]+)/gi,
    // Domain patterns
    /([a-zA-Z0-9-]+\.(com|org|net|io|co|dev|app|ai|xyz|me|info|biz|edu|gov)[^\s]*)/gi,
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
      lowerMsg.includes('forget what we discussed') || lowerMsg.includes('clear our chat')) {
    return { isCommand: true, command: 'clear' };
  }

  // Language switching
  const langMatch = message.match(/(?:let'?s? )?(?:speak|talk|respond|switch) (?:in |to )?([a-zA-Z]+)/i);
  if (langMatch) {
    const requestedLang = langMatch[1].toLowerCase();
    const langMap: Record<string, string> = {
      'english': 'en', 'french': 'fr', 'spanish': 'es', 'german': 'de',
      'portuguese': 'pt', 'chinese': 'zh', 'japanese': 'ja', 'arabic': 'ar',
      'hindi': 'hi', 'russian': 'ru', 'italian': 'it', 'dutch': 'nl',
      'korean': 'ko', 'turkish': 'tr', 'polish': 'pl', 'swahili': 'sw',
      'yoruba': 'yo', 'hausa': 'ha', 'igbo': 'ig',
    };
    
    if (langMap[requestedLang]) {
      return { isCommand: true, command: 'language', language: langMap[requestedLang] };
    }
  }

  // Poll creation
  const pollMatch = message.match(/create (?:a )?poll[:\s]+(.+)/i);
  if (pollMatch || lowerMsg.startsWith('poll:')) {
    const pollContent = pollMatch ? pollMatch[1] : message.replace(/^poll:\s*/i, '');
    // Parse "Question? Option1, Option2, Option3"
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

// Universal search detection - VERY aggressive
export function needsWebSearch(message: string): { needed: boolean; query: string; searchType?: 'general' | 'social' | 'url' | 'time' } {
  const lowerMsg = message.toLowerCase();
  
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

  // Very comprehensive patterns
  const patterns = [
    // Time and date queries
    /what('s| is) (the )?(time|date|day)/i,
    
    // Current events and real-time data
    /what('s| is) (the )?(latest|current|recent|today'?s?|new|happening)/i,
    /news (about|on|regarding|for)/i,
    /(price|stock|weather|score|result|update|rate|exchange) (of|for|on|in)/i,
    
    // People queries - WHO
    /who (is|was|are|were|will be) /i,
    /who (won|is winning|leads?|runs?|owns?|founded|created|invented|discovered)/i,
    /who .+ (president|minister|ceo|leader|founder|owner|king|queen|chancellor|governor|mayor|chairman)/i,
    
    // WHAT questions
    /what (is|are|was|were|happened|did|does|will)/i,
    /what .+ (capital|population|gdp|currency|language|country|city|called)/i,
    
    // WHERE and WHEN questions
    /where (is|are|was|were|did|does|can|do)/i,
    /when (did|does|will|is|was|were|are)/i,
    
    // HOW and WHY questions
    /how (many|much|old|tall|big|long|far|deep|wide|fast|slow|do|does|did|can|could|to)/i,
    /why (did|does|is|are|was|were|do|don't)/i,
    
    // Year references
    /(in |during |since |after |before )?(2024|2025|2026)/i,
    /(this year|last year|next year|recently|lately)/i,
    
    // Real-time keywords
    /\b(latest|current|recent|trending|happening|breaking|live|now|today)\b/i,
    
    // Search intent
    /\b(search|look up|find out|tell me about|explain|describe|define|meaning of)\b/i,
    /\b(check|verify|confirm|validate)\b/i,
    
    // Explicit questions
    /^(who|what|where|when|why|how|is|are|was|were|did|does|can|could|will|would|should) /i,
    /\?$/,
    
    // Crypto, stocks, finance
    /\b(bitcoin|btc|ethereum|eth|crypto|stock|share|forex|dollar|euro|pound|naira)\b/i,
    
    // Sports
    /\b(match|game|score|tournament|league|championship|world cup|premier league|champions league)\b/i,
    
    // Tech and products
    /\b(iphone|android|windows|mac|google|apple|microsoft|amazon|tesla|openai|chatgpt)\b/i,
    
    // Entertainment
    /\b(movie|film|show|series|album|song|artist|celebrity|actor|actress)\b.*(new|latest|released|coming)/i,
    
    // Company/organization queries
    /\b(company|organization|business|startup|corporation)\b/i,
    
    // Comparison queries
    /\b(vs|versus|compared to|difference between|better than|worse than)\b/i,
    
    // Lists and rankings
    /\b(top|best|worst|most|least|biggest|smallest|richest|poorest)\b/i,
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
      console.error('Tavily search failed:', response.status);
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

// Scrape URL with Firecrawl - works for ANY website including social media
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
        waitFor: 3000,
        timeout: 45000,
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl scrape failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.data?.markdown || data.markdown || null;
  } catch (error) {
    console.error('URL scrape error:', error);
    return null;
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
✅ Provide accurate current information (news, prices, scores, events)
✅ Generate content (blogs, tweets, summaries, reports)
✅ Analyze images when provided
✅ Understand voice messages (transcribed)

CRITICAL RULES:
1. NEVER say you can't access websites or social media - YOU CAN via Firecrawl
2. NEVER say you don't have current information - YOU DO via Tavily search
3. When web search results are provided, USE THEM to give accurate answers
4. ALWAYS cite sources with links when using web data
5. For time queries, calculate based on the provided timezone data
6. Be helpful, accurate, and engaging

MEMORY & CONTEXT:
- You REMEMBER the full conversation history
- Refer back to previous messages naturally
- Build on earlier discussions
- Remember user preferences and language choices`;

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
    yo: 'Yoruba', ha: 'Hausa', ig: 'Igbo',
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
    // Convert **bold** to *bold*
    .replace(/\*\*([^*]+)\*\*/g, '*$1*')
    // Convert __bold__ to *bold*
    .replace(/__([^_]+)__/g, '*$1*')
    // Keep single * for italics as _italics_
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '_$1_')
    // Convert ``` code blocks to readable format
    .replace(/```[a-z]*\n?([\s\S]*?)```/g, '「$1」')
    // Convert inline code
    .replace(/`([^`]+)`/g, '「$1」')
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
