import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { SocketService } from './socket.service';

export interface InventoryMovement {
  id: string;
  business_id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  user_id?: string;
  user_name?: string;
  movement_type: 'in' | 'out' | 'adjustment' | 'return';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason?: string;
  notes?: string;
  reference_number?: string;
  cost_per_unit?: number;
  total_cost?: number;
  created_at?: string;
}

export interface InventoryStats {
  totalProducts: number;
  totalStock: number;
  totalValue: number;
  lowStock: number;
  outOfStock: number;
  criticalStock: number;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private movementsSubject = new BehaviorSubject<InventoryMovement[]>([]);
  movements$ = this.movementsSubject.asObservable();

  constructor(
    private supabase: SupabaseService,
    private socketService: SocketService
  ) {}

  async getMovements(
    businessId: string, 
    productId?: string, 
    limit: number = 100
  ): Promise<InventoryMovement[]> {
    try {
      let query = this.supabase
        .from('inventory_movements')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query;

      if (error) throw error;

      this.movementsSubject.next(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching movements:', error);
      throw error;
    }
  }

  async createMovement(movement: Partial<InventoryMovement>): Promise<InventoryMovement> {
    try {
      const { data, error } = await this.supabase
        .from('inventory_movements')
        .insert({
          business_id: movement.business_id,
          product_id: movement.product_id,
          user_id: movement.user_id || null,
          movement_type: movement.movement_type,
          quantity: movement.quantity,
          previous_stock: movement.previous_stock,
          new_stock: movement.new_stock,
          reason: movement.reason || null,
          notes: movement.notes || null,
          reference_number: movement.reference_number || null,
          cost_per_unit: movement.cost_per_unit || null,
          total_cost: movement.total_cost || null
        })
        .select()
        .single();

      if (error) throw error;

      this.emitMovementNotification(data);

      const currentMovements = this.movementsSubject.value;
      this.movementsSubject.next([data, ...currentMovements]);

      return data;
    } catch (error) {
      console.error('Error creating movement:', error);
      throw error;
    }
  }

  private emitMovementNotification(movement: InventoryMovement) {
    const typeMessages = {
      'in': 'Entrada de inventario',
      'out': 'Salida de inventario',
      'adjustment': 'Ajuste de inventario',
      'return': 'Devolución'
    };

    const typeIcons = {
      'in': '📥',
      'out': '📤',
      'adjustment': '⚙️',
      'return': '🔄'
    };

    this.socketService.emitNewOrder({
      id: movement.id,
      order_number: `${typeIcons[movement.movement_type]} ${typeMessages[movement.movement_type]}`,
      total: movement.quantity,
      type: movement.movement_type === 'in' || movement.movement_type === 'return' ? 'success' : 'warning',
      title: `${typeMessages[movement.movement_type]}: ${movement.product_name || 'Producto'}`,
      message: `Cantidad: ${movement.quantity} | Stock anterior: ${movement.previous_stock} → Nuevo: ${movement.new_stock}`,
      link: '/dashboard/inventory'
    });
  }

  async getInventoryStats(businessId: string): Promise<InventoryStats> {
    try {
      const { data: products, error } = await this.supabase
        .from('products')
        .select('stock, price, cost')
        .eq('business_id', businessId);

      if (error) throw error;

      const stats: InventoryStats = {
        totalProducts: products?.length || 0,
        totalStock: products?.reduce((sum, p) => sum + (p.stock || 0), 0) || 0,
        totalValue: products?.reduce((sum, p) => sum + ((p.stock || 0) * (p.cost || p.price || 0)), 0) || 0,
        // ✅ CORREGIDO: Stock bajo ahora es <= 5 (antes era <= 10)
        lowStock: products?.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 5).length || 0,
        outOfStock: products?.filter(p => (p.stock || 0) === 0).length || 0,
        // ✅ CORREGIDO: Stock crítico ahora es <= 3 (antes era <= 5)
        criticalStock: products?.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 3).length || 0
      };

      return stats;
    } catch (error) {
      console.error('Error fetching inventory stats:', error);
      return {
        totalProducts: 0,
        totalStock: 0,
        totalValue: 0,
        lowStock: 0,
        outOfStock: 0,
        criticalStock: 0
      };
    }
  }

  async deleteMovement(movementId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('inventory_movements')
        .delete()
        .eq('id', movementId);

      if (error) throw error;

      const currentMovements = this.movementsSubject.value;
      this.movementsSubject.next(currentMovements.filter(m => m.id !== movementId));
    } catch (error) {
      console.error('Error deleting movement:', error);
      throw error;
    }
  }

  async getProductMovements(businessId: string, productId: string): Promise<InventoryMovement[]> {
    try {
      const { data, error } = await this.supabase
        .from('inventory_movements')
        .select('*')
        .eq('business_id', businessId)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching product movements:', error);
      throw error;
    }
  }
}