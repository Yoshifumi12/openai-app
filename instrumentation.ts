import { register } from "@arizeai/phoenix-otel";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";

register({
  projectName: "openai-app",
  instrumentations: [
    new OpenAIInstrumentation(), 
  ],
});

console.log("OpenAI instrumentation registered");