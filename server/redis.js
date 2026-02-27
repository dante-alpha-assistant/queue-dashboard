import Redis from "ioredis";
const redis = new Redis(process.env.REDIS_URL || "redis://redis.infra.svc.cluster.local:6379", {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 200, 5000),
});
export default redis;
