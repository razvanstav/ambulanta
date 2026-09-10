import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

type Account = { email: string; password: string };
type Fixture = {
  accounts: Record<string, Account>;
  stations: Record<string, string>;
  m03?: object;
};
const path = new URL("../../.verification/m02-fixtures.json", import.meta.url);
const fixture: Fixture | null = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
async function signIn(page: Page, account: Account) {
  await page.goto("/autentificare");
  await page.getByLabel("Adresă de e-mail").fill(account.email);
  await page.getByLabel("Parolă", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Autentificare", exact: true }).click();
  await expect(page).not.toHaveURL(/autentificare/);
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test.describe("M03 personal și flotă cu Supabase real", () => {
  test.skip(!fixture?.m03, "Rulează test:integration pentru fixturea M03.");

  test("șeful substației adaugă angajat, schimbă titularul și îl dezactivează", async ({
    page,
    browser,
  }, info) => {
    const f = fixture!;
    const suffix = randomBytes(4).toString("hex");
    const name = `Persoană E2E ${suffix}`;
    const route = `/substatia/${f.stations.A}/personal`;
    await signIn(page, f.accounts.manager);
    await page.goto(route);
    const create = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Adaugă angajatul", exact: true }) });
    await create.getByLabel("Cod intern").fill(`E2E-${suffix}`);
    await create.getByLabel("Nume și prenume").fill(name);
    await create.getByLabel("Funcție", { exact: true }).fill("Asistent fictiv");
    await create.getByLabel("Motivul modificării").fill("Adăugare personal fictiv E2E");
    const request = page.waitForRequest(
      (r) => r.method() === "POST" && new URL(r.url()).pathname === route,
    );
    await create.getByRole("button", { name: "Adaugă angajatul", exact: true }).click();
    await expect(create.getByRole("status")).toContainText("Angajatul a fost salvat");
    const action = await request;
    const record = page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: name }) });
    await record.locator("summary").click();
    await expect(record.getByLabel("Cont individual")).toHaveCount(0);
    await record.getByLabel("Titular", { exact: true }).check();
    await record.getByLabel("Motivul modificării").fill("Titular fără cont în testul E2E");
    await record.getByRole("button", { name: "Salvează angajatul" }).click();
    await expect(record.locator("summary")).toContainText("Titular");
    await expect(record).toContainText("Titular neeligibil momentan");
    await record.getByLabel("Activ în substație", { exact: true }).uncheck();
    await record.getByLabel("Motivul modificării").fill("Dezactivare locală fictivă E2E");
    await record.getByRole("button", { name: "Salvează angajatul" }).click();
    await expect(record.locator("summary")).toContainText("Inactiv");
    await expect(record).toContainText("exclus din predările noi");
    await fits(page);
    await page.screenshot({ path: info.outputPath("personal.png"), fullPage: true });
    // Replay the real server action with a warehouse session: UI hiding alone is insufficient.
    const context = await browser.newContext({ baseURL: new URL(page.url()).origin });
    const warehouse = await context.newPage();
    await signIn(warehouse, f.accounts.warehouseA);
    const response = await context.request.post(route, {
      data: action.postDataBuffer()!,
      headers: {
        "content-type": action.headers()["content-type"],
        "next-action": action.headers()["next-action"],
      },
    });
    expect(response.status()).toBe(404);
    await warehouse.goto(route);
    await expect(warehouse.getByRole("button", { name: "Adaugă angajatul" })).toHaveCount(0);
    await expect(warehouse.locator("summary").filter({ hasText: name })).toContainText("Inactiv");
    await warehouse.goto(`/substatia/${f.stations.B}/personal`);
    await expect(warehouse.getByRole("heading", { name: "Pagina nu a fost găsită" })).toBeVisible();
    await context.close();
  });

  test("mașina indisponibilă dispare din lista titularului, dar rămâne în evidență", async ({
    page,
    browser,
  }, info) => {
    const f = fixture!;
    const identifier = `E2E-AMB-${randomBytes(4).toString("hex")}`.toUpperCase();
    await signIn(page, f.accounts.manager);
    await page.goto(`/substatia/${f.stations.A}/masini`);
    const create = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Adaugă mașina", exact: true }) });
    await create.getByLabel("Indicativ / număr de înmatriculare").fill(identifier);
    await create.getByLabel("Descriere", { exact: true }).fill("Ambulanță E2E fictivă");
    await create.getByLabel("Motivul modificării").fill("Adăugare flotă pentru verificare E2E");
    await create.getByRole("button", { name: "Adaugă mașina", exact: true }).click();
    await expect(create.getByRole("status")).toContainText("Mașina a fost salvată");
    const context = await browser.newContext({ baseURL: new URL(page.url()).origin });
    const leader = await context.newPage();
    await signIn(leader, f.accounts.leaderA);
    await leader.goto(`/substatia/${f.stations.A}/tura-mea`);
    await expect(leader.getByText(identifier, { exact: true })).toBeVisible();
    const record = page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: identifier }) });
    await record.locator("summary").click();
    await record.getByLabel("Aptă de utilizare").uncheck();
    await record.getByLabel("Motivul modificării").fill("Indisponibilitate tehnică fictivă E2E");
    await record.getByRole("button", { name: "Salvează mașina", exact: true }).click();
    await expect(record.locator("summary")).toContainText("Indisponibilă tehnic");
    await leader.reload();
    await expect(leader.getByText(identifier, { exact: true })).toHaveCount(0);
    await fits(page);
    await page.screenshot({ path: info.outputPath("masini.png"), fullPage: true });
    await context.close();
  });

  test("Tura mea identifică numai titularul autentificat", async ({ page }, info) => {
    const f = fixture!;
    await signIn(page, f.accounts.leaderA);
    await page.goto(`/substatia/${f.stations.A}/tura-mea`);
    await expect(
      page.getByRole("heading", { name: "Titular: Titular Test A", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Titular Test B", { exact: true })).toHaveCount(0);
    await expect(page.getByText("M03-READY", { exact: true })).toBeVisible();
    await expect(page.getByText("M03-INACTIVE", { exact: true })).toHaveCount(0);
    await expect(page.getByText("M03-UNFIT", { exact: true })).toHaveCount(0);
    await fits(page);
    await page.screenshot({ path: info.outputPath("titular.png"), fullPage: true });
    for (const section of ["personal", "masini"]) {
      await page.goto(`/substatia/${f.stations.A}/${section}`);
      await expect(page.getByRole("heading", { name: "Pagina nu a fost găsită" })).toBeVisible();
    }
  });
});
