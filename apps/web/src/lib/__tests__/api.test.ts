import { tokenStorage } from '../api';

describe('tokenStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null for both tokens when nothing has been stored', () => {
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });

  it('stores and retrieves both tokens together', () => {
    tokenStorage.setTokens('access-123', 'refresh-456');

    expect(tokenStorage.getAccessToken()).toBe('access-123');
    expect(tokenStorage.getRefreshToken()).toBe('refresh-456');
  });

  it('overwrites previous tokens when set again (e.g. after a refresh)', () => {
    tokenStorage.setTokens('old-access', 'old-refresh');
    tokenStorage.setTokens('new-access', 'new-refresh');

    expect(tokenStorage.getAccessToken()).toBe('new-access');
    expect(tokenStorage.getRefreshToken()).toBe('new-refresh');
  });

  it('clears both tokens on logout', () => {
    tokenStorage.setTokens('access-123', 'refresh-456');

    tokenStorage.clear();

    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });

  it('clearing when nothing was stored is a safe no-op', () => {
    expect(() => tokenStorage.clear()).not.toThrow();
  });
});
