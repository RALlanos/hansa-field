import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool, type QueryResultRow } from "pg";

export interface DatabaseQuery {
  query<Row extends QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Row[] }>;
}

@Injectable()
export class DatabaseService implements DatabaseQuery, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  query<Row extends QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Row[] }> {
    return this.pool.query<Row>(text, values);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
