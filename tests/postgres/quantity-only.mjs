import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
export async function testQuantityOnly({
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
}) {
  const product = randomUUID(),
    lotA = randomUUID(),
    lotB = randomUUID();
  await db.query(
    "insert into public.products(id,institution_id,code,name,category,base_unit,quantity_precision,track_lots,track_expiry) values($1,$2,'OLD-MED','Produs istoric','medication','buc',0,true,true)",
    [product, id.institution],
  );
  await db.query(
    "insert into public.station_product_settings(institution_id,substation_id,product_id,minimum_quantity) values($1,$2,$3,100)",
    [id.institution, id.station, product],
  );
  for (const [lot, code] of [
    [lotA, "EXPIRAT-A"],
    [lotB, "EXPIRAT-B"],
  ])
    await db.query(
      "insert into public.stock_lots(id,institution_id,substation_id,product_id,lot_code,expires_on,is_internal,blocked) values($1,$2,$3,$4,$5,'2020-01-01',false,true)",
      [lot, id.institution, id.station, product, code],
    );
  await rpc(warehouse, "post_receipt", [
    id.station,
    randomUUID(),
    "OLD",
    "2026-09-11",
    "Test furnizor",
    false,
    JSON.stringify([
      { lot_id: lotA, quantity: "4" },
      { lot_id: lotB, quantity: "6" },
    ]),
    "Stoc istoric pentru migrare",
  ]);
  const snapshot = async () =>
    JSON.stringify(
      (await db.query("select to_jsonb(b) row from public.stock_balances b order by id")).rows,
    );
  const before = await snapshot();
  await db.query(
    await readFile(
      new URL(
        "../../supabase/migrations/202609110009_quantity_only_inventory.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(await snapshot(), before);
  check("quantity-only migration preserves all balances and historical stock identities");
  const receiptArgs = [
    id.station,
    randomUUID(),
    "NEW",
    "2026-09-11",
    "Furnizor test",
    false,
    JSON.stringify([{ product_id: product, quantity: "5" }]),
    "Intrare pe produs",
  ];
  const results = await Promise.all([
    rpc(warehouse, "post_product_receipt", receiptArgs),
    rpc(warehouse, "post_product_receipt", receiptArgs),
  ]);
  assert.equal(results[0], results[1]);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.stock_lots where product_id=$1 and is_internal",
        [product],
      )
    ).rows[0].n,
    1,
  );
  const qty = async (kind) =>
    Number(
      (
        await db.query(
          "select coalesce(sum(b.quantity),0) q from public.stock_balances b join public.inventory_locations l on l.id=b.location_id where b.product_id=$1 and l.kind=$2",
          [product, kind],
        )
      ).rows[0].q,
    );
  assert.equal(await qty("warehouse"), 15);
  check(
    "product receipt auto-creates technical key for historical medication; concurrent replay is exact",
  );
  await denied(
    () =>
      rpc(outsider, "post_product_receipt", [
        ...receiptArgs.slice(0, 1),
        randomUUID(),
        ...receiptArgs.slice(2),
      ]),
    /Acces|refuzat|Drepturi/i,
  );
  for (const lines of [
    [
      { product_id: product, quantity: "1" },
      { product_id: product, quantity: "1" },
    ],
    [{ product_id: product, quantity: "0.5" }],
    [{ product_id: product, quantity: "-1" }],
    [{ product_id: randomUUID(), quantity: "1" }],
  ]) {
    await denied(
      () =>
        rpc(warehouse, "post_product_receipt", [
          id.station,
          randomUUID(),
          "BAD",
          "2026-09-11",
          "Furnizor test",
          false,
          JSON.stringify(lines),
          "Verificare rollback",
        ]),
      /./,
    );
    assert.equal(await qty("warehouse"), 15);
  }
  check("product receipts enforce access, duplicates, precision and atomic rollback");
  // Authorised common catalog creation, after earlier role tests have completed.
  await db.query(
    "insert into public.role_assignments(institution_id,user_id,role) values($1,$2,'logistics')",
    [id.institution, id.warehouse],
  );
  const newProduct = await rpc(warehouse, "save_simple_product", [
    id.station,
    null,
    "NEW-MED",
    "Medicament cantitativ",
    "medication",
    "buc",
    0,
    true,
    "Creare cantitativă",
  ]);
  assert.equal(
    (
      await db.query("select count(*)::int n from public.stock_lots where product_id=$1", [
        newProduct,
      ])
    ).rows[0].n,
    1,
  );
  await denied(
    () =>
      rpc(warehouse, "save_simple_product", [
        id.station,
        newProduct,
        "NEW-MED",
        "Medicament cantitativ",
        "medication",
        "ml",
        3,
        true,
        "Încercare schimbare unitate",
      ]),
    /fixe/,
  );
  check("new medication needs no lot or expiry; measurement remains immutable");
  const { start, finish: end } = (
    await db.query(
      "select (now() at time zone 'Europe/Bucharest')::text start, ((now()+interval '1 hour') at time zone 'Europe/Bucharest')::text finish",
    )
  ).rows[0];
  const shift = await rpc(holder, "request_shift", [
    id.station,
    id.vehicle,
    randomUUID(),
    start,
    end,
  ]);
  const sheetArgs = [
    shift,
    null,
    randomUUID(),
    true,
    JSON.stringify([{ product_id: product, quantity: "12" }]),
    "Predare pe produs",
  ];
  const sheet = await rpc(warehouse, "save_product_issue_sheet", sheetArgs);
  assert.equal(await qty("warehouse"), 15);
  await rpc(holder, "accept_issue_sheet", [sheet, randomUUID()]);
  assert.equal(await qty("warehouse"), 3);
  assert.equal(await qty("vehicle"), 12);
  assert.equal(await rpc(warehouse, "save_product_issue_sheet", sheetArgs), sheet);
  const rows = (
    await holder.query("select * from public.list_vehicle_product_stock($1,$2)", [
      id.station,
      id.vehicle,
    ])
  ).rows.filter((r) => r.product_id === product);
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].quantity), 12);
  check(
    "issue uses combined product quantity across expired/blocked legacy lots; replay after acceptance works",
  );
  const allocs = (
    await holder.query(
      "select id,product_id,quantity from public.shift_stock_allocations where shift_id=$1 order by id",
      [shift],
    )
  ).rows;
  let rest = 7;
  const consume = allocs.map((a) => {
    const q = a.product_id === product ? Math.min(rest, Number(a.quantity)) : 0;
    rest -= q;
    return { allocation_id: a.id, consumed: String(q), returned: "0" };
  });
  const closeArgs = [shift, null, randomUUID(), JSON.stringify(consume)];
  await denied(() => rpc(holder, "close_shift_simple", closeArgs), /finalul programat/);
  await elapsed(shift);
  const closed = await Promise.all([
    rpc(holder, "close_shift_simple", closeArgs),
    rpc(holder, "close_shift_simple", closeArgs),
  ]);
  assert.equal(closed[0], closed[1]);
  assert.equal(await qty("vehicle"), 5);
  assert.equal(await qty("warehouse"), 3);
  const nextShift = await rpc(next, "request_shift", [
    id.station,
    id.vehicle,
    randomUUID(),
    start,
    end,
  ]);
  const carry = await rpc(warehouse, "save_product_issue_sheet", [
    nextShift,
    null,
    randomUUID(),
    true,
    "[]",
    "Preluare stoc existent",
  ]);
  await rpc(next, "accept_issue_sheet", [carry, randomUUID()]);
  assert.equal(await qty("warehouse"), 3);
  assert.equal(await qty("vehicle"), 5);
  assert.equal(
    (
      await holder.query("select * from public.list_vehicle_product_stock($1,$2)", [
        id.station,
        id.vehicle,
      ])
    ).rows.length,
    0,
  );
  check(
    "product consumption 12/7/5 is atomic, time-gated and inherited without a warehouse debit; prior holder isolated",
  );
  await denied(
    () =>
      rpc(warehouse, "save_product_issue_sheet", [
        nextShift,
        null,
        randomUUID(),
        true,
        JSON.stringify([{ product_id: product, quantity: "4" }]),
        "Insuficient cantitativ",
      ]),
    /insuficient/i,
  );
  const newKey = randomUUID();
  const args = [
    id.station,
    newKey,
    "PAR",
    "2026-09-11",
    "Test furnizor",
    false,
    JSON.stringify([{ product_id: product, quantity: "2" }]),
    "Recepție concurentă",
  ];
  const other = await actor(id.warehouse);
  await Promise.all([
    rpc(warehouse, "post_product_receipt", args),
    rpc(other, "post_product_receipt", args),
  ]);
  assert.equal(await qty("warehouse"), 5);
  check(
    "insufficient aggregate stock refused; independent sessions preserve idempotence under concurrency",
  );
  await db.query(
    await readFile(
      new URL("../../supabase/migrations/202609110010_early_closeout.sql", import.meta.url),
      "utf8",
    ),
  );
  const plannedBefore = (
    await db.query("select planned_end from public.shifts where id=$1", [nextShift])
  ).rows[0].planned_end;
  const nextAllocations = (
    await db.query(
      "select id,product_id,quantity from public.shift_stock_allocations where shift_id=$1 order by id",
      [nextShift],
    )
  ).rows;
  let remainingConsume = 2;
  const earlyLines = nextAllocations.map((a) => {
    const consumed = a.product_id === product ? Math.min(remainingConsume, Number(a.quantity)) : 0;
    remainingConsume -= consumed;
    return { allocation_id: a.id, consumed: String(consumed), returned: "0" };
  });
  const earlyArgs = [
    nextShift,
    null,
    randomUUID(),
    JSON.stringify(earlyLines),
    "Închidere anticipată pentru test",
  ];
  await denied(() => rpc(next, "close_shift_simple", earlyArgs.slice(0, 4)), /finalul programat/);
  await denied(() => rpc(warehouse, "close_shift_early", earlyArgs), /titular/);
  await denied(() => rpc(outsider, "close_shift_early", earlyArgs));
  await denied(() => rpc(next, "close_shift_early", [...earlyArgs.slice(0, 4), "x"]), /motivul/);
  await denied(() =>
    next.query("select app_private.finalize_vehicle_closeout($1,$2,true)", [
      randomUUID(),
      randomUUID(),
    ]),
  );
  const invalid = earlyLines.map((l, i) => (i ? l : { ...l, consumed: "999999" }));
  await denied(() =>
    rpc(next, "close_shift_early", [
      nextShift,
      null,
      randomUUID(),
      JSON.stringify(invalid),
      earlyArgs[4],
    ]),
  );
  assert.equal(
    (
      await db.query("select count(*)::int n from public.closeout_versions where shift_id=$1", [
        nextShift,
      ])
    ).rows[0].n,
    0,
  );
  assert.equal(await qty("vehicle"), 5);
  check(
    "early close requires owner and reason; standard close stays time-gated; failed requests roll back",
  );
  const nextSession = await actor(id.next);
  const replay = await Promise.all([
    rpc(next, "close_shift_early", earlyArgs),
    rpc(nextSession, "close_shift_early", earlyArgs),
  ]);
  assert.equal(replay[0], nextShift);
  assert.equal(replay[1], nextShift);
  assert.equal(await qty("vehicle"), 3);
  assert.equal(await qty("warehouse"), 5);
  const final = (
    await db.query("select state,planned_end,closed_at from public.shifts where id=$1", [nextShift])
  ).rows[0];
  assert.equal(final.state, "closed");
  assert.equal(final.planned_end.toISOString(), plannedBefore.toISOString());
  assert.ok(final.closed_at < final.planned_end);
  const operation = (
    await db.query("select request_payload from public.inventory_operations where request_key=$1", [
      earlyArgs[2],
    ])
  ).rows;
  assert.equal(operation.length, 1);
  assert.equal(operation[0].request_payload.early, true);
  assert.equal(operation[0].request_payload.reason, earlyArgs[4]);
  await denied(
    () =>
      rpc(next, "close_shift_early", [...earlyArgs.slice(0, 4), "Alt motiv pentru aceeași cheie"]),
    /reutilizată/,
  );
  await rpc(holder, "request_shift", [id.station, id.vehicle, randomUUID(), start, end]);
  check(
    "concurrent early close consumes once, preserves planned end and audit reason, and releases the vehicle",
  );
}
