import { redisCommand } from './_lib/cache';

type UsageUser = { id: string; count: number };

type StatsCache = {
  timestamp: number;
  payload: { users: UsageUser[]; total: number };
};

const TTL_MS = 5000;
let statsCache: StatsCache | null = null;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.REDIS_URL) {
    console.warn('[api/stats] Missing UPSTASH_REDIS_REST_URL');
  }
  if (!process.env.UPSTASH_REDIS_REST_TOKEN && !process.env.REDIS_TOKEN) {
    console.warn('[api/stats] Missing UPSTASH_REDIS_REST_TOKEN');
  }

  const now = Date.now();
  if (statsCache && now - statsCache.timestamp < TTL_MS) {
    return res.status(200).json(statsCache.payload);
  }

  try {
    const scanResult = await redisCommand(['SCAN', '0', 'MATCH', 'daily:*', 'COUNT', '1000']);
    const keys: string[] = Array.isArray(scanResult?.[1]) ? scanResult[1] : [];

    if (keys.length === 0) {
      const emptyPayload = { users: [] as UsageUser[], total: 0 };
      statsCache = { timestamp: now, payload: emptyPayload };
      return res.status(200).json(emptyPayload);
    }

    const counts = await Promise.all(keys.map((key) => redisCommand(['GET', key])));

    const users: UsageUser[] = keys.map((key, index) => {
      const id = key.startsWith('daily:') ? key.slice(6) : key;
      const rawValue = counts[index];
      const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue || 0);
      return { id, count: Number.isFinite(numeric) ? numeric : 0 };
    });

    users.sort((a, b) => b.count - a.count);
    const total = users.reduce((sum, item) => sum + item.count, 0);

    const payload = { users, total };
    statsCache = { timestamp: now, payload };

    return res.status(200).json(payload);
  } catch (error: any) {
    console.error('[api/stats] failed:', error?.message || error);
    return res.status(500).json({ users: [], total: 0 });
  }
}
