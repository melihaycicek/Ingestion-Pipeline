#!/usr/bin/env node
// =============================================================================
// OctoSky — Hunter (Weather Scraper)
// Codename: "Hunter"
// Deploy to: /opt/octosky/hunter.js
//
// PURPOSE:
//   A "dumb" scraper.  It launches a headless browser, navigates to the target,
//   extracts weather data for Turkish cities, and prints a JSON array to stdout.
//   It does NOT write files, connect to databases, or call APIs.
//
// OUTPUT CONTRACT (stdout):
//   Success → JSON array: [{ city, condition, tempDay, tempNight }, ...]
//   Failure → JSON object: { "error": true, "message": "...", "timestamp": "..." }
//
// PERFORMANCE (Low-RAM Guard — 4 GB VPS):
//   • Images, CSS, fonts, and media are blocked via request interception.
//   • Chromium runs with --no-sandbox, --disable-gpu, --disable-dev-shm-usage.
// =============================================================================

"use strict";

const puppeteer = require("puppeteer");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TARGET_URL = "https://www.havadurumu15gunluk.net/turkiye-iller/";
const NAVIGATION_TIMEOUT_MS = 45_000;
const BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",   // use /tmp instead of /dev/shm (critical on low-RAM)
  "--disable-extensions",
  "--disable-background-networking",
  "--single-process",          // saves ~30 MB RAM
];

// Resource types to block (bandwidth saver).
const BLOCKED_RESOURCES = new Set([
  "image",
  "stylesheet",
  "font",
  "media",
  "texttrack",
  "eventsource",
  "websocket",
  "manifest",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Outputs a structured error JSON and exits with code 0 so n8n can still
 * capture stdout without "Execute Command" treating it as a crash.
 */
function exitWithError(message) {
  const payload = {
    error: true,
    message: String(message),
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(payload));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Main Scrape Routine
// ---------------------------------------------------------------------------
async function scrape() {
  let browser = null;

  try {
    // 1. Launch headless Chromium (optimised for low RAM).
    browser = await puppeteer.launch({
      headless: "new",
      args: BROWSER_ARGS,
      defaultViewport: { width: 1280, height: 720 },
    });

    const page = await browser.newPage();

    // 2. Enable request interception — block heavy resources.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (BLOCKED_RESOURCES.has(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // 3. Set a realistic User-Agent to avoid bot-detection.
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    // 4. Navigate to the target page.
    await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    // 5. Wait for the weather table/container to render.
    //    The site uses a table with class "city-table" or similar.
    //    We use a generous selector and fall back to the body.
    await page.waitForSelector("table, .iller, .sehir-list, body", {
      timeout: 15_000,
    });

    // 6. Extract city weather rows inside the browser context.
    const results = await page.evaluate(() => {
      const data = [];

      // Strategy A: look for rows inside the main table.
      const rows = document.querySelectorAll(
        "table tbody tr, .iller-tablosu tr, .city-list tr, .sehir-list li, .il-list a"
      );

      if (rows.length > 0) {
        rows.forEach((row) => {
          const cells = row.querySelectorAll("td");
          if (cells.length >= 4) {
            data.push({
              city: (cells[0]?.innerText || "").trim(),
              condition: (cells[1]?.innerText || "").trim(),
              tempDay: (cells[2]?.innerText || "").trim(),
              tempNight: (cells[3]?.innerText || "").trim(),
            });
          }
        });
      }

      // Strategy B: if no table rows, try link-based city list.
      if (data.length === 0) {
        const links = document.querySelectorAll("a[href*='hava-durumu']");
        links.forEach((link) => {
          const text = (link.innerText || "").trim();
          if (text.length > 1 && text.length < 50) {
            data.push({
              city: text,
              condition: "",
              tempDay: "",
              tempNight: "",
            });
          }
        });
      }

      return data;
    });

    // 7. Validate we got something.
    if (!results || results.length === 0) {
      exitWithError("Scraper returned 0 results — the page structure may have changed.");
      return; // unreachable, but explicit
    }

    // 8. Print the JSON array to stdout — the ONLY output contract.
    console.log(JSON.stringify(results));
  } catch (err) {
    exitWithError(`Scraper exception: ${err.message}`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------
scrape();
