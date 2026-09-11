// Optional local UI harness, backed by the isolated PostgreSQL test database.
// Auth is deliberately a fixture, NOT Supabase Auth validation. Never deploy this.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
const { default: pg } = await import(
  process.env.TEST_PG_MODULE ?? "../../.tools/runtime/node_modules/pg/lib/index.js"
);
const url = new URL(process.env.TEST_DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !/^\/ambulanta_test_[a-f0-9]+$/.test(url.pathname)
)
  throw Error("Only an isolated local test database is allowed");
const pool = new pg.Pool({ connectionString: url.href });
const users = (await pool.query("select id,display_name from public.profiles where active")).rows;
const tokens = new Map();
const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const path = new URL(req.url, "http://127.0.0.1");
  let body = "";
  for await (const chunk of req) body += chunk;
  let c;
  try {
    const payload = body ? JSON.parse(body) : {};
    if (path.pathname === "/auth/v1/token") {
      const user = users.find((u) => `${u.id}@example.test` === payload.email);
      if (!user || payload.password !== "local-preview-only") throw Error("Invalid fixture login");
      const account = {
        id: user.id,
        email: payload.email,
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: {},
      };
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = [
        Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
        Buffer.from(
          JSON.stringify({
            sub: user.id,
            exp,
            iat: Math.floor(Date.now() / 1000),
            aud: "authenticated",
          }),
        ).toString("base64url"),
        randomBytes(32).toString("base64url"),
      ].join(".");
      tokens.set(token, account);
      return res.end(
        JSON.stringify({
          access_token: token,
          refresh_token: randomBytes(16).toString("hex"),
          expires_in: 3600,
          expires_at: exp,
          token_type: "bearer",
          user: account,
        }),
      );
    }
    const user = tokens.get(req.headers.authorization?.replace(/^Bearer /i, ""));
    if (!user) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ message: "Unauthenticated fixture" }));
    }
    if (path.pathname === "/auth/v1/user") return res.end(JSON.stringify(user));
    if (path.pathname === "/auth/v1/logout") return res.end("{}");
    c = await pool.connect();
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claim.sub',$1,true)", [user.id]);
    let data;
    if (path.pathname === "/rest/v1/rpc/read_reports") {
      const keys = [
        "p_station",
        "p_from",
        "p_until",
        "p_own",
        "p_group",
        "p_holder",
        "p_vehicle",
        "p_shift",
      ];
      data = (
        await c.query(
          "select public.read_reports($1,$2,$3,$4,$5,$6,$7,$8) result",
          keys.map((k) => payload[k] ?? null),
        )
      ).rows[0].result;
    } else {
      const table = path.pathname.replace("/rest/v1/", "");
      const columns = {
        profiles: ["id", "institution_id", "display_name", "active"],
        role_assignments: ["role", "substation_id", "user_id"],
        substations: ["id", "institution_id", "name", "active"],
        shifts: ["id", "closed_at", "final_closeout_id", "state"],
        closeout_versions: ["id", "shift_id", "version", "content_hash", "content"],
      }[table];
      if (!columns) throw Error("Unsupported preview query");
      const selected = (path.searchParams.get("select") ?? "").split(",");
      if (selected.some((k) => !columns.includes(k))) throw Error("Unsupported preview columns");
      const values = [],
        conditions = [];
      for (const [k, v] of path.searchParams)
        if (columns.includes(k)) {
          if (!v.startsWith("eq.")) throw Error("Only equality filters");
          values.push(v.slice(3));
          conditions.push(`${k}=$${values.length}`);
        }
      data = (
        await c.query(
          `select ${selected.join(",")} from public.${table}${conditions.length ? ` where ${conditions.join(" and ")}` : ""}`,
          values,
        )
      ).rows;
      if (req.headers.accept?.includes("vnd.pgrst.object")) data = data[0] ?? null;
    }
    await c.query("rollback");
    res.end(JSON.stringify(data));
  } catch (e) {
    if (c) await c.query("rollback");
    res.statusCode = 400;
    res.end(JSON.stringify({ message: e.message, code: e.code ?? "PREVIEW" }));
  } finally {
    c?.release();
  }
});
server.listen(55440, "127.0.0.1", () =>
  console.log("Local PostgreSQL reporting UI harness on 127.0.0.1:55440; fixture Auth only."),
);
