const { chromium } = require("playwright");

const URL = process.env.GEOMETRY_TEST_URL || "http://127.0.0.1:4183/";

function closeTo(actual, expected, tolerance = 1e-6) {
  return Math.abs(actual - expected) <= tolerance;
}

function closePosition(actual, expected, tolerance = 1e-6) {
  return (
    Array.isArray(actual) &&
    actual.length === 3 &&
    expected.every((value, index) => closeTo(actual[index], value, tolerance))
  );
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
    if (message.type() === "error" || message.type() === "warning") {
      errors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

  await page.goto(URL, { waitUntil: "networkidle" });

  await page.selectOption("#shape-select", "cylinder");
  await page.click("#create-shape-btn");
  await page.waitForTimeout(160);
  const cylinderScene = await page.evaluate(() =>
    window.__geometryDebug.scene()
  );
  if (cylinderScene.curves.length !== 2) {
    throw new Error("Cylinder must expose two circles");
  }
  if (cylinderScene.surfaces.length !== 1) {
    throw new Error("Cylinder must expose one curved surface");
  }
  for (const id of ["OO1", "OA", "O1A1", "AA1", "BB1"]) {
    if (!cylinderScene.edges.some((edge) => edge.id === id)) {
      throw new Error(`Cylinder edge ${id} is missing`);
    }
  }

  await page.selectOption("#point-mode", "circle");
  await page.selectOption("#point-circle-select", "C_bottom");
  await page.fill("#point-circle-value", "45");
  await page.click("#create-exact-point-btn");
  await page.waitForTimeout(120);
  const circlePoint = await page.evaluate(() => {
    const point = window.__geometryDebug
      .scene()
      .points.find((item) => item.constraint?.type === "circle-angle");
    return point
      ? { id: point.id, label: point.label, pos: point.pos, constraint: point.constraint }
      : null;
  });
  if (!circlePoint) throw new Error("Cylinder circle point was not created");
  if (!closePosition(circlePoint.pos, [1.76776695, 1.76776695, 0], 1e-6)) {
    throw new Error(`Unexpected cylinder circle point: ${circlePoint.pos}`);
  }

  await page.selectOption("#point-mode", "surface");
  await page.fill("#point-surface-angle", "30");
  await page.fill("#point-surface-secondary", "3");
  await page.click("#create-exact-point-btn");
  await page.waitForTimeout(120);
  const cylinderSurfacePoint = await page.evaluate(() => {
    const point = window.__geometryDebug
      .scene()
      .points.find((item) => item.constraint?.type === "cylinder-surface");
    return point
      ? { id: point.id, pos: point.pos, constraint: point.constraint }
      : null;
  });
  if (!cylinderSurfacePoint) {
    throw new Error("Cylinder surface point was not created");
  }
  if (!closePosition(cylinderSurfacePoint.pos, [2.16506351, 1.25, 3], 1e-6)) {
    throw new Error(
      `Unexpected cylinder surface point: ${cylinderSurfacePoint.pos}`
    );
  }

  const pointScreen = await page.evaluate(
    (id) => window.__geometryDebug.project(id),
    circlePoint.id
  );
  const axisScreen = await page.evaluate(() =>
    window.__geometryDebug.project("OO1")
  );
  if (!pointScreen || !axisScreen) {
    throw new Error("Unable to project cylinder point or axis");
  }
  await page.click('[data-tool="perpendicular"]');
  await page.mouse.click(pointScreen.x, pointScreen.y);
  await page.waitForTimeout(80);
  await page.mouse.click(axisScreen.x, axisScreen.y);
  await page.waitForTimeout(160);
  const perpendicularResult = await page.evaluate(() => ({
    scene: window.__geometryDebug.scene(),
    status: document.querySelector("#operation-status")?.textContent
  }));
  if (
    perpendicularResult.scene.edges.filter((edge) => edge.auxiliary).length < 1
  ) {
    throw new Error("Perpendicular auxiliary line was not created");
  }

  await page.selectOption("#shape-select", "cone");
  await page.click("#create-shape-btn");
  await page.waitForTimeout(160);
  await page.selectOption("#point-mode", "circle");
  await page.selectOption("#point-circle-select", "C_base");
  await page.fill("#point-circle-value", "30");
  await page.click("#create-exact-point-btn");
  await page.waitForTimeout(120);
  const coneCirclePoint = await page.evaluate(() => {
    const point = window.__geometryDebug
      .scene()
      .points.find((item) => item.constraint?.type === "circle-angle");
    return point ? point.pos : null;
  });
  if (!closePosition(coneCirclePoint, [2.16506351, 1.25, 0], 1e-6)) {
    throw new Error(`Unexpected cone circle point: ${coneCirclePoint}`);
  }

  await page.selectOption("#point-mode", "surface");
  await page.fill("#point-surface-angle", "60");
  await page.fill("#point-surface-secondary", "3");
  await page.click("#create-exact-point-btn");
  await page.waitForTimeout(120);
  const coneSurfacePoint = await page.evaluate(() => {
    const point = window.__geometryDebug
      .scene()
      .points.find((item) => item.constraint?.type === "cone-surface");
    return point
      ? { pos: point.pos, constraint: point.constraint }
      : null;
  });
  if (!coneSurfacePoint) throw new Error("Cone surface point was not created");
  if (
    !closePosition(coneSurfacePoint.pos, [
      0.57912119,
      1.00308466,
      2.31660239
    ], 1e-3)
  ) {
    throw new Error(`Unexpected cone surface point: ${coneSurfacePoint.pos}`);
  }

  await page.selectOption("#shape-select", "sphere");
  await page.click("#create-shape-btn");
  await page.waitForTimeout(160);
  const sphereScene = await page.evaluate(() =>
    window.__geometryDebug.scene()
  );
  if (sphereScene.curves.length !== 1 || sphereScene.surfaces.length !== 1) {
    throw new Error("Sphere semantic curve/surface data is incomplete");
  }

  await page.selectOption("#point-mode", "surface");
  await page.fill("#point-surface-angle", "45");
  await page.fill("#point-surface-secondary", "30");
  await page.click("#create-exact-point-btn");
  await page.waitForTimeout(120);
  const sphereSurfacePoint = await page.evaluate(() => {
    const point = window.__geometryDebug
      .scene()
      .points.find((item) => item.constraint?.type === "sphere-surface");
    return point
      ? { pos: point.pos, constraint: point.constraint }
      : null;
  });
  if (!sphereSurfacePoint) {
    throw new Error("Sphere surface point was not created");
  }
  if (
    !closePosition(
      sphereSurfacePoint.pos,
      [1.8369702, 1.8369702, 1.5],
      1e-3
    )
  ) {
    throw new Error(
      `Unexpected sphere surface point: ${sphereSurfacePoint.pos}`
    );
  }

  const beforeInvalid = sphereScene.points.length;
  await page.fill("#point-surface-secondary", "120");
  await page.click("#create-exact-point-btn");
  await page.waitForTimeout(80);
  const invalidResult = await page.evaluate(() => ({
    status: document.querySelector("#operation-status")?.textContent,
    pointCount: window.__geometryDebug.scene().points.length
  }));
  if (
    !invalidResult.status?.includes("纬度") ||
    invalidResult.pointCount !== beforeInvalid + 1
  ) {
    throw new Error(
      `Invalid sphere latitude was not rejected correctly: ${JSON.stringify(
        invalidResult
      )}`
    );
  }

  await page.reload({ waitUntil: "networkidle" });
  const reloadResult = await page.evaluate(() => ({
    shape: document.querySelector("#shape-select")?.value,
    title: document.querySelector("#scene-title")?.textContent,
    pointCount: window.__geometryDebug.scene().points.length,
    surfaceCount: window.__geometryDebug.scene().surfaces.length
  }));
  if (
    reloadResult.shape !== "sphere" ||
    reloadResult.surfaceCount !== 1 ||
    reloadResult.pointCount < 8
  ) {
    throw new Error(`Autosave did not restore sphere: ${JSON.stringify(reloadResult)}`);
  }

  await page.screenshot({
    path:
      process.env.GEOMETRY_SCREENSHOT ||
      "D:/几何绘图-iPad/verification/curved-solids.png",
    fullPage: true
  });

  console.log(
    JSON.stringify(
      {
        cylinder: {
          circlePoint,
          surfacePoint: cylinderSurfacePoint,
          perpendicularCreated: true
        },
        cone: {
          circlePoint: coneCirclePoint,
          surfacePoint: coneSurfacePoint
        },
        sphere: {
          surfacePoint: sphereSurfacePoint
        },
        invalidResult,
        reloadResult,
        errors
      },
      null,
      2
    )
  );

  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
