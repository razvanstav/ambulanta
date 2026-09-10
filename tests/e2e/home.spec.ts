import { expect, test } from "@playwright/test";

test("pagina inițială se deschide în română, fără erori sau depășirea ecranului", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Gestiune substații");
  await expect(page.locator("html")).toHaveAttribute("lang", "ro");
  await expect(
    page.getByRole("heading", { level: 1, name: "Gestiunea substației, într-un singur loc." }),
  ).toBeVisible();
  await expect(page.getByText("Versiune în dezvoltare", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Proiect pe GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/razvanstav/ambulanta",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(browserErrors).toEqual([]);
});
