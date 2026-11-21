const { chromium } = require("playwright");

async function clickPoint(page, label) {
  const id = await page.evaluate(
    (pointLabel) =>
      window.__geometryDebug
        .scene()
        .points.find((point) => point.label === pointLabel)?.id,
    label
  );
  if (!id) throw new Error(`Point ${label} not found`);
  const point = await page.evaluate(
    (entityId) => window.__geometryDebug.project(entityId),
    id
  );
  if (!point) throw new Error(`Point ${label} is not projectable`);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(120);
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
  await page.selectOption("#shape-select", "triPrism");
  await page.click("#create-shape-btn");
  await page.waitForTimeout(250);

  await page.selectOption("#point-mode", "coordinates");
  await page.fill("#point-x", "0");
  await page.fill("#point-y", "0");
  await page.fill("#point-z", "2");
  await page.click("#create-exact-point-btn");
  await page.waitForTimeout(150);
  await page.fill("#point-x", "1");
  await page.fill("#point-y", "0");
  await page.fill("#point-z", "1.5");
  await page.click("#create-exact-point-btn");
  await page.waitForTimeout(150);

  await page.click('[data-tool="plane"]');
  await page.waitForTimeout(150);
  await clickPoint(page, "A₁");
  await clickPoint(page, "E");
  await clickPoint(page, "D");
  await page.click("#finish-plane-btn");
  await page.waitForTimeout(150);

  const faceInfo = await page.evaluate(() => {
    const scene = window.__geometryDebug.scene();
    const face = scene.faces.find((item) => item.auxiliary);
    return {
      label: face?.label,
      vertices: face?.vertices,
      screen: face ? window.__geometryDebug.project(face.id) : null
    };
  });
  const activeTool = await page
    .locator('[data-tool="select"]')
    .evaluate((element) => element.classList.contains("active"));
  await page.mouse.click(faceInfo.screen.x, faceInfo.screen.y);
  await page.waitForTimeout(250);

  const result = {
    faceInfo,
    activeTool,
    selected: await page.locator("#selection-title").textContent(),
    faceLabelVisible: await page
      .locator(".face-label")
      .filter({ hasText: "平面 A₁ED" })
      .isVisible(),
    colorEditorVisible: await page.locator("#color-editor").isVisible(),
    errors
  };

  await page.screenshot({
    path: "D:/几何绘图/verification/face-a1ed-selected.png",
    fullPage: true
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
