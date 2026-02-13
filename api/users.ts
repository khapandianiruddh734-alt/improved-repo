import { redisCommand } from '../src/lib/cache';

function warnMissingEnv() {
  if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.REDIS_URL) {
    console.warn('[api/users] Missing UPSTASH_REDIS_REST_URL');
  }
  if (!process.env.UPSTASH_REDIS_REST_TOKEN && !process.env.REDIS_TOKEN) {
    console.warn('[api/users] Missing UPSTASH_REDIS_REST_TOKEN');
  }
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req: any, res: any) {
  warnMissingEnv();

  try {
    if (req.method === 'GET') {
      const members = await redisCommand(['SMEMBERS', 'users:list']);
      const users = Array.isArray(members)
        ? members.map((item: any) => String(item)).sort((a, b) => a.localeCompare(b))
        : [];
      return res.status(200).json({ users });
    }

    if (req.method === 'POST') {
      const email = normalizeEmail(req.body?.email);
      if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      const addedRaw = await redisCommand(['SADD', 'users:list', email]);
      const added = typeof addedRaw === 'number' ? addedRaw : Number(addedRaw);
      if (added === 0) {
        return res.status(409).json({ error: 'Email already exists' });
      }
      return res.status(201).json({ ok: true, email });
    }

    if (req.method === 'DELETE') {
      const email = normalizeEmail(req.body?.email);
      if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      await redisCommand(['SREM', 'users:list', email]);
      return res.status(200).json({ ok: true, email });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch {
    return res.status(500).json({ error: 'Unable to process user request' });
  }
}
