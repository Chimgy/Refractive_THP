import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type { UsageEventType } from '../entities/usage-event.entity';

const USAGE_EVENT_TYPES: UsageEventType[] = [
  'login',
  'logout',
  'page_view',
  'feature_used',
  'workflow_started',
  'workflow_completed',
  'workflow_abandoned',
  'error_encountered',
];

export class CreateUsageEventDto {
  @IsIn(USAGE_EVENT_TYPES)
  eventType: UsageEventType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  eventName: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  route?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

// Batched client-side (same instinct as THP_analytics.js, but simpler here —
// no sendBeacon/CORS constraints since this is first-party and authenticated).
// Hard cap replaces the backpressure a queue would otherwise give the public
// telemetry endpoint (see plan §"Key decisions" item 1) — this path has no
// Redis rate limiter in front of it.
export class CreateUsageEventsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateUsageEventDto)
  events: CreateUsageEventDto[];
}
