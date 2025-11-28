import { defineConfig } from "drizzle-kit";
import "load-env";

const dialect = "postgresql";

const url =
  process.env.POSTGRES_URL ||
  `postgres://${process.env.POSTGRES_USER || "chatpie"}:${
    process.env.POSTGRES_PASSWORD || "chatpie123"
  }@${process.env.POSTGRES_HOST || "localhost"}:${
    process.env.POSTGRES_PORT || "5432"
  }/${process.env.POSTGRES_DB || "chatpie"}`;

const schema = "./src/lib/db/pg/schema.pg.ts";

const out = "./src/lib/db/migrations/pg";

export default defineConfig({
  schema,
  out,
  dialect,
  migrations: {},
  dbCredentials: {
    url,
  },
});
