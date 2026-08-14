import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) readonly client: Redis) {}

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  // Pipelined so the increment and its expiry land in one round trip —
  // callers doing this per hash field in a loop (telemetry counters) don't
  // pay two network hops each.
  async hincrbyWithExpire(
    key: string,
    field: string,
    amount: number,
    ttlSeconds: number,
  ): Promise<void> {
    await this.client
      .pipeline()
      .hincrby(key, field, amount)
      .expire(key, ttlSeconds)
      .exec();
  }

  // Same pipelined shape as hincrbyWithExpire, for HyperLogLog keys — PFADD
  // + EXPIRE in one round trip so unique-visitor keys self-expire without a
  // separate rollup job.
  async pfaddWithExpire(
    key: string,
    member: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.client
      .pipeline()
      .pfadd(key, member)
      .expire(key, ttlSeconds)
      .exec();
  }

  // Same pipelined shape again, for the period-bucketed sample lists the
  // metrics engine reads percentiles from (LCP/TTFB/dwell/session duration)
  // — RPUSH + EXPIRE in one round trip.
  async rpushWithExpire(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.client
      .pipeline()
      .rpush(key, value)
      .expire(key, ttlSeconds)
      .exec();
  }

  // Plain scalar counter version of hincrbyWithExpire, for the
  // period-bucketed keys that aren't a hash (e.g. a project's total session
  // count for the period).
  async incrbyWithExpire(
    key: string,
    amount: number,
    ttlSeconds: number,
  ): Promise<void> {
    await this.client
      .pipeline()
      .incrby(key, amount)
      .expire(key, ttlSeconds)
      .exec();
  }

  // PFCOUNT accepts multiple keys and returns the cardinality of their
  // union directly — no PFMERGE needed just to read a "last N days" figure
  // out of N daily HLL keys.
  pfcount(...keys: string[]): Promise<number> {
    return this.client.pfcount(...keys);
  }

  // Fixed-window rate limiting: INCR the window's counter, and set its
  // expiry only if this is the first hit in the window (`EXPIRE ... NX`,
  // Redis 7+) — using plain EXPIRE on every call would keep pushing the
  // window out on every request from a sustained caller, so it would never
  // actually reset. Returns the post-increment count for the caller to
  // compare against its own limit.
  async incrWithExpireNx(key: string, ttlSeconds: number): Promise<number> {
    const results = await this.client
      .pipeline()
      .incr(key)
      .expire(key, ttlSeconds, 'NX')
      .exec();
    const incrResult = results?.[0];
    if (!incrResult) return 0;
    const [err, count] = incrResult;
    if (err) throw err;
    return count as number;
  }
}
