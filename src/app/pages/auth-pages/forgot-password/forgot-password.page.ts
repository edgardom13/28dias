import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../../services/supabase.service';
import { SweetAlertService } from '../../../services/sweet-alert.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonContent, IonSpinner]
})
export class ForgotPasswordPage implements OnInit {
  forgotPasswordForm: FormGroup;
  isLoading = false;
  private supabase: SupabaseClient;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private supabaseService: SupabaseService,
    private sweetAlert: SweetAlertService
  ) {
    this.supabase = this.supabaseService.getClient();
    
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit() {}

  async onSubmit() {
    this.forgotPasswordForm.markAllAsTouched();

    if (this.forgotPasswordForm.invalid) {
      return;
    }

    this.isLoading = true;

    try {
      const { email } = this.forgotPasswordForm.value;
      
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) throw error;
      
      await this.sweetAlert.success(
        '¡Correo enviado!',
        `Hemos enviado un enlace de recuperación a ${email}. Revisa tu bandeja de entrada.`
      );
      
      this.router.navigate(['/login']);
      
    } catch (error: any) {
      console.error('Error:', error);
      await this.sweetAlert.error(
        'Error',
        error.message || 'No se pudo enviar el correo de recuperación'
      );
    } finally {
      this.isLoading = false;
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}