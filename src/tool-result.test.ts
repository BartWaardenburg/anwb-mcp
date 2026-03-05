import { describe, it, expect } from "vitest";
import { toTextResult, toErrorResult } from "./tool-result.js";
import { AnwbApiError } from "./anwb-client.js";

describe("toTextResult", () => {
  it("returns text content", () => {
    const result = toTextResult("hello");
    expect(result).toEqual({
      content: [{ type: "text", text: "hello" }],
    });
  });

  it("includes structured content when provided", () => {
    const result = toTextResult("hello", { key: "value" });
    expect(result).toEqual({
      content: [{ type: "text", text: "hello" }],
      structuredContent: { key: "value" },
    });
  });

  it("omits structuredContent when not provided", () => {
    const result = toTextResult("hello");
    expect(result).not.toHaveProperty("structuredContent");
  });
});

describe("toErrorResult", () => {
  it("formats AnwbApiError with status and details", () => {
    const error = new AnwbApiError("Not found", 404, { code: "NOT_FOUND" });
    const result = toErrorResult(error);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("ANWB API error");
    expect(result.content[0].text).toContain("404");
    expect(result.content[0].text).toContain("NOT_FOUND");
  });

  it("formats AnwbApiError without details", () => {
    const error = new AnwbApiError("Server error", 500);
    const result = toErrorResult(error);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("500");
    expect(result.content[0].text).not.toContain("Details:");
  });

  it("formats generic Error", () => {
    const result = toErrorResult(new Error("something broke"));

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("something broke");
  });

  it("formats non-Error values", () => {
    const result = toErrorResult("string error");

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("string error");
  });

  it("includes rate limit recovery suggestion for 429", () => {
    const error = new AnwbApiError("Rate limit exceeded", 429);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("Rate limit exceeded");
  });

  it("includes route not found recovery suggestion for 404", () => {
    const error = new AnwbApiError("Route not found", 404);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("coordinates");
  });

  it("includes location not found recovery suggestion for 404", () => {
    const error = new AnwbApiError("Location not found", 404);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("coordinates");
  });

  it("includes generic 404 recovery suggestion", () => {
    const error = new AnwbApiError("Not found", 404);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("Resource not found");
  });

  it("includes auth recovery suggestion for 401", () => {
    const error = new AnwbApiError("Unauthorized", 401);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("Authentication");
  });

  it("includes validation recovery suggestion for 400", () => {
    const error = new AnwbApiError("Bad request", 400);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("coordinates");
  });

  it("includes server error recovery suggestion for 500", () => {
    const error = new AnwbApiError("Internal server error", 500);
    const result = toErrorResult(error);

    expect(result.content[0].text).toContain("Recovery:");
    expect(result.content[0].text).toContain("temporary issue");
  });

  it("returns no recovery suggestion for unrecognized status codes", () => {
    const error = new AnwbApiError("I'm a teapot", 418);
    const result = toErrorResult(error);

    expect(result.content[0].text).not.toContain("Recovery:");
  });
});
