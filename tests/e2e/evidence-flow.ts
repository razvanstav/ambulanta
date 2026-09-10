import { expect, type Page, type TestInfo } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

export async function verifyEvidenceFlow(
  leader: Page,
  operator: Page,
  shiftTitle: string,
  info: TestInfo,
) {
  const workspace = leader.getByRole("region", { name: "Declarație de închidere" });
  const draft = workspace
    .locator("form")
    .filter({ has: leader.getByRole("button", { name: "Salvează ciorna declarației" }) });
  const allocations = await draft.locator(".closeout-line").all();
  for (const allocation of allocations) {
    const quantity = Number((await allocation.innerText()).match(/Predat: (\d+)/)![1]);
    await allocation.locator('input[name="consumed"]').fill("1");
    await allocation.locator('input[name="returned"]').fill(String(quantity - 1));
  }
  await draft.getByRole("button", { name: "Salvează ciorna declarației" }).click();
  await expect(
    workspace.getByRole("heading", { name: "Ciornă v1 · cantități salvate" }),
  ).toBeVisible();
  const signature = workspace
    .locator("form")
    .filter({ has: leader.getByRole("button", { name: "Salvează semnătura", exact: true }) });
  await signature.getByRole("checkbox").check();
  await signature.getByRole("button", { name: "Salvează semnătura", exact: true }).click();
  await expect(signature.getByRole("alert")).toContainText("goală");
  async function draw(page: Page, mobile: boolean) {
    const canvas = page.getByLabel("Zonă pentru semnătură");
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    const points = Array.from({ length: 30 }, (_, i) => ({
      x: box.x + box.width * (0.1 + i * 0.022),
      y: box.y + box.height * (0.5 + 0.2 * Math.sin(i / 2)),
    }));
    if (mobile) {
      const session = await page.context().newCDPSession(page);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [points[0]],
      });
      for (const point of points.slice(1))
        await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await session.detach();
    } else {
      await page.mouse.move(points[0].x, points[0].y);
      await page.mouse.down();
      for (const point of points.slice(1)) await page.mouse.move(point.x, point.y);
      await page.mouse.up();
    }
  }
  await draw(leader, info.project.name.startsWith("mobile"));
  await signature.getByRole("button", { name: "Șterge și refă semnătura" }).click();
  await signature.getByRole("button", { name: "Salvează semnătura", exact: true }).click();
  await expect(signature.getByRole("alert")).toContainText("goală");
  await draw(leader, info.project.name.startsWith("mobile"));
  await signature.getByRole("button", { name: "Salvează semnătura", exact: true }).click();
  await expect(
    workspace.getByRole("img", { name: "Semnătura declarată", exact: false }),
  ).toBeVisible();
  await expect(
    workspace.getByText("Ciorna are cantități reconciliate", { exact: false }),
  ).toBeVisible();

  const uploadForm = workspace
    .locator("form")
    .filter({ has: leader.getByRole("button", { name: "Încarcă dovada", exact: true }) });
  await uploadForm.getByLabel("Document sau fotografie").setInputFiles({
    name: "fals.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7 fals %%EOF"),
  });
  await uploadForm.getByRole("button", { name: "Încarcă dovada" }).click();
  await expect(uploadForm.getByRole("alert")).toBeVisible();
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Document fictiv M07 - fara date reale", { x: 40, y: 760, size: 18 });
  pdf.addPage().drawText("Pagina a doua - document fictiv", { x: 40, y: 760, size: 18 });
  await uploadForm.getByLabel("Document sau fotografie").setInputFiles({
    name: "document-demo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await uploadForm.getByRole("button", { name: "Încarcă dovada" }).click();
  await expect(workspace.getByText("document-demo.pdf", { exact: true })).toBeVisible();
  await workspace.getByText("Previzualizare PDF", { exact: true }).click();
  await expect(
    workspace.getByRole("img", { name: "PDF: document-demo.pdf — pagina 1" }),
  ).toHaveAttribute("data-rendered", "true");
  await workspace.getByRole("button", { name: "Pagina următoare" }).click();
  await expect(
    workspace.getByRole("img", { name: "PDF: document-demo.pdf — pagina 2" }),
  ).toHaveAttribute("data-rendered", "true");
  await workspace.getByRole("button", { name: "Pagina anterioară" }).click();
  await expect(
    workspace.getByRole("img", { name: "PDF: document-demo.pdf — pagina 1" }),
  ).toHaveAttribute("data-rendered", "true");
  // CDP omits file bytes from captured multipart postData. Construct a complete
  // request explicitly to verify a real replay, rather than replaying truncated data.
  const replayArgs = {
    headers: { origin: new URL(leader.url()).origin },
    multipart: {
      version: await workspace.locator('input[name="expected_version"]').inputValue(),
      request_key: randomUUID(),
      kind: "document",
      file: {
        name: "replay-demo.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(await pdf.save()),
      },
    },
  };
  const initial = await leader.context().request.post("/api/evidence", replayArgs);
  expect(initial.status(), await initial.text()).toBe(200);
  const replay = await leader.context().request.post("/api/evidence", replayArgs);
  expect(replay.status(), await replay.text()).toBe(200);
  expect((await replay.json()).id).toBe((await initial.json()).id);
  const photo = await sharp({
    create: { width: 320, height: 180, channels: 3, background: "#326b9b" },
  })
    .jpeg()
    .toBuffer();
  await uploadForm
    .getByLabel("Document sau fotografie")
    .setInputFiles({ name: "foto-demo.jpg", mimeType: "image/jpeg", buffer: photo });
  await expect(uploadForm.getByRole("img")).toBeVisible();
  await uploadForm.getByRole("button", { name: "Încarcă dovada" }).click();
  await expect(workspace.getByRole("img", { name: "Dovadă fotografică" })).toBeVisible();
  const privateLink = (await workspace
    .getByRole("link", { name: "Deschide dovada privată" })
    .first()
    .getAttribute("href"))!;
  const download = await leader.context().request.get(privateLink);
  expect(download.status()).toBe(200);
  expect(download.headers()["cache-control"]).toContain("no-store");
  await leader.screenshot({ path: info.outputPath("m07-semnatura-si-dovezi.png"), fullPage: true });
  expect(await leader.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );

  await workspace.getByText("Modifică declarația — creează versiune nouă", { exact: true }).click();
  const first = draft.locator(".closeout-line").first();
  const issued = Number((await first.innerText()).match(/Predat: (\d+)/)![1]);
  await first.locator('input[name="consumed"]').fill("2");
  await first.locator('input[name="returned"]').fill(String(issued - 2));
  await draft.getByRole("button", { name: "Salvează ciorna declarației" }).click();
  await expect(
    workspace.getByRole("heading", { name: "Ciornă v2 · cantități salvate" }),
  ).toBeVisible();
  await expect(
    workspace.getByText("Mai este necesară cel puțin o dovadă", { exact: false }),
  ).toBeVisible();
  await expect(
    signature.getByRole("button", { name: "Salvează semnătura", exact: true }),
  ).toBeVisible();
  await workspace.getByText("Istoricul ciornelor și al dovezilor", { exact: true }).click();
  await workspace
    .getByText("Ciornă v1 — dovezi valabile numai pentru această versiune", { exact: true })
    .click();
  await expect(
    workspace.getByRole("img", { name: "Semnătura declarată", exact: false }),
  ).toBeVisible();
  const base = leader.url().replace(/\/tura-mea$/, "");
  await operator.goto(`${base}/ture`);
  const operatorShift = operator
    .locator("section.panel")
    .filter({ has: operator.getByRole("heading", { name: shiftTitle, exact: true }) });
  const capture = operatorShift
    .locator("form")
    .filter({ has: operator.getByRole("button", { name: "Salvează semnătura", exact: true }) });
  await capture.getByLabel("Numele semnatarului").fill("Semnatar fictiv la magazie");
  await capture.getByRole("checkbox").check();
  // Scope to the intended shift: other open fixtures also contain signature canvases.
  const target = capture.getByLabel("Zonă pentru semnătură");
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  await operator.mouse.move(box.x + 20, box.y + 40);
  await operator.mouse.down();
  await operator.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.7, { steps: 12 });
  await operator.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, { steps: 12 });
  await operator.mouse.up();
  await capture.getByRole("button", { name: "Salvează semnătura", exact: true }).click();
  await expect(
    operatorShift.getByText("Semnătură: Semnatar fictiv la magazie", { exact: true }),
  ).toBeVisible();
  await leader.reload();
  await expect(
    workspace.getByText("Semnătură: Semnatar fictiv la magazie", { exact: true }),
  ).toBeVisible();
  await workspace
    .getByRole("button", { name: "Elimină semnătura din ciornă", exact: true })
    .click();
  await expect(
    signature.getByRole("button", { name: "Salvează semnătura", exact: true }),
  ).toBeVisible();
  return privateLink;
}
