import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

type Account = { id: string; email: string; password: string };
type Fixture = { run: string; accounts: Record<string, Account>; stations: Record<string, string> };
const path = new URL("../../.verification/m02-fixtures.json", import.meta.url);
const fixture: Fixture | null = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;

async function signIn(page: Page, account: Account) {
  await page.goto("/autentificare");
  await page.getByLabel("Adresă de e-mail").fill(account.email);
  await page.getByLabel("Parolă", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Autentificare", exact: true }).click();
  await expect(page).not.toHaveURL(/autentificare/);
}
async function openMenu(page: Page) {
  await expect(page.locator(".app-shell")).toHaveAttribute("data-ready", "true");
  const trigger = page.getByRole("button", { name: "Deschide meniul" });
  if (await trigger.isVisible()) await trigger.click();
}
async function expectFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("vizitatorul ajunge la autentificare; demo rămâne separat", async ({ page }, info) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/autentificare$/);
  await expect(page.getByRole("heading", { name: "Intră în cont" })).toBeVisible();
  await expectFits(page);
  await page.screenshot({ path: info.outputPath("autentificare.png"), fullPage: true });
  await page.goto("/administrare");
  await expect(page).toHaveURL(/\/autentificare$/);
  await page.getByRole("link", { name: /Explorează interfața demonstrativă/ }).click();
  await expect(page.getByText("Date demonstrative", { exact: true })).toBeVisible();
});

