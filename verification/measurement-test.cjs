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
  await page.selectOption("#shape-select", "cube");
  await page.click("#create-shape-btn");
  await page.waitForTimeout(200);

  await page.click('[data-tool="measure-length"]');
  await clickPoint(page, "A");
  await clickPoint(page, "B");

  await page.click('[data-tool="measure-angle"]');
  await clickPoint(page, "A₁");
  await clickPoint(page, "A");
  await clickPoint(page, "D₁");
  await page.waitForTimeout(200);

  const measurements = await page.evaluate(
    () => window.__geometryDebug.scene().measurements || []
  );
  const result = {
    measurements,
    listText: await page.locator("#measurement-list").innerText(),
    labelCount: await page.locator(".measurement-label").count(),
    errors
  };

  await page.screenshot({
    path: "D:/几何绘图/verification/measurements.png",
    fullPage: true
  });
  await page.reload({ waitUntil: "networkidle" });
  result.afterReload = await page.locator("#measurement-list").innerText();
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
