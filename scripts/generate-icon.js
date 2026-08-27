#!/usr/bin/env node
/**
 * Wrexlyn for Investments — Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * See LICENSE for details.
 *
 * Renders public/icon.svg into the Windows .ico (used by the Inno Setup
 * installer's Desktop/Start Menu shortcuts) and macOS .icns (used by
 * install.sh's .app launcher on Darwin) — same self-contained approach as
 * coding-agent/scripts/generate-icon.js, ported here so this app's icon
 * doesn't depend on that repo's build tooling. Re-run this after editing
 * public/icon.svg; requires `npm install puppeteer` (devDependency) first.
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "public", "icon.svg");
const icoPath = path.join(root, "installer", "windows", "wrexlyn-investments.ico");
const icnsPath = path.join(root, "installer", "macos", "wrexlyn-investments.icns");
const ICO_SIZES = [16, 32, 48, 256];
// Only the modern, unambiguously-documented PNG-payload ICNS type codes (ic07 and up) —
// macOS downsamples fine from these for Dock/Finder small sizes.
const ICNS_TYPES = [
  { size: 32, type: "ic11" },
  { size: 64, type: "ic12" },
  { size: 128, type: "ic07" },
  { size: 256, type: "ic08" },
  { size: 512, type: "ic09" },
  { size: 1024, type: "ic10" },
];

async function renderPng(page, svg, size) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<style>*{box-sizing:border-box}html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    { waitUntil: "load" }
  );
  return page.screenshot({ type: "png", omitBackground: true });
}

/** Packs PNG-format images into a valid .ico container (modern Windows accepts a raw PNG payload per entry). */
function buildIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  let offset = 6 + count * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...dirEntries, ...images.map((i) => i.data)]);
}

/** Packs PNG-format images into a valid .icns container (Apple Icon Services layout). */
function buildIcns(images) {
  const chunks = images.map(({ type, data }) => {
    const chunkHeader = Buffer.alloc(8);
    chunkHeader.write(type, 0, 4, "ascii");
    chunkHeader.writeUInt32BE(8 + data.length, 4);
    return Buffer.concat([chunkHeader, data]);
  });
  const body = Buffer.concat(chunks);
  const fileHeader = Buffer.alloc(8);
  fileHeader.write("icns", 0, 4, "ascii");
  fileHeader.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([fileHeader, body]);
}

async function main() {
  const svg = fs.readFileSync(sourcePath, "utf8");
  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();

    const icoImages = [];
    for (const size of ICO_SIZES) {
      icoImages.push({ size, data: await renderPng(page, svg, size) });
    }
    fs.mkdirSync(path.dirname(icoPath), { recursive: true });
    fs.writeFileSync(icoPath, buildIco(icoImages));

    const icnsImages = [];
    for (const { size, type } of ICNS_TYPES) {
      icnsImages.push({ type, data: await renderPng(page, svg, size) });
    }
    fs.mkdirSync(path.dirname(icnsPath), { recursive: true });
    fs.writeFileSync(icnsPath, buildIcns(icnsImages));
  } finally {
    await browser.close();
  }

  console.log(`Wrote ${icoPath}`);
  console.log(`Wrote ${icnsPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
