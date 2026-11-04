import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginIn, RegisterIn, TokenOut, User } from '../models';
import { AuthStore } from './auth.store';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly baseUrl = environment.apiUrl;

  register(data: RegisterIn): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/auth/register`, data);
  }

  login(data: LoginIn): Observable<TokenOut> {
    return this.http.post<TokenOut>(`${this.baseUrl}/auth/login`, data).pipe(
      tap((res) => {
        this.authStore.setSession(res.access_token, res.user);
      })
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/logout`, {}).pipe(
      tap({
        next: () => this.authStore.clear(),
        error: () => this.authStore.clear(),
      })
    );
  }

  me(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/me`).pipe(
      tap({
        next: (user) => this.authStore.updateUser(user),
        error: () => this.authStore.clear(),
      })
    );
  }
}
