import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-payment-success',
  template: `
    <ion-content [fullscreen]="true" class="success-content">
      <div class="success-wrapper">
        <div class="success-icon">
          <i class="bi bi-check-circle-fill"></i>
        </div>
        
        <h1 class="success-title">¡Pago Exitoso!</h1>
        <p class="success-text">
          Tu cuenta Premium ha sido creada correctamente.
        </p>
        <p class="success-subtext">
          Revisa tu correo electrónico para confirmar tu cuenta y comenzar a usar todas las funcionalidades.
        </p>
        
        <div class="loading-indicator">
          <p>Redirigiendo...</p>
        </div>
        
        <button class="btn-continue" (click)="goNow()">
          Continuar ahora
        </button>
      </div>
    </ion-content>
  `,
  styleUrls: ['./payment-success.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent]
})
export class PaymentSuccessPage implements OnInit {
  constructor(private router: Router) {}

  ngOnInit() {
    setTimeout(() => {
      this.router.navigate(['/confirm-email']);
    }, 5000);
  }

  goNow() {
    this.router.navigate(['/confirm-email']);
  }
}