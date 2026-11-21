const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  const errors = [];
  const requestHosts = new Set();

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    requestHosts.add(new URL(request.url()).host);
  });

  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });

  const expectedCounts = {
    cube: 26,
    cuboid: 26,
    tetra: 14,
    triPyramid: 14,
    quadPyramid: 18,
    triPrism: 20
  };
  const shapeResults = {};

  for (const [shape, expected] of Object.entries(expectedCounts)) {
    await page.selectOption("#shape-select", shape);
    await page.click("#create-shape-btn");
    await page.waitForTimeout(180);
    shapeResults[shape] = {
      title: await page.locator("#scene-title").textContent(),
      count: await page.locator(".object-row").count(),
      expected
    };
  }

  await page.selectOption("#shape-select", "triPyramid");
  await page.fill("input[data-param=base]", "4");
  await page.fill("input[data-param=lateral]", "2");
  await page.click("#create-shape-btn");
  await page.waitForTimeout(120);
  const invalidMessage = await page.locator("#shape-message").textContent();

  const jsonDownload = page.waitForEvent("download");
  await page.click("#save-btn");
  const jsonFile = await jsonDownload;

  const pngDownload = page.waitForEvent("download");
  await page.click("#export-btn");
  const pngFile = await pngDownload;

  const titleBeforeReload = await page.locator("#scene-title").textContent();
  await page.reload({ waitUntil: "networkidle" });
  const titleAfterReload = await page.locator("#scene-title").textContent();

  console.log(
    JSON.stringify(
      {
        shapeResults,
        invalidMessage,
        jsonFilename: jsonFile.suggestedFilename(),
        pngFilename: pngFile.suggestedFilename(),
        titleBeforeReload,
        titleAfterReload,
        requestHosts: [...requestHosts],
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
