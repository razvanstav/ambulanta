import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import {
  checked,
  configuration,
  login,
  privilegedClient,
  publicClient,
} from "../../scripts/supabase-tools.mjs";

const file = new URL("../../.verification/m02-fixtures.json", import.meta.url);
const f = JSON.parse(await readFile(file, "utf8"));
assert.equal(f.url, configuration().url);
assert.equal(process.env.M02_TEST_PROJECT_REF, new URL(f.url).hostname.split(".")[0]);
assert.ok(f.m06 && !f.m07);
const admin = privilegedClient();
const owner = await login(f.accounts.m06a);
const other = await login(f.accounts.m06b);
const warehouse = await login(f.accounts.warehouseA);
const foreign = await login(f.accounts.warehouseB);
const institutionAdmin = await login(f.accounts.adminA);
const manager = await login(f.accounts.manager);
const anon = publicClient();
const rpc = async (client, name, args) => checked(await client.rpc(name, args), name);
const rows = async (client, table, column = "institution_id", id = f.institutions[0]) =>
  checked(await client.from(table).select("*").eq(column, id), table);
const denied = (result) => assert.ok(result.error, "Operația trebuia refuzată");
const shift = f.m06.shiftA;
const sheets = (await rows(owner, "issue_sheet_versions", "shift_id", shift)).filter(
  (s) => s.state === "accepted",
);
let lines = checked(
  await owner
    .from("issue_sheet_lines")
    .select("*")
    .in(
      "sheet_id",
      sheets.map((s) => s.id),
    ),
  "Alocări",
).map((l) => ({ allocation_id: l.id, consumed: "0", returned: String(l.quantity) }));
const draftArgs = (expected = null, extra = {}) => ({
  p_shift: shift,
  p_expected_version: expected,
  p_request_key: randomUUID(),
  p_lines: lines,
  ...extra,
});
let current;
let passed = 0;
async function verify(name, run) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}
const png = await sharp({ create: { width: 80, height: 40, channels: 3, background: "navy" } })
  .png()
  .toBuffer();
const hash = createHash("sha256").update(png).digest("hex");
const evidenceArgs = (extra = {}) => ({
  p_actor: f.accounts.m06a.id,
  p_version: current,
  p_key: randomUUID(),
  p_kind: "document",
  p_filename: "dovada-fictiva.png",
  p_mime: "image/png",
  p_size: png.length,
  p_hash: hash,
  p_signer: "",
  p_confirm: false,
  ...extra,
});
const finalize = async (e) =>
  rpc(admin, "finalize_validated_evidence", { p_actor: e.collector_id, p_evidence: e.id });
const upload = async (e) => {
  checked(
    await admin.storage
      .from("shift-evidence")
      .upload(e.object_path, png, { contentType: "image/png", upsert: false }),
    "Upload privat fixture",
  );
  return finalize(e);
};
const readiness = () => rpc(owner, "closeout_readiness", { p_version: current });
const beforeStock = await rows(institutionAdmin, "stock_balances");

