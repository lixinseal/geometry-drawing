const { chromium } = require("playwright");

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
  await page.fill("input[data-param=edge]", "4");
  await page.click("#create-shape-btn");
  await page.waitForTimeout(250);

  const axisLabels = await page
    .locator(".entity-label")
    .allTextContents();

  await page.click('[data-tool="point"]');
  await page.waitForTimeout(150);

  const facePoint = await page.evaluate(() =>
    window.__geometryDebug.project("ABCD")
  );
  await page.mouse.click(facePoint.x, facePoint.y);
  await page.waitForTimeout(250);
  const afterFace = {
    status: await page.locator("#operation-status").textContent(),
    pointCount: await page.evaluate(
      () => window.__geometryDebug.scene().points.length
    ),
    selected: await page.locator("#selection-title").textContent()
  };

  const edgePoint = await page.evaluate(() =>
    window.__geometryDebug.project("AB")
  );
  await page.mouse.click(edgePoint.x, edgePoint.y);
  await page.waitForTimeout(250);
  const afterEdge = {
    status: await page.locator("#operation-status").textContent(),
    pointCount: await page.evaluate(
      () => window.__geometryDebug.scene().points.length
    )
  };

  await page.selectOption("#point-edge-select", "AB");
  await page.selectOption("#point-anchor-select", "A");
  await page.fill("#point-distance", "1.25");
  await page.click("#create-exact-point-btn");
  await page.waitForTimeout(250);
  const exactEdgePoint = await page.evaluate(() => {
    const scene = window.__geometryDebug.scene();
    const point = scene.points.find(
      (item) => item.constraint?.type === "edge-distance"
    );
    return {
      label: point?.label,
      position: point?.pos,
      constraint: point?.constraint
    };
  });
  const afterExactEdge = {
    status: await page.locator("#operation-status").textContent(),
    detail: await page.locator("#selection-details").innerText(),
    point: exactEdgePoint
  };

  await page.selectOption("#point-mode", "coordinates");
  await page.fill("#point-x", "1");
  await page.fill("#point-y", "1");
  await page.fill("#point-z", "3");
  await page.click("#create-exact-point-btn");
  await page.waitForTimeout(250);
  const exactCoordinatePoint = await page.evaluate(() => {
    const scene = window.__geometryDebug.scene();
    const point = scene.points.find(
      (item) => item.constraint?.type === "coordinates"
    );
    return {
      label: point?.label,
      position: point?.pos,
      constraint: point?.constraint
    };
  });
  const afterExactCoordinates = {
    status: await page.locator("#operation-status").textContent(),
    detail: await page.locator("#selection-details").innerText(),
    point: exactCoordinatePoint
  };

  await page.screenshot({
    path: "D:/几何绘图/verification/point-tool.png",
    fullPage: true
  });

  console.log(
    JSON.stringify(
      {
        axisLabels,
        axesRemoved: !axisLabels.some((label) =>
          ["x", "y", "z"].includes(label.trim())
        ),
        afterFace,
        afterEdge,
        afterExactEdge,
        afterExactCoordinates,
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
