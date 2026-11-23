const { chromium } = require("playwright");

const URL = process.env.GEOMETRY_TEST_URL || "http://127.0.0.1:4184/";

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

async function setComposite(page, host, relation, params) {
  await page.selectOption("#composite-host-select", host);
  await page.selectOption("#composite-relation-select", relation);
  for (const [key, value] of Object.entries(params)) {
    await page.locator(
      `#composite-parameter-fields input[data-param="${key}"]`
    ).fill(String(value));
  }
  await page.click("#create-composite-btn");
  await page.waitForTimeout(220);
  return page.evaluate(() => window.__geometryDebug.scene());
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

  const faceSphere = await setComposite(page, "cube", "cube-face-sphere", {
    edge: 4
  });
  const faceComposite = faceSphere.composites?.[0];
  if (!faceComposite || faceComposite.relation !== "cube-face-sphere") {
    throw new Error("Cube face-tangent sphere relation was not created");
  }
  if (!closeTo(faceComposite.sphereRadius, 2)) {
    throw new Error(`Unexpected face sphere radius: ${faceComposite.sphereRadius}`);
  }
  if (!closePosition(faceComposite.sphereCenter, [0, 0, 2], 1e-6)) {
    throw new Error(`Unexpected face sphere center: ${faceComposite.sphereCenter}`);
  }
  if (faceComposite.contactPointIds.length !== 6) {
    throw new Error("Face-tangent sphere must have six contact points");
  }
  const faceMeasurements = faceSphere.measurements.filter(
    (item) => item.type === "relation"
  );
  if (faceMeasurements.length < 5 || !faceMeasurements.every((item) => item.locked)) {
    throw new Error("Composite measurements are incomplete or not locked");
  }

  const edgeSphere = await setComposite(page, "cube", "cube-edge-sphere", {
    edge: 4
  });
  const edgeComposite = edgeSphere.composites?.[0];
  if (!edgeComposite || !closeTo(edgeComposite.sphereRadius, 2 * Math.SQRT2, 1e-6)) {
    throw new Error("Cube edge-tangent sphere radius is incorrect");
  }
  if (edgeComposite.contactPointIds.length !== 12) {
    throw new Error("Edge-tangent sphere must have twelve contact points");
  }

  const circumSphere = await setComposite(page, "cube", "cube-circumsphere", {
    edge: 4
  });
  const circumComposite = circumSphere.composites?.[0];
  if (
    !circumComposite ||
    !closeTo(circumComposite.sphereRadius, 2 * Math.sqrt(3), 1e-6) ||
    circumComposite.contactPointIds.length !== 8
  ) {
    throw new Error("Cube circumsphere construction is incorrect");
  }

  const cuboidSphere = await setComposite(
    page,
    "cuboid",
    "cuboid-circumsphere",
    { length: 5, width: 3.5, height: 3 }
  );
  const cuboidComposite = cuboidSphere.composites?.[0];
  if (
    !cuboidComposite ||
    !closeTo(
      cuboidComposite.sphereRadius,
      Math.hypot(5, 3.5, 3) / 2,
      1e-6
    )
  ) {
    throw new Error("Cuboid circumsphere radius is incorrect");
  }

  const cylinderSphere = await setComposite(
    page,
    "cylinder",
    "cylinder-insphere",
    { radius: 2.5 }
  );
  const cylinderComposite = cylinderSphere.composites?.[0];
  if (
    !cylinderComposite ||
    !closeTo(cylinderSphere.params.height, 5) ||
    !closeTo(cylinderComposite.sphereRadius, 2.5) ||
    !cylinderComposite.contactCurveIds.includes("C_cylinder_contact")
  ) {
    throw new Error("Cylinder insphere construction is incorrect");
  }

  const coneSphere = await setComposite(page, "cone", "cone-insphere", {
    radius: 2.5,
    height: 5
  });
  const coneComposite = coneSphere.composites?.[0];
  const expectedConeRadius =
    (2.5 * 5) / (2.5 + Math.hypot(2.5, 5));
  if (
    !coneComposite ||
    !closeTo(coneComposite.sphereRadius, expectedConeRadius, 1e-6) ||
    !coneComposite.contactCurveIds.includes("C_cone_contact")
  ) {
    throw new Error("Cone insphere construction is incorrect");
  }

  const updatedFaceSphere = await setComposite(
    page,
    "cube",
    "cube-face-sphere",
    { edge: 6 }
  );
  const updatedComposite = updatedFaceSphere.composites?.[0];
  if (!updatedComposite || !closeTo(updatedComposite.sphereRadius, 3)) {
    throw new Error("Parent parameter did not update the derived sphere");
  }

  await page.selectOption("#point-mode", "surface");
  await page.selectOption("#point-surface-select", "S_child_sphere");
  await page.fill("#point-surface-angle", "45");
  await page.fill("#point-surface-secondary", "30");
  await page.click("#create-exact-point-btn");
  await page.waitForTimeout(150);
  const childPoint = await page.evaluate(() => {
    const scene = window.__geometryDebug.scene();
    const point = scene.points.find(
      (item) => item.constraint?.surfaceId === "S_child_sphere"
    );
    return point
      ? { pos: point.pos, label: point.label, constraint: point.constraint }
      : null;
  });
  if (!childPoint) throw new Error("Child sphere precise point was not created");

  const contactScreenPoints = [];
  for (const id of updatedComposite.contactPointIds.slice(2, 5)) {
    const screen = await page.evaluate(
      (pointId) => window.__geometryDebug.project(pointId),
      id
    );
    if (!screen) throw new Error(`Unable to project contact point ${id}`);
    contactScreenPoints.push(screen);
  }
  await page.click('[data-tool="section"]');
  for (const screen of contactScreenPoints) {
    await page.mouse.click(screen.x, screen.y);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(180);
  const sectionResult = await page.evaluate(() => {
    const scene = window.__geometryDebug.scene();
    return {
      sectionFace: scene.faces.find((item) =>
        item.label?.startsWith("截面")
      ),
      sphereSectionCurve: scene.curves.find((item) =>
        item.label?.includes("截面圆")
      )
    };
  });
  if (!sectionResult.sectionFace) {
    throw new Error("Three-point section face was not created");
  }
  if (!sectionResult.sphereSectionCurve) {
    throw new Error("Child sphere section circle was not created");
  }

  await page.reload({ waitUntil: "networkidle" });
  const reloadResult = await page.evaluate(() => {
    const scene = window.__geometryDebug.scene();
    return {
      composite: scene.composites?.[0],
      sectionFaceCount: scene.faces.filter((item) =>
        item.label?.startsWith("截面")
      ).length,
      sphereSectionCount: scene.curves.filter((item) =>
        item.label?.includes("截面圆")
      ).length,
      relationMeasurementCount: scene.measurements.filter(
        (item) => item.type === "relation"
      ).length
    };
  });
  if (
    !reloadResult.composite ||
    reloadResult.sectionFaceCount !== 1 ||
    reloadResult.sphereSectionCount !== 1 ||
    reloadResult.relationMeasurementCount < 5
  ) {
    throw new Error(`Composite scene did not restore: ${JSON.stringify(reloadResult)}`);
  }

  await page.setViewportSize({ width: 1180, height: 820 });
  await page.waitForTimeout(300);
  const landscapeLayout = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    return {
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      canvas: canvas
        ? {
            width: canvas.width,
            height: canvas.height,
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight
          }
        : null,
      leftPanelScrollable:
        document.querySelector("#shape-panel")?.scrollHeight >
        document.querySelector("#shape-panel")?.clientHeight
    };
  });
  await page.screenshot({
    path:
      process.env.GEOMETRY_SCREENSHOT ||
      "D:/几何绘图-iPad/verification/composite-sphere.png",
    fullPage: true
  });

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(300);
  const portraitLayout = await page.evaluate(() => ({
    overflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    canvas: (() => {
      const canvas = document.querySelector("canvas");
      return canvas
        ? {
            width: canvas.width,
            height: canvas.height,
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight
          }
        : null;
    })()
  }));

  console.log(
    JSON.stringify(
      {
        faceComposite,
        edgeRadius: edgeComposite.sphereRadius,
        circumRadius: circumComposite.sphereRadius,
        cuboidRadius: cuboidComposite.sphereRadius,
        cylinderComposite,
        coneComposite,
        updatedRadius: updatedComposite.sphereRadius,
        childPoint,
        sectionResult,
        reloadResult,
        landscapeLayout,
        portraitLayout,
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
