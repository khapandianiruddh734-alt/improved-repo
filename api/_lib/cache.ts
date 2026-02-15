// Line 1 - DELETE THIS: import { redisCommand } from './_lib/cache.js';

type GeminiInlineData = { data: string; mimeType: string };
type GeminiPart = { text?: string; inlineData?: GeminiInlineData };

const USER_DAILY_LIMIT = 15;
const USER_MINUTE_LIMIT = 5;
const TEAM_DAILY_LIMIT = 200;

// ... rest of your code stays exactly the same ...

export async function redisCommand(command: (string | number)[]): Promise<any> {
  assertRedisEnv();

  const response = await fetch(REDIS_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ command }),
  });

  if (!response.ok) {
    throw new Error(`Redis error: ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`Redis command failed: ${payload.error}`);
  }

  return payload.result;
}