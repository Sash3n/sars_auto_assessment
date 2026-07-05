import type { ExtractableField, FieldSuggestion } from "./types";

/*
 * Cloud LLM fallback, bring-your-own-API-key. The request goes directly from
 * the browser to the Anthropic API, never through any backend of ours. It
 * only runs after the user has explicitly consented in the modal, per
 * instance, having been told exactly what will be sent and to whom.
 */

export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_MODEL = "claude-opus-4-8";

const AMOUNT_FIELDS: ExtractableField[] = [
  "basicSalary",
  "annualBonus",
  "leavePay",
  "employeeRetirement",
  "employerRetirement",
  "employerMedicalAid",
  "paye",
  "uif",
];

/*
 * Structured output schema: the response is constrained to this shape, so
 * parsing cannot silently drift. additionalProperties false throughout.
 */
const extractionSchema = {
  type: "object",
  properties: {
    fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: {
            type: "string",
            enum: [
              "employer",
              "periodMonth",
              "basicSalary",
              "annualBonus",
              "leavePay",
              "allowance",
              "employeeRetirement",
              "employerRetirement",
              "employerMedicalAid",
              "otherFringeBenefit",
              "paye",
              "uif",
              "nonTaxDeduction",
            ],
          },
          value: { type: "string" },
          label: { type: "string" },
          confidence: { type: "number" },
          evidence: { type: "string" },
        },
        required: ["field", "value", "confidence", "evidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["fields"],
  additionalProperties: false,
} as const;

export function buildExtractionRequestBody(rawText: string): object {
  return {
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    output_config: {
      format: {
        type: "json_schema",
        schema: extractionSchema,
      },
    },
    messages: [
      {
        role: "user",
        content: `Extract South African payslip fields from the text below.

Rules:
- Amounts are plain numbers without currency symbols or separators, as strings, for example "30000.00".
- periodMonth is ISO "YYYY-MM".
- Use "allowance", "otherFringeBenefit", and "nonTaxDeduction" with a label for named list items.
- confidence is 0 to 1, your honest certainty the value is correct for that field.
- evidence quotes the exact payslip line the value came from.
- Only include fields genuinely present in the text. Never infer or invent amounts. A missing field is simply omitted.

Payslip text:
"""
${rawText}
"""`,
      },
    ],
  };
}

export class CloudExtractionError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "CloudExtractionError";
    this.status = status;
  }
}

interface RawLlmField {
  field: string;
  value: string;
  label?: string;
  confidence: number;
  evidence: string;
}

function toSuggestion(raw: RawLlmField): FieldSuggestion | null {
  const field = raw.field as ExtractableField;
  const clampedConfidence = Math.max(0, Math.min(1, raw.confidence));
  if (field === "employer") {
    return {
      field,
      value: raw.value.trim(),
      confidence: clampedConfidence,
      evidence: raw.evidence,
      source: "llm",
    };
  }
  if (field === "periodMonth") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw.value.trim())) {
      return null;
    }
    return {
      field,
      value: raw.value.trim(),
      confidence: clampedConfidence,
      evidence: raw.evidence,
      source: "llm",
    };
  }
  const amount = Number.parseFloat(raw.value.replace(/[,\s]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }
  const isListField =
    field === "allowance" ||
    field === "otherFringeBenefit" ||
    field === "nonTaxDeduction";
  if (!isListField && !AMOUNT_FIELDS.includes(field)) {
    return null;
  }
  return {
    field,
    value: Math.round(amount * 100) / 100,
    label: isListField ? raw.label || "Item" : undefined,
    confidence: clampedConfidence,
    evidence: raw.evidence,
    source: "llm",
  };
}

export async function extractWithAnthropic(
  apiKey: string,
  rawText: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FieldSuggestion[]> {
  if (apiKey.trim() === "") {
    throw new CloudExtractionError("An Anthropic API key is required.");
  }

  let response: Response;
  try {
    response = await fetchImpl(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
        // Required for direct browser calls. This is the consented,
        // backend-free flow the project spec mandates.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(buildExtractionRequestBody(rawText)),
    });
  } catch {
    throw new CloudExtractionError(
      "Could not reach the Anthropic API. Check your connection.",
    );
  }

  if (!response.ok) {
    const message =
      response.status === 401
        ? "The API key was rejected. Check it and try again."
        : response.status === 429
          ? "Rate limited by the Anthropic API. Wait a moment and try again."
          : `The Anthropic API returned an error (HTTP ${response.status}).`;
    throw new CloudExtractionError(message, response.status);
  }

  const payload = (await response.json()) as {
    stop_reason?: string;
    content?: { type: string; text?: string }[];
  };

  if (payload.stop_reason === "refusal") {
    throw new CloudExtractionError(
      "The model declined this request. Capture the fields manually instead.",
    );
  }

  const textBlock = payload.content?.find((block) => block.type === "text");
  if (!textBlock?.text) {
    throw new CloudExtractionError(
      "The model returned no usable content. Try again or capture manually.",
    );
  }

  let parsed: { fields?: RawLlmField[] };
  try {
    parsed = JSON.parse(textBlock.text) as { fields?: RawLlmField[] };
  } catch {
    throw new CloudExtractionError(
      "The model response could not be parsed. Try again or capture manually.",
    );
  }

  return (parsed.fields ?? [])
    .map(toSuggestion)
    .filter((entry): entry is FieldSuggestion => entry !== null);
}
