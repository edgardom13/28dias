import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone'; // Se quitó IonInput
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-business',
  templateUrl: './business.page.html',
  styleUrls: ['./business.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonContent, IonSpinner] // Se quitó IonInput
})
export class BusinessPage implements OnInit {
  businessForm: FormGroup;
  selectedBusiness: string = '';
  isLoading: boolean = false;

  businessTypes = [
    { id: 'tienda', name: 'Tienda', icon: 'bi-shop' },
    { id: 'restaurante', name: 'Restaurante', icon: 'bi-cup-hot-fill' },
    { id: 'floristeria', name: 'Floristería', icon: 'bi-flower1' },
    { id: 'taller', name: 'Taller Mecánico', icon: 'bi-gear-fill' },
    { id: 'perfumeria', name: 'Perfumería', icon: 'bi-droplet-fill' },
    { id: 'ropa', name: 'Tienda de Ropa', icon: 'bi-handbag-fill' },
    { id: 'accesorios', name: 'Accesorios', icon: 'bi-gem' },
    { id: 'regalos', name: 'Tienda de Regalos', icon: 'bi-gift-fill' },
    { id: 'jardineria', name: 'Jardinería', icon: 'bi-tree-fill' },
    { id: 'zapatos', name: 'Tienda de Zapatos', icon: 'bi-shoe' },
    { id: 'cafe', name: 'Café', icon: 'bi-cup-straw' },
    { id: 'bar', name: 'Bar', icon: 'bi-cup-fill' },
    { id: 'comida-rapida', name: 'Comidas Rápidas', icon: 'bi-egg-fried' },
    { id: 'licoreria', name: 'Licorería', icon: 'bi-wine' },
    { id: 'panaderia', name: 'Panadería', icon: 'bi-basket-fill' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {
    this.businessForm = this.fb.group({
      businessName: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  ngOnInit() {}

  selectBusiness(businessId: string) {
    this.selectedBusiness = businessId;
  }

  async onContinue() {
    this.businessForm.markAllAsTouched();
    
    if (this.businessForm.invalid || !this.selectedBusiness) {
      // Las validaciones visuales ya se muestran en el HTML
      return;
    }

    this.isLoading = true;

    try {
      await this.authService.saveTempBusinessData({
        business_name: this.businessForm.value.businessName,
        business_type: this.selectedBusiness
      });

      this.router.navigate(['/plans']);
    } catch (error: any) {
      console.error('Error al guardar:', error);
    } finally {
      this.isLoading = false;
    }
  }
}