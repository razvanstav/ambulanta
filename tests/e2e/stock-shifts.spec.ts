import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { verifyEvidenceFlow } from "./evidence-flow";
type Fixture = {
  accounts: Record<string, { email: string; password: string }>;
  stations: Record<string, string>;
  m06?: object;
};
const path = new URL("../../.verification/m02-fixtures.json", import.meta.url);
const fixture: Fixture | null = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
async function login(page: Page, account: { email: string; password: string }) {
  await page.goto("/autentificare");
  await page.getByLabel("Adresă de e-mail").fill(account.email);
  await page.getByLabel("Parolă", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Autentificare", exact: true }).click();
  await expect(page).not.toHaveURL(/autentificare/);
}
test.describe("M04–M07 circuit real", () => {
  test.use({ actionTimeout: 10000 });
  test.skip(!fixture?.m06, "Rulează test:integration pentru fixturele M06.");
  test("catalog, recepție, neconcordanță, acceptare și suplimentare", async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(240_000);
    const f = fixture!;
    const base = `/substatia/${f.stations.A}`;
    const suffix = randomBytes(4).toString("hex");
    const name = `Produs circuit ${suffix}`;
    await login(page, f.accounts.adminA);
    await page.goto(`${base}/catalog`);
    const create = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Adaugă produsul", exact: true }) });
    await create.getByLabel("Cod produs").fill(`UI-${suffix}`);
    await create.getByLabel("Denumire", { exact: true }).fill(name);
    await create.getByLabel("Motivul modificării").fill("Produs fictiv circuit complet");
    await create.getByRole("button", { name: "Adaugă produsul", exact: true }).click();
    await expect(create.getByRole("status")).toContainText("Produsul a fost salvat");
    const record = page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: name }) });
    await record.locator("summary").click();
    const local = record
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Salvează pragul local" }) });
    await local.getByLabel("Prag minim", { exact: false }).fill("20");
    await local.getByLabel("Activ în această substație").check();
    await local.getByLabel("Motivul modificării").fill("Activare locală pentru circuit");
    await local.getByRole("button", { name: "Salvează pragul local" }).click();
    await expect(local.getByRole("status")).toContainText("salvate numai în această substație");
    const lot = record
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Creează lotul intern" }) });
    await lot.getByLabel("Motivul modificării").fill("Lot intern pentru testul de circuit");
    await lot.getByRole("button", { name: "Creează lotul intern" }).click();
    await expect(record.getByText("Lot intern", { exact: true })).toBeVisible();
    const product = record
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Salvează produsul", exact: true }) });
    await product.getByLabel("Unitate de bază").selectOption("fiola");
    await product.getByLabel("Motivul modificării").fill("Încercare unitate după lot");
    await product.getByRole("button", { name: "Salvează produsul", exact: true }).click();
    await expect(product.getByRole("alert")).toContainText("fixe după primul lot");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath("catalog.png"), fullPage: true });
    await page.goto(`${base}/stocuri`);
    const receipt = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Confirmă recepția" }) });
    await receipt.getByLabel("Număr document").fill(`DOC-${suffix}`);
    await receipt.getByLabel("Furnizor", { exact: true }).fill("Furnizor fictiv UI");
    await receipt
      .getByRole("combobox", { name: "Lot 1", exact: true })
      .selectOption({ label: `${name} · INTERN · bucată` });
    await receipt.getByLabel("Cantitate 1", { exact: true }).fill("100");
    await receipt.getByLabel("Motivul înregistrării").fill("Recepție pentru circuit E2E");
    const receiptRequest = page.waitForRequest(
      (r) => r.method() === "POST" && new URL(r.url()).pathname === `${base}/stocuri`,
    );
    await receipt.getByRole("button", { name: "Confirmă recepția" }).click();
    await expect(receipt.getByRole("status")).toContainText("Recepția a fost înregistrată");
    const captured = await receiptRequest;
    const stockRow = page.getByRole("row").filter({ hasText: name });
    await expect(stockRow).toContainText("100 bucată");
    const context = await browser.newContext({
      baseURL: new URL(page.url()).origin,
      viewport: page.viewportSize(),
      isMobile: info.project.name.startsWith("mobile"),
      hasTouch: info.project.name.startsWith("mobile"),
    });
    const leader = await context.newPage();
    const account = info.project.name.startsWith("desktop") ? "m06uiDesktop" : "m06uiMobile";
    await login(leader, f.accounts[account]);
    const forged = await context.request.post(`${base}/stocuri`, {
      data: captured.postDataBuffer()!,
      headers: {
        "content-type": captured.headers()["content-type"],
        "next-action": captured.headers()["next-action"],
      },
    });
    expect(forged.status()).toBe(404);
    await leader.goto(`${base}/tura-mea`);
    await leader
      .getByLabel("Mașina pentru tură")
      .selectOption({ label: `AMB-${account.toUpperCase()} · Mașină fictivă M06` });
    await leader.getByRole("button", { name: "Solicită fișa și rezervă mașina" }).click();
    await expect(leader.getByText("În așteptarea fișei", { exact: true })).toBeVisible();
    await page.goto(`${base}/ture`);
    const shift = page.locator("section.panel").filter({
      has: page.getByRole("heading", {
        name: `AMB-${account.toUpperCase()} · ${account}`,
        exact: true,
      }),
    });
    async function send(quantity: string) {
      const editor = shift
        .locator("form")
        .filter({ has: page.getByRole("button", { name: "Salvează versiunea fișei" }) });
      await editor
        .getByRole("combobox", { name: "Lot 1", exact: true })
        .selectOption({ label: `${name} · INTERN · 100 bucată disponibil` });
      await editor.getByLabel("Cantitate 1", { exact: true }).fill(quantity);
      await editor.getByLabel("Motivul fișei").fill("Fișă pentru circuit E2E");
      await editor.getByRole("button", { name: "Salvează versiunea fișei" }).click();
      await expect(shift.locator("summary").filter({ hasText: "Trimisă" })).toBeVisible();
    }
    await send("10");
    await leader.reload();
    await expect(leader.getByRole("button", { name: "Accept fișa și pornesc tura" })).toBeVisible();
    await expect(leader.getByLabel("Cantitate 1", { exact: true })).toHaveCount(0);
    const dispute = leader
      .locator("form")
      .filter({ has: leader.getByRole("button", { name: "Semnalează neconcordanță" }) });
    await dispute.getByLabel("Motivul acțiunii").fill("Cantitatea corectă trebuie să fie 12");
    await dispute.getByRole("button", { name: "Semnalează neconcordanță" }).click();
    await expect(leader.getByText("Neconcordanță semnalată", { exact: true })).toBeVisible();
    await expect(leader.getByRole("button", { name: "Accept fișa și pornesc tura" })).toHaveCount(
      0,
    );
    await page.reload();
    await send("12");
    await leader.reload();
    await leader.getByRole("button", { name: "Accept fișa și pornesc tura" }).click();
    await expect(leader.getByText("Tură pornită", { exact: true })).toBeVisible();
    await expect(leader.getByRole("heading", { name: "Produse predate în tură" })).toBeVisible();
    await page.goto(`${base}/stocuri`);
    await expect(stockRow).toContainText("88 bucată");
    await page.screenshot({ path: info.outputPath("stoc.png"), fullPage: true });
    await page.goto(`${base}/ture`);
    const editor = shift
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Salvează versiunea fișei" }) });
    await editor
      .getByRole("combobox", { name: "Lot 1", exact: true })
      .selectOption({ label: `${name} · INTERN · 88 bucată disponibil` });
    await editor.getByLabel("Cantitate 1", { exact: true }).fill("3");
    await editor.getByLabel("Motivul fișei").fill("Suplimentare circuit E2E");
    await editor.getByRole("button", { name: "Salvează versiunea fișei" }).click();
    await expect(shift.locator("summary").filter({ hasText: "Trimisă" })).toBeVisible();
    await leader.reload();
    await leader.getByRole("button", { name: "Accept suplimentarea" }).click();
    await expect(leader.locator("summary").filter({ hasText: "Fișa v3" })).toContainText(
      "Acceptată",
    );
    await expect(leader.getByRole("button", { name: "Accept suplimentarea" })).toHaveCount(0);
    await page.goto(`${base}/tura-mea`);
    await expect(page.getByRole("heading", { name: "Pagina nu a fost găsită" })).toBeVisible();
    await page.goto(`${base}/stocuri`);
    await expect(stockRow).toContainText("85 bucată");
    // Reuse the project's device viewport for the titular's visual check.
    await leader.setViewportSize(page.viewportSize()!);
    await leader.locator("main").focus();
    expect(await leader.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await leader.screenshot({ path: info.outputPath("tura.png"), fullPage: true });
    const privateLink = await verifyEvidenceFlow(
      leader,
      page,
      `AMB-${account.toUpperCase()} · ${account}`,
      info,
    );
    const outsider = await browser.newContext({ baseURL: new URL(page.url()).origin });
    const outsiderPage = await outsider.newPage();
    await login(outsiderPage, f.accounts.m06b);
    expect((await outsider.request.get(privateLink)).status()).toBe(404);
    await outsider.close();
    await leader.goto(`${base}/catalog`);
    await expect(leader.getByRole("heading", { name: "Pagina nu a fost găsită" })).toBeVisible();
    await context.close();
  });
});
