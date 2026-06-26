import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { SweetAlertService } from '../../services/sweet-alert.service';

@Component({
  selector: 'app-payment',
  templateUrl: './payment.page.html',
  styleUrls: ['./payment.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule, 
    IonContent, 
    IonSpinner
  ]
})
export class PaymentPage implements OnInit {
  paymentForm: FormGroup;
  isLoading: boolean = false;
  planType: 'free' | 'premium' = 'premium';
  amount: number = 20000;
  businessInfo: any = null;
  userEmail: string = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private sweetAlert: SweetAlertService
  ) {
    this.paymentForm = this.fb.group({
      cardHolder: ['', [Validators.minLength(3)]]
    });
  }

  ngOnInit() {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.planType = navigation.extras.state['planType'] || 'premium';
      this.businessInfo = navigation.extras.state['businessInfo'];
      this.userEmail = navigation.extras.state['userEmail'];
    }

    if (!this.businessInfo || !this.userEmail) {
      this.sweetAlert.error('Información incompleta', 'Por favor, completa el registro desde el inicio');
      this.router.navigate(['/register']);
    }
  }

  async processPayment() {
    this.isLoading = true;
    this.sweetAlert.loading('Preparando pago...', 'Serás redirigido a Mercado Pago de forma segura');

    try {
      const response = await fetch(
        'https://twiihtyrqqxdtejpgwkj.supabase.co/functions/v1/create-preference',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3aWlodHlycXF4ZHRlanBnd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Mzc0MjcsImV4cCI6MjA5NzUxMzQyN30.Vd_11dsPfcUWmuokq8mFNr46d8_COwokZlS6miwck7A',
          },
          body: JSON.stringify({
            amount: this.amount,
            email: this.userEmail,
            businessName: this.businessInfo.business_name,
            planType: this.planType,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error creando preferencia de pago');
      }

      this.sweetAlert.close();
      
      // Redirigir a Mercado Pago
      window.location.href = data.initPoint;

    } catch (error: any) {
      this.sweetAlert.close();
      console.error('Error:', error);
      
      await this.sweetAlert.error(
        'Error en el pago',
        error.message || 'No se pudo iniciar el pago. Por favor, intenta de nuevo.'
      );
    } finally {
      this.isLoading = false;
    }
  }

  goBack() {
    this.router.navigate(['/plans']);
  }
}