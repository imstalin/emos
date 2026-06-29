import Redis from "ioredis";

export function createRedisConnection(): Redis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";

  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export async function checkRedisConnection(): Promise<boolean> {
  const redis = createRedisConnection();

  try {
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  } finally {
    redis.disconnect();
  }
}
