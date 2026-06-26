// src/app/services/settings.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';

export interface UserSettings {
  id?: string;
  user_id: string;
  business_id: string;
  dark_mode: boolean;
  language: string;
  timezone: string;
  email_notifications: boolean;
  push_notifications: boolean;
  sound_notifications: boolean;
  currency: string;
  tax_rate: number;
  date_format: string;
  time_format: string;
  show_email_in_receipts: boolean;
  show_phone_in_receipts: boolean;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private settingsSubject = new BehaviorSubject<UserSettings | null>(null);
  settings$ = this.settingsSubject.asObservable();

  constructor(private supabase: SupabaseService) {}

  async getSettings(userId: string, businessId: string): Promise<UserSettings | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .eq('business_id', businessId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        this.settingsSubject.next(data);
        return data;
      }

      // Crear configuración por defecto
      const defaultSettings = await this.createDefaultSettings(userId, businessId);
      return defaultSettings;
    } catch (error) {
      console.error('Error getting settings:', error);
      return null;
    }
  }

  async createDefaultSettings(userId: string, businessId: string): Promise<UserSettings> {
    const defaultSettings: Partial<UserSettings> = {
      user_id: userId,
      business_id: businessId,
      dark_mode: false,
      language: 'es',
      timezone: 'America/Mexico_City',
      email_notifications: true,
      push_notifications: true,
      sound_notifications: true,
      currency: 'MXN',
      tax_rate: 16.00,
      date_format: 'DD/MM/YYYY',
      time_format: '24h',
      show_email_in_receipts: false,
      show_phone_in_receipts: true
    };

    const { data, error } = await this.supabase
      .from('user_settings')
      .insert(defaultSettings)
      .select()
      .single();

    if (error) throw error;

    this.settingsSubject.next(data);
    return data;
  }

  async updateSettings(settingsId: string, updates: Partial<UserSettings>): Promise<UserSettings | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', settingsId)
        .select()
        .single();

      if (error) throw error;

      this.settingsSubject.next(data);
      return data;
    } catch (error) {
      console.error('Error updating settings:', error);
      return null;
    }
  }

  applyDarkMode(isDark: boolean) {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDark));
  }
}