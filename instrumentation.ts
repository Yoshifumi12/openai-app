import { register, registerInstrumentations } from "@arizeai/phoenix-otel";
import OpenAI from "openai";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";

const provider = register({
  projectName: "openai-app",
  url: process.env.PHOENIX_COLLECTOR_ENDPOINT || "http://localhost:6006",
  apiKey: process.env.PHOENIX_API_KEY || "",
  batch: true,
});

const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);

registerInstrumentations({
  instrumentations: [instrumentation],
});

instrumentation.setTracerProvider(provider);
console.log("✅ OpenAI instrumentation registered");
