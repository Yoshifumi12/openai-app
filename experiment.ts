import "./instrumentation.ts";
import OpenAI from "openai";
import { trace } from "@opentelemetry/api";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function runExperiment(
  model: string, 
  prompt: string, 
  experimentName: string,
  variant: string
) {
  const tracer = trace.getTracer("openai-app");
  
  return tracer.startActiveSpan(`experiment.${experimentName}`, async (span) => {
    try {
      span.setAttribute("phoenix.experiment.name", experimentName);
      span.setAttribute("phoenix.experiment.variant", variant);
      span.setAttribute("phoenix.dataset.name", experimentName);
      
      const response = await openai.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });
      
      const content = response.choices[0].message.content;
      
      span.setAttribute("llm.model_name", model);
      span.setAttribute("llm.prompt", prompt);
      span.setAttribute("llm.output_messages", JSON.stringify([{
        role: "assistant",
        content: content
      }]));
      
      return {
        variant,
        model,
        content,
        prompt,
        usage: response.usage
      };
    } finally {
      span.end();
    }
  });
}

const experimentPrompts = [
  "Write a creative haiku about the ocean",
  "Write a technical haiku about programming",
  "Write an emotional haiku about friendship"
];

Promise.all(
  experimentPrompts.flatMap(prompt => [
    runExperiment("gpt-4o", prompt, "model-comparison", "gpt-4o"),
    runExperiment("gpt-3.5-turbo", prompt, "model-comparison", "gpt-3.5-turbo")
  ])
).then(results => {
  console.log("Experiment Results:");
  results.forEach(result => {
    console.log(`Variant: ${result.variant}`);
    console.log(`Prompt: ${result.prompt}`);
    console.log(`Response: ${result.content}`);
    console.log(`Tokens: ${result.usage?.total_tokens}`);
    console.log("---");
  });
}).then(() => new Promise(resolve => setTimeout(resolve, 10000)));