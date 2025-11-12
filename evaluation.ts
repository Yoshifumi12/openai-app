import "./instrumentation.ts";
import OpenAI from "openai";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { createClient } from "@arizeai/phoenix-client";
import { addSpanAnnotation } from "@arizeai/phoenix-client/spans";
import type { Annotation } from "@arizeai/phoenix-client/types/annotations";

const phoenix = createClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class EvalAnnotator {
  private tracer = trace.getTracer("openai-app");
  private useApiAnnotations = true;

  async generateAndEvaluate(theme: string, prompt: string) {
    const span = this.tracer.startSpan("llm.generation", {
      kind: 1,
      attributes: {
        "phoenix.dataset.name": "comprehensive-evals",
        theme: theme,
        "openinference.span.kind": "LLM",
      },
    });

    let content: string;
    const spanId = span.spanContext().spanId.toString();

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });

      content = response.choices[0].message.content || "";
      if (!content) throw new Error("Empty response");

      span.setAttribute(
        "llm.input_messages",
        JSON.stringify([{ role: "user", content: prompt }])
      );
      span.setAttribute(
        "llm.output_messages",
        JSON.stringify([{ role: "assistant", content }])
      );

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }

    const autoEvals = await this.runAutomaticEvals(content, theme);
    await this.addAnnotations(spanId, span, autoEvals, "model");

    const humanEvals = [
      {
        name: "human_quality_score",
        score: 0.85,
        explanation: "Good overall quality",
        evaluator: "human",
      },
      {
        name: "human_approval",
        label: "approved",
        explanation: "Meets content guidelines",
        evaluator: "human",
      },
    ];
    await this.addAnnotations(spanId, span, humanEvals, "human");

    return { content, spanId };
  }

  private async runAutomaticEvals(content: string, theme: string) {
    const [rel, qual, creat] = await Promise.all([
      this.evalRelevance(content, theme),
      this.evalQuality(content),
      this.evalCreativity(content),
    ]);
    return [...rel, ...qual, ...creat];
  }

  private async evalRelevance(content: string, theme: string) {
    return [
      {
        name: "theme_relevance",
        score: Math.random() * 0.3 + 0.7,
        explanation: `Content is relevant to theme: ${theme}`,
        evaluator: "model",
        metadata: { eval_type: "relevance" },
      },
    ];
  }

  private async evalQuality(content: string) {
    const score = content.length > 20 ? 0.8 : 0.4;
    return [
      {
        name: "content_quality",
        score,
        explanation:
          score > 0.7 ? "High quality content" : "Low quality content",
        evaluator: "model",
        metadata: { eval_type: "quality" },
      },
      {
        name: "length_appropriate",
        label: content.length > 15 ? "appropriate" : "too_short",
        explanation: `Content length: ${content.length} characters`,
        evaluator: "model",
        metadata: { eval_type: "quality" },
      },
    ];
  }

  private async evalCreativity(content: string) {
    const uniqueWords = new Set(content.toLowerCase().split(/\s+/)).size;
    const creativityScore = Math.min(uniqueWords / 10, 1.0);
    return [
      {
        name: "creativity",
        score: creativityScore,
        explanation: `Unique words ratio: ${(creativityScore * 100).toFixed(
          1
        )}%`,
        evaluator: "model",
        metadata: { eval_type: "creativity" },
      },
    ];
  }

  private async addAnnotations(
    spanId: string,
    span: any,
    annotations: any[],
    kind: string
  ) {
    let apiFailed = false;
    if (this.useApiAnnotations) {
      for (const ann of annotations) {
        const annotation: Annotation = {
          name: ann.name,
          label: ann.label,
          score: ann.score,
          explanation: ann.explanation,
          identifier: `${ann.name}_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`,
          metadata: { ...ann.metadata, evaluator: ann.evaluator, kind },
        };

        try {
          await addSpanAnnotation({
            client: phoenix,
            spanAnnotation: { spanId, ...annotation },
            sync: false,
          });
          console.log(
            `API Added: ${annotation.name} = ${
              annotation.score ?? annotation.label
            }`
          );
        } catch (err: any) {
          if (err.message.includes("404")) {
            console.warn(
              "API 404 detected — switching to attributes fallback."
            );
            this.useApiAnnotations = false;
            apiFailed = true;
            break;
          } else {
            console.error(`API Error for ${annotation.name}:`, err);
          }
        }
      }
    }

    if (!this.useApiAnnotations || apiFailed) {
      console.log("Using attributes fallback for annotations.");
      for (const ann of annotations) {
        const evalData = {
          score: ann.score,
          label: ann.label,
          explanation: ann.explanation,
          evaluator: ann.evaluator,
          kind,
          ...ann.metadata,
        };
        span.setAttribute(`eval.${ann.name}`, JSON.stringify(evalData));
        console.log(
          `Attribute Added: eval.${ann.name} = ${ann.score ?? ann.label}`
        );
      }
    }
  }
}

async function main() {
  const annotator = new EvalAnnotator();

  const testCases = [
    {
      theme: "nature",
      prompt: "Write a beautiful haiku about nature's beauty in springtime.",
    },
    {
      theme: "technology",
      prompt: "Write a short poem about artificial intelligence and humanity.",
    },
  ];

  for (const tc of testCases) {
    const { content, spanId } = await annotator.generateAndEvaluate(
      tc.theme,
      tc.prompt
    );
    console.log(`\nSpan ${spanId}: ${tc.theme}\n${content}\n`);
  }

  console.log(
    "All evals added. Check Phoenix UI: Datasets → comprehensive-evals (look for 'eval.*' columns or annotations)."
  );
}

main().then(() => new Promise((r) => setTimeout(r, 15000)));
