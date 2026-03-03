<<<<<<< HEAD
import { Component, ChangeDetectorRef } from '@angular/core';
=======
import { Component, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
>>>>>>> 9aac1f3c2fd33f2f8c91f8ebd961a239a611b9b0
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
<<<<<<< HEAD
=======
  changeDetection: ChangeDetectionStrategy.OnPush,
>>>>>>> 9aac1f3c2fd33f2f8c91f8ebd961a239a611b9b0
})
export class Login {
  username = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  onLogin(): void {
    if (!this.username || !this.password) {
      this.errorMessage = 'Please enter both username and password';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        // console.log('Login successful', response);
        this.router.navigate(['/home']);
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Login failed. Please try again.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

}
