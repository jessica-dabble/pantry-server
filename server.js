const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function callClaude(system, user) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await response.json();
  console.log("Claude response:", JSON.stringify(data).slice(0, 300));
  return data.content?.[0]?.text || "";
}

app.post("/parse-ingredients", async (req, res) => {
  const { text } = req.body;
  console.log("parse-ingredients called, text:", text);
  if (!text) return res.status(400).json({ error: "No text provided" });

  try {
    const raw = await callClaude(
      `You extract pantry ingredients from natural spoken speech and return ONLY a JSON array. No preamble, no explanation, no markdown backticks.

Each item must have:
- "name": clean ingredient name (e.g. "Chicken breast", "Greek yoghurt", "Olive oil")
- "qty": quantity with unit if mentioned. Accept any natural form: "500g", "2 bottles", "1 packet", "3 tins", "half a kilo", "a dozen", "2L", "a bunch", "3 cans", "2 sachets", "1 jar", "a loaf". Use "1" if not stated.
- "category": one of exactly: Fridge, Freezer, Pantry, Produce, Dairy, Meat, Spices, Other
- "expiry": expiry date in YYYY-MM-DD format if mentioned (e.g. "expires next Friday", "use by 15th June", "expiry June 20"). Leave as empty string "" if not mentioned.

Infer the category if not stated (e.g. milk → Dairy, chicken → Fridge, pasta → Pantry, spinach → Produce).
Handle natural speech like "I've got some chicken in the fridge expiring Friday", "a couple of eggs use by the 10th", "half a kilo of mince".
Today's date is ${new Date().toISOString().slice(0, 10)}.
Return [] if no ingredients found.`,
      text
    );

    const cleaned = raw.replace(/```json|```/g, "").trim();
    console.log("Raw text:", cleaned);
    const parsed = JSON.parse(cleaned);
    res.json({ ingredients: parsed });

  } catch (err) {
    console.error("parse-ingredients error:", err);
    res.status(500).json({ error: "Failed to parse ingredients: " + err.message });
  }
});

app.post("/smart-search", async (req, res) => {
  const { query, ingredients } = req.body;
  console.log("smart-search called, query:", query);
  if (!query || !ingredients) return res.status(400).json({ error: "Missing query or ingredients" });

  try {
    const raw = await callClaude(
      `You are a pantry assistant. Given a search concept and a list of ingredients, return ONLY a JSON array of ingredient names that match the concept. No preamble, no explanation, no markdown.

Examples:
- concept "grains" → ["Rice", "Pasta", "Oats", "Quinoa", "Bread"]
- concept "protein" → ["Chicken breast", "Eggs", "Greek yoghurt", "Tuna", "Lentils"]
- concept "dairy" → ["Milk", "Cheese", "Butter", "Greek yoghurt"]
- concept "vegetables" → ["Spinach", "Broccoli", "Tomatoes", "Carrots"]

Return [] if nothing matches. Only return names that are in the provided ingredient list.`,
      `Search concept: "${query}"\nIngredient list: ${ingredients}`
    );
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const matches = JSON.parse(cleaned);
    res.json({ matches });
  } catch (err) {
    console.error("smart-search error:", err);
    res.status(500).json({ matches: [] });
  }
});

app.post("/suggest-recipes", async (req, res) => {
  const { ingredients } = req.body;
  console.log("suggest-recipes called");
  if (!ingredients) return res.status(400).json({ error: "No ingredients provided" });

  try {
    const text = await callClaude(
      `You are a warm, practical nutritionist-chef. The user focuses on high-protein, anti-inflammatory, fertility-supportive eating: 130–150g protein/day, high fibre, ~7500 kJ daily cap. Suggest 3 recipes using their pantry ingredients. For each: recipe name, ingredients used, approx protein per serve, and a 3-sentence method. Metric units only.`,
      `My pantry: ${ingredients}. What 3 recipes can I make?`
    );
    res.json({ recipes: text });
  } catch (err) {
    console.error("suggest-recipes error:", err);
    res.status(500).json({ error: "Failed to suggest recipes: " + err.message });
  }
});

app.get("/", (req, res) => res.send("Pantry API running ✓"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
