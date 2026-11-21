const { chromium } = require("playwright");

async function clickEntity(page, id) {
  const point = await page.evaluate(
    (entityId) => window.__geometryDebug.project(entityId),
    id
  );
  if (!point) throw new Error(`Unable to project ${id}`);
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
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.selectOption("#shape-select", "tetra");
  await page.click("#create-shape-btn");
  await page.waitForTimeout(200);

  await page.click('[data-tool="measure-edge-angle"]');
  await clickEntity(page, "A");
  await clickEntity(page, "AB");
  const progressAfterTwoPicks = await page
    .locator("#measurement-progress")
    .textContent();
  await clickEntity(page, "CA");
  await page.waitForTimeout(200);

  const measurements = await page.evaluate(
    () => window.__geometryDebug.scene().measurements || []
  );
  const result = {
    progressAfterTwoPicks,
    measurements,
    listText: await page.locator("#measurement-list").innerText(),
    labelVisible: await page
      .locator(".measurement-label")
      .filter({ hasText: "∠BAC = 60°" })
      .isVisible(),
    errors
  };

  await page.screenshot({
    path: "D:/几何绘图/verification/edge-angle.png",
    fullPage: true
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
