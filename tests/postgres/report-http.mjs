// Run against report-preview.mjs + the isolated Next preview, never a hosted app.
import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";
const { default: pg } = await import(
  process.env.TEST_PG_MODULE ?? "../../.tools/runtime/node_modules/pg/lib/index.js"
);
const database = new URL(process.env.TEST_DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(database.hostname) ||
  !/^\/ambulanta_test_[a-f0-9]+$/.test(database.pathname)
)
  throw Error("Local test database required");
const db = new pg.Client({ connectionString: database.href });
await db.connect();
try {
  const rows = (
    await db.query(
      "select p.id,p.display_name,r.role,r.substation_id from public.profiles p join public.role_assignments r on r.user_id=p.id",
    )
  ).rows;
  const warehouse = rows.find((r) => r.display_name === "warehouse" && r.role === "warehouse"),
    holder = rows.find((r) => r.display_name === "holder"),
    other = rows.find((r) => r.display_name === "next");
  const station = warehouse.substation_id;
  async function session(id) {
    const cookies = new Map();
    const client = createServerClient("http://127.0.0.1:55440", "local-preview", {
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: (updates) => updates.forEach((c) => cookies.set(c.name, c.value)),
      },
    });
    const { error } = await client.auth.signInWithPassword({
      email: `${id}@example.test`,
      password: "local-preview-only",
    });
    assert.equal(error, null);
    return [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  const [logisticCookie, ownCookie, otherCookie] = await Promise.all([
    session(warehouse.id),
    session(holder.id),
    session(other.id),
  ]);
  const base = `http://127.0.0.1:3101/api/reports/aggregate?station=${station}&from=2026-03-01&until=2026-09-12`;
  for (const kind of ["consumption", "warehouse", "stock", "closed", "pending"]) {
    for (const format of ["csv", "pdf"]) {
      const response = await fetch(`${base}&kind=${kind}&format=${format}`, {
        headers: { cookie: logisticCookie },
      });
      assert.equal(response.status, 200, `${kind}/${format}`);
      assert.match(response.headers.get("cache-control"), /no-store/);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (format === "pdf") assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      else assert.match(bytes.toString(), /Test A/);
    }
  }
  assert.equal((await fetch(base)).status, 404);
  assert.equal((await fetch(base, { headers: { cookie: ownCookie } })).status, 404);
  assert.equal(
    (await fetch(`${base}&own=1&kind=stock`, { headers: { cookie: ownCookie } })).status,
    404,
  );
  const own = await fetch(`${base}&own=1&kind=closed`, { headers: { cookie: ownCookie } });
  assert.equal(own.status, 200);
  const text = await own.text();
  assert.ok(text.includes('"holder"'));
  assert.ok(!text.includes('"next"'));
  const otherShift = (
    await db.query("select id from public.shifts where owner_id=$1 and state='closed' limit 1", [
      other.id,
    ])
  ).rows[0].id;
  const forbidden = await fetch(`${base}&own=1&kind=closed&shift=${otherShift}`, {
    headers: { cookie: ownCookie },
  });
  assert.equal(forbidden.status, 200);
  assert.ok(!(await forbidden.text()).includes('"next"'));
  const otherCsv = await fetch(`${base}&own=1&kind=closed`, { headers: { cookie: otherCookie } });
  assert.ok(!(await otherCsv.text()).includes('"holder"'));
  const bad = await fetch(`${base}&group=invalid`, { headers: { cookie: logisticCookie } });
  assert.equal(bad.status, 400);
  console.log(
    "M09 HTTP: 10 CSV/PDF exports; private cache; anonymous, owner and cross-holder checks; invalid filters passed. Local fixture Auth + real PostgreSQL RLS.",
  );
} finally {
  await db.end();
}
