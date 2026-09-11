import { expect, type Page, type TestInfo } from "@playwright/test";

export async function verifySimpleCloseout(
  leader: Page,
  operator: Page,
  shiftTitle: string,
  info: TestInfo,
) {
  const workspace = leader.getByRole("region", { name: "Încheierea turei" });
  await expect(workspace.getByRole("heading", { name: "Închide tura" })).toBeVisible();
  await expect(workspace).toContainText("stocul se actualizează numai atunci.");

  const allocations = await workspace.locator(".closeout-line").all();
  expect(allocations.length).toBe(1); // Initial handover + supplement, one product.
  const consumption = workspace.locator('input[name="consumed"]').first();
  const close = workspace.getByRole("button", { name: "Închide tura și actualizează stocul" });
  await expect(consumption).toBeEnabled();
  await expect(close).toBeDisabled();
  await consumption.fill("4");
  await consumption.fill("6");
  await consumption.press("Enter");
  await expect(consumption).toHaveValue("6");
  await expect(leader.getByText("Tură pornită", { exact: true })).toBeVisible();
  for (const allocation of allocations) {
    const quantity = Number((await allocation.innerText()).match(/Preluat: (\d+)/)![1]);
    await allocation.locator('input[name="consumed"]').fill("7");
    await expect(allocation.locator(".remaining-stock")).toContainText(String(quantity - 7));
  }

  await expect(workspace.locator('input[name="returned"]')).toHaveCount(allocations.length);
  await expect(workspace.getByText("Retur fizic", { exact: false })).toHaveCount(0);
  await expect(workspace.getByText("Dovada consumului", { exact: false })).toHaveCount(0);
  const early = info.project.name.startsWith("mobile");
  if (early) {
    await workspace.getByRole("button", { name: "Închide tura înainte", exact: true }).click();
    await workspace.getByRole("button", { name: "Renunță", exact: true }).click();
    await expect(consumption).toHaveValue("7");
    await workspace.getByRole("button", { name: "Închide tura înainte", exact: true }).click();
    await workspace
      .getByRole("button", { name: "Confirm închiderea anticipată", exact: true })
      .click();
    await expect(leader.getByText("Tură pornită", { exact: true })).toBeVisible();
    await workspace
      .getByLabel("Motivul închiderii anticipate")
      .fill("Închidere anticipată de test");
    await workspace.getByLabel("Am verificat consumul și confirm închiderea turei acum.").check();
    await expect(close).toBeDisabled();
  } else
    await expect(
      workspace.getByRole("button", { name: "Închide tura și actualizează stocul" }),
    ).toBeEnabled({ timeout: 150_000 });
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
  await workspace
    .getByRole("button", {
      name: early ? "Confirm închiderea anticipată" : "Închide tura și actualizează stocul",
      exact: true,
    })
    .click();
  await leader.getByRole("button", { name: /Istoric/ }).click();
  await expect(leader.getByRole("heading", { name: "Tura este închisă" })).toBeVisible();
  await expect(leader.getByRole("region", { name: "Încheierea turei" })).toContainText(
    "Rămas în mașină 8 bucată",
  );
}
