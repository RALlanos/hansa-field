import { Client } from "pg";
import { z } from "zod";

import { migrateDown, migrateUp } from "./migrator.js";

const environment = z
  .object({
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  })
  .parse(process.env);

const direction = process.argv[2] ?? "up";
if (direction !== "up" && direction !== "down") {
  throw new Error('Migration direction must be either "up" or "down".');
}

const client = new Client({ connectionString: environment.DATABASE_URL });

try {
  await client.connect();
  if (direction === "up") {
    await migrateUp(client);
  } else {
    await migrateDown(client);
  }
} finally {
  await client.end();
}
