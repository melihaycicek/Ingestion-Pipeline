// =============================================================================
// Node B — Build AI Prompt for Ollama (Phi-3)
// =============================================================================
// n8n Node Type : Code (JavaScript)
// Runs after    : Node A (Parse stdout)
//
// PURPOSE:
//   Constructs a single batch prompt that asks the local Ollama Phi-3 model
//   to generate a short, helpful suggestion for each city based on its
//   current weather condition and temperatures.
//
// OUTPUT:
//   A JSON item with a `prompt` string ready to be sent to the Ollama
//   HTTP Request node (POST http://localhost:11434/api/generate).
// =============================================================================

const input = $input.first().json;

// 1. Guard against upstream errors.
if (input.error) {
  return [{ json: input }]; // pass-through the error
}

const cities = input.cities;

// 2. Build a compact city summary block for the prompt.
//    We batch ALL cities into a single prompt to minimise Ollama round-trips.
const citySummaries = cities.map((c, i) => {
  return `${i + 1}. ${c.city}: ${c.condition || "N/A"}, ` +
         `Day ${c.tempDay || "?"}°C / Night ${c.tempNight || "?"}°C`;
}).join("\n");

// 3. Construct the system + user prompt.
const prompt = `You are a concise weather advisor. For each Turkish city listed below, write ONE short suggestion (max 15 words) about what people should wear or do today. Respond ONLY with valid JSON — an array of objects like: [{"city":"CityName","suggestion":"..."}]. No markdown, no explanation.

Cities:
${citySummaries}`;

// 4. Return the prompt and the Ollama request body.
return [{
  json: {
    // Pass the original data downstream for merging in Node C.
    _originalCities: cities,
    _scrapedAt: input.scrapedAt,

    // Ollama /api/generate request body.
    ollamaPayload: {
      model: "phi3",
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.5,
        num_predict: 2048,   // enough for ~81 cities × 15 words
      },
    },
  }
}];

// -----------------------------------------------------------------------
// n8n HTTP Request Node Configuration (next node after this Code node):
//   Method : POST
//   URL    : http://localhost:11434/api/generate
//   Body   : JSON  →  {{ $json.ollamaPayload }}
//   Headers: Content-Type: application/json
// -----------------------------------------------------------------------
