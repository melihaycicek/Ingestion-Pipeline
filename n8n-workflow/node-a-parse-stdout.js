// =============================================================================
// Node A — Parse Scraper stdout
// =============================================================================
// n8n Node Type : Code (JavaScript)
// Runs after    : "Execute Command" node that calls `node /opt/octosky/hunter.js`
//
// The "Execute Command" node produces an item with a `stdout` string property.
// This node parses that string into a usable JSON array for downstream nodes.
// =============================================================================

// 1. Grab the raw stdout from the previous "Execute Command" node.
const rawStdout = $input.first().json.stdout;

// 2. Safety check — make sure we have output.
if (!rawStdout || rawStdout.trim().length === 0) {
  return [{
    json: {
      error: true,
      message: "Hunter returned empty stdout.",
      timestamp: new Date().toISOString(),
    }
  }];
}

// 3. Parse the JSON string.
let parsed;
try {
  parsed = JSON.parse(rawStdout.trim());
} catch (err) {
  return [{
    json: {
      error: true,
      message: `Failed to parse Hunter output: ${err.message}`,
      raw: rawStdout.substring(0, 500), // truncate for debugging
      timestamp: new Date().toISOString(),
    }
  }];
}

// 4. Check if the scraper itself reported an error.
if (parsed.error) {
  return [{
    json: {
      error: true,
      message: parsed.message || "Unknown scraper error.",
      timestamp: parsed.timestamp || new Date().toISOString(),
    }
  }];
}

// 5. Validate we got an array of city objects.
if (!Array.isArray(parsed) || parsed.length === 0) {
  return [{
    json: {
      error: true,
      message: "Parsed output is not a non-empty array.",
      timestamp: new Date().toISOString(),
    }
  }];
}

// 6. Return the array wrapped for n8n — one item with the full cities array,
//    plus individual items for per-city processing downstream.
return [{
  json: {
    scrapedAt: new Date().toISOString(),
    totalCities: parsed.length,
    cities: parsed,   // full array — used by Node C and the DB insert
  }
}];
