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
  await page.waitForTimeout(200);

  const viewport = await page.locator("#viewport").boundingBox();
  const before = await page.evaluate(() => window.__geometryDebug.camera());
  const startX = viewport.x + viewport.width * 0.55;
  const startY = viewport.y + viewport.height * 0.55;

  await page.mouse.move(startX, startY);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(startX + 120, startY + 65, { steps: 8 });
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.__geometryDebug.camera());

  const targetDelta = after.target.map(
    (value, index) => value - before.target[index]
  );
  const targetMoved = after.target.some(
    (value, index) => Math.abs(value - before.target[index]) > 0.01
  );

  await page.screenshot({
    path: "D:/几何绘图/verification/right-pan.png",
    fullPage: true
  });
  console.log(
    JSON.stringify(
      {
        before,
        after,
        targetMoved,
        targetDelta,
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