await verify("ciornă proprie idempotentă, snapshot și hash; fără schimbarea stocului", async () => {
  const args = draftArgs();
  current = await rpc(owner, "save_closeout_draft", args);
  assert.equal(await rpc(owner, "save_closeout_draft", args), current);
  denied(await owner.rpc("save_closeout_draft", { ...args, p_lines: [] }));
  const v = (await rows(owner, "closeout_versions", "id", current))[0];
  assert.match(v.content_hash, /^[a-f0-9]{64}$/);
  assert.equal(v.content.lines.length, lines.length);
  assert.equal((await readiness()).ready, false);
  assert.deepEqual(await rows(institutionAdmin, "stock_balances"), beforeStock);
});
await verify(
  "alte substații, alt titular și magazia nu editează declarația; scrieri directe refuzate",
  async () => {
    for (const client of [other, warehouse, foreign, anon])
      denied(await client.rpc("save_closeout_draft", draftArgs(current)));
    for (const client of [other, foreign]) {
      assert.equal((await rows(client, "closeout_versions", "id", current)).length, 0);
      denied(await client.rpc("closeout_readiness", { p_version: current }));
    }
    denied(await owner.from("closeout_versions").update({ content: {} }).eq("id", current));
    denied(await owner.from("evidence_files").insert({}));
  },
);
await verify(
  "cantități incorecte, duplicate și alocări lipsă fac rollback inclusiv audit",
  async () => {
    const count = (await rows(institutionAdmin, "audit_events")).length;
    for (const invalid of [
      [],
      [lines[0], lines[0]],
      lines.map((l, i) => (i ? l : { ...l, consumed: "-1" })),
      lines.map((l, i) => (i ? l : { ...l, consumed: "999999999" })),
      lines.map((l, i) => (i ? l : { ...l, consumed: "NaN" })),
    ])
      denied(await owner.rpc("save_closeout_draft", draftArgs(current, { p_lines: invalid })));
    assert.equal((await rows(institutionAdmin, "audit_events")).length, count);
  },
);
await verify(
  "două editări concurente au o singură versiune nouă și detectează versiunea veche",
  async () => {
    const args = [draftArgs(current), draftArgs(current)];
    const result = await Promise.all(args.map((a) => owner.rpc("save_closeout_draft", a)));
    assert.equal(result.filter((r) => !r.error).length, 1);
    current = result.find((r) => !r.error).data;
  },
);
let document;
await verify(
  "numai serverul poate atesta validarea; obiectul lipsă blochează finalizarea",
  async () => {
    for (const client of [owner, warehouse, anon])
      denied(await client.rpc("reserve_validated_evidence", evidenceArgs()));
    const args = evidenceArgs();
    const results = await Promise.all([
      rpc(admin, "reserve_validated_evidence", args),
      rpc(admin, "reserve_validated_evidence", args),
    ]);
    document = results[0];
    assert.equal(document.id, results[1].id);
    denied(await admin.rpc("reserve_validated_evidence", { ...args, p_hash: "a".repeat(64) }));
    denied(
      await admin.rpc("finalize_validated_evidence", {
        p_actor: document.collector_id,
        p_evidence: document.id,
      }),
    );
    denied(
      await owner.rpc("finalize_validated_evidence", {
        p_actor: document.collector_id,
        p_evidence: document.id,
      }),
    );
    assert.equal((await readiness()).ready, false);
    await upload(document);
    assert.equal(await finalize(document), document.id);
    assert.equal((await readiness()).ready, true);
  },
);
await verify(
  "Storage privat: proprietar și magazie citesc; anon, alt titular și altă substație nu descarcă",
  async () => {
    for (const client of [owner, warehouse])
      assert.ok(
        checked(
          await client.storage.from("shift-evidence").download(document.object_path),
          "Citire autorizată",
        ),
      );
    for (const client of [other, foreign, anon]) {
      denied(await client.storage.from("shift-evidence").download(document.object_path));
      if (client !== anon)
        assert.equal((await rows(client, "evidence_files", "id", document.id)).length, 0);
    }
    for (const client of [owner, warehouse]) {
      denied(
        await client.storage
          .from("shift-evidence")
          .upload(document.object_path, png, { contentType: "image/png", upsert: true }),
      );
      const removed = await client.storage.from("shift-evidence").remove([document.object_path]);
      assert.ok(removed.error || removed.data.length === 0);
    }
    assert.ok(
      checked(
        await owner.storage.from("shift-evidence").download(document.object_path),
        "Original intact",
      ),
    );
  },
);
await verify(
  "limita de 5 documente rezistă la încărcări concurente; eliminarea eliberează un loc",
  async () => {
    const result = await Promise.all(
      Array.from({ length: 6 }, () => admin.rpc("reserve_validated_evidence", evidenceArgs())),
    );
    assert.equal(result.filter((r) => !r.error).length, 4);
    for (const r of result.filter((r) => !r.error))
      await rpc(owner, "remove_draft_evidence", { p_evidence: r.data.id });
  },
);
let signature;
await verify(
  "colectorul diferă de semnatar; confirmarea obligatorie și o singură semnătură",
  async () => {
    denied(
      await admin.rpc(
        "reserve_validated_evidence",
        evidenceArgs({ p_kind: "signature", p_signer: "Titular fictiv" }),
      ),
    );
    signature = await rpc(
      admin,
      "reserve_validated_evidence",
      evidenceArgs({
        p_actor: f.accounts.warehouseA.id,
        p_kind: "signature",
        p_signer: "Semnatar fictiv",
        p_confirm: true,
      }),
    );
    assert.equal(signature.collector_id, f.accounts.warehouseA.id);
    assert.equal(signature.signer_name, "Semnatar fictiv");
    assert.ok(signature.confirmation);
    await upload(signature);
    denied(
      await admin.rpc(
        "reserve_validated_evidence",
        evidenceArgs({ p_kind: "signature", p_signer: "Alt semnatar", p_confirm: true }),
      ),
    );
  },
);
await verify(
  "cantități schimbate cer dovezi noi; vechea semnătură rămâne doar la versiunea originală",
  async () => {
    const old = current;
    lines = lines.map((l, i) =>
      i ? l : { ...l, consumed: "1", returned: String(Number(l.returned) - 1) },
    );
    current = await rpc(owner, "save_closeout_draft", draftArgs(current));
    assert.equal((await readiness()).evidence_count, 0);
    assert.equal((await readiness()).ready, false);
    assert.equal((await rows(owner, "evidence_files", "id", signature.id))[0].version_id, old);
    denied(await owner.rpc("remove_draft_evidence", { p_evidence: signature.id }));
    denied(
      await admin.rpc("finalize_validated_evidence", {
        p_actor: signature.collector_id,
        p_evidence: signature.id,
      }),
    );
  },
);
await verify("revocarea rolului cu JWT existent oprește colectarea și descărcarea", async () => {
  const pending = await rpc(admin, "reserve_validated_evidence", evidenceArgs());
  await rpc(institutionAdmin, "set_account_access", {
    p_user: f.accounts.m06a.id,
    p_active: true,
    p_roles: [],
    p_reason: "Revocare test M07",
  });
  try {
    denied(
      await admin.rpc("finalize_validated_evidence", {
        p_actor: pending.collector_id,
        p_evidence: pending.id,
      }),
    );
    denied(await owner.storage.from("shift-evidence").download(document.object_path));
    denied(await owner.rpc("save_closeout_draft", draftArgs(current)));
  } finally {
    await rpc(institutionAdmin, "set_account_access", {
      p_user: f.accounts.m06a.id,
      p_active: true,
      p_roles: [{ role: "shift_leader", substation_id: f.stations.A }],
      p_reason: "Restaurare cont fictiv M07",
    });
  }
  await rpc(owner, "remove_draft_evidence", { p_evidence: pending.id });
});
await verify("politica opțională/obligatorie este locală, auditată și protejată", async () => {
  const args = {
    p_substation: f.stations.A,
    p_policy: "optional",
    p_reason: "Politică fictivă M07",
  };
  for (const client of [owner, warehouse, foreign])
    denied(await client.rpc("set_evidence_policy", args));
  await rpc(manager, "set_evidence_policy", args);
  assert.equal((await readiness()).ready, true);
  await rpc(institutionAdmin, "set_evidence_policy", { ...args, p_policy: "at_least_one" });
  assert.equal((await readiness()).ready, false);
  assert.ok((await rows(institutionAdmin, "audit_events")).some((e) => e.reason === args.p_reason));
});
await verify(
  "suplimentarea invalidează ciorna, iar finalizarea viitoare blochează modificarea dovezilor",
  async () => {
    const pending = await rpc(admin, "reserve_validated_evidence", evidenceArgs());
    const supplement = await rpc(warehouse, "save_issue_sheet", {
      p_shift: shift,
      p_expected_sheet: null,
      p_request_key: randomUUID(),
      p_send: true,
      p_lines: [{ lot_id: f.m04.lot, quantity: "1" }],
      p_reason: "Suplimentare test ciornă M07",
    });
    await rpc(owner, "accept_issue_sheet", { p_sheet: supplement, p_request_key: randomUUID() });
    assert.equal((await readiness()).current, false);
    denied(
      await admin.rpc("finalize_validated_evidence", {
        p_actor: pending.collector_id,
        p_evidence: pending.id,
      }),
    );
    denied(await owner.rpc("save_closeout_draft", draftArgs(current)));
    const allocation = (await rows(owner, "issue_sheet_lines", "sheet_id", supplement))[0];
    lines.push({ allocation_id: allocation.id, consumed: "0", returned: "1" });
    current = await rpc(owner, "save_closeout_draft", draftArgs(current));
    const e = await rpc(admin, "reserve_validated_evidence", evidenceArgs());
    await upload(e);
    // Simulate only the future state on this disposable fixture, without implementing M08.
    checked(
      await admin.from("shifts").update({ state: "pending_close" }).eq("id", shift),
      "Fixture stare viitoare",
    );
    try {
      denied(await owner.rpc("remove_draft_evidence", { p_evidence: e.id }));
      denied(await owner.rpc("save_closeout_draft", draftArgs(current)));
    } finally {
      checked(
        await admin.from("shifts").update({ state: "open" }).eq("id", shift),
        "Restaurare fixture",
      );
    }
    assert.equal((await readiness()).ready, true);
  },
);
f.m07 = { shift, current, document: document.id };
await writeFile(file, JSON.stringify(f, null, 2), { mode: 0o600 });
console.log(`${passed} grupuri de teste M07 trecute pe PostgreSQL și Storage real.`);
