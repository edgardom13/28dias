// src/app/pages/dashboard/dashboard-home/dashboard-home.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { DashboardService, DashboardStats, SalesByDay, TopProduct, RecentActivity, Alert } from '../../../services/dashboard.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-dashboard-home',
  templateUrl: './dashboard-home.component.html',
  styleUrls: ['./dashboard-home.component.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, IonSpinner]
})
export class DashboardHomeComponent implements OnInit {
  isLoading: boolean = true;
  businessId: string = '';
  businessName: string = 'Mi Negocio';
  today: Date = new Date();

  stats: DashboardStats = {
    todaySales: 0, todaySalesCount: 0,
    monthIncome: 0, monthExpenses: 0, monthProfit: 0,
    pendingCredits: 0, pendingCreditsCount: 0,
    lowStockCount: 0, totalProducts: 0, totalCustomers: 0
  };

  salesByDay: SalesByDay[] = [];
  topProducts: TopProduct[] = [];
  recentActivity: RecentActivity[] = [];
  alerts: Alert[] = [];

  constructor(
    private dashboardService: DashboardService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      const profile = await this.authService.getUserProfile();
      if (profile?.profile?.business_id) {
        this.businessId = profile.profile.business_id;
        this.businessName = profile.profile.business_name || 'Mi Negocio';
        await this.loadDashboard();
      }
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    }
  }

  async loadDashboard() {
    this.isLoading = true;
    try {
      const [stats, salesByDay, topProducts, recentActivity, alerts] = await Promise.all([
        this.dashboardService.getStats(this.businessId),
        this.dashboardService.getSalesByDay(this.businessId, 7),
        this.dashboardService.getTopProducts(this.businessId, 5),
        this.dashboardService.getRecentActivity(this.businessId, 5),
        this.dashboardService.getAlerts(this.businessId)
      ]);

      this.stats = stats;
      this.salesByDay = salesByDay;
      this.topProducts = topProducts;
      this.recentActivity = recentActivity;
      this.alerts = alerts;
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
    } finally {
      this.isLoading = false;
    }
  }

  navigateTo(link: string) {
    if (link) {
      this.router.navigate([link]);
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0
    }).format(amount);
  }

  // ✅ NUEVO: Formato para el hero (solo número con separadores)
  formatNumber(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatShortDate(date: string): string {
    const d = new Date(date);
    return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
  }

  formatTimeAgo(date: string): string {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }

  // ✅ NUEVO: Detectar si una fecha es hoy
  isToday(date: string): boolean {
    const d = new Date(date);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  }

  getMaxSales(): number {
    if (this.salesByDay.length === 0) return 0;
    return Math.max(...this.salesByDay.map(s => s.total), 1);
  }

  getBarHeight(total: number): string {
    const max = this.getMaxSales();
    if (max === 0) return '0%';
    const percentage = (total / max) * 100;
    return `${Math.max(percentage, 2)}%`;
  }

  getTopProductPercentage(quantity: number): string {
    if (this.topProducts.length === 0) return '0%';
    const max = Math.max(...this.topProducts.map(p => p.quantity));
    return `${(quantity / max) * 100}%`;
  }

  getProfitColor(): string {
    return this.stats.monthProfit >= 0 ? 'profit-positive' : 'profit-negative';
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }
}