interface ApiErrorShape {
  response?: { data?: { message?: string | string[] } };
  message?: string;
}

/** Extracts a user-facing message from an API error, including class-validator arrays. */
export function getErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as ApiErrorShape;
  const message = apiError?.response?.data?.message;
  if (Array.isArray(message)) return message.join('. ');
  if (typeof message === 'string' && message.length > 0) return message;
  return fallback;
}
