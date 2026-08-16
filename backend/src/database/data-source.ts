import { DataSource, DataSourceOptions } from 'typeorm';

// Shared between AppModule's TypeOrmModule.forRoot() and the TypeORM CLI
// (migration:generate/run/revert need a concrete DataSource, not Nest's
// factory-based config) — keeping one definition means the app and the CLI
// can never see a different schema/connection than each other.
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'refractive_thp',
  entities: [`${__dirname}/../**/*.entity{.ts,.js}`],
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
};

export default new DataSource(dataSourceOptions);
