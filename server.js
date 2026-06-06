const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.post("/parse-ingredients", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided" });

  const prompt = `You extract pantry ingredients from natural spoken speech and return ONLY a JSON array. No preamble, no explanation, no markdown backticks.

Each item must have:
- "name": clean ingredient name (e.g. "Chicken breast", "Greek yoghurt", "Olive oil")
- "qty": quantity with unit if mentioned (e.g. "500g", "2", "1 litre") or "1" if not stated
- "category": one of exactly: Fridge, Freezer, Pantry, Produce, Dairy, Meat, Spices, Other

Infer the category if not stated (e.g. milk → Dairy, chicken → Fridge, pasta → Pantry, spinach → Produce).
Handle natural speech like "I've got some chicken in the fridge", "a couple of eggs", "half a kilo of mince".
Return [] if no ingredients found.

Speech to parse: ${text}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    res.json({ ingredients: parsed });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to parse ingredients" });
  }
});

app.get("/", (req, res) => res.send("Pantry API running ✓"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
