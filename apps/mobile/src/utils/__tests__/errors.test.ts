import { getErrorMessage } from '../errors';

describe('getErrorMessage', () => {
  it('returns the API message when present', () => {
    expect(getErrorMessage({ response: { data: { message: 'Card declined' } } }, 'fallback')).toBe('Card declined');
  });

  it('joins validation message arrays', () => {
    const error = { response: { data: { message: ['email must be valid', 'password too short'] } } };
    expect(getErrorMessage(error, 'fallback')).toBe('email must be valid. password too short');
  });

  it('falls back for errors without an API message', () => {
    expect(getErrorMessage(new Error('network'), 'Something went wrong')).toBe('Something went wrong');
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
  });
});
