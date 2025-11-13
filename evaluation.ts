import "./instrumentation.ts";
import { createClassifierFn } from "@arizeai/phoenix-evals";
import { openai as openAISDK } from "@ai-sdk/openai";
import OpenAI from "openai";

async function main() {
  const model = openAISDK("gpt-4o");
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

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const input = "What is the capital of France?";
  const output = openai.chat.completions
    .create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: input,
        },
      ],
    })
    .then((response) => {
      return response.choices[0]?.message?.content ?? "";
    });

  const result = await evaluator({
    output: await output,
    input: input,
    reference:
      "France's capital city is Paris, known for its art, fashion, gastronomy, and culture.",
  });

  console.log("Evaluation Result:", result);
}

main().then(() => new Promise((r) => setTimeout(r, 15000)));
