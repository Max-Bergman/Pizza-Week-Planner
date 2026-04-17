#!/usr/bin/env node
/**
 * One-off EverOut scraper for Portland Mercury Pizza Week.
 *
 * 1. Downloads the parent Pizza Week event page and parses each "group-item" card.
 * 2. Fetches each participating slice event detail page (Referer required or EverOut returns 403).
 * 3. Geocodes street addresses via Nominatim (1 req/s — do not lower the delay).
 * 4. Writes public/data/restaurants.json
 *
 * Usage:
 *   node scripts/scrape-everout-pizza-week.mjs
 *   node scripts/scrape-everout-pizza-week.mjs --dry-run
 *   EVEROUT_PIZZA_URL="https://..." node scripts/scrape-everout-pizza-week.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_FILE = path.join(ROOT, "public", "data", "restaurants.json");
const BACKUP_FILE = path.join(ROOT, "public", "data", "restaurants.backup.json");

const PARENT_URL =
  process.env.EVEROUT_PIZZA_URL ||
  "https://everout.com/portland/events/the-portland-mercurys-pizza-week-2026/e222744/";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const GEO_DELAY_MS = 1100;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

/** JS getDay(): 0 Sun … 6 Sat — EverOut uses monday..sunday slugs */
const DAY_SLUG_TO_JS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function decodeHtmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(html) {
  return decodeHtmlEntities(
    html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  );
}

function slugifyId(slug, oid) {
  return `${slug}-e${oid}`.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").toLowerCase();
}

