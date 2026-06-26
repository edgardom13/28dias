import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone'; // Se quitó IonInput e IonCheckbox
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonContent, IonSpinner] // Se quitó IonInput e IonCheckbox
})
export class RegisterPage implements OnInit {
  registerForm: FormGroup;
  hidePassword = true;
  hideConfirmPassword = true;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      termsAccepted: [false, [Validators.requiredTrue]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {}

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  async onRegister() {
    this.registerForm.markAllAsTouched();

    if (this.registerForm.invalid) {
      return;
    }

    this.isLoading = true;

    try {
      const { email, password } = this.registerForm.value;
      
      // Solo guardar temporalmente
      await this.authService.saveTempEmail(email);
      this.authService.saveTempPassword(password);
      
      this.router.navigate(['/business']);
    } catch (error: any) {
      console.error('Error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}