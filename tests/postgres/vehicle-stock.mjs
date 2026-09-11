import { testQuantityOnly } from "./quantity-only.mjs";
// Real PostgreSQL, isolated database. Auth identity and Storage metadata are test scaffolding;
// this does not substitute for hosted Supabase Auth/Storage HTTP tests.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
const { default: pg } = await import(
  process.env.TEST_PG_MODULE ?? "../../.tools/runtime/node_modules/pg/lib/index.js"
);
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !["127.0.0.1", "localhost"].includes(new URL(connectionString).hostname))
  throw new Error("TEST_DATABASE_URL must point to a local PostgreSQL test server.");
const admin = new pg.Client({ connectionString });
await admin.connect();
const database = `ambulanta_test_${randomUUID().replaceAll("-", "")}`;
await admin.query(`create database ${database} template template0 encoding 'UTF8' locale 'C'`);
await admin.end();
const url = new URL(connectionString);
url.pathname = database;
const db = new pg.Client({ connectionString: url.href });
await db.connect();
const connections = [];
const id = Object.fromEntries(
  [
    "institution",
    "station",
    "stationB",
    "warehouse",
    "holder",
    "next",
    "outsider",
    "employee",
    "employee2",
    "employee3",
    "vehicle",
    "vehicle2",
    "product",
    "lot",
  ].map((k) => [k, randomUUID()]),
);
let passed = 0;
function check(name) {
  passed++;
  console.log(`PASS ${passed}: ${name}`);
}
async function actor(user) {
  const c = new pg.Client({ connectionString: url.href });
  await c.connect();
  connections.push(c);
  await c.query("set role authenticated");
  await c.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  return c;
}
async function rpc(c, name, args = []) {
  if (name === "list_vehicle_stock") {
    const r = await c.query(
      "select to_jsonb(s) as result from public.list_vehicle_stock($1,$2) s",
      args,
    );
    return r.rows.map((row) => row.result);
  }
  const r = await c.query(
    `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`,
    args,
  );
  return r.rows[0].result;
}
async function denied(action, pattern) {
  await assert.rejects(action, pattern);
}
async function balance(kind) {
  const { rows } = await db.query(
    "select coalesce(sum(b.quantity),0)::text as n from public.stock_balances b join public.inventory_locations l on l.id=b.location_id where l.kind=$1 and b.lot_id=$2",
    [kind, id.lot],
  );
  return Number(rows[0].n);
}
async function elapsed(shift) {
  // Simulate elapsed wall time only in this throwaway fixture. Application roles cannot edit this.
  await db.query(
    "update public.shifts set planned_start=now()-interval '13 hours',planned_end=now()-interval '1 second' where id=$1",
    [shift],
  );
}
async function draft(c, shift, consumed, returned = 0, previous = null) {
  const { rows } = await c.query(
    "select id,quantity from public.shift_stock_allocations where shift_id=$1 order by id",
    [shift],
  );
  return rpc(c, "save_closeout_draft", [
    shift,
    previous,
    randomUUID(),
    JSON.stringify(
      rows.map((l, i) => ({
        allocation_id: l.id,
        consumed: String(i === 0 ? consumed : 0),
        returned: String(i === 0 ? returned : 0),
      })),
    ),
  ]);
}
async function fakeEvidence(c, version, kind = "signature", finalize = true) {
  const result = await db.query(
    "select to_jsonb(public.reserve_validated_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)) as e",
    [
      c === holder ? id.holder : id.next,
      version,
      randomUUID(),
      kind,
      "fixture.png",
      "image/png",
      10,
      "a".repeat(64),
      "Semnatar fictiv",
      true,
    ],
  );
  const e = result.rows[0].e;
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values('shift-evidence',$1,$2)",
    [e.object_path, JSON.stringify({ size: 10, mimetype: "image/png" })],
  );
  if (finalize)
    await db.query("select public.finalize_validated_evidence($1,$2)", [
      c === holder ? id.holder : id.next,
      e.id,
    ]);
  return e;
}
let warehouse, holder, next, outsider;
try {
  await db.query(`do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if; end $$;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,service_role;
    grant select on storage.objects to authenticated;`);
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  const migrations = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrations.slice(0, 6))
    await db.query(await readFile(new URL(file, dir), "utf8"));
  await db.query("insert into public.institutions(id,name) values($1,'Instituție test local')", [
    id.institution,
  ]);
  for (const station of [id.station, id.stationB])
    await db.query("insert into public.substations(id,institution_id,name) values($1,$2,$3)", [
      station,
      id.institution,
      station === id.station ? "Test A" : "Test B",
    ]);
  for (const [name, role, station] of [
    ["warehouse", "warehouse", id.station],
    ["holder", "shift_leader", id.station],
    ["next", "shift_leader", id.station],
    ["outsider", "warehouse", id.stationB],
  ]) {
    await db.query("insert into auth.users values($1)", [id[name]]);
    await db.query("insert into public.profiles(id,institution_id,display_name) values($1,$2,$3)", [
      id[name],
      id.institution,
      name,
    ]);
    await db.query(
      "insert into public.role_assignments(institution_id,user_id,substation_id,role) values($1,$2,$3,$4)",
      [id.institution, id[name], station, role],
    );
  }
  for (const [name, employee] of [
    ["holder", "employee"],
    ["next", "employee2"],
  ]) {
    await db.query(
      "insert into public.employees(id,institution_id,code,display_name,user_id) values($1,$2,$3,$3,$4)",
      [id[employee], id.institution, name, id[name]],
    );
    await db.query(
      "insert into public.employee_assignments(institution_id,employee_id,substation_id,job_title,is_titular) values($1,$2,$3,'Asistent fictiv',true)",
      [id.institution, id[employee], id.station],
    );
  }
  for (const name of ["vehicle", "vehicle2"])
    await db.query(
      "insert into public.vehicles(id,institution_id,substation_id,identifier,description) values($1,$2,$3,$4,'Ambulanță test')",
      [id[name], id.institution, name === "vehicle" ? id.station : id.stationB, name],
    );
  await db.query(
    "insert into public.products(id,institution_id,code,name,category,base_unit,quantity_precision,track_lots,track_expiry) values($1,$2,'GLOVE','Mănuși fictive','consumable','buc',0,false,false)",
    [id.product, id.institution],
  );
  await db.query(
    "insert into public.station_product_settings(institution_id,substation_id,product_id,minimum_quantity) values($1,$2,$3,0)",
    [id.institution, id.station, id.product],
  );
  await db.query(
    "insert into public.stock_lots(id,institution_id,substation_id,product_id,lot_code,is_internal) values($1,$2,$3,$4,'INTERN',true)",
    [id.lot, id.institution, id.station, id.product],
  );
  warehouse = await actor(id.warehouse);
  holder = await actor(id.holder);
  next = await actor(id.next);
  outsider = await actor(id.outsider);
  await rpc(warehouse, "post_receipt", [
    id.station,
    randomUUID(),
    "TEST-100",
    "2026-09-10",
    "Furnizor fictiv",
    false,
    JSON.stringify([{ lot_id: id.lot, quantity: "100" }]),
    "Stoc pentru test",
  ]);
  const shift = await rpc(holder, "request_shift", [
    id.station,
    id.vehicle,
    randomUUID(),
    null,
    null,
  ]);
  const sheet = await rpc(warehouse, "save_issue_sheet", [
    shift,
    null,
    randomUUID(),
    true,
    JSON.stringify([{ lot_id: id.lot, quantity: "10" }]),
    "Predare pentru test",
  ]);
  await rpc(holder, "accept_issue_sheet", [sheet, randomUUID()]);
  const legacyAllocation = (
    await holder.query("select id from public.issue_sheet_lines where sheet_id=$1", [sheet])
  ).rows[0].id;
  const oldDraft = await rpc(holder, "save_closeout_draft", [
    shift,
    null,
    randomUUID(),
    JSON.stringify([{ allocation_id: legacyAllocation, consumed: "7", returned: "3" }]),
  ]);
  const oldSignature = await fakeEvidence(holder, oldDraft);
  await db.query(await readFile(new URL(migrations[6], dir), "utf8"));
  assert.equal(await balance("warehouse"), 90);
  assert.equal(await balance("vehicle"), 10);
  assert.equal(await balance("shift"), 0);
  assert.equal(
    (
      await db.query(
        "select quantity from public.inventory_movements where destination_id in(select id from public.inventory_locations where kind='shift')",
      )
    ).rows[0].quantity,
    "10",
  );
  check("migration transfers existing balances through journal and preserves historical issues");
  assert.equal((await rpc(holder, "closeout_readiness", [oldDraft])).ready, false);
  await denied(() => rpc(holder, "remove_draft_evidence", [oldSignature.id]), /Semnătura salvată/);
  check("old draft needs new vehicle declaration; saved signature cannot be removed");
  await rpc(holder, "set_legacy_shift_schedule", [shift, "2026-09-10T00:00", "2099-09-10T12:00"]);
  await denied(
    () => rpc(holder, "set_legacy_shift_schedule", [shift, "2026-09-10T00:00", "2098-09-10T12:00"]),
    /nu poate fi schimbat/,
  );
  const version = await draft(holder, shift, 7, 0, oldDraft);
  assert.equal(
    (
      await db.query(
        "select content->'lines'->0->>'remaining' as n from public.closeout_versions where id=$1",
        [version],
      )
    ).rows[0].n,
    "3",
  );
  await denied(
    () => rpc(holder, "submit_vehicle_closeout", [version, randomUUID()]),
    /finalul programat/,
  );
  assert.equal(await balance("vehicle"), 10);
  check("10 received, 7 declared, 3 remaining; draft does not move stock; early close blocked");
  await elapsed(shift);
  await denied(
    () => rpc(holder, "submit_vehicle_closeout", [version, randomUUID()]),
    /declarația și dovezile/,
  );
  const signature = await fakeEvidence(holder, version, "signature", false);
  const validator = await actor(id.holder);
  await validator.query("reset role"); // trusted server fixture, not an application permission
  const remover = await actor(id.holder);
  await db.query("begin");
  await db.query("select id from institutions where id=$1 for update", [id.institution]);
  async function waiting(client) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const r = await db.query("select wait_event_type from pg_stat_activity where pid=$1", [
        client.processID,
      ]);
      if (r.rows[0]?.wait_event_type === "Lock") return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("Expected lock contention was not observed");
  }
  const finalized = rpc(validator, "finalize_validated_evidence", [id.holder, signature.id]);
  await waiting(validator);
  const removed = rpc(remover, "remove_draft_evidence", [signature.id]).then(
    () => null,
    (error) => error,
  );
  await waiting(remover);
  await db.query("commit");
  await finalized;
  assert.match((await removed)?.message ?? "", /Semnătura salvată/);
  check("signature validation wins queued race; removal rechecks validated state under lock");
  await denied(() => rpc(holder, "remove_draft_evidence", [signature.id]), /Semnătura salvată/);
  await denied(() => rpc(next, "submit_vehicle_closeout", [version, randomUUID()]), /inaccesibilă/);
  await denied(
    () => rpc(warehouse, "submit_vehicle_closeout", [version, randomUUID()]),
    /Numai titularul/,
  );
  assert.equal((await next.query("select * from public.closeout_versions")).rowCount, 0);
  check("evidence required; owner and cross-holder access enforced");
  const concurrent = await actor(id.holder);
  await Promise.all([
    rpc(holder, "submit_vehicle_closeout", [version, randomUUID()]),
    rpc(concurrent, "submit_vehicle_closeout", [version, randomUUID()]),
  ]);
  assert.equal(await balance("vehicle"), 3);
  assert.equal(await balance("warehouse"), 90);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.inventory_operations where kind='closeout'",
      )
    ).rows[0].n,
    1,
  );
  await denied(() => draft(holder, shift, 0, 0, version), /nu permite declarații/);
  check("concurrent repeated close consumes exactly once, keeps 3 in vehicle, freezes declaration");
  assert.equal((await rpc(holder, "list_vehicle_stock", [id.station, id.vehicle])).length, 0);
  assert.equal((await rpc(outsider, "list_vehicle_stock", [id.station, null])).length, 0);
  await denied(
    () => holder.query("update public.stock_balances set quantity=500"),
    /permission denied/,
  );
  check("former holder loses live vehicle stock access; other station and direct writes denied");
  await denied(
    () => rpc(next, "request_shift", [id.station, id.vehicle, randomUUID(), null, null]),
    /Stabilește intervalul/,
  );
  const second = await rpc(next, "request_shift", [
    id.station,
    id.vehicle,
    randomUUID(),
    "2026-09-10T00:00",
    "2099-09-10T12:00",
  ]);
  assert.equal((await rpc(next, "list_vehicle_stock", [id.station, id.vehicle]))[0].quantity, 3);
  assert.equal((await next.query("select * from public.inventory_movements")).rowCount, 0);
  const carry = await rpc(warehouse, "save_issue_sheet", [
    second,
    null,
    randomUUID(),
    true,
    "[]",
    "Preluare fără completare",
  ]);
  await rpc(next, "accept_issue_sheet", [carry, randomUUID()]);
  assert.equal(await balance("warehouse"), 90);
  assert.equal(await balance("vehicle"), 3);
  assert.equal(
    (
      await next.query(
        "select quantity,source from public.shift_stock_allocations where shift_id=$1",
        [second],
      )
    ).rows[0].source,
    "opening",
  );
  check("next holder accepts existing 3 without another warehouse debit or access to old history");
  const v2 = await draft(next, second, 1, 1);
  await fakeEvidence(next, v2);
  await elapsed(second);
  await rpc(next, "submit_vehicle_closeout", [v2, randomUUID()]);
  assert.equal(await balance("warehouse"), 90);
  assert.equal(await balance("vehicle"), 3);
  assert.equal(
    (await db.query("select state from public.shifts where id=$1", [second])).rows[0].state,
    "pending_close",
  );
  await denied(
    () => rpc(next, "confirm_vehicle_return", [v2, randomUUID()]),
    /Drepturi insuficiente/,
  );
  await denied(
    async () =>
      rpc(next, "remove_draft_evidence", [
        (await next.query("select id from public.evidence_files where version_id=$1", [v2])).rows[0]
          .id,
      ]),
    /nu mai permite modificări/,
  );
  const warehouse2 = await actor(id.warehouse);
  await Promise.all([
    rpc(warehouse, "confirm_vehicle_return", [v2, randomUUID()]),
    rpc(warehouse2, "confirm_vehicle_return", [v2, randomUUID()]),
  ]);
  assert.equal(await balance("warehouse"), 91);
  assert.equal(await balance("vehicle"), 1);
  check(
    "physical return waits for warehouse; concurrent confirmations return 1 and consume 1 exactly once",
  );
  const third = await rpc(holder, "request_shift", [
    id.station,
    id.vehicle,
    randomUUID(),
    "2026-09-10T00:00",
    "2099-09-10T12:00",
  ]);
  const topup = await rpc(warehouse, "save_issue_sheet", [
    third,
    null,
    randomUUID(),
    true,
    JSON.stringify([{ lot_id: id.lot, quantity: "9" }]),
    "Completare din magazie",
  ]);
  await rpc(holder, "accept_issue_sheet", [topup, randomUUID()]);
  assert.equal(await balance("vehicle"), 10);
  assert.equal(await balance("warehouse"), 82);
  const d3 = await draft(holder, third, 0);
  await fakeEvidence(holder, d3);
  const supplement = await rpc(warehouse, "save_issue_sheet", [
    third,
    null,
    randomUUID(),
    true,
    JSON.stringify([{ lot_id: id.lot, quantity: "1" }]),
    "Suplimentare test",
  ]);
  await rpc(holder, "accept_issue_sheet", [supplement, randomUUID()]);
  assert.equal((await rpc(holder, "closeout_readiness", [d3])).ready, false);
  check(
    "top-up combines carryover and new stock; accepted supplement invalidates old signed declaration",
  );
  await denied(() => draft(holder, third, 999, 0, d3), /neconforme/);
  await denied(() => draft(holder, third, 0.5, 0, d3), /neconforme/);
  const d4 = await draft(holder, third, 0, 0, d3);
  await fakeEvidence(holder, d4);
  await elapsed(third);
  await db.query("update public.profiles set active=false where id=$1", [id.holder]);
  await denied(() => rpc(holder, "submit_vehicle_closeout", [d4, randomUUID()]), /inaccesibilă/);
  await db.query("update public.profiles set active=true where id=$1", [id.holder]);
  check("overconsumption, fractional gloves and revoked access rejected");
  // Force a fixture shortage to verify all stock movements and state roll back atomically.
  const { rows: allocs } = await holder.query(
    "select id,quantity from public.shift_stock_allocations where shift_id=$1 order by id",
    [third],
  );
  const full = await rpc(holder, "save_closeout_draft", [
    third,
    d4,
    randomUUID(),
    JSON.stringify(
      allocs.map((l) => ({ allocation_id: l.id, consumed: l.quantity, returned: "0" })),
    ),
  ]);
  await fakeEvidence(holder, full);
  await db.query(
    "update public.stock_balances set quantity=1 where location_id in(select id from public.inventory_locations where vehicle_id=$1)",
    [id.vehicle],
  );
  const before = (await db.query("select count(*)::int n from public.inventory_movements")).rows[0]
    .n;
  await denied(
    () => rpc(holder, "submit_vehicle_closeout", [full, randomUUID()]),
    /Stoc insuficient/,
  );
  assert.equal(
    (await db.query("select count(*)::int n from public.inventory_movements")).rows[0].n,
    before,
  );
  assert.equal(
    (await db.query("select state from public.shifts where id=$1", [third])).rows[0].state,
    "open",
  );
  await db.query(
    "update public.stock_balances set quantity=11 where location_id in(select id from public.inventory_locations where vehicle_id=$1)",
    [id.vehicle],
  );
  check("shortage rolls back partial movements, operation and shift state");
  await db.query(await readFile(new URL(migrations[7], dir), "utf8"));
  const simpleAllocations = (
    await holder.query(
      "select id,quantity::numeric from public.shift_stock_allocations where shift_id=$1 order by id",
      [third],
    )
  ).rows;
  let toConsume = 2;
  const simpleLines = simpleAllocations.map((allocation) => {
    const consumed = Math.min(Number(allocation.quantity), toConsume);
    toConsume -= consumed;
    return {
      allocation_id: allocation.id,
      consumed: String(consumed),
      returned: "0",
    };
  });
  await rpc(holder, "close_shift_simple", [third, full, randomUUID(), JSON.stringify(simpleLines)]);
  assert.equal(await balance("vehicle"), 9);
  assert.equal(
    (await db.query("select state from public.shifts where id=$1", [third])).rows[0].state,
    "closed",
  );
  assert.equal(
    (await db.query("select bool_and(evidence_policy='optional') ok from public.substations"))
      .rows[0].ok,
    true,
  );
  check("one-step close records consumption and leaves the remainder in the vehicle");
  await testQuantityOnly({
    db,
    id,
    rpc,
    actor,
    warehouse,
    holder,
    next,
    outsider,
    elapsed,
    denied,
    check,
  });
  const mismatch = await db.query(`select b.id from public.stock_balances b where b.quantity <>
    coalesce((select sum(case when m.destination_id=b.location_id then m.quantity else -m.quantity end) from public.inventory_movements m where m.lot_id=b.lot_id and (m.source_id=b.location_id or m.destination_id=b.location_id)),0)`);
  assert.equal(mismatch.rowCount, 0);
  check("all warehouse, legacy and vehicle balances reconcile with immutable journal");
  console.log(`${passed} PostgreSQL scenarios passed. Isolated database: ${database}`);
} finally {
  await Promise.all(connections.map((c) => c.end()));
  await db.end();
}
