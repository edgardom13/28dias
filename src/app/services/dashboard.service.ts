// src/app/services/dashboard.service.ts
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface DashboardStats {
  todaySales: number;
  todaySalesCount: number;
  monthIncome: number;
  monthExpenses: number;
  monthProfit: number;
  pendingCredits: number;
  pendingCreditsCount: number;
  lowStockCount: number;
  totalProducts: number;
  totalCustomers: number;
}

export interface SalesByDay {
  date: string;
  total: number;
  count: number;
}

export interface TopProduct {
  product_name: string;
  quantity: number;
  revenue: number;
}

export interface RecentActivity {
  id: string;
  type: 'sale' | 'expense' | 'credit' | 'stock';
  description: string;
  amount: number;
  date: string;
  icon: string;
}

export interface Alert {
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  action?: string;
  link?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  constructor(private supabase: SupabaseService) {}

  async getStats(businessId: string): Promise<DashboardStats> {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Ventas de hoy
      const { data: todaySales } = await this.supabase
        .from('orders')
        .select('total')
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .gte('completed_at', today.toISOString());

      // Ingresos del mes
      const { data: monthIncome } = await this.supabase
        .from('transactions')
        .select('amount')
        .eq('business_id', businessId)
        .eq('type', 'income')
        .gte('transaction_date', monthStart.toISOString());

      // Egresos del mes
      const { data: monthExpenses } = await this.supabase
        .from('transactions')
        .select('amount')
        .eq('business_id', businessId)
        .eq('type', 'expense')
        .gte('transaction_date', monthStart.toISOString());

      // Créditos pendientes
      const { data: pendingCredits, count: pendingCreditsCount } = await this.supabase
        .from('credits')
        .select('remaining_amount', { count: 'exact', head: false })
        .eq('business_id', businessId)
        .in('status', ['pending', 'partial']);

      // Stock bajo
      const { count: lowStockCount } = await this.supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .lte('stock', 10)
        .gt('stock', 0);

      // Total productos
      const { count: totalProducts } = await this.supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId);

