import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic, MODELS } from "../lib/anthropic.js";

const SubmittalProduct = z.object({
  product: z
    .string()
    .nullable()
    .describe("Product name or category, e.g. 'shower drain', 'grab bar'."),
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  spec_section: z
    .string()
    .nullable()
    .describe("CSI spec section if referenced (e.g. 09 30 00)."),
  install_requirements: z
    .string()
    .nullable()
    .describe(
      "Install / rough-in requirements pulled from the submittal: backing, framing, water supply, drain, clearances, etc.",
    ),
  room_or_area: z
    .string()
    .nullable()
    .describe("Room or area the submittal targets, if specified."),
});

const SubmittalExtraction = z.object({
  products: z.array(SubmittalProduct),
});

export type SubmittalExtractionResult = z.infer<typeof SubmittalExtraction>;

const SYSTEM_PROMPT = `You review product submittals on behalf of a general contractor.

A submittal package may cover one or many products. For each distinct product, capture:
- product name / category
- manufacturer
- model number
- CSI spec section (if cited)
- install / rough-in requirements that affect adjacent trades — backing height, water supply size, drain size, blocking, clearances, electrical needs, etc.
- the specific room or area the submittal targets, if stated

Read both visible labels and printed text. If a value is not present in the submittal, return null. Do not infer manufacturer or model from prior knowledge — only what is stated in the document.`;

export async function extractSubmittal(
  pdfBuffer: Buffer,
): Promise<SubmittalExtractionResult> {
  const anthropic = getAnthropic();
  const result = await anthropic.messages.parse({
    model: MODELS.vision,
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBuffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: "Extract every product covered by this submittal package as instructed.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(SubmittalExtraction) },
  });

  return result.parsed_output ?? { products: [] };
}
