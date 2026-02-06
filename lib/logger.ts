const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  error: (...args: unknown[]) => {
    // Errors are logged in production for monitoring purposes
    console.error(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
};
