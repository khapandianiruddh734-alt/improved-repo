import { runAI } from "../../lib/aiClient";
import { getCache, setCache } from "../../lib/cache";
import { allowRequest } from "../../lib/limiter";
import { toBase64Key } from "../../utils/hash";

export const config = {
  runtime: "edge",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt : "";
    const user = typeof body?.user === "string" ? body.user : "";

    if (!prompt || !user) {
      return json({ error: "Invalid body. Expected { prompt, user }" }, 400);
    }

    const allowed = await allowRequest(user);
    if (!allowed) {
      return json({ error: "Rate limit exceeded" }, 429);
    }

    const cacheKey = `ai:${toBase64Key(prompt)}`;
    const cachedText = await getCache(cacheKey);
    if (cachedText !== null) {
      return json({ text: cachedText, cached: true }, 200);
    }

    const text = await runAI(prompt);
    await setCache(cacheKey, text);

    return json({ text, cached: false }, 200);
  } catch {
    return json({ error: "Internal server error" }, 500);
  }
}

