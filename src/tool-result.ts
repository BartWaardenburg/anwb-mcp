import { AnwbApiError } from "./anwb-client.js";

export const toTextResult = (
  text: string,
  structuredContent?: Record<string, unknown>,
) => ({
  content: [{ type: "text" as const, text }],
  ...(structuredContent ? { structuredContent } : {}),
});

const getRecoverySuggestion = (status: number, message: string, _details: unknown): string | null => {
  if (status === 429) {
    return "Rate limit exceeded. Wait a moment and retry, or reduce the frequency of API calls.";
  }

  if (status === 404) {
    const lower = message.toLowerCase();
    if (lower.includes("route") || lower.includes("location")) {
      return "Route or location not found. Verify the coordinates or search query are correct.";
    }
    return "Resource not found. Verify the request parameters are correct.";
  }

  if (status === 401 || status === 403) {
    return "Authentication failed. The ANWB API may have changed its access requirements.";
  }

  if (status === 400) {
    return "Invalid request. Check that coordinates are valid (latitude,longitude format) and all parameters are in the correct format.";
  }

  if (status >= 500) {
    return "ANWB API server error. This is a temporary issue. Wait a moment and retry.";
  }

  return null;
};

export const toErrorResult = (error: unknown) => {
  if (error instanceof AnwbApiError) {
    const suggestion = getRecoverySuggestion(error.status, error.message, error.details);

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `ANWB API error: ${error.message}`,
            `Status: ${error.status}`,
            error.details ? `Details: ${JSON.stringify(error.details, null, 2)}` : "",
            suggestion ? `\nRecovery: ${suggestion}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: error instanceof Error ? error.message : String(error),
      },
    ],
    isError: true,
  };
};
