// =============================================================================
// Node C — Merge Weather Data + AI Suggestions
// =============================================================================
// n8n Node Type : Code (JavaScript)
// Runs after    : HTTP Request node (Ollama response)
//
// PURPOSE:
//   Merges the original scraped city data with the AI-generated suggestions.
//   Produces the final payload used for:
//     1. Writing /var/www/html/weather.json  (Write File node)
//     2. Inserting into PostgreSQL            (Postgres node)
// =============================================================================

const input = $input.first().json;

// 1. Retrieve the original cities array (passed through from Node B).
const originalCities = input._originalCities || [];
const scrapedAt      = input._scrapedAt || new Date().toISOString();

// 2. Parse the Ollama response.
//    The Ollama /api/generate endpoint returns { response: "..." }.
let aiSuggestions = [];
try {
  const raw = input.response || input.body?.response || "";

  // Ollama may wrap the JSON in markdown code fences — strip them.
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  aiSuggestions = JSON.parse(cleaned);

  if (!Array.isArray(aiSuggestions)) {
    aiSuggestions = [];
  }
} catch (err) {
  // If AI response is unparseable, continue without suggestions.
  aiSuggestions = [];
}

// 3. Build a lookup map: city name → suggestion.
const suggestionMap = {};
aiSuggestions.forEach((item) => {
  if (item.city && item.suggestion) {
    suggestionMap[item.city.toLowerCase().trim()] = item.suggestion;
  }
});

// 4. Merge: enrich each city object with its AI suggestion.
const enrichedCities = originalCities.map((city) => {
  const key = (city.city || "").toLowerCase().trim();
  return {
    ...city,
    suggestion: suggestionMap[key] || "Hava durumuna göre giyinin.",
  };
});

// 5. Build the final JSON payload.
const finalPayload = {
  generatedAt: new Date().toISOString(),
  scrapedAt: scrapedAt,
  totalCities: enrichedCities.length,
  cities: enrichedCities,
};

// 6. Return items for downstream nodes.
return [{
  json: {
    // For the "Write File" node → write this string to /var/www/html/weather.json
    fileContent: JSON.stringify(finalPayload, null, 2),

    // For the PostgreSQL node → structured columns
    dbRecord: {
      scraped_at: scrapedAt,
      source_url: "havadurumu15gunluk.net",
      cities: JSON.stringify(enrichedCities),          // JSONB column
      ai_suggestions: JSON.stringify(aiSuggestions),   // JSONB column
      metadata: JSON.stringify({
        enriched: aiSuggestions.length > 0,
        totalCities: enrichedCities.length,
      }),
    },
  }
}];

// -----------------------------------------------------------------------
// Downstream node config hints:
//
// ► Write File Node
//   File Path : /var/www/html/weather.json
//   Content   : {{ $json.fileContent }}
//
// ► PostgreSQL Node
//   Operation : Insert
//   Schema    : weather
//   Table     : weather_logs
//   Columns   : scraped_at, source_url, cities, ai_suggestions, metadata
//   Values from: {{ $json.dbRecord.scraped_at }}, etc.
// -----------------------------------------------------------------------
