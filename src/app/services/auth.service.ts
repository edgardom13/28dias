import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { BehaviorSubject } from 'rxjs';
import { User, Session, AuthError } from '@supabase/supabase-js';

export interface BusinessData {
  business_name: string;
  business_type: string;
  plan: 'free' | 'premium';
  trial_end_date?: Date;
  monthly_price?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private currentSessionSubject = new BehaviorSubject<Session | null>(null);
  public currentSession$ = this.currentSessionSubject.asObservable();

  private authReadySubject = new BehaviorSubject<boolean>(false);
  public authReady$ = this.authReadySubject.asObservable();

  private tempEmail: string | null = null;
  private tempPassword: string | null = null;
  private tempBusinessData: Partial<BusinessData> | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      const { data: { session } } = await this.supabaseService.auth.getSession();
      
      this.currentSessionSubject.next(session);
      this.currentUserSubject.next(session?.user ?? null);

      this.supabaseService.auth.onAuthStateChange(async (event, session) => {
        console.log('🔐 Auth state changed:', event);
        this.currentSessionSubject.next(session);
        this.currentUserSubject.next(session?.user ?? null);
      });

      this.authReadySubject.next(true);
      console.log('✅ Auth initialized, user:', session?.user?.email);
    } catch (error) {
      console.error('❌ Error initializing auth:', error);
      this.authReadySubject.next(true);
    }
  }

  async waitForAuthReady(): Promise<boolean> {
    if (this.authReadySubject.value) {
      return true;
    }

    return new Promise((resolve) => {
      const subscription = this.authReady$.subscribe(ready => {
        if (ready) {
          subscription.unsubscribe();
          resolve(true);
        }
      });

      setTimeout(() => {
        subscription.unsubscribe();
        resolve(false);
      }, 5000);
    });
  }

  // ============================================
  // REGISTRO
  // ============================================
  async signUp(email: string, password: string): Promise<{ user: User | null; error: AuthError | null }> {
    try {
      const { data, error } = await this.supabaseService.auth.signUp({
        email,
        password,
        options: { data: { email } }
      });
      if (error) throw error;
      return { user: data.user, error: null };
    } catch (error: any) {
      return { user: null, error };
    }
  }

  // ============================================
  // LOGIN
  // ============================================
  async signIn(email: string, password: string): Promise<{ user: User | null; error: AuthError | null }> {
    try {
      const { data, error } = await this.supabaseService.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return { user: data.user, error: null };
    } catch (error: any) {
      return { user: null, error };
    }
  }

  // ============================================
  // GOOGLE OAUTH
  // ============================================
  async signInWithGoogle(): Promise<{ url: string | null; error: AuthError | null }> {
    try {
      const { data, error } = await this.supabaseService.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/dashboard' }
      });
      if (error) throw error;
      return { url: data.url, error: null };
    } catch (error: any) {
      return { url: null, error };
    }
  }

  // ============================================
  // LOGOUT
  // ============================================
  async signOut(): Promise<void> {
    await this.supabaseService.auth.signOut();
    this.currentUserSubject.next(null);
    this.currentSessionSubject.next(null);
    this.router.navigate(['/login']);
  }

  // ============================================
  // DATOS TEMPORALES
  // ============================================
  saveTempEmail(email: string): void {
    this.tempEmail = email;
    localStorage.setItem('temp_email', email);
  }

  getTempEmail(): string | null {
    if (!this.tempEmail) {
      this.tempEmail = localStorage.getItem('temp_email');
    }
    return this.tempEmail;
  }

  clearTempEmail(): void {
    this.tempEmail = null;
    localStorage.removeItem('temp_email');
  }

  saveTempPassword(password: string): void {
    this.tempPassword = password;
  }

  getTempPassword(): string | null {
    return this.tempPassword;
  }

  clearTempPassword(): void {
    this.tempPassword = null;
  }

  saveTempBusinessData(data: Partial<BusinessData>): void {
    this.tempBusinessData = data;
    localStorage.setItem('temp_business_data', JSON.stringify(data));
  }

  getTempBusinessData(): Partial<BusinessData> | null {
    if (!this.tempBusinessData) {
      const stored = localStorage.getItem('temp_business_data');
      if (stored) {
        this.tempBusinessData = JSON.parse(stored);
      }
    }
    return this.tempBusinessData;
  }

  clearTempBusinessData(): void {
    this.tempBusinessData = null;
    localStorage.removeItem('temp_business_data');
  }

  // ============================================
  // CREAR CUENTA COMPLETA
  // ============================================
  async createFullAccount(
    email: string,
    password: string,
    businessData: BusinessData
  ): Promise<{ user: User | null; error: any }> {
    try {
      const { data, error } = await this.supabaseService.auth.signUp({
        email,
        password,
        options: {
          data: {
            business_name: businessData.business_name,
            business_type: businessData.business_type
          }
        }
      });

      if (error) throw error;
      if (!data.user) throw new Error('No se pudo crear el usuario');

      await new Promise(resolve => setTimeout(resolve, 500));

      const trialEnd = businessData.plan === 'free'
        ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { error: updateError } = await this.supabaseService
        .from('profiles')
        .update({
          business_name: businessData.business_name,
          business_type: businessData.business_type,
          plan: businessData.plan,
          trial_end_date: trialEnd,
          monthly_price: businessData.monthly_price || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.user.id);

      if (updateError) {
        console.error('Error actualizando perfil:', updateError);
        throw updateError;
      }

      this.clearTempEmail();
      this.clearTempPassword();
      this.clearTempBusinessData();

      return { user: data.user, error: null };
    } catch (error) {
      console.error('Error creando cuenta completa:', error);
      return { user: null, error };
    }
  }

  // ============================================
  // OBTENER PERFIL
  // ============================================
 async getUserProfile(): Promise<{ profile: any } | null> {
  try {
    const supabase = this.supabaseService.getClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }

    // ✅ Seleccionar explícitamente business_id y todos los campos
    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, business_id, email, business_name, business_type, plan, trial_end_date, monthly_price, created_at, updated_at')
      .eq('user_id', user.id)
      .single();

    console.log('📊 Perfil obtenido:', data); // Debug

    if (error) {
      console.error('Error getting profile:', error);
      return null;
    }

    return { profile: data };
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return null;
  }
}

  // ============================================
  // VERIFICAR PLAN ACTIVO
  // ============================================
  isPlanActive(profile: any): boolean {
    if (!profile) return false;
    if (profile.plan === 'premium') return true;
    if (profile.trial_end_date) {
      const trialEnd = new Date(profile.trial_end_date);
      const now = new Date();
      return now < trialEnd;
    }
    return false;
  }

  // ============================================
  // CALCULAR DÍAS RESTANTES
  // ============================================
  getDaysRemaining(profile: any): number {
    if (!profile || !profile.trial_end_date) return 0;
    const trialEnd = new Date(profile.trial_end_date);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return daysRemaining > 0 ? daysRemaining : 0;
  }

  // ============================================
  // VERIFICAR AUTENTICACIÓN
  // ============================================
  isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }

  // ============================================
  // MÉTODOS AUXILIARES (para dashboard)
  // ============================================
  async getPendingOrdersCount(): Promise<number> {
    return 0;
  }

  async getCreditPendingCount(): Promise<number> {
    return 0;
  }

  async getLowStockCount(): Promise<number> {
    return 0;
  }
}