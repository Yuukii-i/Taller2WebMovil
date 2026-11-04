import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="auth-card-container">
      <div class="auth-card">
        <h1 class="title">Log in</h1>
        <p class="subtitle">Access your library and reviews</p>

        @if (generalError()) {
          <div class="general-error" role="alert">
            {{ generalError() }}
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-form">
          <mat-form-field appearance="outline">
            <mat-label>Username or Email</mat-label>
            <input
              matInput
              type="text"
              formControlName="identifier"
              autocomplete="username"
            />
            @if (form.controls.identifier.touched && form.controls.identifier.hasError('required')) {
              <mat-error>Username or email is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Password</mat-label>
            <input
              matInput
              type="password"
              formControlName="password"
              autocomplete="current-password"
            />
            @if (form.controls.password.touched && form.controls.password.hasError('required')) {
              <mat-error>Password is required</mat-error>
            }
          </mat-form-field>

          <button
            mat-flat-button
            type="submit"
            class="submit-btn"
            [disabled]="form.invalid || loading()"
          >
            @if (loading()) {
              <mat-spinner diameter="20" class="btn-spinner"></mat-spinner>
            } @else {
              Log in
            }
          </button>
        </form>

        <p class="switch-link">
          Don't have an account?
          <a routerLink="/register">Register</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-card-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 160px);
      padding: 24px 16px;
    }
    .auth-card {
      width: 100%;
      max-width: 400px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 32px 24px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
    .title {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: var(--text);
    }
    .subtitle {
      margin: 4px 0 24px;
      font-size: 14px;
      color: var(--text-muted);
    }
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .general-error {
      background: rgba(229, 72, 77, 0.1);
      border: 1px solid var(--danger);
      color: var(--danger);
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 16px;
    }
    .submit-btn {
      margin-top: 8px;
      height: 44px;
      border-radius: 999px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-size: 13px;
    }
    .btn-spinner {
      margin: 0 auto;
    }
    .switch-link {
      margin: 24px 0 0;
      text-align: center;
      font-size: 13px;
      color: var(--text-muted);
    }
    .switch-link a {
      color: var(--text);
      text-decoration: underline;
      font-weight: 500;
    }
  `],
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly generalError = signal<string | null>(null);

  readonly form = new FormGroup({
    identifier: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  onSubmit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.generalError.set(null);

    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        // Validate safe returnUrl (starts with / and not //)
        const safeUrl =
          returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')
            ? returnUrl
            : '/';
        this.router.navigateByUrl(safeUrl);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 401) {
          this.generalError.set(err.error?.detail || 'Invalid credentials');
        } else {
          this.generalError.set(
            err.error?.detail || 'An unexpected error occurred. Please try again.'
          );
        }
      },
    });
  }
}
