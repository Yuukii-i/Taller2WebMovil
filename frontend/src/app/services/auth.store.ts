import { Injectable, computed, signal } from '@angular/core';
import { User } from '../models';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

function getInitialToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function getInitialUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

@Injectable({
  providedIn: 'root',
})
export class AuthStore {
  readonly token = signal<string | null>(getInitialToken());
  readonly user = signal<User | null>(getInitialUser());
  readonly isLoggedIn = computed(() => !!this.token());

  setSession(token: string, user: User): void {
    this.token.set(token);
    this.user.set(user);
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // Storage unavailable or disabled
    }
  }

  updateUser(user: User): void {
    this.user.set(user);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // Storage unavailable or disabled
    }
  }

  clear(): void {
    this.token.set(null);
    this.user.set(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // Storage unavailable or disabled
    }
  }
}
