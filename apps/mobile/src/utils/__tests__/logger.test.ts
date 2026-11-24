import { logger } from '../logger';

describe('logger', () => {
  afterEach(() => jest.restoreAllMocks());

  it('writes errors to the console in development', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure = new Error('boom');

    logger.error('Something failed', failure);

    expect(spy).toHaveBeenCalledWith('Something failed', failure);
  });

  it('writes log messages to the console in development', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    logger.log('hello', 1);

    expect(spy).toHaveBeenCalledWith('hello', 1);
  });

  it('stays silent when not in development', () => {
    const globals = globalThis as unknown as { __DEV__: boolean };
    const original = globals.__DEV__;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    globals.__DEV__ = false;
    try {
      logger.error('quiet', new Error('x'));
      logger.log('quiet');
    } finally {
      globals.__DEV__ = original;
    }

    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });
});
