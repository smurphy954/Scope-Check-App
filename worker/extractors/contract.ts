import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { extractText, getDocumentProxy } from "unpdf";
import { getAnthropic, MODELS } from "../lib/anthropic.js";

const ContractScopeItem = z.object({
  trade: z
    .string()
    .nullable()
    .describe("Trade or scope category (e.g. tile, plumbing, framing)."),
  room_or_area: z
    .string()
    .nullable()
    .describe("Specific room or area called out in the contract, if any."),
  scope_item: z
    .string()
    .describe("The work to be performed. Specific and verifiable."),
  source_page: z
    .number()
    .int()
    .nullable()
    .describe("1-indexed page number where this item appeared."),
});

const ContractExtraction = z.object({
  scope: z.array(ContractScopeItem),
});

export type ContractScope = z.infer<typeof ContractExtraction>;

const SYSTEM_PROMPT = `You review construction contracts and scopes of work on behalf of a general contractor.

Your job: itemize every distinct piece of work the contract assigns. Tag each by trade and by room/area when the contract specifies one.

Each scope_item should be:
- Specific enough to physically verify on site (e.g. "install Schluter Kerdi membrane on shower walls" not "waterproofing")
- One discrete piece of work, not a batch ("install grab bars" and "install backing for grab bars" are separate)
- Quoted faithfully — do not invent details the contract does not state

If the contract is silent on trade or room for a given item, return null for that field. Cite the page number where each item appears.`;

export async function extractContract(
  pdfBuffer: Buffer,
): Promise<ContractScope> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
  const { text: pages, totalPages } = await extractText(pdf, {
    mergePages: false,
  });
  const pageArray = Array.isArray(pages) ? pages : [pages];

  const stripped = pageArray.map((p) => p.trim()).filter((p) => p.length > 0);
  if (stripped.length === 0) {
    // pdf-parse path failed to find text — likely a scanned contract.
    // Fall back to vision so the contract still gets analyzed.
    return await extractContractViaVision(pdfBuffer);
  }

  const numbered = pageArray
    .map((p, i) => `--- page ${i + 1} of ${totalPages} ---\n${p.trim()}`)
    .join("\n\n");

  const anthropic = getAnthropic();
  const result = await anthropic.messages.parse({
    model: MODELS.fast,
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
            type: "text",
            text: `Contract / scope of work text follows. Pages are demarcated. Itemize every distinct scope item.\n\n${numbered}`,
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ContractExtraction) },
  });

  return result.parsed_output ?? { scope: [] };
}

async function extractContractViaVision(
  pdfBuffer: Buffer,
): Promise<ContractScope> {
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
            text: "This contract appears to be scanned (text extraction was empty). Read it visually and itemize every scope item with its trade, room/area, and page.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ContractExtraction) },
  });
  return result.parsed_output ?? { scope: [] };
}
