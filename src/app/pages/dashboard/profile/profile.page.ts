// src/app/pages/dashboard/profile/profile.page.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../../services/auth.service';
import { SupabaseService } from '../../../services/supabase.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner]
})
export class ProfilePage implements OnInit {
  isLoading: boolean = true;
  isSaving: boolean = false;
  currentUser: any = null;
  userProfile: any = null;
  businessId: string = '';

  profileForm = {
    business_name: '',
    business_type: 'tienda',
    phone: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    rfc: '',
    website: '',
    description: ''
  };

  businessTypes = [
    { value: 'tienda', label: 'Tienda / Retail', icon: '🏪' },
    { value: 'restaurante', label: 'Restaurante / Comida', icon: '🍽️' },
    { value: 'servicios', label: 'Servicios', icon: '🔧' },
    { value: 'salud', label: 'Salud / Belleza', icon: '💊' },
    { value: 'educacion', label: 'Educación', icon: '📚' },
    { value: 'tecnologia', label: 'Tecnología', icon: '💻' },
    { value: 'otro', label: 'Otro', icon: '📦' }
  ];

  // Agrega después de la propiedad businessTypes

get currentBusinessType() {
  return this.businessTypes.find(t => t.value === this.profileForm.business_type);
}

get currentBusinessTypeIcon(): string {
  return this.currentBusinessType?.icon || '📦';
}

get currentBusinessTypeLabel(): string {
  return this.currentBusinessType?.label || 'Otro';
}

  constructor(
    private authService: AuthService,
    private supabase: SupabaseService
  ) {}

  async ngOnInit() {
    await this.loadProfile();
  }

  async loadProfile() {
    this.isLoading = true;
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      this.currentUser = user;

      const result = await this.authService.getUserProfile();
      if (result?.profile) {
        this.userProfile = result.profile;
        this.businessId = result.profile.business_id;
        
        this.profileForm = {
          business_name: result.profile.business_name || '',
          business_type: result.profile.business_type || 'tienda',
          phone: result.profile.phone || '',
          address: result.profile.address || '',
          city: result.profile.city || '',
          state: result.profile.state || '',
          postal_code: result.profile.postal_code || '',
          rfc: result.profile.rfc || '',
          website: result.profile.website || '',
          description: result.profile.description || ''
        };
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async saveProfile() {
  // ... validaciones ...
  
  const { error } = await this.supabase
    .from('profiles')
    .update({
      business_name: this.profileForm.business_name,
      business_type: this.profileForm.business_type,
      phone: this.profileForm.phone || null,           // ✅ Teléfono
      address: this.profileForm.address || null,       // ✅ Dirección
      city: this.profileForm.city || null,             // ✅ Ciudad
      state: this.profileForm.state || null,           // ✅ Estado
      postal_code: this.profileForm.postal_code || null, // ✅ CP
      rfc: this.profileForm.rfc || null,               // ✅ RFC
      website: this.profileForm.website || null,       // ✅ Web
      description: this.profileForm.description || null, // ✅ Descripción
      updated_at: new Date().toISOString()
    })
    .eq('business_id', this.businessId);  // ← Guarda en el perfil del negocio
}

  getInitials(): string {
    const email = this.currentUser?.email || '';
    return email.charAt(0).toUpperCase();
  }

  getPlanLabel(): string {
    const plan = this.userProfile?.plan || 'free';
    return plan === 'premium' ? '⭐ Premium' : 'Gratuito';
  }

  getDaysRemaining(): number {
    return this.authService.getDaysRemaining(this.userProfile);
  }
}