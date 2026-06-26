import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-payment-failure',
  template: `
    <ion-content [fullscreen]="true" class="failure-content">
      <div class="failure-wrapper">
        <div class="failure-icon">
          <i class="bi bi-x-circle-fill"></i>
        </div>
        
        <h1 class="failure-title">Pago No Completado</h1>
        <p class="failure-text">
          Hubo un problema con tu pago. No te preocupes, no se ha realizado ningún cobro.
        </p>
        
        <button class="btn-back" (click)="goBack()">
          <i class="bi bi-arrow-left"></i>
          Volver a intentar
        </button>
      </div>
    </ion-content>
  `,
  styleUrls: ['./payment-failure.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent]
})
export class PaymentFailurePage {
  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/plans']);
  }
}