import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServerClient } from "@supabase/ssr";
import { checked, configuration, login, publicClient } from "../../scripts/supabase-tools.mjs";

const file = new URL("../../.verification/m02-fixtures.json", import.meta.url);
const f = JSON.parse(await readFile(file, "utf8"));
const config = configuration();
assert.equal(f.url, config.url);
assert.equal(process.env.M02_TEST_PROJECT_REF, new URL(f.url).hostname.split(".")[0]);
const station = f.stations.A;
const rpc = async (client, name, args) => checked(await client.rpc(name, args), name);
const sessions = {};
for (const name of [
  "adminA",
  "warehouseA",
  "warehouseB",
  "foreignAdmin",
  "m06uiDesktop",
  "m06uiMobile",
])
  sessions[name] = await login(f.accounts[name]);
const admin = sessions.adminA;
const warehouse = sessions.warehouseA;
const holder = sessions.m06uiDesktop;
const other = sessions.m06uiMobile;
const local = (date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(" ", "T");
const today = local(new Date()).slice(0, 10);
const until = local(new Date(Date.now() + 86400000)).slice(0, 10);
const args = { p_station: station, p_from: today, p_until: until, p_group: "product" };
const reports = (client, extra = {}) => rpc(client, "read_reports", { ...args, ...extra });
if (!f.m09) {
  const product = await rpc(admin, "save_simple_product", {
    p_substation: station,
    p_product: null,
    p_code: "P01-DEMO",
    p_name: "Consumabil fictiv P01",
    p_category: "consumable",
    p_base_unit: "buc",
    p_precision: 0,
    p_active: true,
    p_reason: "Circuit izolat de publicare P01",
  });
  f.m09 = { product, today, until, shifts: [] };
  await writeFile(file, JSON.stringify(f, null, 2));
  const receipt = {
    p_substation: station,
    p_request_key: randomUUID(),
    p_document_number: "P01-DEMO",
    p_document_date: today,
    p_supplier: "Furnizor fictiv P01",
    p_initial: false,
    p_lines: [{ product_id: product, quantity: "100" }],
    p_reason: "Recepție fictivă P01",
  };
  assert.equal(
    await rpc(warehouse, "post_product_receipt", receipt),
    await rpc(warehouse, "post_product_receipt", receipt),
  );
  for (const [client, quantity, consumed] of [
    [holder, "15", "7"],
    [other, "0", "3"],
  ]) {
    const shift = await rpc(client, "request_shift", {
      p_substation: station,
      p_vehicle: f.m06.vehicles.m06uiDesktop,
      p_request_key: randomUUID(),
      p_planned_start: local(new Date()),
      p_planned_end: local(new Date(Date.now() + 3600000)),
    });
    f.m09.shifts.push(shift);
    await writeFile(file, JSON.stringify(f, null, 2));
    const before = await reports(warehouse);
    assert.ok(before.pending.some((s) => s.id === shift && s.state === "awaiting_issue"));
    const sheet = await rpc(warehouse, "save_product_issue_sheet", {
      p_shift: shift,
      p_expected_sheet: null,
      p_request_key: randomUUID(),
      p_send: true,
      p_lines: quantity === "0" ? [] : [{ product_id: product, quantity }],
      p_reason: "Predare fictivă P01",
    });
    assert.deepEqual((await reports(warehouse)).stock, before.stock);
    const accept = { p_sheet: sheet, p_request_key: randomUUID() };
    assert.equal(
      await rpc(client, "accept_issue_sheet", accept),
      await rpc(client, "accept_issue_sheet", accept),
    );
    const allocations = checked(
      await client
        .from("shift_stock_allocations")
        .select("id,quantity,source")
        .eq("shift_id", shift),
      "Alocări",
    );
    assert.equal(allocations.length, 1);
    assert.equal(Number(allocations[0].quantity), quantity === "0" ? 8 : 15);
    if (quantity === "0") assert.equal(allocations[0].source, "opening");
    const close = {
      p_shift: shift,
      p_expected_version: null,
      p_request_key: randomUUID(),
      p_lines: [{ allocation_id: allocations[0].id, consumed, returned: "0" }],
      p_reason: "Închidere anticipată pentru demonstrația fictivă P01",
    };
    assert.equal(
      await rpc(client, "close_shift_early", close),
      await rpc(client, "close_shift_early", close),
    );
  }
  f.m09.complete = true;
  await writeFile(file, JSON.stringify(f, null, 2));
}
assert.equal(f.m09.complete, true, "Circuit întrerupt: inspectează fixturea înainte de reluare");
const report = await reports(warehouse);
const row = report.warehouse.find((r) => r.product_id === f.m09.product);
assert.deepEqual(
  [row.opening, row.received, row.issued, row.returned, row.closing].map(Number),
  [0, 100, 15, 0, 85],
);
assert.equal(Number(report.consumption.find((r) => r.product_id === f.m09.product).consumed), 10);
assert.equal(
  Number(report.stock.find((r) => r.product_id === f.m09.product && r.kind === "vehicle").quantity),
  5,
);
for (const group of ["day", "week", "shift", "holder", "vehicle", "station", "product"]) {
  const grouped = await reports(warehouse, { p_group: group });
  assert.equal(
    grouped.consumption.reduce((n, r) => n + Number(r.consumed), 0),
    10,
  );
}
for (const [client, shift, expected] of [
  [holder, f.m09.shifts[0], 7],
  [other, f.m09.shifts[1], 3],
]) {
  const own = await reports(client, { p_own: true });
  assert.deepEqual(
    own.closed.map((s) => s.id),
    [shift],
  );
  assert.equal(Number(own.consumption[0].consumed), expected);
  assert.deepEqual(own.warehouse, []);
  assert.deepEqual(own.stock, []);
  assert.ok((await client.rpc("read_reports", args)).error);
}
for (const client of [sessions.warehouseB, sessions.foreignAdmin, publicClient()])
  assert.ok((await client.rpc("read_reports", args)).error);
console.log(
  "PASS circuit găzduit: recepție 100, predare 15, consum 7+3, magazie 85, mașină 5; replay, preluare fără debit nou, 7 grupări și izolare",
);

const base = process.env.E2E_BASE_URL;
if (base) {
  assert.equal(base, "https://ambulanta.netlify.app", "Exporturile live sunt limitate la demo");
  const cookies = async (account) => {
    const jar = new Map();
    const client = createServerClient(config.url, config.key, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (values) => values.forEach(({ name, value }) => jar.set(name, value)),
      },
    });
    checked(
      await client.auth.signInWithPassword({ email: account.email, password: account.password }),
      "Sesiune HTTP",
    );
    client.auth.stopAutoRefresh();
    return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  };
  const adminCookie = await cookies(f.accounts.adminA);
  const holderCookie = await cookies(f.accounts.m06uiDesktop);
  const otherCookie = await cookies(f.accounts.m06uiMobile);
  const foreignCookie = await cookies(f.accounts.foreignAdmin);
  const output = new URL("../../.verification/p01-exports/", import.meta.url);
  await mkdir(output, { recursive: true });
  const url = (kind, format, own = "0") =>
    `${base}/api/reports/aggregate?${new URLSearchParams({ station, from: today, until, group: "product", kind, format, own })}`;
  for (const kind of ["consumption", "warehouse", "stock", "closed", "pending"]) {
    for (const format of ["csv", "pdf"]) {
      const response = await fetch(url(kind, format), { headers: { cookie: adminCookie } });
      assert.equal(response.status, 200, `${kind}/${format}`);
      assert.match(response.headers.get("cache-control"), /private.*no-store/);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (format === "pdf") assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      else if (kind === "consumption") assert.match(bytes.toString(), /Consumabil fictiv P01/);
      await writeFile(new URL(`${kind}.${format}`, output), bytes);
    }
  }
  for (const cookie of ["", foreignCookie, holderCookie])
    assert.equal((await fetch(url("stock", "csv"), { headers: { cookie } })).status, 404);
  assert.equal(
    (await fetch(url("stock", "csv", "1"), { headers: { cookie: holderCookie } })).status,
    404,
  );
  const ownCsv = await fetch(url("closed", "csv", "1"), { headers: { cookie: holderCookie } });
  assert.equal(ownCsv.status, 200);
  const content = await ownCsv.text();
  assert.ok(content.includes(f.m09.shifts[0]));
  assert.ok(!content.includes(f.m09.shifts[1]));
  const individual = `${base}/api/reports/shifts/${f.m09.shifts[0]}`;
  for (const [cookie, status] of [
    [holderCookie, 200],
    [adminCookie, 200],
    [otherCookie, 404],
    [foreignCookie, 404],
    ["", 404],
  ])
    assert.equal((await fetch(individual, { headers: { cookie } })).status, status);
  console.log(
    "PASS Netlify: 10 CSV/PDF private, export propriu izolat, PDF individual autorizat și refuz anonim/alt titular/altă instituție",
  );
}
