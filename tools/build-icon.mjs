// Renderar art/panel-ikon.svg till app-ikonerna. Kör med: node tools/build-icon.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const svg = fs.readFileSync('/home/user/panel/art/panel-ikon.svg', 'utf8');
const browser = await chromium.launch();
for (const px of [512, 192]) {
  const page = await browser.newPage({ viewport: { width: px, height: px }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${px}" height="${px}" `)}</body>`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `/home/user/panel/icons/icon-${px}.png` });
  await page.close();
}
await browser.close();
console.log('ikoner ritade');
