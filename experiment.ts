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

    const countSyllables = (word: string): number => {
      word = word.toLowerCase().trim();
      if (word.length === 0) return 0;

      let cleaned = word.replace(/e$/, "");

      const exceptions: { [key: string]: number } = {
        the: 1,
        a: 1,
        i: 1,
        quiet: 2,
        fire: 2,
        hour: 2,
        breeze: 1,
        leaves: 1,
        dance: 1,
        embrace: 2,
      };
      if (exceptions[word]) return exceptions[word];

      let count = 0;
      let prevWasVowel = false;

      for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        const isVowel = /[aeiouy]/.test(char);

        if (isVowel && !prevWasVowel) {
          count++;
        }

        if (
          word.endsWith("le") &&
          word.length > 2 &&
          !/[aeiouy]/.test(word[word.length - 3])
        ) {
          count = Math.max(1, count);
        }

        prevWasVowel = isVowel;
      }

      if (word.endsWith("e") && !word.endsWith("le") && count === 0) count = 1;

      return Math.max(1, count);
    };

    const lineSyllables = lines.map((line) =>
      line
        .replace(/[,\.]/g, "")
        .split(/\s+/)
        .filter(Boolean)
        .reduce((sum, w) => sum + countSyllables(w), 0)
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
      metadata: { line_count: lines.length, lines: lines.map((l) => l.trim()) },
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
