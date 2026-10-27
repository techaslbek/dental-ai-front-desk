// Runs supabase/tests/*.sql against SUPABASE_DB_URL. Each file wraps itself in
// a transaction and rolls back, and raises an exception on the first failed
// check, so a non-zero exit means a security regression.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set (see .env.example).");
  process.exit(1);
}

const testsDir = path.resolve("supabase/tests");
const files = (await readdir(testsDir)).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client({ connectionString: url });
await client.connect();

let failed = false;
try {
  for (const file of files) {
    const sql = await readFile(path.join(testsDir, file), "utf8");
    try {
      const results = await client.query(sql);
      const last = [results].flat().findLast((r) => r.rows?.length);
      console.log(`ok   ${file}${last ? ` — ${Object.values(last.rows[0])[0]}` : ""}`);
    } catch (error) {
      failed = true;
      console.error(`FAIL ${file}: ${error.message}`);
      await client.query("rollback").catch(() => {});
    }
  }
} finally {
  await client.end();
}

process.exit(failed ? 1 : 0);
