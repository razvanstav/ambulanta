import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export async function testReports({
  db,
  id,
  rpc,
  actor,
  warehouse,
  holder,
  next,
  outsider,
  denied,
  check,
}) {
  await db.query(
    await readFile(
      new URL("../../supabase/migrations/202609110011_reporting.sql", import.meta.url),
      "utf8",
    ),
  );
  const today = (await db.query("select (now() at time zone 'Europe/Bucharest')::date::text d"))
    .rows[0].d;
  const until = (await db.query("select ($1::date+1)::text d", [today])).rows[0].d;
  const args = [id.station, today, until, false, "product"];
  // Quantity catalogue tests granted this actor a global role; restore local scope.
  await db.query("delete from public.role_assignments where user_id=$1 and role='logistics'", [
    id.warehouse,
  ]);
  const report = await rpc(warehouse, "read_reports", args);
  assert.ok(report.closed.length > 0);
  assert.ok(report.pending.length > 0);
  assert.ok(report.pending.every((s) => s.state !== "closed"));
  const expected = (
    await db.query(
      `select a.product_id,l->>'product_name' product,l->>'base_unit' unit,sum((l->>'consumed')::numeric)::text consumed
    from public.shifts s join public.closeout_versions v on v.id=s.final_closeout_id
    cross join lateral jsonb_array_elements(v.content->'lines') l
    join public.shift_stock_allocations a on a.id=(l->>'allocation_id')::uuid
    where s.state='closed' and s.substation_id=$1 and s.operational_date>=$2 and s.operational_date<$3
    group by a.product_id,product,unit`,
      [id.station, today, until],
    )
  ).rows;
  const normalized = (rows) =>
    rows.map((r) => JSON.stringify([r.product_id, r.product, r.unit, Number(r.consumed)])).sort();
  assert.deepEqual(normalized(report.consumption), normalized(expected));
  for (const row of report.warehouse) {
    assert.equal(
      Number(row.opening) + Number(row.received) - Number(row.issued) + Number(row.returned),
      Number(row.closing),
    );
    const current = report.stock
      .filter((s) => s.kind === "warehouse" && s.product_id === row.product_id)
      .reduce((n, s) => n + Number(s.quantity), 0);
    assert.equal(current, Number(row.closing));
  }
  check(
    "M09: consumption reconciles with final reports; warehouse equation reconciles with current balances",
  );
  const own = await rpc(holder, "read_reports", [id.station, today, until, true, "shift"]);
  const other = await rpc(next, "read_reports", [id.station, today, until, true, "shift"]);
  assert.equal(own.stock.length, 0);
  assert.equal(own.warehouse.length, 0);
  assert.ok(!own.closed.some((s) => other.closed.some((o) => o.id === s.id)));
  await denied(() => rpc(holder, "read_reports", args), /logistic/);
  await denied(() => rpc(outsider, "read_reports", args), /inaccesibil/);
  await denied(() => rpc(warehouse, "read_reports", [id.stationB, today, until]), /inaccesibil/);
  const all = await rpc(warehouse, "read_reports", [null, today, until]);
  assert.deepEqual(
    all.stations.map((s) => s.id),
    [id.station],
  );
  const anonymous = await actor(null);
  await denied(() => rpc(anonymous, "read_reports", args), /refuzat/);
  await db.query("set role anon");
  await denied(() => rpc(db, "read_reports", args), /permission denied/);
  await db.query("reset role");
  const foreignInstitution = randomUUID(),
    foreignUser = randomUUID();
  await db.query("insert into public.institutions(id,name) values($1,'Altă instituție M09');", [
    foreignInstitution,
  ]);
  await db.query("insert into auth.users(id) values($1)", [foreignUser]);
  await db.query(
    "insert into public.profiles(id,institution_id,display_name) values($1,$2,'Administrator străin')",
    [foreignUser, foreignInstitution],
  );
  await db.query(
    "insert into public.role_assignments(user_id,institution_id,role) values($1,$2,'administrator')",
    [foreignUser, foreignInstitution],
  );
  const foreign = await actor(foreignUser);
  await denied(() => rpc(foreign, "read_reports", args), /inaccesibil/);
  const global = randomUUID();
  await db.query("insert into auth.users(id) values($1)", [global]);
  await db.query(
    "insert into public.profiles(id,institution_id,display_name) values($1,$2,'Logistică M09')",
    [global, id.institution],
  );
  await db.query(
    "insert into public.role_assignments(user_id,institution_id,role) values($1,$2,'logistics')",
    [global, id.institution],
  );
  const logistics = await actor(global);
  const combined = await rpc(logistics, "read_reports", [null, today, until]);
  assert.deepEqual(combined.stations.map((s) => s.id).sort(), [id.station, id.stationB].sort());
  check(
    "M09: owner-only, local and central scope; anonymous and foreign institution refused in PostgreSQL",
  );
  for (const invalid of [
    [id.station, until, today],
    [id.station, "2025-01-01", "2026-12-31"],
    [id.station, today, until, false, "invalid"],
    [id.station, today, until, null],
  ])
    await denied(() => rpc(warehouse, "read_reports", invalid), /Filtre invalide/);
  const selected = report.closed[0];
  const single = await rpc(warehouse, "read_reports", [...args, null, null, selected.id]);
  assert.equal(single.closed.length, 1);
  assert.equal(single.closed[0].id, selected.id);
  assert.deepEqual(single.warehouse, report.warehouse);
  const hidden = await rpc(next, "read_reports", [
    id.station,
    today,
    until,
    true,
    "day",
    null,
    null,
    own.closed[0].id,
  ]);
  assert.equal(hidden.closed.length, 0);
  assert.equal(hidden.consumption.length, 0);
  const snapshot = JSON.stringify(report.consumption);
  await db.query("update public.products set name='Catalog ulterior M09' where id=$1", [
    id.product,
  ]);
  assert.equal(JSON.stringify((await rpc(warehouse, "read_reports", args)).consumption), snapshot);
  check(
    "M09: validated filters, own shift identifiers cannot bypass access, historical product labels survive rename",
  );
  // Boundary fixtures are deliberately edited only by the isolated test database owner.
  // Commit fixture timestamps to make them visible to the separate authenticated sessions.
  await db.query(
    "update public.shifts set operational_date='2026-03-29',started_at='2026-03-28T22:30:00Z',closed_at='2026-03-29T05:00:00Z' where id=$1",
    [selected.id],
  );
  const spring = await rpc(warehouse, "read_reports", [
    id.station,
    "2026-03-29",
    "2026-03-30",
    false,
    "week",
    null,
    null,
    selected.id,
  ]);
  assert.equal(spring.closed.length, 1);
  assert.ok(spring.consumption.every((r) => r.bucket === "2026-03-23"));
  const previous = await rpc(warehouse, "read_reports", [
    id.station,
    "2026-03-28",
    "2026-03-29",
    false,
    "day",
    null,
    null,
    selected.id,
  ]);
  assert.equal(previous.closed.length, 0);
  const bounds = (
    await db.query(`select extract(epoch from (date '2026-03-30'::timestamp at time zone 'Europe/Bucharest')-(date '2026-03-29'::timestamp at time zone 'Europe/Bucharest'))/3600 spring,
    extract(epoch from (date '2026-10-26'::timestamp at time zone 'Europe/Bucharest')-(date '2026-10-25'::timestamp at time zone 'Europe/Bucharest'))/3600 autumn`)
  ).rows[0];
  assert.equal(Number(bounds.spring), 23);
  assert.equal(Number(bounds.autumn), 25);
  const op = (
    await db.query(
      "select id from public.inventory_operations where kind in ('receipt','initial') order by occurred_at limit 1",
    )
  ).rows[0].id;
  await db.query(
    "update public.inventory_operations set occurred_at='2026-03-28T22:00:00Z' where id=$1",
    [op],
  );
  const movement = await rpc(warehouse, "read_reports", [id.station, "2026-03-29", "2026-03-30"]);
  assert.ok(movement.warehouse.some((r) => Number(r.received) > 0));
  const excluded = await rpc(warehouse, "read_reports", [id.station, "2026-03-28", "2026-03-29"]);
  assert.ok(excluded.warehouse.every((r) => Number(r.received) === 0));
  check(
    "M09: overnight operational day, Monday grouping, 23/25-hour Bucharest days and inclusive/exclusive movement boundaries",
  );
  // A concurrent uncommitted receipt must be absent, then fully visible after commit.
  const before = await rpc(warehouse, "read_reports", args);
  const c = await actor(id.warehouse);
  await c.query("begin");
  const receipt = [
    id.station,
    randomUUID(),
    "M09-SNAPSHOT",
    today,
    "Furnizor fictiv",
    false,
    JSON.stringify([{ product_id: id.product, quantity: "1" }]),
    "Test citire concurentă",
  ];
  await rpc(c, "post_product_receipt", receipt);
  const during = await rpc(warehouse, "read_reports", args);
  assert.deepEqual(during.stock, before.stock);
  assert.deepEqual(during.warehouse, before.warehouse);
  await c.query("commit");
  const after = await rpc(warehouse, "read_reports", args);
  const stock = (r) =>
    Number(r.stock.find((s) => s.kind === "warehouse" && s.product_id === id.product).quantity);
  assert.equal(stock(after), stock(before) + 1);
  await warehouse.query("begin read only");
  await rpc(warehouse, "read_reports", args);
  await warehouse.query("rollback");
  check(
    "M09: concurrent receipt invisible before commit and fully visible after; report is read-only",
  );
}
