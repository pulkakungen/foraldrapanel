// Bygger panelens app-ikoner ur bella.svg. Kör med: node tools/build-icon.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const svg = fs.readFileSync('/home/user/panel/bella.svg', 'utf8');
// viewBox 0 0 768 768. Huvudet sitter i övre halvan, lite vänster om mitten.
// Klipper ut huvudet ur illustrationen. Ändra värdena om bilden byts ut.
const [cx, cy, size] = (process.argv.slice(2).length ? process.argv.slice(2) : [354, 282, 560]).map(Number);
const view = `${Math.round(cx - size / 2)} ${Math.round(cy - size / 2)} ${size} ${size}`;
const kropp = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const browser = await chromium.launch();
for (const px of [512, 192]) {
  const page = await browser.newPage({ viewport: { width: px, height: px }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0;background:#141319">
    <svg width="${px}" height="${px}" viewBox="${view}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
      style="fill-rule:evenodd;clip-rule:evenodd">${kropp}</svg></body>`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/home/user/panel/icons/icon-${px}.png` });
  await page.close();
}
await browser.close();
console.log('ikon ur bella.svg, ruta', view);
