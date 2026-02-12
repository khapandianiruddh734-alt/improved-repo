import { redisCommand } from "./cache";

const DAILY_LIMIT = 60;
const ONE_DAY_SECONDS = 60 * 60 * 24;

export async function allowRequest(userId: string): Promise<boolean> {
  const dayKey = new Date().toISOString().slice(0, 10);
  const key = `rate:${userId}:${dayKey}`;

  const countRaw = await redisCommand(["INCR", key]);
  const count = typeof countRaw === "number" ? countRaw : Number(countRaw);

  if (count === 1) {
    await redisCommand(["EXPIRE", key, ONE_DAY_SECONDS]);
  }

  return count <= DAILY_LIMIT;
}

