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
  const constructionButtons = await page
    .locator("#tool-grid [data-tool]")
    .count();
  const measurementButtons = await page
    .locator("#measurement-tool-grid [data-tool]")
    .count();

  await page.click('#measurement-tool-grid [data-tool="measure-length"]');
  const afterMeasurement = {
    measurementActive: await page
      .locator(
        '#measurement-tool-grid [data-tool="measure-length"]'
      )
      .evaluate((element) => element.classList.contains("active")),
    constructionActive: await page
      .locator("#tool-grid [data-tool].active")
      .count(),
    progressVisible: await page.locator("#measurement-progress").isVisible()
  };

  await page.click('#tool-grid [data-tool="line"]');
  const afterConstruction = {
    constructionActive: await page
      .locator('#tool-grid [data-tool="line"]')
      .evaluate((element) => element.classList.contains("active")),
    measurementActive: await page
      .locator("#measurement-tool-grid [data-tool].active")
      .count(),
    progressVisible: await page.locator("#measurement-progress").isVisible()
  };

  await page.screenshot({
    path: "D:/几何绘图/verification/tool-modules.png",
    fullPage: true
  });
  console.log(
    JSON.stringify(
      {
        constructionButtons,
        measurementButtons,
        afterMeasurement,
        afterConstruction,
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