      // Total clientes
      const { count: totalCustomers } = await this.supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId);

      return {
        todaySales: todaySales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0,
        todaySalesCount: todaySales?.length || 0,
        monthIncome: monthIncome?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0,
        monthExpenses: monthExpenses?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0,
        monthProfit: (monthIncome?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0) - 
                     (monthExpenses?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0),
        pendingCredits: pendingCredits?.reduce((sum, s) => sum + (s.remaining_amount || 0), 0) || 0,
        pendingCreditsCount: pendingCreditsCount || 0,
        lowStockCount: lowStockCount || 0,
        totalProducts: totalProducts || 0,
        totalCustomers: totalCustomers || 0
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      return {
        todaySales: 0, todaySalesCount: 0,
        monthIncome: 0, monthExpenses: 0, monthProfit: 0,
        pendingCredits: 0, pendingCreditsCount: 0,
        lowStockCount: 0, totalProducts: 0, totalCustomers: 0
      };
    }
  }

  async getSalesByDay(businessId: string, days: number = 7): Promise<SalesByDay[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('orders')
        .select('total, completed_at')
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .gte('completed_at', startDate.toISOString())
        .order('completed_at', { ascending: true });

      if (error) throw error;

      // Agrupar por día
      const salesMap: { [key: string]: SalesByDay } = {};
      
      // Inicializar todos los días
      for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        salesMap[dateKey] = { date: dateKey, total: 0, count: 0 };
      }

      // Llenar con datos reales
      data?.forEach(sale => {
        const dateKey = new Date(sale.completed_at).toISOString().split('T')[0];
        if (salesMap[dateKey]) {
          salesMap[dateKey].total += sale.total || 0;
          salesMap[dateKey].count += 1;
        }
      });

      return Object.values(salesMap);
    } catch (error) {
      console.error('Error getting sales by day:', error);
      return [];
    }
  }

  async getTopProducts(businessId: string, limit: number = 5): Promise<TopProduct[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const { data: orders } = await this.supabase
        .from('orders')
        .select('id')
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .gte('completed_at', startDate.toISOString());

      if (!orders || orders.length === 0) return [];

      const orderIds = orders.map(o => o.id);

      const { data: items, error } = await this.supabase
        .from('order_items')
        .select('product_name, quantity, subtotal')
        .in('order_id', orderIds);

      if (error) throw error;

      const productMap: { [key: string]: TopProduct } = {};
      items?.forEach(item => {
        const name = item.product_name;
        if (!productMap[name]) {
          productMap[name] = { product_name: name, quantity: 0, revenue: 0 };
        }
        productMap[name].quantity += item.quantity || 0;
        productMap[name].revenue += item.subtotal || 0;
      });

      return Object.values(productMap)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting top products:', error);
      return [];
    }
  }

  async getRecentActivity(businessId: string, limit: number = 5): Promise<RecentActivity[]> {
    try {
      const activities: RecentActivity[] = [];

      // Últimas ventas
      const { data: recentSales } = await this.supabase
        .from('orders')
        .select('id, order_number, total, completed_at')
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(3);

      recentSales?.forEach(sale => {
        activities.push({
          id: sale.id,
          type: 'sale',
          description: `Venta ${sale.order_number}`,
          amount: sale.total,
          date: sale.completed_at,
          icon: '💰'
        });
      });

      // Últimos egresos
      const { data: recentExpenses } = await this.supabase
        .from('transactions')
        .select('id, description, amount, transaction_date')
        .eq('business_id', businessId)
        .eq('type', 'expense')
        .order('transaction_date', { ascending: false })
        .limit(2);

      recentExpenses?.forEach(exp => {
        activities.push({
          id: exp.id,
          type: 'expense',
          description: exp.description,
          amount: exp.amount,
          date: exp.transaction_date,
          icon: '💸'
        });
      });

      // Ordenar por fecha
      return activities
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return [];
    }
  }

  async getAlerts(businessId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];
    try {
      // Stock bajo
      const { count: lowStock } = await this.supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .lte('stock', 10)
        .gt('stock', 0);

      if (lowStock && lowStock > 0) {
        alerts.push({
          type: 'warning',
          title: 'Stock Bajo',
          message: `${lowStock} producto${lowStock > 1 ? 's' : ''} con stock bajo`,
          action: 'Ver productos',
          link: '/dashboard/inventory'
        });
      }

      // Sin stock
      const { count: outOfStock } = await this.supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('stock', 0);

      if (outOfStock && outOfStock > 0) {
        alerts.push({
          type: 'danger',
          title: 'Sin Stock',
          message: `${outOfStock} producto${outOfStock > 1 ? 's' : ''} agotado${outOfStock > 1 ? 's' : ''}`,
          action: 'Reabastecer',
          link: '/dashboard/inventory'
        });
      }

      // Créditos vencidos
      const now = new Date().toISOString();
      const { count: overdueCredits } = await this.supabase
        .from('credits')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .in('status', ['pending', 'partial'])
        .lt('due_date', now);

      if (overdueCredits && overdueCredits > 0) {
        alerts.push({
          type: 'danger',
          title: 'Créditos Vencidos',
          message: `${overdueCredits} crédito${overdueCredits > 1 ? 's' : ''} vencido${overdueCredits > 1 ? 's' : ''}`,
          action: 'Ver créditos',
          link: '/dashboard/credit'
        });
      }

      // Pedidos pendientes
      const { count: pendingOrders } = await this.supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('status', 'pending');

      if (pendingOrders && pendingOrders > 0) {
        alerts.push({
          type: 'info',
          title: 'Pedidos Pendientes',
          message: `${pendingOrders} pedido${pendingOrders > 1 ? 's' : ''} por procesar`,
          action: 'Ver pedidos',
          link: '/dashboard/orders'
        });
      }
    } catch (error) {
      console.error('Error getting alerts:', error);
    }

    return alerts;
  }
}