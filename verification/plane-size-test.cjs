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

async function resetCube(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.selectOption("#shape-select", "cube");
  await page.click("#create-shape-btn");
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
  await resetCube(page);

  await page.click('[data-tool="plane"]');
  await clickPoint(page, "A");
  await clickPoint(page, "B");
  await clickPoint(page, "C");
  const afterThree = {
    finishVisible: await page.locator("#finish-plane-btn").isVisible(),
    status: await page.locator("#operation-status").textContent()
  };
  await clickPoint(page, "D");
  const fourPointFace = await page.evaluate(() => {
    const face = window.__geometryDebug
      .scene()
      .faces.find((item) => item.auxiliary);
    return {
      label: face?.label,
      vertices: face?.vertices,
      count: face?.vertices.length
    };
  });
  const afterFour = {
    selected: await page.locator("#selection-title").textContent(),
    finishHidden: await page.locator("#finish-plane-btn").isHidden(),
    selectToolActive: await page
      .locator('[data-tool="select"]')
      .evaluate((element) => element.classList.contains("active")),
    face: fourPointFace
  };
  await page.screenshot({
    path: "D:/几何绘图/verification/four-point-plane.png",
    fullPage: true
  });

  await resetCube(page);
  await page.click('[data-tool="plane"]');
  await clickPoint(page, "A");
  await clickPoint(page, "B");
  await clickPoint(page, "C");
  const threeFinishVisible = await page
    .locator("#finish-plane-btn")
    .isVisible();
  await page.click("#finish-plane-btn");
  await page.waitForTimeout(180);
  const threePointFace = await page.evaluate(() => {
    const face = window.__geometryDebug
      .scene()
      .faces.find((item) => item.auxiliary);
    return {
      label: face?.label,
      count: face?.vertices.length
    };
  });

  await resetCube(page);
  await page.click('[data-tool="plane"]');
  await clickPoint(page, "A");
  await clickPoint(page, "B");
  await clickPoint(page, "C");
  await clickPoint(page, "D₁");
  const nonCoplanar = {
    status: await page.locator("#operation-status").textContent(),
    auxiliaryFaceCount: await page.evaluate(
      () =>
        window.__geometryDebug
          .scene()
          .faces.filter((item) => item.auxiliary).length
    )
  };

  console.log(
    JSON.stringify(
      {
        afterThree,
        afterFour,
        threeFinishVisible,
        threePointFace,
        nonCoplanar,
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
