// import { Logger } from "drizzle-orm";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";

// class MyLogger implements Logger {
//   logQuery(query: string, params: unknown[]): void {
//     console.log({ query, params });
//   }
// }
export function getPostgresUrl(): string {
  const url = process.env.POSTGRES_URL;
  if (url && url.trim()) return url;
  const user = process.env.POSTGRES_USER || "chatpie";
  const password = process.env.POSTGRES_PASSWORD || "chatpie123";
  const host = process.env.POSTGRES_HOST || "localhost";
  const port = process.env.POSTGRES_PORT || "5432";
  const db = process.env.POSTGRES_DB || "chatpie";
  return `postgres://${user}:${password}@${host}:${port}/${db}`;
}

export const pgDb = drizzlePg(getPostgresUrl(), {});
