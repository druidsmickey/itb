import { CommonModule } from '@angular/common';
<<<<<<< HEAD
import { Component, ChangeDetectorRef } from '@angular/core';
=======
import { Component, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
>>>>>>> 9aac1f3c2fd33f2f8c91f8ebd961a239a611b9b0
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './change-password.html',
  styleUrl: './change-password.css',
<<<<<<< HEAD
=======
  changeDetection: ChangeDetectionStrategy.OnPush,
>>>>>>> 9aac1f3c2fd33f2f8c91f8ebd961a239a611b9b0
})
export class ChangePassword {
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  errorMessage = '';
  successMessage = '';
  isLoading = false;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'All fields are required';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'New password and confirm password do not match';
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage = 'New password must be at least 6 characters long';
      return;
    }

    this.isLoading = true;

    this.authService
      .changePassword(this.currentPassword, this.newPassword)
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.successMessage =
            response.message || 'Password changed successfully!';
          this.errorMessage = '';
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          
          // Trigger change detection manually
          this.cdr.detectChanges();

          setTimeout(() => {
            this.router.navigate(['/home']);
          }, 2000);
        },
        error: (error: any) => {
          this.isLoading = false;
          this.successMessage = '';
          this.errorMessage =
            error.error?.message || 'An error occurred while changing password';
          
          // Trigger change detection manually
          this.cdr.detectChanges();
        },
      });
  }

  onCancel() {
    this.router.navigate(['/home']);
  }

}