test.describe("M02 cu Supabase real", () => {
  test.skip(!fixture, "Rulează test:integration pentru fixturea privată Supabase.");

  test("sesiunea persistă, rolul local limitează URL-urile și deconectarea închide accesul", async ({
    page,
  }, info) => {
    const f = fixture!;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await signIn(page, f.accounts.warehouseA);
    await expect(page).toHaveURL(new RegExp(`/substatia/${f.stations.A}$`));
    await expect(page.getByLabel("Substația activă").locator("option")).toHaveCount(2);
    await page.reload();
    await expect(page.getByText("Sesiune autentificată", { exact: true })).toBeVisible();
    await expectFits(page);
    await page.screenshot({ path: info.outputPath("substatia-autentificata.png"), fullPage: true });
    for (const route of [
      `/substatia/${f.stations.B}`,
      "/administrare",
      `/substatia/${f.stations.A}/tura-mea`,
    ]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: "Pagina nu a fost găsită" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Administrare", exact: true })).toHaveCount(0);
    }
    await page.goto(`/substatia/${f.stations.A}`);
    await openMenu(page);
    await page
      .getByRole("button", { name: "Deconectare", exact: true })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/\/autentificare$/);
    await page.goto(`/substatia/${f.stations.A}`);
    await expect(page).toHaveURL(/\/autentificare$/);
    expect(errors).toEqual([]);
  });

  test("șeful de tură are numai perspectiva proprie; contul fără rol are stare explicită", async ({
    page,
  }) => {
    const f = fixture!;
    await signIn(page, f.accounts.leaderA);
    await page.getByRole("main").getByRole("link", { name: "Tura mea", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Tura mea", exact: true })).toBeVisible();
    await page.goto(`/substatia/${f.stations.A}/logistica`);
    await expect(page.getByRole("heading", { name: "Pagina nu a fost găsită" })).toBeVisible();
    await page.context().clearCookies();
    await signIn(page, f.accounts.noRole);
    await expect(page).toHaveURL(/\/cont$/);
    await expect(page.getByRole("heading", { name: "Nicio substație disponibilă" })).toBeVisible();
  });

  test("logistica centrală schimbă substația și nu poate administra conturi", async ({ page }) => {
    const f = fixture!;
    await signIn(page, f.accounts.central);
    await page.getByLabel("Substația activă").selectOption(f.stations.B);
    await expect(page).toHaveURL(new RegExp(`/substatia/${f.stations.B}$`));
    await page
      .getByRole("main")
      .getByRole("link", { name: "Logistică / Magazie", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Logistică / Magazie", exact: true }),
    ).toBeVisible();
    await page.goto("/administrare");
    await expect(page.getByRole("heading", { name: "Pagina nu a fost găsită" })).toBeVisible();
  });

  test("administratorul creează substație și cont, atribuie rol și dezactivează contul", async ({
    page,
    browser,
  }, info) => {
    const f = fixture!;
    const suffix = `${info.project.name}-${randomBytes(3).toString("hex")}`;
    const name = `Cont E2E ${suffix}`;
    const email = `ui-${suffix}.${f.run}@example.invalid`;
    const password = randomBytes(24).toString("base64url") + "Aa1!";
    await signIn(page, f.accounts.adminA);
    await expect(page.getByRole("heading", { name: "Administrare", exact: true })).toBeVisible();
    const stationPanel = page
      .getByRole("heading", { name: "Adaugă substație", exact: true })
      .locator("..")
      .locator("..")
      .locator("..");
    await stationPanel.getByLabel("Denumire substație").fill(`E2E ${suffix}`);
    await stationPanel
      .getByLabel("Motivul modificării")
      .fill("Verificare administrare din interfață");
    const submittedAction = page.waitForRequest(
      (request) =>
        request.method() === "POST" && new URL(request.url()).pathname === "/administrare",
    );
    await stationPanel.getByRole("button", { name: "Adaugă substația" }).click();
    await expect(stationPanel.getByRole("status")).toContainText("Substația a fost salvată");
    const actionRequest = await submittedAction;
    expect(actionRequest.headers()["next-action"]).toBeTruthy();
    const probeContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
    const replay = {
      data: actionRequest.postDataBuffer()!,
      headers: {
        "content-type": actionRequest.headers()["content-type"],
        "next-action": actionRequest.headers()["next-action"],
      },
      maxRedirects: 0,
    };
    const anonymousAction = await probeContext.request.post("/administrare", replay);
    // Next may stream the destination with status 200; the action redirect is authoritative.
    expect(anonymousAction.headers()["x-action-redirect"]).toContain("/autentificare");
    await signIn(await probeContext.newPage(), f.accounts.warehouseA);
    const unauthorizedAction = await probeContext.request.post("/administrare", replay);
    expect(unauthorizedAction.status()).toBe(404);
    await probeContext.close();
    const createPanel = page
      .getByRole("heading", { name: "Creează cont", exact: true })
      .locator("..")
      .locator("..")
      .locator("..");
    await createPanel.getByLabel("Nume afișat").fill(name);
    await createPanel.getByLabel("Adresă de e-mail").fill(email);
    await createPanel.getByLabel("Parolă inițială").fill(password);
    await createPanel.getByLabel("Motivul modificării").fill("Cont fictiv pentru verificarea M02");
    await createPanel.getByRole("button", { name: "Creează contul" }).click();
    await expect(createPanel.getByRole("status")).toContainText("Contul a fost creat");
    const record = page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: name }) });
    await record.locator("summary").click();
    await record.locator(`input[value="warehouse:${f.stations.A}"]`).check();
    await record.getByLabel("Motivul modificării").fill("Atribuire gestionar în substația A");
    await record.getByRole("button", { name: "Salvează drepturile" }).click();
    await expect(record.getByRole("status")).toContainText("Drepturile au fost salvate");
    await expectFits(page);
    await page.screenshot({ path: info.outputPath("administrare.png"), fullPage: true });
    const userContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
    const userPage = await userContext.newPage();
    await signIn(userPage, { id: "", email, password });
    await expect(userPage).toHaveURL(new RegExp(`/substatia/${f.stations.A}$`));
    await record.getByLabel("Cont activ", { exact: true }).uncheck();
    await record.getByLabel("Motivul modificării").fill("Revocare acces în testul E2E");
    await record.getByRole("button", { name: "Salvează drepturile" }).click();
    await expect(record.getByRole("status")).toContainText("Drepturile au fost salvate");
    await expect(record.locator("summary")).toContainText("Inactiv");
    await userPage.reload();
    await expect(userPage).toHaveURL(/\/autentificare$/);
    await userContext.close();
  });
});
