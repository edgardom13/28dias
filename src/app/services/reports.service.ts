import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ReportSummary {
  total_sales: number;
  total_income: number;
  total_expenses: number;
  total_profit: number;
  sales_count: number;
  average_ticket: number;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}

export interface SalesByDay {
  sale_date: string;
  total_sales: number;
  sales_count: number;
}

export interface SalesByPaymentMethod {
  payment_method: string;
  total_sales: number;
  sales_count: number;
}

export interface ExpensesByCategory {
  category: string;
  total_amount: number;
  count: number;
}

export interface ReportData {
  summary: ReportSummary;
  topProducts: TopProduct[];
  salesByDay: SalesByDay[];
  salesByPaymentMethod: SalesByPaymentMethod[];
  expensesByCategory: ExpensesByCategory[];
}

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  constructor(private supabase: SupabaseService) {}

  async getReportData(
    businessId: string,
    startDate: string,
    endDate: string
  ): Promise<ReportData> {
    try {
      // Convertir fechas a formato ISO completo con zona horaria
      const startDateTime = new Date(startDate + 'T00:00:00').toISOString();
      const endDateTime = new Date(endDate + 'T23:59:59.999').toISOString();

      console.log('🔍 Consultando reporte:', {
        businessId,
        startDate: startDateTime,
        endDate: endDateTime
      });

      // Ejecutar todas las consultas en paralelo
      const [
        summary,
        topProducts,
        salesByDay,
        salesByPaymentMethod,
        expensesByCategory
      ] = await Promise.all([
        this.getSummary(businessId, startDateTime, endDateTime),
        this.getTopProducts(businessId, startDateTime, endDateTime),
        this.getSalesByDay(businessId, startDateTime, endDateTime),
        this.getSalesByPaymentMethod(businessId, startDateTime, endDateTime),
        this.getExpensesByCategory(businessId, startDateTime, endDateTime)
      ]);

      const reportData: ReportData = {
        summary,
        topProducts,
        salesByDay,
        salesByPaymentMethod,
        expensesByCategory
      };

      console.log('✅ Reporte generado:', reportData);
      return reportData;
    } catch (error) {
      console.error('❌ Error fetching report data:', error);
      throw error;
    }
  }

  // ==========================================
  // RESUMEN (sin RPC)
  // ==========================================
  private async getSummary(
    businessId: string,
    startDate: string,
    endDate: string
  ): Promise<ReportSummary> {
    console.log('📊 Calculando resumen...');

    // Ventas
    const { data: sales, error: salesError } = await this.supabase
      .from('orders')
      .select('total')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('completed_at', startDate)
      .lte('completed_at', endDate);

    if (salesError) {
      console.error('❌ Error consultando ventas:', salesError);
    }

    // Ingresos - Soporta ambos valores ('income' o 'ingreso')
    const { data: incomes, error: incomesError } = await this.supabase
      .from('transactions')
      .select('amount, type')
      .eq('business_id', businessId)
      .in('type', ['income', 'ingreso'])
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    if (incomesError) {
      console.error('❌ Error consultando ingresos:', incomesError);
    }

    console.log('💰 Ingresos encontrados:', incomes?.length || 0);
    if (incomes && incomes.length > 0) {
      console.log('📋 Primera transacción de ingreso:', incomes[0]);
    }

    // Egresos - Soporta ambos valores ('expense' o 'egreso')
    const { data: expenses, error: expensesError } = await this.supabase
      .from('transactions')
      .select('amount, type')
      .eq('business_id', businessId)
      .in('type', ['expense', 'egreso'])
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    if (expensesError) {
      console.error('❌ Error consultando egresos:', expensesError);
    }

    const totalSales = sales?.reduce((sum, s) => sum + (Number(s.total) || 0), 0) || 0;
    const totalIncome = incomes?.reduce((sum, i) => sum + (Number(i.amount) || 0), 0) || 0;
    const totalExpenses = expenses?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
    const salesCount = sales?.length || 0;
    const averageTicket = salesCount > 0 ? totalSales / salesCount : 0;

    console.log('✅ Resumen calculado:', {
      totalSales,
      totalIncome,
      totalExpenses,
      salesCount,
      averageTicket
    });

    return {
      total_sales: totalSales,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      total_profit: totalIncome - totalExpenses,
      sales_count: salesCount,
      average_ticket: averageTicket
    };
  }

  // ==========================================
  // TOP PRODUCTOS (sin RPC)
  // ==========================================
  private async getTopProducts(
    businessId: string,
    startDate: string,
    endDate: string,
    limit: number = 10
  ): Promise<TopProduct[]> {
    console.log('🏆 Calculando top productos...');

    // Obtener IDs de órdenes completadas
    const { data: orders, error: ordersError } = await this.supabase
      .from('orders')
      .select('id')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('completed_at', startDate)
      .lte('completed_at', endDate);

    if (ordersError) {
      console.error('❌ Error consultando órdenes:', ordersError);
      return [];
    }

    if (!orders || orders.length === 0) {
      console.log('⚠️ No hay órdenes completadas en el período');
      return [];
    }

    const orderIds = orders.map(o => o.id);
    console.log(`📦 Procesando ${orderIds.length} órdenes`);

    // Obtener items de esas órdenes
    const { data: items, error: itemsError } = await this.supabase
      .from('order_items')
      .select('product_id, product_name, quantity, subtotal')
      .in('order_id', orderIds);

    if (itemsError) {
      console.error('❌ Error consultando items:', itemsError);
      return [];
    }

    if (!items || items.length === 0) {
      console.log('⚠️ No hay items en las órdenes');
      return [];
    }

    // Agrupar por producto
    const productMap: { [key: string]: TopProduct } = {};
    items.forEach(item => {
      const id = item.product_id;
      if (!id) return;
      
      if (!productMap[id]) {
        productMap[id] = {
          product_id: id,
          product_name: item.product_name,
          total_quantity: 0,
          total_revenue: 0
        };
      }
      productMap[id].total_quantity += Number(item.quantity) || 0;
      productMap[id].total_revenue += Number(item.subtotal) || 0;
    });

    const result = Object.values(productMap)
      .sort((a, b) => b.total_quantity - a.total_quantity)
      .slice(0, limit);

    console.log('✅ Top productos calculado:', result.length, 'productos');
    return result;
  }

  // ==========================================
  // VENTAS POR DÍA (sin RPC)
  // ==========================================
  private async getSalesByDay(
    businessId: string,
    startDate: string,
    endDate: string
  ): Promise<SalesByDay[]> {
    console.log('📈 Calculando ventas por día...');

    const { data: sales, error } = await this.supabase
      .from('orders')
      .select('total, completed_at')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('completed_at', startDate)
      .lte('completed_at', endDate)
      .order('completed_at', { ascending: true });

    if (error) {
      console.error('❌ Error consultando ventas por día:', error);
      return [];
    }

    if (!sales || sales.length === 0) {
      console.log('⚠️ No hay ventas en el período');
      return [];
    }

    // Agrupar por día
    const dayMap: { [key: string]: SalesByDay } = {};
    sales.forEach(sale => {
      const date = new Date(sale.completed_at).toISOString().split('T')[0];
      if (!dayMap[date]) {
        dayMap[date] = { sale_date: date, total_sales: 0, sales_count: 0 };
      }
      dayMap[date].total_sales += Number(sale.total) || 0;
      dayMap[date].sales_count += 1;
    });

    const result = Object.values(dayMap).sort((a, b) => 
      a.sale_date.localeCompare(b.sale_date)
    );

    console.log('✅ Ventas por día calculadas:', result.length, 'días');
    return result;
  }

  // ==========================================
  // VENTAS POR MÉTODO DE PAGO (sin RPC)
  // ==========================================
  private async getSalesByPaymentMethod(
    businessId: string,
    startDate: string,
    endDate: string
  ): Promise<SalesByPaymentMethod[]> {
    console.log('💳 Calculando ventas por método de pago...');

    const { data: sales, error } = await this.supabase
      .from('orders')
      .select('total, notes')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('completed_at', startDate)
      .lte('completed_at', endDate);

    if (error) {
      console.error('❌ Error consultando métodos de pago:', error);
      return [];
    }

    if (!sales || sales.length === 0) {
      console.log('⚠️ No hay ventas para analizar métodos de pago');
      return [];
    }

    // Extraer método de pago de las notas
    const methodMap: { [key: string]: SalesByPaymentMethod } = {};
    sales.forEach(sale => {
      const match = sale.notes?.match(/Pago: (\w+)/);
      const method = match ? match[1].toLowerCase() : 'unknown';
      
      if (!methodMap[method]) {
        methodMap[method] = { payment_method: method, total_sales: 0, sales_count: 0 };
      }
      methodMap[method].total_sales += Number(sale.total) || 0;
      methodMap[method].sales_count += 1;
    });

    const result = Object.values(methodMap).sort((a, b) => b.total_sales - a.total_sales);
    console.log('✅ Métodos de pago calculados:', result.length, 'métodos');
    return result;
  }

  // ==========================================
  // EGRESOS POR CATEGORÍA (sin RPC)
  // ==========================================
  private async getExpensesByCategory(
    businessId: string,
    startDate: string,
    endDate: string
  ): Promise<ExpensesByCategory[]> {
    console.log('💸 Calculando egresos por categoría...');

    const { data: expenses, error } = await this.supabase
      .from('transactions')
      .select('category, amount')
      .eq('business_id', businessId)
      .in('type', ['expense', 'egreso'])
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate);

    if (error) {
      console.error('❌ Error consultando egresos por categoría:', error);
      return [];
    }

    if (!expenses || expenses.length === 0) {
      console.log('⚠️ No hay egresos en el período');
      return [];
    }

    console.log(`💸 Procesando ${expenses.length} egresos`);

    // Agrupar por categoría
    const categoryMap: { [key: string]: ExpensesByCategory } = {};
    expenses.forEach(expense => {
      const category = expense.category || 'Sin categoría';
      if (!categoryMap[category]) {
        categoryMap[category] = { category, total_amount: 0, count: 0 };
      }
      categoryMap[category].total_amount += Number(expense.amount) || 0;
      categoryMap[category].count += 1;
    });

    const result = Object.values(categoryMap).sort((a, b) => b.total_amount - a.total_amount);
    console.log('✅ Egresos por categoría calculados:', result.length, 'categorías');
    return result;
  }

  // ==========================================
  // EXPORTAR A CSV
  // ==========================================
  exportToCSV(data: ReportData, fileName: string): void {
    let csv = '';

    // Resumen
    csv += 'RESUMEN GENERAL\n';
    csv += 'Concepto,Monto\n';
    csv += `Total Ventas,${data.summary.total_sales}\n`;
    csv += `Total Ingresos,${data.summary.total_income}\n`;
    csv += `Total Egresos,${data.summary.total_expenses}\n`;
    csv += `Utilidad,${data.summary.total_profit}\n`;
    csv += `Número de Ventas,${data.summary.sales_count}\n`;
    csv += `Ticket Promedio,${data.summary.average_ticket}\n\n`;

    // Top productos
    csv += 'TOP PRODUCTOS MÁS VENDIDOS\n';
    csv += 'Producto,Cantidad,Ingresos\n';
    data.topProducts.forEach(p => {
      csv += `"${p.product_name}",${p.total_quantity},${p.total_revenue}\n`;
    });
    csv += '\n';

    // Ventas por día
    csv += 'VENTAS POR DÍA\n';
    csv += 'Fecha,Ventas Totales,Cantidad\n';
    data.salesByDay.forEach(s => {
      csv += `${s.sale_date},${s.total_sales},${s.sales_count}\n`;
    });
    csv += '\n';

    // Ventas por método de pago
    csv += 'VENTAS POR MÉTODO DE PAGO\n';
    csv += 'Método,Ventas Totales,Cantidad\n';
    data.salesByPaymentMethod.forEach(s => {
      csv += `${s.payment_method},${s.total_sales},${s.sales_count}\n`;
    });
    csv += '\n';

    // Egresos por categoría
    csv += 'EGRESOS POR CATEGORÍA\n';
    csv += 'Categoría,Monto Total,Cantidad\n';
    data.expensesByCategory.forEach(e => {
      csv += `"${e.category}",${e.total_amount},${e.count}\n`;
    });

    this.downloadFile(csv, fileName, 'text/csv;charset=utf-8;');
  }

  private downloadFile(content: string, fileName: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}