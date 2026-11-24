declare const __DEV__: boolean;

export const logger = {
  error(message: string, error?: unknown) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error(message, error);
    }
  },

  log(message: string, ...args: unknown[]) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(message, ...args);
    }
  },
};
