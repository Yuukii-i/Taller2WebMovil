import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../services/auth.service';

export const passwordMatchValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (!confirmPassword) return null;
  return password === confirmPassword ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-register-page',
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
        <h1 class="title">Create an account</h1>
        <p class="subtitle">Join and start tracking your collection</p>

        @if (generalError()) {
          <div class="general-error" role="alert">
            {{ generalError() }}
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-form">
          <mat-form-field appearance="outline">
            <mat-label>Username</mat-label>
            <input
              matInput
              type="text"
              formControlName="username"
              autocomplete="username"
            />
            @if (form.controls.username.touched && form.controls.username.hasError('required')) {
              <mat-error>Username is required</mat-error>
            } @else if (form.controls.username.touched && form.controls.username.hasError('pattern')) {
              <mat-error>3–20 lowercase letters, numbers, or underscores</mat-error>
            } @else if (form.controls.username.hasError('serverError')) {
              <mat-error>{{ form.controls.username.getError('serverError') }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input
              matInput
              type="email"
              formControlName="email"
              autocomplete="email"
            />
            @if (form.controls.email.touched && form.controls.email.hasError('required')) {
              <mat-error>Email is required</mat-error>
            } @else if (form.controls.email.touched && form.controls.email.hasError('email')) {
              <mat-error>Please enter a valid email address</mat-error>
            } @else if (form.controls.email.hasError('serverError')) {
              <mat-error>{{ form.controls.email.getError('serverError') }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Password</mat-label>
            <input
              matInput
              type="password"
              formControlName="password"
              autocomplete="new-password"
            />
            @if (form.controls.password.touched && form.controls.password.hasError('required')) {
              <mat-error>Password is required</mat-error>
            } @else if (form.controls.password.touched && form.controls.password.hasError('minlength')) {
              <mat-error>Password must be at least 8 characters</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Confirm Password</mat-label>
            <input
              matInput
              type="password"
              formControlName="confirmPassword"
              autocomplete="new-password"
            />
            @if (form.controls.confirmPassword.touched && form.hasError('passwordMismatch')) {
              <mat-error>Passwords do not match</mat-error>
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
              Register
            }
          </button>
        </form>

        <p class="switch-link">
          Already have an account?
          <a routerLink="/login">Log in</a>
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
export class RegisterPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(false);
  readonly generalError = signal<string | null>(null);

  readonly form = new FormGroup(
    {
      username: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(/^[a-z0-9_]{3,20}$/),
        ],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [passwordMatchValidator] }
  );

  onSubmit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.generalError.set(null);

    const { username, email, password } = this.form.getRawValue();

    this.authService.register({ username, email, password }).subscribe({
      next: () => {
        this.loading.set(false);
        this.snackBar.open('Registration successful! Please log in.', 'OK', {
          duration: 4000,
        });
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 409) {
          const detail = (err.error?.detail || '').toLowerCase();
          if (detail.includes('username')) {
            this.form.controls.username.setErrors({
              serverError: 'Username already taken',
            });
          } else if (detail.includes('email')) {
            this.form.controls.email.setErrors({
              serverError: 'Email already registered',
            });
          } else {
            this.generalError.set(
              err.error?.detail || 'Registration conflict occurred'
            );
          }
        } else {
          this.generalError.set(
            err.error?.detail || 'An unexpected error occurred. Please try again.'
          );
        }
      },
    });
  }
}
