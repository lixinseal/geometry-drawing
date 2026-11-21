const { chromium } = require("playwright");

async function clickProjected(page, id) {
  const point = await page.evaluate(
    (entityId) => window.__geometryDebug.project(entityId),
    id
  );
  if (!point) throw new Error(`Unable to project ${id}`);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(120);
}

async function chooseColor(page, color) {
  await page.locator(`.color-swatch[data-color="${color}"]`).click();
  await page.waitForTimeout(180);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.selectOption("#shape-select", "cube");
  await page.click("#create-shape-btn");
  await page.waitForTimeout(200);

  await page.click('[data-tool="point"]');
  await page.waitForTimeout(120);
  await clickProjected(page, "ABCD");
  const pointEditorVisible = await page.locator("#color-editor").isVisible();
  await chooseColor(page, "#2563eb");

  await page.click('[data-tool="midpoint"]');
  await page.waitForTimeout(120);
  await clickProjected(page, "A");
  await clickProjected(page, "B");

  await page.click('[data-tool="line"]');
  await page.waitForTimeout(120);
  await clickProjected(page, "A");
  const midpointId = await page.evaluate(
    () =>
      window.__geometryDebug
        .scene()
        .points.find((point) => !point.base && point.label === "E")?.id
  );
  await clickProjected(page, midpointId);

  await page
    .locator(".object-name", { hasText: "棱 AE" })
    .click();
  await page.waitForTimeout(120);
  const lineEditorVisible = await page.locator("#color-editor").isVisible();
  await chooseColor(page, "#dc2626");

  await page.click('[data-tool="plane"]');
  await page.waitForTimeout(120);
  await clickProjected(page, "A");
  await clickProjected(page, "B");
  await clickProjected(page, "D1");
  await page.locator(".object-name", { hasText: "平面 ABD₁" }).click();
  await page.waitForTimeout(120);
  const faceEditorVisible = await page.locator("#color-editor").isVisible();
  await chooseColor(page, "#7c3aed");

  const beforeReload = await page.evaluate(() => {
    const scene = window.__geometryDebug.scene();
    return {
      point: scene.points.find((item) => item.color === "#2563eb")?.color,
      edge: scene.edges.find((item) => item.color === "#dc2626")?.color,
      face: scene.faces.find((item) => item.color === "#7c3aed")?.color
    };
  });
  await page.screenshot({
    path: "D:/几何绘图/verification/custom-colors.png",
    fullPage: true
  });

  await page.reload({ waitUntil: "networkidle" });
  const afterReload = await page.evaluate(() => {
    const scene = window.__geometryDebug.scene();
    return {
      point: scene.points.find((item) => item.color === "#2563eb")?.color,
      edge: scene.edges.find((item) => item.color === "#dc2626")?.color,
      face: scene.faces.find((item) => item.color === "#7c3aed")?.color
    };
  });

  console.log(
    JSON.stringify(
      {
        pointEditorVisible,
        lineEditorVisible,
        faceEditorVisible,
        beforeReload,
        afterReload,
        errors
      },
      null,
      2
    )
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
