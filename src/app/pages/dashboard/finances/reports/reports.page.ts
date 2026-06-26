import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { ReportsService, ReportData } from '../../../../services/reports.service';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner]
})
export class ReportsPage implements OnInit {
  businessId: string = '';
  isLoading: boolean = false;
  
  // Periodos predefinidos
  dateRange: string = 'month';
  startDate: string = '';
  endDate: string = '';
  
  reportData: ReportData = {
    summary: {
      total_sales: 0,
      total_income: 0,
      total_expenses: 0,
      total_profit: 0,
      sales_count: 0,
      average_ticket: 0
    },
    topProducts: [],
    salesByDay: [],
    salesByPaymentMethod: [],
    expensesByCategory: []
  };

  constructor(
    private reportsService: ReportsService,
    private authService: AuthService
  ) {
    this.initializeDates();
  }

  async ngOnInit() {
    try {
      const profile = await this.authService.getUserProfile();
      if (profile?.profile?.business_id) {
        this.businessId = profile.profile.business_id;
        console.log('✅ Business ID cargado:', this.businessId);
        await this.loadReport();
      } else {
        console.error('❌ No se encontró business_id en el perfil');
      }
    } catch (error) {
      console.error('❌ Error cargando datos:', error);
    }
  }

  initializeDates() {
    const today = new Date();
    this.endDate = this.formatDateISO(today);
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    this.startDate = this.formatDateISO(startDate);
  }

  private formatDateISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onDateRangeChange() {
    const today = new Date();
    let startDate = new Date();

    switch (this.dateRange) {
      case 'today':
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case 'week':
        startDate.setDate(today.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(today.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(today.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      case 'custom':
        return; // No cambiar fechas en custom
    }

    this.startDate = this.formatDateISO(startDate);
    this.endDate = this.formatDateISO(today);
    this.loadReport();
  }

  async loadReport() {
    if (!this.businessId || !this.startDate || !this.endDate) {
      console.error('❌ Faltan parámetros:', {
        businessId: this.businessId,
        startDate: this.startDate,
        endDate: this.endDate
      });
      return;
    }

    this.isLoading = true;
    try {
      console.log('🔄 Cargando reporte...');
      this.reportData = await this.reportsService.getReportData(
        this.businessId,
        this.startDate,
        this.endDate
      );
      console.log('✅ Reporte cargado exitosamente:', this.reportData);
    } catch (error) {
      console.error('❌ Error cargando reporte:', error);
      alert('Error al cargar el reporte. Revisa la consola para más detalles.');
    } finally {
      this.isLoading = false;
    }
  }

  exportCSV() {
    const fileName = `reporte_${this.startDate}_${this.endDate}.csv`;
    this.reportsService.exportToCSV(this.reportData, fileName);
  }

  printReport() {
    window.print();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-MX', {
      month: 'short',
      day: 'numeric'
    });
  }

  getPaymentMethodLabel(method: string): string {
    const labels: { [key: string]: string } = {
      'cash': '💵 Efectivo',
      'card': '💳 Tarjeta',
      'transfer': '🏦 Transferencia',
      'mixed': '🔀 Mixto',
      'unknown': '❓ Desconocido'
    };
    return labels[method] || method;
  }

  // ==========================================
  // GRÁFICOS - CALCULADORES
  // ==========================================
  getMaxSalesDay(): number {
    if (!this.reportData.salesByDay.length) return 0;
    return Math.max(...this.reportData.salesByDay.map(d => d.total_sales));
  }

  getSalesBarHeight(amount: number): string {
    const max = this.getMaxSalesDay();
    if (max === 0) return '0%';
    return `${(amount / max) * 100}%`;
  }

  getMaxTopProduct(): number {
    if (!this.reportData.topProducts.length) return 0;
    return Math.max(...this.reportData.topProducts.map(p => p.total_quantity));
  }

  getProductBarHeight(quantity: number): string {
    const max = this.getMaxTopProduct();
    if (max === 0) return '0%';
    return `${(quantity / max) * 100}%`;
  }

  getTotalPaymentMethods(): number {
    return this.reportData.salesByPaymentMethod.reduce((sum, p) => sum + p.total_sales, 0);
  }

  getPaymentMethodPercentage(amount: number): number {
    const total = this.getTotalPaymentMethods();
    if (total === 0) return 0;
    return (amount / total) * 100;
  }

  getTotalExpenses(): number {
    return this.reportData.expensesByCategory.reduce((sum, e) => sum + e.total_amount, 0);
  }

  getExpensePercentage(amount: number): number {
    const total = this.getTotalExpenses();
    if (total === 0) return 0;
    return (amount / total) * 100;
  }

  getExpenseColor(index: number): string {
    const colors = [
      '#ef4444', '#f97316', '#eab308', '#84cc16', 
      '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
      '#8b5cf6', '#ec4899'
    ];
    return colors[index % colors.length];
  }

  getProfitMargin(): number {
    if (this.reportData.summary.total_income === 0) return 0;
    return (this.reportData.summary.total_profit / this.reportData.summary.total_income) * 100;
  }
}