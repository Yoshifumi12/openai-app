import "./instrumentation.ts";
import OpenAI from "openai";
import { trace } from "@opentelemetry/api";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function createCompletionWithDataset(
  messages: any[],
  datasetName: string = "haiku-test"
) {
  const tracer = trace.getTracer("openai-app");

  return tracer.startActiveSpan(
    `chat.completion.${datasetName}`,
    { kind: 1 },
    async (span) => {
      try {
        span.setAttribute("phoenix.dataset.name", datasetName);
        span.setAttribute("phoenix.dataset.split", "test");
        span.setAttribute("openinference.span.kind", "LLM");

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages,
        });

        const content = response.choices[0].message.content ?? "";

        span.setAttribute("llm.input_messages", JSON.stringify(messages));
        span.setAttribute(
          "llm.output_messages",
          JSON.stringify([{ role: "assistant", content }])
        );

        span.setStatus({ code: 1 });
        return content;
      } catch (err: any) {
        span.setStatus({ code: 2, message: err.message });
        span.recordException(err);
        throw err;
      } finally {
        span.end();
      }
    }
  );
}

const testPrompts = [
  { role: "user", content: "Write a haiku about nature." },
  { role: "user", content: "Write a haiku about technology." },
  { role: "user", content: "Write a haiku about love." },
];

Promise.all(
  testPrompts.map((p, i) =>
    createCompletionWithDataset([p], "haiku-quality-test").then((r) =>
      console.log(`Dataset row ${i + 1}:`, r)
    )
  )
).then(() => new Promise((r) => setTimeout(r, 10_000)));
