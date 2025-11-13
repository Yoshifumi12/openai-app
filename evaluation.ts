import "./instrumentation.ts";
import { createClassifierFn } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

async function main() {
  const model = openai("gpt-4o");

  const promptTemplate = `
In this task, you will be presented with a query, a reference text and an answer. The answer is
generated to the question based on the reference text. The answer may contain false information. You
must use the reference text to determine if the answer to the question contains false information,
if the answer is a hallucination of facts. Your objective is to determine whether the answer text
contains factual information and is not a hallucination. A 'hallucination' refers to
an answer that is not based on the reference text or assumes information that is not available in
the reference text. Your response should be a single word: either "factual" or "hallucinated", and
it should not include any other text or characters.

    [BEGIN DATA]
    ************
    [Query]: {{input}}
    ************
    [Reference text]: {{reference}}
    ************
    [Answer]: {{output}}
    ************
    [END DATA]

Is the answer above factual or hallucinated based on the query and reference text?
`;

  const evaluator = await createClassifierFn({
    model,
    choices: { factual: 1, hallucinated: 0 },
    promptTemplate: promptTemplate,
  });

  const result = await evaluator({
    output: "Arize is not open source.",
    input: "Is Arize Phoenix Open Source?",
    reference:
      "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
  });

  console.log("Evaluation Result:", result);
}

main().then(() => new Promise((r) => setTimeout(r, 15000)));
