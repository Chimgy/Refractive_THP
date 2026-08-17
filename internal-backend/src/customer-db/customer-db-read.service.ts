import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

// Read-only, hand-written-SQL connection into the CUSTOMER platform's own
// postgres (a different database than this app's own TypeOrmModule
// connection — see database/data-source.ts) via the least-privilege
// `internal_readonly` role (backend migration AddInternalReadonlyRole).
// Deliberately a plain pg.Pool, not a second TypeOrmModule/DataSource:
// TypeORM's entity/repository model adds nothing when every query here is a
// hand-written aggregate against a foreign, read-only schema this app
// doesn't own end-to-end (plan §"Key decisions" item 7).
@Injectable()
export class CustomerDbReadService implements OnModuleDestroy {
  private readonly logger = new Logger(CustomerDbReadService.name);
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    this.pool = new Pool({
      host: configService.get<string>('CUSTOMER_DB_HOST', 'localhost'),
      port: Number(configService.get<string>('CUSTOMER_DB_PORT', '5432')),
      user: configService.get<string>(
        'CUSTOMER_DB_USERNAME',
        'internal_readonly',
      ),
      password: configService.get<string>('CUSTOMER_DB_PASSWORD'),
      database: configService.get<string>('CUSTOMER_DB_NAME', 'refractive_thp'),
    });
    this.pool.on('error', (err) => {
      // Idle-client errors (e.g. the customer-net link dropping) surface
      // here asynchronously, off any request — must be handled or the
      // process crashes on an unhandled 'error' event (pg's own documented
      // gotcha for pool-level errors).
      this.logger.error('Idle customerDB connection error', err);
    });
  }

  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
