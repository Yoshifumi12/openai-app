import { register, registerInstrumentations } from "@arizeai/phoenix-otel";
import OpenAI from "openai";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";

const provider = register({
  projectName: "openai-app",
  instrumentations: [new OpenAIInstrumentation()],
});

const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);

registerInstrumentations({
  instrumentations: [instrumentation],
});

instrumentation.setTracerProvider(provider);
console.log("✅ OpenAI instrumentation registered");
