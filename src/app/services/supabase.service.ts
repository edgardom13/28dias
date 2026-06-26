import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = (environment as any).url || (environment as any).supabaseUrl;
    const supabaseKey = (environment as any).anonKey || (environment as any).supabaseKey;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase URL o Key no están configurados en environment');
      throw new Error('Supabase configuration is missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client inicializado');
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  get auth() {
    return this.supabase.auth;
  }

  get from() {
    return this.supabase.from.bind(this.supabase);
  }

  get storage() {
    return this.supabase.storage;
  }

  get rpc() {
    return this.supabase.rpc.bind(this.supabase);
  }

  // Método para verificar si el cliente está listo
  isReady(): boolean {
    return !!this.supabase;
  }
}