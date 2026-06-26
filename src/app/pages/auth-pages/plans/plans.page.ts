import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-plans',
  templateUrl: './plans.page.html',
  styleUrls: ['./plans.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner]
})
export class PlansPage implements OnInit {
  selectedPlan: 'free' | 'premium' | null = null;
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) { }

  ngOnInit() {}

  selectPlan(plan: 'free' | 'premium') {
    this.selectedPlan = plan;
  }

  async onContinue() {
    if (!this.selectedPlan) {
      alert('Por favor, selecciona un plan para continuar');
      return;
    }

    // Si es FREE, crear cuenta directamente
    if (this.selectedPlan === 'free') {
      const confirmed = confirm('Has seleccionado el Plan Gratuito (15 días de prueba). ¿Deseas continuar?');
      if (!confirmed) return;

      this.isLoading = true;

      try {
        const email = this.authService.getTempEmail();
        const password = this.authService.getTempPassword();
        const businessInfo = this.authService.getTempBusinessData();
        
        if (!email || !password || !businessInfo) {
          throw new Error('Información incompleta. Por favor, regístrate de nuevo.');
        }

        const businessData = {
          business_name: businessInfo.business_name!,
          business_type: businessInfo.business_type!,
          plan: 'free' as const,
          trial_end_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          monthly_price: 0
        };

        const { user, error } = await this.authService.createFullAccount(email, password, businessData);

        if (error) throw error;
        if (!user) throw new Error('No se pudo crear la cuenta');

        this.router.navigate(['/confirm-email']);

      } catch (error: any) {
        console.error('Error:', error);
        alert('Error al crear cuenta: ' + (error.message || 'No se pudo crear tu cuenta.'));
      } finally {
        this.isLoading = false;
      }
    } 
    // Si es PREMIUM, redirigir a payment
    else {
      const email = this.authService.getTempEmail();
      const businessInfo = this.authService.getTempBusinessData();
      
      if (!email || !businessInfo) {
        alert('Información incompleta. Por favor, regístrate de nuevo.');
        return;
      }

      this.router.navigate(['/payment'], {
        state: {
          planType: 'premium',
          businessInfo: {
            ...businessInfo,
            password: this.authService.getTempPassword()
          },
          userEmail: email
        }
      });
    }
  }
}