import "./instrumentation.ts";
import OpenAI from "openai";
import { trace } from "@opentelemetry/api";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function createCompletionWithDataset(
  messages: any[], 
  datasetName: string = "haiku-test"
) {
  const tracer = trace.getTracer("openai-app");
  
  return tracer.startActiveSpan(`chat.completion.${datasetName}`, async (span) => {
    try {
      span.setAttribute("phoenix.dataset.name", datasetName);
      span.setAttribute("phoenix.dataset.split", "test");
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
      });
      
      const content = response.choices[0].message.content;
      
      span.setAttribute("llm.output_messages", JSON.stringify([{
        role: "assistant",
        content: content
      }]));
      
      return content;
    } finally {
      span.end();
    }
  });
}

const testPrompts = [
  { role: "user", content: "Write a haiku about nature." },
  { role: "user", content: "Write a haiku about technology." },
  { role: "user", content: "Write a haiku about love." },
];

Promise.all(
  testPrompts.map((prompt, index) => 
    createCompletionWithDataset([prompt], "haiku-quality-test")
      .then(response => {
        console.log(`Test ${index + 1}:`, response);
        return response;
      })
  )
).then(() => new Promise(resolve => setTimeout(resolve, 10000)));