function parseListing(html) {
  const SPLIT = '<div class="col-xs-12 col-sm-6 col-md-4 text-center mb-4 group-item ';
  const parts = html.split(SPLIT);
  const rows = [];

  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const classMatch = seg.match(/^([^">]+)">/);
    if (!classMatch) continue;
    const classStr = `group-item ${classMatch[1]}`;

    const urlMatch = seg.match(
      /href="(https:\/\/everout\.com\/portland\/events\/([^/]+)\/(e\d+)\/)"/
    );
    if (!urlMatch) continue;
    const fullUrl = urlMatch[1];
    const slug = urlMatch[2];
    const eid = urlMatch[3].replace(/^e/, "");
    if (slug === "the-portland-mercurys-pizza-week-2026") continue;

    rows.push({ fullUrl, slug, oid: eid, classStr });
  }

  const seen = new Set();
  return rows.filter((r) => {
    if (seen.has(r.fullUrl)) return false;
    seen.add(r.fullUrl);
    return true;
  });
}

function parseDietaryAndSchedule(classStr) {
  const dietaryTags = [];
  if (classStr.includes("q-314-vegan")) {
    dietaryTags.push("vegan");
    dietaryTags.push("vegetarian");
  } else if (classStr.includes("q-314-vegetarian")) {
    dietaryTags.push("vegetarian");
  }

  const gfOffered =
    classStr.includes("q-315-yes") ||
    classStr.includes("q-315-available-same-price") ||
    classStr.includes("q-315-available-with-surcharge");
  if (gfOffered) dietaryTags.push("gluten_free");

  const closedDays = [];
  for (const [slug, jsDay] of Object.entries(DAY_SLUG_TO_JS)) {
    if (!classStr.includes(`q-473-${slug}`)) closedDays.push(jsDay);
  }
  closedDays.sort((a, b) => a - b);

  const hasSlice = classStr.includes("q-317-by-the-slice");
  const hasWhole = classStr.includes("q-317-whole-pie");
  let pizzaServing = "both";
  if (hasSlice && !hasWhole) pizzaServing = "slice";
  else if (!hasSlice && hasWhole) pizzaServing = "whole_pie";
  else if (hasSlice && hasWhole) pizzaServing = "both";
  // if neither class (unusual), keep "both"

  return { dietaryTags: [...new Set(dietaryTags)], closedDays, pizzaServing };
}

function parseDetailPage(html) {
  let imageUrl = "";
  const imgM = html.match(
    /<div class="item-image[^"]*"[^>]*>[\s\S]*?<img class="img-fluid" src="([^"]+)"/
  );
  if (imgM) imageUrl = imgM[1];

  /** Google embed uses an encoded full address — most reliable. */
  let address = "";
  const iframeM = html.match(/maps\/embed\/v1\/place[^"']+&(?:amp;)?q=([^"&']+)/);
  if (iframeM) {
    address = decodeURIComponent(iframeM[1].replace(/\+/g, " ")).trim();
  }

  let website = "";
  const venueWebM = html.match(
    /class="venue-website[^"]*"[^>]*>[\s\S]*?<a href="(https?:\/\/[^"]+)"[^>]*>/
  );
  if (venueWebM) website = venueWebM[1];

  if (!address) {
    let street = "";
    let cityLine = "";
    const locM = html.match(
      /<div class="location-info[\s\S]*?<\/h4>\s*([\s\S]*?)(?:<span class="venue-website|<\/div>\s*<\/div>\s*<div class="map")/
    );
    if (locM) {
      const inner = locM[1];
      const lines = inner
        .split(/<br\s*\/?>/i)
        .map((l) => stripTags(l))
        .filter(Boolean);
      if (lines.length >= 1) street = lines[0];
      if (lines.length >= 2) cityLine = lines[1];
    }
    address = [street, cityLine].filter(Boolean).join(", ").trim();
  }

  address = address.replace(/\s*Venue website\s*$/i, "").trim();

  const qa = [];
  const re =
    /<div class="question-text[^"]*">([^<]*)<\/div>\s*<div class="answer-text[^"]*">([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    qa.push({
      q: stripTags(m[1]),
      a: stripTags(m[2]),
    });
  }

  let venueName = "";
  const venueM = html.match(
    /<div class="location-info[\s\S]*?<a href="https:\/\/everout\.com\/portland\/locations\/[^"]+">([^<]+)<\/a>/
  );
  if (venueM) venueName = stripTags(venueM[1]);

  if (!venueName && qa.length) {
    const venueAns = qa.find((x) => x.q.includes("Where") || x.q.toLowerCase().includes("location"));
    if (venueAns) venueName = venueAns.a.split(",")[0]?.trim() ?? "";
  }

  let special = "";
  const titleM = html.match(
    /<div class="answer-list[^"]*">[\s\S]*?<div class="text-center fs-2 fw-bold[^"]*">\s*([\s\S]*?)<\/div>/
  );
  if (titleM) special = stripTags(titleM[1]);

  if (!special) {
    const og = html.match(/<meta property="og:title" content="([^"]+)"/);
    if (og) {
      special = stripTags(og[1]).split("-")[0]?.trim() ?? "";
    }
  }

  let description = "";
  const onIt = qa.find((x) => x.q.includes("On It") || x.q.includes("What's"));
  if (onIt) description = onIt.a;
  if (!description) {
    const add = html.match(
      /<div class="description additional-details[^"]*"[^>]*>\s*([\s\S]*?)<\/div>/
    );
    if (add) description = stripTags(add[1]);
  }

  return {
    venueName,
    special,
    description,
    address,
    imageUrl,
    website,
  };
}

async function fetchText(url, extraHeaders = {}) {
  const res = await fetch(url, { headers: { ...BROWSER_HEADERS, ...extraHeaders } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function geocodeAddress(query) {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    countrycodes: "us",
  });
  const url = `${NOMINATIM}?${params}`;
  const res = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      "User-Agent": "PortlandPizzaWeekScraper/1.0 (contact: local dev)",
    },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = await res.json();
  if (!data?.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Parent URL: ${PARENT_URL}`);
  console.log("Fetching parent page…");
  const parentHtml = await fetchText(PARENT_URL);
  const listing = parseListing(parentHtml);
  console.log(`Found ${listing.length} participating events.`);

  if (dryRun) {
    console.log("Dry run — first 3:");
    for (const r of listing.slice(0, 3)) {
      console.log(`  ${r.fullUrl}`);
    }
    return;
  }

  const restaurants = [];
  let i = 0;
  for (const row of listing) {
    i++;
    process.stdout.write(`\r[${i}/${listing.length}] ${row.slug}…`);
    let detailHtml;
    try {
      detailHtml = await fetchText(row.fullUrl, { Referer: PARENT_URL });
    } catch (e) {
      console.error(`\nSkip ${row.fullUrl}: ${e.message}`);
      continue;
    }

    const detail = parseDetailPage(detailHtml);
    const { dietaryTags, closedDays, pizzaServing } = parseDietaryAndSchedule(row.classStr);

    const name = detail.venueName || "Unknown venue";
    const addr = detail.address || "Portland, OR";
    await sleep(GEO_DELAY_MS);
    let lat = 45.51;
    let lng = -122.68;
    try {
      const geo = await geocodeAddress(addr.includes("Portland") ? addr : `${addr}, Portland, OR`);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
    } catch {
      /* keep default */
    }

    restaurants.push({
      id: slugifyId(row.slug, row.oid),
      name,
      address: addr,
      lat,
      lng,
      special: detail.special || row.slug.replace(/-/g, " "),
      description: detail.description || "",
      dietaryTags,
      closedDays,
      pizzaServing,
      priceSlice: 4,
      priceWhole: 25,
      website: detail.website || "",
      imageUrl: detail.imageUrl || "",
      _sourceUrl: row.fullUrl,
    });
  }

  console.log("\nWriting files…");
  if (fs.existsSync(OUT_FILE)) {
    fs.copyFileSync(OUT_FILE, BACKUP_FILE);
    console.log(`Backed up previous data → ${path.relative(ROOT, BACKUP_FILE)}`);
  }

  const out = restaurants.map(({ _sourceUrl, ...rest }) => rest);
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`Wrote ${out.length} records → ${path.relative(ROOT, OUT_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
