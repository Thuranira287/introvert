import { getErrorMessage } from '../errors';

describe('getErrorMessage', () => {
  it('returns the API message when present', () => {
    expect(getErrorMessage({ response: { data: { message: 'Card declined' } } }, 'fallback')).toBe('Card declined');
  });

  it('joins validation message arrays into one sentence-style string', () => {
    const error = { response: { data: { message: ['email must be valid', 'password too short'] } } };
    expect(getErrorMessage(error, 'fallback')).toBe('email must be valid. password too short');
  });

  it('falls back when the error has no API message', () => {
    expect(getErrorMessage(new Error('network'), 'Something went wrong')).toBe('Something went wrong');
  });

  it('falls back for empty messages and non-error values', () => {
    expect(getErrorMessage({ response: { data: { message: '' } } }, 'fallback')).toBe('fallback');
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
  });
});
