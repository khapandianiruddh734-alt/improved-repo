import { redisCommand } from '../src/lib/cache';

type GeminiInlineData = { data: string; mimeType: string };
type GeminiPart = { text?: string; inlineData?: GeminiInlineData };

const USER_DAILY_LIMIT = 15;
const USER_MINUTE_LIMIT = 5;
const TEAM_DAILY_LIMIT = 200;

const USER_DAILY_TTL = 60 * 60 * 24;
const USER_MINUTE_TTL = 60;
const GLOBAL_DAILY_TTL = 60 * 60 * 24;
const LOCK_TTL = 3;
const CACHE_TTL = 3600;

const GEMINI_MODEL_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

function missingEnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.REDIS_URL) missing.push('UPSTASH_REDIS_REST_URL');
  if (!process.env.UPSTASH_REDIS_REST_TOKEN && !process.env.REDIS_TOKEN) missing.push('UPSTASH_REDIS_REST_TOKEN');
  if (!process.env.GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
  return missing;
}

async function incrementWithLimit(key: string, ttl: number, limit: number): Promise<boolean> {
  const raw = await redisCommand(['INCR', key]);
  const count = typeof raw === 'number' ? raw : Number(raw);
  if (count === 1) {
    await redisCommand(['EXPIRE', key, ttl]);
  }
  return count <= limit;
}

async function callGeminiWithRetry(prompt: string, parts: GeminiPart[], retries = 2): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn('[api/gemini] GEMINI_API_KEY missing');
    throw new Error('GEMINI_API_KEY missing');
  }

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= retries) {
    try {
      const response = await fetch(`${GEMINI_MODEL_URL}?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [...parts, { text: prompt }] }],
        }),
      });

      if (response.ok) {
        const payload = await response.json();
        const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text === 'string') return text;
        throw new Error('Invalid Gemini response');
      }

      if (response.status === 429 && attempt < retries) {
        attempt += 1;
        await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        continue;
      }

      const body = await response.text();
      throw new Error(body || `Gemini error ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        attempt += 1;
        await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('Gemini failed');
}

function normalizeParts(rawParts: any): GeminiPart[] {
  if (!Array.isArray(rawParts)) return [];
  return rawParts
    .map((part: any): GeminiPart => {
      if (typeof part?.text === 'string') return { text: part.text };
      if (typeof part?.inlineData?.data === 'string' && typeof part?.inlineData?.mimeType === 'string') {
        return { inlineData: { data: part.inlineData.data, mimeType: part.inlineData.mimeType } };
      }
      return {};
    })
    .filter(part => typeof part.text === 'string' || !!part.inlineData);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const missing = missingEnvVars();
  if (missing.length > 0) {
    console.warn(`[api/gemini] Missing env: ${missing.join(', ')}`);
    return res.status(503).json({ error: 'Server configuration missing' });
  }

  try {
    const { prompt, userId, parts } = req.body || {};
    const cleanPrompt = typeof prompt === 'string' ? prompt.trim() : '';
    const cleanUserId = typeof userId === 'string' ? userId.trim().toLowerCase() : '';

    if (!cleanPrompt || cleanPrompt.length < 2) {
      return res.status(400).json({ error: 'Invalid prompt' });
    }
    if (!cleanUserId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const allowedRaw = await redisCommand(['SISMEMBER', 'users:list', cleanUserId]);
    const isAllowed = allowedRaw === 1 || allowedRaw === '1';
    if (!isAllowed) {
      return res.status(403).json({ error: 'User is not allowed' });
    }

    const lockKey = `lock:${cleanUserId}`;
    const lock = await redisCommand(['SET', lockKey, '1', 'EX', LOCK_TTL, 'NX']);
    if (lock !== 'OK') {
      return res.status(429).json({ error: 'Too many quick requests' });
    }

    const allowedMinute = await incrementWithLimit(`minute:${cleanUserId}`, USER_MINUTE_TTL, USER_MINUTE_LIMIT);
    if (!allowedMinute) return res.status(429).json({ error: 'Minute limit exceeded' });

    const allowedDaily = await incrementWithLimit(`daily:${cleanUserId}`, USER_DAILY_TTL, USER_DAILY_LIMIT);
    if (!allowedDaily) return res.status(429).json({ error: 'Daily limit exceeded' });

    const allowedGlobal = await incrementWithLimit('global:daily', GLOBAL_DAILY_TTL, TEAM_DAILY_LIMIT);
    if (!allowedGlobal) return res.status(429).json({ error: 'Team daily limit exceeded' });

    const cacheKey = `cache:${cleanPrompt}`;
    const cached = await redisCommand(['GET', cacheKey]);
    if (typeof cached === 'string' && cached.length > 0) {
      return res.status(200).json({ text: cached, cached: true });
    }

    const safeParts = normalizeParts(parts);
    const text = await callGeminiWithRetry(cleanPrompt, safeParts, 2);
    await redisCommand(['SETEX', cacheKey, CACHE_TTL, text]);

    return res.status(200).json({ text, cached: false });
  } catch {
    return res.status(500).json({ error: 'Gemini request failed' });
  }
}
