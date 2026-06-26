// src/app/pages/dashboard/settings/settings.page.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../../services/auth.service';
import { SettingsService, UserSettings } from '../../../services/settings.service';
import { SupabaseService } from '../../../services/supabase.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner]
})
export class SettingsPage implements OnInit {
  isLoading: boolean = true;
  isSaving: boolean = false;
  
  settings: UserSettings | null = null;
  businessId: string = '';
  userId: string = '';

  // Opciones
  languages = [
    { value: 'es', label: 'Español', flag: '🇲🇽' },
    { value: 'en', label: 'English', flag: '🇺🇸' }
  ];

  currencies = [
    { value: 'MXN', label: 'Peso Mexicano (MXN)', symbol: '$' },
    { value: 'USD', label: 'Dólar Estadounidense (USD)', symbol: 'US$' },
    { value: 'EUR', label: 'Euro (EUR)', symbol: '€' },
    { value: 'COP', label: 'Peso Colombiano (COP)', symbol: '$' }
  ];

  dateFormats = [
    { value: 'DD/MM/YYYY', label: '31/12/2024' },
    { value: 'MM/DD/YYYY', label: '12/31/2024' },
    { value: 'YYYY-MM-DD', label: '2024-12-31' }
  ];

  constructor(
    private authService: AuthService,
    private settingsService: SettingsService,
    private supabase: SupabaseService
  ) {}

  async ngOnInit() {
    await this.loadSettings();
  }

  async loadSettings() {
    this.isLoading = true;
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) return;

      this.userId = user.id;
      const profile = await this.authService.getUserProfile();
      this.businessId = profile?.profile?.business_id || '';

      if (this.businessId) {
        this.settings = await this.settingsService.getSettings(this.userId, this.businessId);
        
        // Aplicar modo oscuro si está activado
        if (this.settings?.dark_mode) {
          this.settingsService.applyDarkMode(true);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async saveSettings() {
    if (!this.settings) return;

    this.isSaving = true;
    try {
      const updated = await this.settingsService.updateSettings(this.settings.id!, this.settings);
      if (updated) {
        this.settings = updated;
        this.settingsService.applyDarkMode(this.settings.dark_mode);
        alert('✅ Configuración guardada exitosamente');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error al guardar la configuración');
    } finally {
      this.isSaving = false;
    }
  }

  onDarkModeToggle() {
    if (this.settings) {
      this.settingsService.applyDarkMode(this.settings.dark_mode);
    }
  }

  resetToDefaults() {
    if (!this.settings) return;
    
    if (confirm('¿Restablecer toda la configuración a los valores predeterminados?')) {
      this.settings.dark_mode = false;
      this.settings.language = 'es';
      this.settings.currency = 'MXN';
      this.settings.tax_rate = 16.00;
      this.settings.date_format = 'DD/MM/YYYY';
      this.settings.time_format = '24h';
      this.settings.email_notifications = true;
      this.settings.push_notifications = true;
      this.settings.sound_notifications = true;
      this.settings.show_email_in_receipts = false;
      this.settings.show_phone_in_receipts = true;
      
      this.settingsService.applyDarkMode(false);
    }
  }
}