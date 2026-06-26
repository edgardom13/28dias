import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  total_purchases: number;
  total_spent: number;
  loyalty_points: number;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CustomersService {
  private customersSubject = new BehaviorSubject<Customer[]>([]);
  customers$ = this.customersSubject.asObservable();

  constructor(private supabase: SupabaseService) {}

  // ==========================================
  // GET CUSTOMERS
  // ==========================================
  async getCustomers(businessId: string): Promise<Customer[]> {
    try {
      const { data, error } = await this.supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.customersSubject.next(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }
  }

  // ==========================================
  // CREATE CUSTOMER
  // ==========================================
  async createCustomer(businessId: string, customerData: Partial<Customer>): Promise<Customer> {
    try {
      const { data, error } = await this.supabase
        .from('customers')
        .insert({
          business_id: businessId,
          name: customerData.name,
          email: customerData.email || null,
          phone: customerData.phone || null,
          address: customerData.address || null,
          notes: customerData.notes || null,
          total_purchases: 0,
          total_spent: 0,
          loyalty_points: 0
        })
        .select()
        .single();

      if (error) throw error;

      // Actualizar lista local
      const currentCustomers = this.customersSubject.value;
      this.customersSubject.next([data, ...currentCustomers]);

      return data;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  // ==========================================
  // UPDATE CUSTOMER
  // ==========================================
  async updateCustomer(customerId: string, customerData: Partial<Customer>): Promise<Customer> {
    try {
      const { data, error } = await this.supabase
        .from('customers')
        .update({
          name: customerData.name,
          email: customerData.email || null,
          phone: customerData.phone || null,
          address: customerData.address || null,
          notes: customerData.notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', customerId)
        .select()
        .single();

      if (error) throw error;

      // Actualizar lista local
      const currentCustomers = this.customersSubject.value;
      const index = currentCustomers.findIndex(c => c.id === customerId);
      if (index !== -1) {
        currentCustomers[index] = data;
        this.customersSubject.next([...currentCustomers]);
      }

      return data;
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  // ==========================================
  // DELETE CUSTOMER
  // ==========================================
  async deleteCustomer(customerId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (error) throw error;

      // Actualizar lista local
      const currentCustomers = this.customersSubject.value;
      this.customersSubject.next(currentCustomers.filter(c => c.id !== customerId));
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }

  // ==========================================
  // UPDATE PURCHASE STATS
  // ==========================================
  async updateCustomerPurchaseStats(
    customerId: string,
    purchaseAmount: number
  ): Promise<void> {
    try {
      // Primero obtener el cliente actual
      const { data: currentCustomer, error: fetchError } = await this.supabase
        .from('customers')
        .select('total_purchases, total_spent, loyalty_points')
        .eq('id', customerId)
        .single();

      if (fetchError) throw fetchError;

      // Calcular nuevos valores
      const newPurchases = (currentCustomer.total_purchases || 0) + 1;
      const newSpent = (currentCustomer.total_spent || 0) + purchaseAmount;
      const newPoints = (currentCustomer.loyalty_points || 0) + Math.floor(purchaseAmount / 10);

      // Actualizar
      const { error } = await this.supabase
        .from('customers')
        .update({
          total_purchases: newPurchases,
          total_spent: newSpent,
          loyalty_points: newPoints,
          updated_at: new Date().toISOString()
        })
        .eq('id', customerId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating customer stats:', error);
      throw error;
    }
  }

  // ==========================================
  // GET CUSTOMER BY ID
  // ==========================================
  async getCustomerById(customerId: string): Promise<Customer | null> {
    try {
      const { data, error } = await this.supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching customer:', error);
      return null;
    }
  }

  // ==========================================
  // SEARCH CUSTOMERS
  // ==========================================
  async searchCustomers(businessId: string, query: string): Promise<Customer[]> {
    try {
      const { data, error } = await this.supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId)
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error searching customers:', error);
      throw error;
    }
  }
}