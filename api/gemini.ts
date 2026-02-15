type GeminiInlineData = { data: string; mimeType: string };
type GeminiPart = { text?: string; inlineData?: GeminiInlineData };

const GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
const GEMINI_MODEL_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
};

function sanitizeEnv(value?: string): string {
  if (!value) return '';
  return value.trim().replace(/^["']|["']$/g, '');
}

function missingEnvVars(): string[] {
  const missing: string[] = [];
  if (!sanitizeEnv(process.env.GEMINI_API_KEY)) missing.push('GEMINI_API_KEY');
  return missing;
}

function readGeminiErrorMessage(bodyText: string, status: number): string {
  try {
    const parsed = JSON.parse(bodyText);
    const err = parsed?.error;
    const baseMessage = typeof err?.message === 'string' ? err.message : '';
    const details = Array.isArray(err?.details) ? err.details : [];
    const retryInfo = details.find((d: any) => String(d?.['@type'] || '').includes('RetryInfo'));
    const retryDelay = typeof retryInfo?.retryDelay === 'string' ? retryInfo.retryDelay : '';
    const isQuota = /quota exceeded|resource_exhausted/i.test(baseMessage) || status === 429;

    if (isQuota) {
      return retryDelay
        ? `Gemini quota exceeded. Retry after ${retryDelay}, or enable billing/increase quota.`
        : 'Gemini quota exceeded. Please retry later, or enable billing/increase quota.';
    }

    if (baseMessage) return baseMessage;
  } catch {
    // Ignore JSON parse errors and fall back to generic message below.
  }

  if (status === 429) return 'Gemini rate limit exceeded. Please retry later.';
  return bodyText || `Gemini error ${status}`;
}

async function callGeminiWithRetry(prompt: string, parts: GeminiPart[], retries = 2): Promise<string> {
  const key = sanitizeEnv(process.env.GEMINI_API_KEY);
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
      const err: any = new Error(readGeminiErrorMessage(body, response.status));
      err.status = response.status;
      throw err;
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
    const { prompt, parts } = req.body || {};
    const cleanPrompt = typeof prompt === 'string' ? prompt.trim() : '';

    if (!cleanPrompt || cleanPrompt.length < 2) {
      return res.status(400).json({ error: 'Invalid prompt' });
    }

    // Prevent oversized OCR payloads from collapsing into generic 500s.
    const approxInlineBytes = Array.isArray(parts)
      ? parts.reduce((acc: number, part: any) => {
          const data = part?.inlineData?.data;
          return acc + (typeof data === 'string' ? data.length : 0);
        }, 0)
      : 0;
    if (approxInlineBytes > 3_500_000) {
      return res.status(413).json({
        error: 'Input is too large for one request. Please upload fewer/smaller files.',
      });
    }

    const safeParts = normalizeParts(parts);
    const text = await callGeminiWithRetry(cleanPrompt, safeParts, 2);
    return res.status(200).json({ text, cached: false });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    const message = typeof error?.message === 'string' && error.message.trim()
      ? error.message
      : 'Gemini request failed';
    console.error('[api/gemini] failed:', message);
    return res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
  }
}
