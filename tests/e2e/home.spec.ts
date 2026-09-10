import { expect, test, type Page } from "@playwright/test";

async function expectFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

async function openNavigation(page: Page) {
  await expect(page.locator(".app-shell")).toHaveAttribute("data-ready", "true");
  const trigger = page.getByRole("button", { name: "Deschide meniul" });
  if (await trigger.isVisible()) await trigger.click();
}

test("dashboard în română, cu exemple explicite și indicatori separați", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/demo");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Gestiune substații");
  await expect(page.locator("html")).toHaveAttribute("lang", "ro");
  await expect(page.getByRole("heading", { level: 1, name: "Privire de ansamblu" })).toBeVisible();
  await expect(page.getByText("Date demonstrative", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Previzualizare interfață. Operațiile nu se salvează."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Produse în magazie/ })).toContainText("6");
  await expect(page.getByRole("link", { name: /Ture active/ })).toContainText("2");
  await expect(page.getByRole("link", { name: /Cereri în așteptare/ })).toContainText("2");
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath("dashboard.png"), fullPage: true });
  await page.getByRole("link", { name: /Sub pragul de stoc/ }).click();
  await expect(page.getByLabel("Stare stoc")).toHaveValue("sub-prag");
  await expect(page.getByRole("status")).toContainText("2 din 6 produse");
  expect(errors).toEqual([]);
});

test("toate destinațiile meniului sunt navigabile și acțiunile viitoare sunt inactive", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/demo");
  for (const [label, path] of [
    ["Stocuri", "/stocuri"],
    ["Recepții", "/receptii"],
    ["Distribuire tură", "/distribuire"],
    ["Închidere tură", "/inchidere"],
    ["Rapoarte", "/rapoarte"],
    ["Personal", "/personal"],
    ["Mașini", "/masini"],
    ["Setări", "/setari"],
    ["Privire de ansamblu", "/"],
  ]) {
    await openNavigation(page);
    const link = page
      .getByRole("navigation", { name: "Navigație Logistică" })
      .getByRole("link", { name: label, exact: true });
    await link.click();
    await expect(page).toHaveURL(new RegExp(path === "/" ? "/demo$" : "/demo" + path + "$"));
    await expect(page.getByRole("heading", { level: 1, name: label, exact: true })).toBeVisible();
    await expectFits(page);
    if (!["/", "/stocuri"].includes(path)) {
      await expect(page.locator(".unavailable-action button")).toBeDisabled();
    }
  }
  expect(errors).toEqual([]);
});

test("căutarea fără diacritice, filtrele combinate și revenirea din lipsa rezultatelor", async ({
  page,
}, testInfo) => {
  await page.goto("/demo/stocuri");
  const search = page.getByRole("searchbox", { name: "Caută produs sau lot" });
  await search.fill("manusi");
  await expect(page.getByRole("status")).toHaveText("1 din 6 produse");
  await expect(page.getByRole("cell", { name: /Mănuși nitril/ })).toBeVisible();
  await search.fill("");
  await page.getByRole("combobox", { name: "Categorie", exact: true }).selectOption("Medicamente");
  await page.getByLabel("Stare stoc").selectOption("sub-prag");
  await expect(page.getByRole("status")).toHaveText("1 din 6 produse");
  await search.fill("inexistent");
  await expect(page.getByRole("heading", { name: "Niciun produs găsit" })).toBeVisible();
  await page.getByRole("button", { name: "Resetează filtrele" }).click();
  await expect(page.getByRole("status")).toHaveText("6 din 6 produse");
  await page.getByLabel("Stare stoc").selectOption("expira");
  await expect(page.getByRole("cell", { name: /Bandaj elastic/ })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("1 din 6 produse");
  await page.getByLabel("Stare stoc").selectOption("toate");
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath("stocuri.png"), fullPage: true });
});

