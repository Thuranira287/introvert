const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  error(message: string, error?: unknown) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.error(message, error);
    }
  },

  warn(message: string, ...args: unknown[]) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.warn(message, ...args);
    }
  },
};
