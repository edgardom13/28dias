import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';

export interface Sale {
  id: string;
  business_id: string;
  customer_id?: string;
  customer_name?: string;
  order_number: string;
  status: string;
  delivery_type: string;
  total: number;
  subtotal: number;
  tax: number;
  notes?: string;
  created_at?: string;
  completed_at?: string;
  items_count?: number;
}

export interface SaleStats {
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  todaySales: number;
  todayRevenue: number;
  weekSales: number;
  weekRevenue: number;
  monthSales: number;
  monthRevenue: number;
}

export interface SalesByDate {
  date: string;
  total: number;
  count: number;
}

export interface SalesByProduct {
  product_name: string;
  quantity: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class SalesService {
  private salesSubject = new BehaviorSubject<Sale[]>([]);
  sales$ = this.salesSubject.asObservable();

  constructor(private supabase: SupabaseService) {}

  // ==========================================
  // GET SALES
  // ==========================================
  async getSales(
    businessId: string,
    startDate?: string,
    endDate?: string
  ): Promise<Sale[]> {
    try {
      let query = this.supabase
        .from('sales_completed')
        .select('*')
        .eq('business_id', businessId)
        .order('completed_at', { ascending: false });

      if (startDate) {
        query = query.gte('completed_at', startDate);
      }

      if (endDate) {
        query = query.lte('completed_at', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      this.salesSubject.next(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching sales:', error);
      throw error;
    }
  }

  // ==========================================
  // GET SALE BY ID
  // ==========================================
  async getSaleById(saleId: string): Promise<Sale | null> {
    try {
      const { data, error } = await this.supabase
        .from('sales_completed')
        .select('*')
        .eq('id', saleId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching sale:', error);
      return null;
    }
  }

  // ==========================================
  // GET SALE ITEMS
  // ==========================================
  async getSaleItems(saleId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('order_items')
        .select('*')
        .eq('order_id', saleId);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching sale items:', error);
      return [];
    }
  }

  // ==========================================
  // GET SALES STATISTICS
  // ==========================================
  async getSalesStats(businessId: string): Promise<SaleStats> {
    try {
      const { data, error } = await this.supabase
        .from('sales_completed')
        .select('total, completed_at')
        .eq('business_id', businessId);

      if (error) throw error;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats: SaleStats = {
        totalSales: data?.length || 0,
        totalRevenue: data?.reduce((sum, s) => sum + (s.total || 0), 0) || 0,
        averageTicket: data?.length ? (data.reduce((sum, s) => sum + (s.total || 0), 0) / data.length) : 0,
        todaySales: data?.filter(s => new Date(s.completed_at) >= today).length || 0,
        todayRevenue: data?.filter(s => new Date(s.completed_at) >= today).reduce((sum, s) => sum + (s.total || 0), 0) || 0,
        weekSales: data?.filter(s => new Date(s.completed_at) >= weekAgo).length || 0,
        weekRevenue: data?.filter(s => new Date(s.completed_at) >= weekAgo).reduce((sum, s) => sum + (s.total || 0), 0) || 0,
        monthSales: data?.filter(s => new Date(s.completed_at) >= monthAgo).length || 0,
        monthRevenue: data?.filter(s => new Date(s.completed_at) >= monthAgo).reduce((sum, s) => sum + (s.total || 0), 0) || 0
      };

      return stats;
    } catch (error) {
      console.error('Error fetching sales stats:', error);
      return {
        totalSales: 0,
        totalRevenue: 0,
        averageTicket: 0,
        todaySales: 0,
        todayRevenue: 0,
        weekSales: 0,
        weekRevenue: 0,
        monthSales: 0,
        monthRevenue: 0
      };
    }
  }

  // ==========================================
  // GET SALES BY DATE (para gráficos)
  // ==========================================
  async getSalesByDate(
    businessId: string,
    days: number = 30
  ): Promise<SalesByDate[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('sales_completed')
        .select('total, completed_at')
        .eq('business_id', businessId)
        .gte('completed_at', startDate.toISOString())
        .order('completed_at', { ascending: true });

      if (error) throw error;

      // Agrupar por fecha
      const salesByDate: { [key: string]: SalesByDate } = {};

      data?.forEach(sale => {
        const date = new Date(sale.completed_at).toISOString().split('T')[0];
        if (!salesByDate[date]) {
          salesByDate[date] = { date, total: 0, count: 0 };
        }
        salesByDate[date].total += sale.total || 0;
        salesByDate[date].count += 1;
      });

      return Object.values(salesByDate);
    } catch (error) {
      console.error('Error fetching sales by date:', error);
      return [];
    }
  }

  // ==========================================
  // GET TOP SELLING PRODUCTS
  // ==========================================
  async getTopSellingProducts(
    businessId: string,
    limit: number = 10
  ): Promise<SalesByProduct[]> {
    try {
      const { data, error } = await this.supabase
        .from('order_items')
        .select('product_name, quantity, subtotal, order_id')
        .in('order_id', 
          (await this.supabase
            .from('orders')
            .select('id')
            .eq('business_id', businessId)
            .eq('status', 'completed')
          ).data?.map(o => o.id) || []
        );

      if (error) throw error;

      // Agrupar por producto
      const productsMap: { [key: string]: SalesByProduct } = {};

      data?.forEach(item => {
        const name = item.product_name;
        if (!productsMap[name]) {
          productsMap[name] = { product_name: name, quantity: 0, total: 0 };
        }
        productsMap[name].quantity += item.quantity || 0;
        productsMap[name].total += item.subtotal || 0;
      });

      // Ordenar por cantidad y limitar
      return Object.values(productsMap)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching top products:', error);
      return [];
    }
  }
}