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
  await page.click("#create-shape-btn");
  await page.waitForTimeout(250);

  const pointA = await page.evaluate(() =>
    window.__geometryDebug.project("A")
  );
  await page.mouse.move(pointA.x + 14, pointA.y + 8);
  await page.waitForTimeout(250);
  const pointHover = {
    text: await page.locator("#hover-chip").textContent(),
    snappedClass: await page
      .locator("#hover-chip")
      .evaluate((element) => element.classList.contains("snap")),
    snap: await page.evaluate(
      ([x, y]) => window.__geometryDebug.snap(x, y),
      [pointA.x + 14, pointA.y + 8]
    )
  };
  await page.screenshot({
    path: "D:/几何绘图/verification/point-snap.png",
    fullPage: true
  });
  await page.mouse.click(pointA.x + 14, pointA.y + 8);
  await page.waitForTimeout(150);
  const pointSelection = await page.locator("#selection-title").textContent();

  const edgeAB = await page.evaluate(() =>
    window.__geometryDebug.project("AB")
  );
  await page.mouse.move(edgeAB.x, edgeAB.y + 9);
  await page.waitForTimeout(250);
  const edgeHover = {
    text: await page.locator("#hover-chip").textContent(),
    snappedClass: await page
      .locator("#hover-chip")
      .evaluate((element) => element.classList.contains("snap")),
    snap: await page.evaluate(
      ([x, y]) => window.__geometryDebug.snap(x, y),
      [edgeAB.x, edgeAB.y + 9]
    )
  };
  await page.mouse.click(edgeAB.x, edgeAB.y + 9);
  await page.waitForTimeout(150);
  const edgeSelection = await page.locator("#selection-title").textContent();

  console.log(
    JSON.stringify(
      {
        pointHover,
        pointSelection,
        edgeHover,
        edgeSelection,
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
