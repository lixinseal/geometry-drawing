const { chromium } = require("playwright");

const browserPath =
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

async function clickPoint(page, label) {
  const id = await page.evaluate(
    (pointLabel) =>
      window.__geometryDebug.scene().points.find(
        (point) => point.label === pointLabel
      )?.id,
    label
  );
  if (!id) throw new Error(`Unable to find point ${label}`);
  await clickEntity(page, id);
}

async function clickEntity(page, id) {
  const point = await page.evaluate(
    (entityId) => window.__geometryDebug.project(entityId),
    id
  );
  if (!point) throw new Error(`Unable to project entity ${id}`);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(250);
}

async function createTriangularPyramid(page) {
  await page.selectOption("#shape-select", "triPyramid");
  await page.locator("input[data-param=base]").fill("4");
  await page.locator("input[data-param=lateral]").fill("5");
  await page.click("#create-shape-btn");
  await page.waitForTimeout(450);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: browserPath
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await createTriangularPyramid(page);

  await page.click('[data-tool="midpoint"]');
  await page.waitForTimeout(250);
  await clickPoint(page, "A");
  const midpointStatusAfterA = await page
    .locator("#operation-status")
    .textContent();
  await clickPoint(page, "P");
  const midpointStatusAfterP = await page
    .locator("#operation-status")
    .textContent();
  const labelsAfterMidpoint = await page.evaluate(() =>
    window.__geometryDebug.scene().points.map((point) => point.label)
  );
  await page.waitForTimeout(250);

  await page.click('[data-tool="line"]');
  await page.waitForTimeout(250);
  await clickPoint(page, "A");
  await clickPoint(page, "D");
  await page.waitForTimeout(250);

  await page.click('[data-tool="perpendicular"]');
  await page.waitForTimeout(250);
  await clickPoint(page, "P");
  await clickEntity(page, "AB");
  await page.waitForTimeout(300);

  const statusAfterPerpendicular = await page
    .locator("#operation-status")
    .textContent();

  await page.click('[data-tool="plane"]');
  await page.waitForTimeout(80);
  await clickPoint(page, "P");
  await clickPoint(page, "A");
  await clickPoint(page, "B");
  await page.waitForTimeout(300);
  const statusAfterPlane = await page.locator("#operation-status").textContent();
  const countAfterConstruction = await page.locator(".object-row").count();

  await page.click("#undo-btn");
  await page.waitForTimeout(150);
  const countAfterUndo = await page.locator(".object-row").count();
  await page.click("#redo-btn");
  await page.waitForTimeout(150);
  const countAfterRedo = await page.locator(".object-row").count();

  await page.screenshot({
    path: "D:/几何绘图/verification/interactions.png",
    fullPage: true
  });

  const result = {
    title: await page.locator("#scene-title").textContent(),
    statusAfterPerpendicular,
    statusAfterPlane,
    midpointStatusAfterA,
    midpointStatusAfterP,
    labelsAfterMidpoint,
    countAfterConstruction,
    countAfterUndo,
    countAfterRedo,
    errors
  };

  await page.setViewportSize({ width: 1180, height: 820 });
  await page.waitForTimeout(350);
  await page.screenshot({
    path: "D:/几何绘图/verification/ipad-landscape.png",
    fullPage: true
  });
  result.landscapeOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(350);
  await page.screenshot({
    path: "D:/几何绘图/verification/ipad-portrait.png",
    fullPage: true
  });
  result.portraitOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
