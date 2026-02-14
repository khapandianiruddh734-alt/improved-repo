function sanitizeEnv(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.replace(/^["']|["']$/g, "");
}

const REDIS_URL = sanitizeEnv(process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL);
const REDIS_TOKEN = sanitizeEnv(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN);

function assertRedisEnv(): void {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error("Missing UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN (or REDIS_URL/REDIS_TOKEN)");
  }
}

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

