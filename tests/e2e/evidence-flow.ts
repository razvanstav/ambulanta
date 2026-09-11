import { expect, type Page, type TestInfo } from "@playwright/test";

export async function verifySimpleCloseout(
  leader: Page,
  operator: Page,
  shiftTitle: string,
  info: TestInfo,
) {
  const workspace = leader.getByRole("region", { name: "Încheierea turei" });
  await expect(workspace.getByRole("heading", { name: "Închide tura" })).toBeVisible();
  await expect(workspace).toContainText(
    "Scrie doar cât s-a consumat. Diferența rămâne automat în mașină.",
  );

  const allocations = await workspace.locator(".closeout-line").all();
  expect(allocations.length).toBe(1); // Initial handover + supplement, one product.
  // Wait for the real scheduled end; PostgreSQL enforces the same clock gate.
  await expect(workspace.locator('input[name="consumed"]').first()).toBeEnabled({
    timeout: 150_000,
  });
  for (const allocation of allocations) {
    const quantity = Number((await allocation.innerText()).match(/Preluat: (\d+)/)![1]);
    await allocation.locator('input[name="consumed"]').fill("7");
    await expect(allocation.locator(".remaining-stock")).toContainText(String(quantity - 7));
  }

  await expect(workspace.locator('input[name="returned"]')).toHaveCount(allocations.length);
  await expect(workspace.getByText("Retur fizic", { exact: false })).toHaveCount(0);
  await expect(workspace.getByText("Dovada consumului", { exact: false })).toHaveCount(0);
  await expect(
    workspace.getByRole("button", { name: "Închide tura și actualizează stocul" }),
  ).toBeEnabled();
  expect(await leader.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await leader.screenshot({ path: info.outputPath("inchidere-simpla.png"), fullPage: true });

  const base = leader.url().replace(/\/tura-mea$/, "");
  await operator.goto(base + "/ture");
  const operatorShift = operator
    .locator("section.panel")
    .filter({ has: operator.getByRole("heading", { name: shiftTitle, exact: true }) });
  await expect(
    operatorShift.getByText("Titularul completează consumul", { exact: false }),
  ).toBeVisible();
  await expect(
    operatorShift.getByRole("button", { name: "Închide tura și actualizează stocul" }),
  ).toHaveCount(0);
  await workspace.getByRole("button", { name: "Închide tura și actualizează stocul" }).click();
  await leader.getByRole("button", { name: /Istoric/ }).click();
  await expect(leader.getByRole("heading", { name: "Tura este închisă" })).toBeVisible();
  await expect(leader.getByRole("region", { name: "Încheierea turei" })).toContainText(
    "Rămas în mașină 8 bucată",
  );
}
