import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

export interface DatabaseQuery {
  query<Row extends QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Row[] }>;
}

export interface TransactionalDatabase extends DatabaseQuery {
  withTransaction<Result>(
    operation: (database: DatabaseQuery) => Promise<Result>,
  ): Promise<Result>;
}

function clientQuery(client: PoolClient): DatabaseQuery {
  return {
    query: (text, values) => client.query(text, values),
  };
}

@Injectable()
export class DatabaseService implements TransactionalDatabase, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  query<Row extends QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Row[] }> {
    return this.pool.query<Row>(text, values);
  }

  async withTransaction<Result>(
    operation: (database: DatabaseQuery) => Promise<Result>,
  ): Promise<Result> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await operation(clientQuery(client));
      await client.query("COMMIT");
      return result;
    } catch (error: unknown) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
