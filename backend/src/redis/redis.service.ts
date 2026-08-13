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
}