test("Tura mea previzualizează mașina și fișa fără cereri de salvare", async ({
  page,
}, testInfo) => {
  const writes: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/demo");
  await openNavigation(page);
  await page.getByRole("link", { name: "Logistică / Magazie", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Tura mea", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Previzualizează selecția" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Alege o mașină");
  await page.getByRole("radio", { name: /DEMO-05/ }).check();
  await page.getByRole("button", { name: "Previzualizează selecția" }).click();
  await expect(page.getByRole("status")).toContainText("Mașină selectată: DEMO-05");
  await expect(page.getByRole("button", { name: "Trimite cererea de start tură" })).toBeDisabled();
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath("tura-mea.png"), fullPage: true });

  const preview = page.getByLabel("Stare demonstrativă a turei");
  await preview.selectOption("unavailable");
  await expect(page.getByRole("heading", { name: "Nicio mașină disponibilă" })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await preview.selectOption("waiting");
  await expect(page.getByRole("heading", { name: "Magazia pregătește fișa" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Tura nu a început");
  await preview.selectOption("issue");
  const issue = page.getByRole("region", { name: "Fișa primită, numai citire" });
  await expect(issue.getByRole("row")).toHaveCount(5);
  await expect(issue.locator("input, select, textarea, [contenteditable]")).toHaveCount(0);
  await expect(page.getByText(/Versiunea 2/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept fișa și pornesc tura" })).toBeDisabled();
  await expectFits(page);
  await page.screenshot({ path: testInfo.outputPath("fisa.png"), fullPage: true });
  await openNavigation(page);
  await expect(page.getByRole("navigation", { name: "Navigație Logistică" })).toHaveCount(0);
  await page.getByRole("link", { name: "Istoricul meu", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nicio tură în istoric" })).toBeVisible();
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("schimbarea substației păstrează contextul și golește selecțiile demonstrative", async ({
  page,
}) => {
  await page.goto("/demo/tura-mea");
  await page.getByRole("radio", { name: /DEMO-05/ }).check();
  await page.getByLabel("Substația demonstrativă").selectOption("alexandria");
  await expect(page.getByRole("heading", { name: "Nicio mașină disponibilă" })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByLabel("Substația demonstrativă").selectOption("rosiori");
  await expect(page.getByRole("radio", { name: /DEMO-05/ })).not.toBeChecked();
  await page.getByLabel("Substația demonstrativă").selectOption("alexandria");
  await openNavigation(page);
  await page.getByRole("link", { name: "Tura mea", exact: true }).click();
  await expect(page.getByRole("link", { name: /Produse în magazie/ })).toContainText("0");
  await page.getByRole("link", { name: /Produse în magazie/ }).click();
  await expect(page.getByLabel("Substația demonstrativă")).toHaveValue("alexandria");
  await expect(
    page.getByRole("heading", { name: "Magazia nu are produse demonstrative" }),
  ).toBeVisible();
  await expect(page.getByText("Comprese sterile", { exact: true })).toHaveCount(0);
  await page.getByLabel("Substația demonstrativă").selectOption("rosiori");
  await expect(page.getByRole("status")).toHaveText("6 din 6 produse");
});

test("stări standard fără date, încărcare și eroare cu revenire", async ({ page }) => {
  await page.goto("/demo/setari");
  await page.getByRole("button", { name: "Încărcare", exact: true }).click();
  await expect(page.getByRole("status")).toHaveAttribute("aria-busy", "true");
  await page.getByRole("button", { name: "Eroare", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Datele nu au putut fi încărcate",
  );
  await page.getByRole("button", { name: "Reia previzualizarea" }).click();
  await expect(page.getByRole("heading", { name: "Nu există înregistrări" })).toBeVisible();
  await expectFits(page);
});

test("navigație cu tastatura și închidere accesibilă a meniului mobil", async ({
  page,
  isMobile,
}) => {
  await page.goto("/demo");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-ready", "true");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Sari la conținut" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  if (isMobile) {
    const trigger = page.getByRole("button", { name: "Deschide meniul" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Meniu principal" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole("button", { name: "Închide meniul" }).click();
    await expect(trigger).toBeFocused();
  }
});

test("adresă necunoscută și parametru de filtru nevalid", async ({ page }) => {
  await page.goto("/demo/pagina-inexistenta");
  await expect(page.getByRole("heading", { name: "Pagina nu a fost găsită" })).toBeVisible();
  await page.getByRole("link", { name: "La privirea de ansamblu" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privire de ansamblu" })).toBeVisible();
  await page.goto("/demo/stocuri?stare=nevalid");
  await expect(page.getByLabel("Stare stoc")).toHaveValue("toate");
  await expect(page.getByRole("status")).toHaveText("6 din 6 produse");
});
