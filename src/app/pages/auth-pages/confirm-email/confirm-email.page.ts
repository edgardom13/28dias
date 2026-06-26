import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-confirm-email',
  templateUrl: './confirm-email.page.html',
  styleUrls: ['./confirm-email.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, IonSpinner]
})
export class ConfirmEmailPage implements OnInit, OnDestroy {
  userEmail: string = '';
  isResending: boolean = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.userEmail = this.authService.getTempEmail() || '';
    
    if (!this.userEmail) {
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy() {}

  goToLogin() {
    this.router.navigate(['/login']);
  }

  async resendEmail() {
    if (this.isResending) return;

    this.isResending = true;

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('✅ Correo reenviado correctamente');
      alert('Correo reenviado correctamente');
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error al reenviar el correo');
    } finally {
      this.isResending = false;
    }
  }

  showHelp() {
    alert('Si no recibes el correo de confirmación, revisa tu carpeta de spam o contáctanos en soporte@28dias.com');
  }
}