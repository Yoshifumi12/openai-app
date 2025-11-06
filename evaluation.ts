import "./instrumentation.ts";
import OpenAI from "openai";
import { trace } from "@opentelemetry/api";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class EvalAnnotator {
  private tracer = trace.getTracer("openai-app");

  async generateWithAutomaticEvals(theme: string, prompt: string) {
    return this.tracer.startActiveSpan("llm.generation", async (span) => {
      try {
        span.setAttribute("phoenix.dataset.name", "comprehensive-evals");
        span.setAttribute("theme", theme);

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        });

        const content = response.choices[0].message.content;

        if (!content) {
          return;
        }

        span.setAttribute(
          "llm.output_messages",
          JSON.stringify([
            {
              role: "assistant",
              content: content,
            },
          ])
        );

        const autoEvals = await this.runAutomaticEvals(content, theme);
        this.addAnnotationsToSpan(span, autoEvals);

        return {
          content,
          spanContext: span.spanContext(),
          autoEvals,
        };
      } finally {
        span.end();
      }
    });
  }

  private async runAutomaticEvals(content: string, theme: string) {
    const evalPromises = [
      this.evalRelevance(content, theme),
      this.evalQuality(content),
      this.evalCreativity(content),
    ];

    const results = await Promise.all(evalPromises);
    return results.flat();
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
        score: score,
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

  private addAnnotationsToSpan(span: any, annotations: any[]) {
    const openInferenceAnnotations = annotations.map((annotation) => ({
      name: annotation.name,
      score: annotation.score,
      label: annotation.label,
      explanation: annotation.explanation,
      metadata: annotation.metadata,
    }));

    span.setAttribute(
      "openinference.annotations",
      JSON.stringify(openInferenceAnnotations)
    );
  }

  async addHumanEvaluation(spanId: string, humanEvals: any[]) {
    console.log(`Adding human evaluations to span ${spanId}:`, humanEvals);
  }
}

async function runComprehensiveExample() {
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

  const results = await Promise.all(
    testCases.map((testCase) =>
      annotator.generateWithAutomaticEvals(testCase.theme, testCase.prompt)
    )
  );

  console.log("=== COMPREHENSIVE EVALUATIONS ===");
  results.forEach((result, index) => {
    console.log(`\n--- Test Case ${index + 1} ---`);
    console.log(`Theme: ${testCases[index].theme}`);
    console.log(`Content: ${result?.content}`);
    console.log("Automatic Evaluations:");
    result?.autoEvals.forEach((evals: any) => {
      if (evals.score !== undefined) {
        console.log(
          `  ✅ ${evals.name}: ${evals.score.toFixed(2)} - ${evals.explanation}`
        );
      } else {
        console.log(
          `  ✅ ${evals.name}: ${evals.label} - ${evals.explanation}`
        );
      }
    });

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
    if (result) {
      annotator.addHumanEvaluation(result.spanContext.spanId, humanEvals);
    }
  });
}

runComprehensiveExample().then(
  () => new Promise((resolve) => setTimeout(resolve, 15000))
);
