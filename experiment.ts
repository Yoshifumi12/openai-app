import { createClient } from "@arizeai/phoenix-client";
import {
  asEvaluator,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";
import type { Example } from "@arizeai/phoenix-client/types/datasets";
import OpenAI from "openai";

const phoenix = createClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const task = async (example: Example) => {
  const response = await openai.chat.completions.create({
    model: (example.metadata?.model as string) || "gpt-4o",
    messages: [
      { role: "user", content: JSON.stringify(example.input, null, 2) },
    ],
    temperature: 0.7,
  });
  return response.choices[0]?.message?.content ?? "";
};

const haikuStructure = asEvaluator({
  name: "Haiku Structure",
  kind: "LLM",
  evaluate: async ({ output }) => {
    const lines = (output as string)?.trim().split("\n").filter(Boolean);
    const syllables = (word: string) =>
      Math.max(
        1,
        word
          .toLowerCase()
          .split(/[aeiouy]+/)
          .filter(Boolean).length
      );

    const lineSyllables = lines.map((line) =>
      line.split(/\s+/).reduce((sum, w) => sum + syllables(w), 0)
    );

    const isValid =
      lines.length === 3 &&
      lineSyllables[0] === 5 &&
      lineSyllables[1] === 7 &&
      lineSyllables[2] === 5;

    return {
      score: isValid ? 1.0 : 0.0,
      label: isValid ? "valid" : "invalid",
      explanation: `Syllables: ${lineSyllables.join("-")} (expected 5-7-5)`,
      metadata: { line_count: lines.length },
    };
  },
});

runExperiment({
  dataset: {
    datasetId: "RGF0YXNldDox", 
  },
  experimentName: "gpt-4o-vs-gpt-3.5-turbo",
  client: phoenix,
  task,
  evaluators: [haikuStructure],
  });

new Promise((r) => setTimeout(r, 15000));
