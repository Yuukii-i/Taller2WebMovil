import { TestBed } from '@angular/core/testing';
import { AuthStore } from './auth.store';
import { User } from '../models';

describe('AuthStore', () => {
  let store: AuthStore;
  const mockUser: User = {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    created_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [AuthStore],
    });
    store = TestBed.inject(AuthStore);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize empty when localStorage is empty', () => {
    expect(store.token()).toBeNull();
    expect(store.user()).toBeNull();
    expect(store.isLoggedIn()).toBe(false);
  });

  it('should persist token and user in localStorage on setSession', () => {
    store.setSession('test-token-123', mockUser);

    expect(store.token()).toBe('test-token-123');
    expect(store.user()).toEqual(mockUser);
    expect(store.isLoggedIn()).toBe(true);

    expect(localStorage.getItem('auth_token')).toBe('test-token-123');
    expect(JSON.parse(localStorage.getItem('auth_user') || '{}')).toEqual(mockUser);
  });

  it('should update user in signal and localStorage', () => {
    store.setSession('test-token-123', mockUser);
    const updatedUser: User = { ...mockUser, username: 'alice_updated' };

    store.updateUser(updatedUser);

    expect(store.user()?.username).toBe('alice_updated');
    expect(JSON.parse(localStorage.getItem('auth_user') || '{}').username).toBe('alice_updated');
  });

  it('should clear token and user on clear()', () => {
    store.setSession('test-token-123', mockUser);
    expect(store.isLoggedIn()).toBe(true);

    store.clear();

    expect(store.token()).toBeNull();
    expect(store.user()).toBeNull();
    expect(store.isLoggedIn()).toBe(false);

    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
  });
});
