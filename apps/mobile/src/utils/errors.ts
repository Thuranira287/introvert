interface ApiErrorShape {
  response?: { data?: { message?: string | string[] } };
}

/** Extracts a user-facing message from an API error, including class-validator arrays. */
export function getErrorMessage(error: unknown, fallback: string): string {
  const message = (error as ApiErrorShape)?.response?.data?.message;
  if (Array.isArray(message)) return message.join('. ');
  if (typeof message === 'string' && message.length > 0) return message;
  return fallback;
}
