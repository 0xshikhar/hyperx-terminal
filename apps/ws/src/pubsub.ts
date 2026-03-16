import { Redis } from "@upstash/redis";

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export type PubSubMessage = {
  channel: string;
  market?: string;
  data: unknown;
};

let redis: Redis | null = null;
let isEnabled = false;
const messageCallbacks = new Set<(message: PubSubMessage) => void>();
let subscriberRunning = false;

function disableRedisPubSub(reason: string) {
  if (isEnabled) {
    console.warn(`Redis pub/sub disabled - ${reason}`);
  }
  redis = null;
  isEnabled = false;
}

export function initRedisPubSub(): { enabled: boolean } {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    console.log("Redis pub/sub disabled - no credentials configured");
    return { enabled: false };
  }

  redis = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN,
  });
  isEnabled = true;
  console.log("Redis pub/sub enabled for multi-instance support");
  return { enabled: true };
}

export function isPubSubEnabled(): boolean {
  return isEnabled;
}

const subscriberChannels = new Set<string>();

export async function subscribeToChannel(channel: string): Promise<void> {
  if (!isEnabled || !redis) return;
  
  subscriberChannels.add(channel);
}

export async function publishMessage(message: PubSubMessage): Promise<void> {
  if (!isEnabled || !redis) return;

  const channelKey = message.market 
    ? `${message.channel}:${message.market}`
    : message.channel;

  try {
    await redis.publish(channelKey, JSON.stringify(message));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown Redis publish error";
    disableRedisPubSub(`publish failed (${reason})`);
  }
}

export function onPubSubMessage(
  callback: (message: PubSubMessage) => void
): () => void {
  messageCallbacks.add(callback);
  
  return () => {
    messageCallbacks.delete(callback);
  };
}

async function redisSubscribeLoop(): Promise<void> {
  if (!isEnabled || !redis || subscriberRunning) return;
  subscriberRunning = true;

  while (isEnabled) {
    try {
      const keys = await redis.keys("pubsub:*");
      for (const key of keys.slice(0, 10)) {
        const message = await redis.lpop(key);
        if (message) {
          try {
            const parsed = JSON.parse(message as string) as PubSubMessage;
            messageCallbacks.forEach((cb) => cb(parsed));
          } catch {
            // ignore parse errors
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

export async function startRedisSubscriber(): Promise<void> {
  if (!isEnabled) return;
  redisSubscribeLoop();
}
