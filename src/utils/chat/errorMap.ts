const FRIENDLY_CODE_MAP: Record<string, string> = {
  unauthorized: 'Your session expired. Please sign in again.',
  forbidden: 'You do not have access to this conversation.',
  forbidden_conversation_access: 'You do not have access to this conversation.',
  invalid_conversation: 'This conversation no longer exists.',
  rate_limited: 'Too many requests. Please try again shortly.',
};

export const mapChatErrorToMessage = (input: unknown): string => {
  const fallback = 'Something went wrong while processing chat data.';

  if (!input) return fallback;

  const maybeObj = input as {
    code?: string;
    message?: string;
    response?: { status?: number; data?: { code?: string; message?: string } };
  };

  const code =
    maybeObj.response?.data?.code ||
    maybeObj.code ||
    (typeof maybeObj.response?.data?.message === 'string'
      ? maybeObj.response?.data?.message.toLowerCase().replace(/\s+/g, '_')
      : undefined);

  if (code && FRIENDLY_CODE_MAP[code]) {
    return FRIENDLY_CODE_MAP[code];
  }

  const status = maybeObj.response?.status;
  if (status === 401) return FRIENDLY_CODE_MAP.unauthorized;
  if (status === 403) return FRIENDLY_CODE_MAP.forbidden;
  if (status === 404) return FRIENDLY_CODE_MAP.invalid_conversation;
  if (status === 429) return FRIENDLY_CODE_MAP.rate_limited;

  if (typeof maybeObj.response?.data?.message === 'string') {
    return maybeObj.response.data.message;
  }
  if (typeof maybeObj.message === 'string') {
    return maybeObj.message;
  }

  return fallback;
};
