import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonInput, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../../services/auth.service';
import { SweetAlertService } from '../../../services/sweet-alert.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonContent, IonInput, IonSpinner]
})
export class LoginPage implements OnInit {
  loginForm: FormGroup;
  hidePassword = true;
  isLoading = false;
  showSplash = true;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private sweetAlert: SweetAlertService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    // Ocultar splash screen después de 2.5 segundos
    setTimeout(() => {
      this.showSplash = false;
    }, 2500);
  }

  async onLogin() {
    this.loginForm.markAllAsTouched();

    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;

    try {
      const { email, password } = this.loginForm.value;
      const { user, error } = await this.authService.signIn(email, password);
      
      if (error) throw error;
      
      // ✅ Navegar usando Router en lugar de window.location
      await this.router.navigate(['/dashboard']);
      
    } catch (error: any) {
      this.isLoading = false;
      await this.sweetAlert.error('Error de inicio de sesión', error.message || 'Correo o contraseña incorrectos');
    }
  }

  async loginWithGoogle() {
    try {
      const { url, error } = await this.authService.signInWithGoogle();
      
      if (error) throw error;
      if (url) {
        window.location.href = url;
      }
    } catch (error: any) {
      await this.sweetAlert.error('Error', error.message || 'No se pudo conectar con Google');
    }
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }

  goToForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }
}