import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic, MODELS } from "../lib/anthropic.js";

const DrawingFinding = z.object({
  room: z
    .string()
    .nullable()
    .describe("Room or area label as written on the drawing, if any."),
  requirement: z
    .string()
    .describe(
      "The actionable requirement, note, callout, or detail reference. Be specific.",
    ),
  trade: z
    .string()
    .nullable()
    .describe(
      "Trade responsible if identifiable (e.g. framing, plumbing, tile, electrical).",
    ),
  source_sheet: z
    .string()
    .nullable()
    .describe("Sheet number / name where this was found, if visible."),
  source_detail: z
    .string()
    .nullable()
    .describe("Detail callout reference, e.g. 4/A5.01, if applicable."),
  page_number: z
    .number()
    .int()
    .nullable()
    .describe("1-indexed page number in the supplied PDF."),
});

const DrawingExtraction = z.object({
  findings: z.array(DrawingFinding),
});

export type DrawingFindings = z.infer<typeof DrawingExtraction>;

const SYSTEM_PROMPT = `You review architectural and construction drawings on behalf of a general contractor.

Your job: extract every actionable requirement that could be missed during installation — especially items that get buried inside walls, floors, and ceilings before they are inspected.

Look for:
- Notes and callouts (general notes, sheet notes, keynotes)
- Detail references (e.g. "see 4/A5.01")
- Room labels and the requirements applying to that room
- Backing / blocking, waterproofing, vapor barriers, fire-rated assemblies
- Plumbing rough-ins, electrical rough-ins, HVAC penetrations
- Finish schedules, door / window schedules, hardware sets
- Dimensions and tolerances that drive other trades

For each finding, capture the room when stated, the trade if obvious, and any sheet / detail / page reference visible in the document. If a value is not stated in the drawing, return null — do not guess.

Be thorough. It is better to record a marginal finding than to skip a real one.`;

export async function extractDrawing(
  pdfBuffer: Buffer,
): Promise<DrawingFindings> {
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
            text: "Extract every actionable requirement from this drawing set as instructed. Cite the sheet / detail / page when visible.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(DrawingExtraction) },
  });

  return result.parsed_output ?? { findings: [] };
}
