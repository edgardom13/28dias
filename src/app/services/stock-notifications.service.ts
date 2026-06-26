import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class StockNotificationsService {
  private supabase;

  constructor(private supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getClient();
  }

  // ✅ Obtener productos y filtrar en el cliente
  async getLowStockProducts(businessId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('id, name, stock, min_stock, business_id')
        .eq('business_id', businessId)
        .gt('stock', 0)
        .order('stock', { ascending: true });

      if (error) {
        console.error('Error obteniendo productos:', error);
        return [];
      }

      const lowStockProducts = data?.filter(product => 
        product.stock <= product.min_stock
      ) || [];

      console.log(`📦 Productos con stock bajo: ${lowStockProducts.length}`);
      return lowStockProducts;

    } catch (error) {
      console.error('Error en getLowStockProducts:', error);
      return [];
    }
  }

  // ✅ Obtener productos sin stock
  async getOutOfStockProducts(businessId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('id, name, stock, min_stock, business_id')
        .eq('business_id', businessId)
        .eq('stock', 0)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error obteniendo productos sin stock:', error);
        return [];
      }

      console.log(`📦 Productos sin stock: ${data?.length || 0}`);
      return data || [];

    } catch (error) {
      console.error('Error en getOutOfStockProducts:', error);
      return [];
    }
  }

  // ✅ Verificar y notificar stock bajo
  async checkAndNotifyLowStock(businessId: string): Promise<{lowStock: number, outOfStock: number}> {
    try {
      const [lowStockProducts, outOfStockProducts] = await Promise.all([
        this.getLowStockProducts(businessId),
        this.getOutOfStockProducts(businessId)
      ]);

      console.log(`📊 Stock bajo: ${lowStockProducts.length}, Sin stock: ${outOfStockProducts.length}`);

      // Crear notificaciones para stock bajo
      for (const product of lowStockProducts) {
        await this.createStockNotification(
          businessId,
          'warning',
          'Stock bajo',
          `El producto "${product.name}" tiene stock bajo (${product.stock} unidades)`,
          '/dashboard/products'
        );
      }

      // Crear notificaciones para sin stock
      for (const product of outOfStockProducts) {
        await this.createStockNotification(
          businessId,
          'error',
          'Sin stock',
          `El producto "${product.name}" está sin stock`,
          '/dashboard/products'
        );
      }

      return {
        lowStock: lowStockProducts.length,
        outOfStock: outOfStockProducts.length
      };

    } catch (error) {
      console.error('Error en checkAndNotifyLowStock:', error);
      return { lowStock: 0, outOfStock: 0 };
    }
  }

  // ✅ Crear notificación de stock (SIN product_id)
  private async createStockNotification(
    businessId: string,
    type: 'info' | 'success' | 'warning' | 'error',
    title: string,
    message: string,
    link: string
  ): Promise<void> {
    try {
      // Verificar si ya existe una notificación reciente
      const { data: existing } = await this.supabase
        .from('business_notifications')
        .select('id')
        .eq('business_id', businessId)
        .eq('type', type)
        .ilike('message', `%${message}%`) // Buscar por contenido similar
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();

      if (existing) {
        console.log(`⏭️ Notificación ya existe: ${title}`);
        return;
      }

      // ✅ Insertar SIN product_id
      const { error } = await this.supabase
        .from('business_notifications')
        .insert({
          business_id: businessId,
          type: type,
          title: title,
          message: message,
          link: link,
          read: false
        });

      if (error) {
        console.error('Error creando notificación:', error);
      } else {
        console.log(`✅ Notificación creada: ${title}`);
      }

    } catch (error) {
      console.error('Error en createStockNotification:', error);
    }
  }

  // ✅ Obtener notificaciones del negocio
  async getStockNotifications(businessId: string, limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('business_notifications')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error obteniendo notificaciones:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('Error en getStockNotifications:', error);
      return [];
    }
  }

  // ✅ Marcar notificación como leída
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('business_notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marcando notificación como leída:', error);
      }

    } catch (error) {
      console.error('Error en markNotificationAsRead:', error);
    }
  }

  // ✅ Marcar todas como leídas
  async markAllNotificationsAsRead(businessId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('business_notifications')
        .update({ read: true })
        .eq('business_id', businessId)
        .eq('read', false);

      if (error) {
        console.error('Error marcando todas como leídas:', error);
      }

    } catch (error) {
      console.error('Error en markAllNotificationsAsRead:', error);
    }
  }

  // ✅ Limpiar notificaciones antiguas
  async cleanupOldNotifications(businessId: string, daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
      
      const { error } = await this.supabase
        .from('business_notifications')
        .delete()
        .eq('business_id', businessId)
        .lt('created_at', cutoffDate)
        .eq('read', true);

      if (error) {
        console.error('Error limpiando notificaciones antiguas:', error);
      } else {
        console.log(`🧹 Notificaciones antiguas eliminadas`);
      }

    } catch (error) {
      console.error('Error en cleanupOldNotifications:', error);
    }
  }
}