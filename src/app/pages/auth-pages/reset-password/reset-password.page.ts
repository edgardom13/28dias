import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../../services/supabase.service';
import { SweetAlertService } from '../../../services/sweet-alert.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonContent, IonSpinner]
})
export class ResetPasswordPage implements OnInit {
  resetPasswordForm: FormGroup;
  hidePassword = true;
  hideConfirmPassword = true;
  isLoading = false;
  private supabase: SupabaseClient;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private sweetAlert: SweetAlertService
  ) {
    this.supabase = this.supabaseService.getClient();
    
    this.resetPasswordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {
    // Verificar si hay tokens en la URL (Supabase los agrega después del redirect)
    const hash = this.route.snapshot.fragment;
    if (hash) {
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      
      if (accessToken && refreshToken) {
        // Verificar la sesión con los tokens
        this.supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
      }
    }
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  async onSubmit() {
    this.resetPasswordForm.markAllAsTouched();

    if (this.resetPasswordForm.invalid) {
      return;
    }

    this.isLoading = true;

    try {
      const { password } = this.resetPasswordForm.value;
      
      const { error } = await this.supabase.auth.updateUser({
        password: password
      });
      
      if (error) throw error;
      
      await this.sweetAlert.success(
        '¡Contraseña actualizada!',
        'Tu contraseña ha sido actualizada exitosamente. Ahora puedes iniciar sesión con tu nueva contraseña.'
      );
      
      // Cerrar sesión después de actualizar la contraseña
      await this.supabase.auth.signOut();
      
      this.router.navigate(['/login']);
      
    } catch (error: any) {
      console.error('Error:', error);
      await this.sweetAlert.error(
        'Error',
        error.message || 'No se pudo actualizar la contraseña'
      );
    } finally {
      this.isLoading = false;
    }
  }
}