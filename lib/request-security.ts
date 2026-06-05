import { NextResponse } from "next/server";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

export class RequestBodyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "RequestBodyError";
  }
}

export function isRequestBodyError(error: unknown): error is RequestBodyError {
  return error instanceof RequestBodyError;
}

function pruneExpiredRateLimits(now: number) {
  if (rateLimitStore.size < 2000) return;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function checkServerRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  pruneExpiredRateLimits(now);
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

export function rateLimitResponse(message = "Za dużo żądań. Spróbuj ponownie za chwilę.") {
  return NextResponse.json({ error: message }, { status: 429 });
}

export async function readJsonBody<T>(request: Request, maxBytes = 128 * 1024): Promise<T> {
  const body = await request.text();
  const size = new TextEncoder().encode(body).byteLength;

  if (size > maxBytes) {
    throw new RequestBodyError(`Treść żądania przekracza limit ${maxBytes} bajtów.`, 413);
  }

  try {
    return (body ? JSON.parse(body) : {}) as T;
  } catch {
    throw new RequestBodyError("Niepoprawny JSON w treści żądania.", 400);
  }
}
