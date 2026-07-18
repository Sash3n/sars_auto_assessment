import { describe, expect, it, vi } from "vitest";
import {
  ANTHROPIC_API_URL,
  buildExtractionRequestBody,
  CloudExtractionError,
  extractWithAnthropic,
} from "@/lib/extraction/llm";

function fakeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function successPayload(fields: unknown[]) {
  return {
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify({ fields }) }],
  };
}

describe("buildExtractionRequestBody", () => {
  it("embeds the payslip text and constrains output to the schema", () => {
    const body = buildExtractionRequestBody("Basic salary 30 000") as {
      messages: { content: string }[];
      output_config: { format: { type: string } };
      model: string;
    };
    expect(body.messages[0].content).toContain("Basic salary 30 000");
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.model).toBe("claude-opus-4-8");
  });
});

describe("extractWithAnthropic", () => {
  it("sends the request directly to the Anthropic API with the user's key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(successPayload([])));
    await extractWithAnthropic("sk-ant-test", "text", fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      ANTHROPIC_API_URL,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "sk-ant-test",
          "anthropic-dangerous-direct-browser-access": "true",
        }),
      }),
    );
  });

  it("maps returned fields to suggestions with llm source", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      fakeResponse(
        successPayload([
          {
            field: "basicSalary",
            value: "30000.00",
            confidence: 0.95,
            evidence: "Basic salary 30 000.00",
          },
          {
            field: "allowance",
            value: "500",
            label: "Cellphone",
            confidence: 0.9,
            evidence: "Cellphone allowance 500.00",
          },
          {
            field: "periodMonth",
            value: "2025-03",
            confidence: 0.9,
            evidence: "March 2025",
          },
        ]),
      ),
    );
    const suggestions = await extractWithAnthropic("sk", "text", fetchMock);
    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]).toMatchObject({
      field: "basicSalary",
      value: 30_000,
      source: "llm",
    });
    expect(suggestions[1]).toMatchObject({ label: "Cellphone", value: 500 });
  });

  it("drops invalid values instead of trusting them", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      fakeResponse(
        successPayload([
          { field: "paye", value: "not a number", confidence: 1, evidence: "x" },
          { field: "periodMonth", value: "March", confidence: 1, evidence: "x" },
          { field: "basicSalary", value: "-100", confidence: 1, evidence: "x" },
        ]),
      ),
    );
    const suggestions = await extractWithAnthropic("sk", "text", fetchMock);
    expect(suggestions).toHaveLength(0);
  });

  it("clamps out-of-range confidence", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      fakeResponse(
        successPayload([
          { field: "paye", value: "6000", confidence: 7, evidence: "x" },
        ]),
      ),
    );
    const suggestions = await extractWithAnthropic("sk", "text", fetchMock);
    expect(suggestions[0].confidence).toBe(1);
  });

  it("explains a rejected key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({}, 401));
    await expect(
      extractWithAnthropic("sk-bad", "text", fetchMock),
    ).rejects.toThrow(/key was rejected/i);
  });

  it("surfaces refusals as a friendly error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      fakeResponse({ stop_reason: "refusal", content: [] }),
    );
    await expect(extractWithAnthropic("sk", "text", fetchMock)).rejects.toThrow(
      /declined/i,
    );
  });

  it("requires a key before sending anything", async () => {
    const fetchMock = vi.fn();
    await expect(extractWithAnthropic("  ", "text", fetchMock)).rejects.toThrow(
      CloudExtractionError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("wraps network failures", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    await expect(extractWithAnthropic("sk", "text", fetchMock)).rejects.toThrow(
      /could not reach/i,
    );
  });
});
