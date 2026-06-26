import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { SalesService, Sale, SaleStats, SalesByDate, SalesByProduct } from '../../../../services/sales.service';
import { AuthService } from '../../../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sales-history',
  templateUrl: './sales-history.page.html',
  styleUrls: ['./sales-history.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner]
})
export class SalesHistoryPage implements OnInit, OnDestroy {
  // ==========================================
  // PROPIEDADES
  // ==========================================
  sales: Sale[] = [];
  filteredSales: Sale[] = [];
  isLoading: boolean = false;
  showDetailsModal: boolean = false;
  selectedSale: Sale | null = null;
  saleItems: any[] = [];
  
  stats: SaleStats = {
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

  salesByDate: SalesByDate[] = [];
  topProducts: SalesByProduct[] = [];

  searchQuery: string = '';
  dateFilter: string = 'all';
  startDate: string = '';
  endDate: string = '';

  businessId: string = '';

  private salesSubscription?: Subscription;

  // ==========================================
  // CONSTRUCTOR
  // ==========================================
  constructor(
    private router: Router,
    private salesService: SalesService,
    private authService: AuthService
  ) {}

  // ==========================================
  // LIFECYCLE
  // ==========================================
  async ngOnInit() {
    try {
      const profile = await this.authService.getUserProfile();
      if (profile?.profile?.business_id) {
        this.businessId = profile.profile.business_id;
        await this.loadData();
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  }

  ngOnDestroy() {
    this.salesSubscription?.unsubscribe();
  }

  // ==========================================
  // DATA LOADING
  // ==========================================
  async loadData() {
    this.isLoading = true;
    try {
      this.salesSubscription = this.salesService.sales$.subscribe((sales: Sale[]) => {
        this.sales = sales;
        this.applyFilters();
      });

      await Promise.all([
        this.salesService.getSales(this.businessId),
        this.loadStats(),
        this.loadChartData(),
        this.loadTopProducts()
      ]);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async loadStats() {
    try {
      this.stats = await this.salesService.getSalesStats(this.businessId);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  }

  async loadChartData() {
    try {
      this.salesByDate = await this.salesService.getSalesByDate(this.businessId, 30);
    } catch (error) {
      console.error('Error cargando datos de gráfico:', error);
    }
  }

  async loadTopProducts() {
    try {
      this.topProducts = await this.salesService.getTopSellingProducts(this.businessId, 5);
    } catch (error) {
      console.error('Error cargando productos top:', error);
    }
  }

  // ==========================================
  // FILTERS
  // ==========================================
  applyFilters() {
    let filtered = [...this.sales];

    // Filtro por fecha
    if (this.dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date;

      if (this.dateFilter === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (this.dateFilter === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (this.dateFilter === 'month') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (this.dateFilter === 'custom' && this.startDate) {
        startDate = new Date(this.startDate);
      } else {
        startDate = new Date(0);
      }

      const endDate = this.dateFilter === 'custom' && this.endDate 
        ? new Date(this.endDate) 
        : now;

      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.completed_at || sale.created_at || '');
        return saleDate >= startDate && saleDate <= endDate;
      });
    }

    // Filtro por búsqueda
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(sale => 
        sale.order_number.toLowerCase().includes(query) ||
        (sale.customer_name && sale.customer_name.toLowerCase().includes(query)) ||
        (sale.notes && sale.notes.toLowerCase().includes(query))
      );
    }

    this.filteredSales = filtered;
  }

  onFilterChange() {
    this.applyFilters();
  }

  // ==========================================
  // MODAL ACTIONS
  // ==========================================
  async viewSaleDetails(sale: Sale) {
    this.selectedSale = sale;
    try {
      this.saleItems = await this.salesService.getSaleItems(sale.id);
      this.showDetailsModal = true;
    } catch (error) {
      console.error('Error cargando detalles:', error);
      alert('Error al cargar los detalles');
    }
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedSale = null;
    this.saleItems = [];
  }

  // ==========================================
  // UTILS
  // ==========================================
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  }

  formatDate(date: string | undefined): string {
    if (!date) return 'Sin fecha';
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatDateTime(date: string | undefined): string {
    if (!date) return 'Sin fecha';
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getCustomerName(sale: Sale): string {
    return sale.customer_name || 'Cliente no registrado';
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  getCustomerColor(id: string): string {
    const colors = [
      '#6B21A8', '#EC4899', '#8B5CF6', '#3B82F6', '#10B981',
      '#F59E0B', '#EF4444', '#6366F1', '#14B8A6', '#F97316'
    ];
    const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  }

  // ==========================================
  // CHART HELPERS
  // ==========================================
  getMaxSalesValue(): number {
    if (this.salesByDate.length === 0) return 0;
    return Math.max(...this.salesByDate.map(s => s.total));
  }

  getBarHeight(total: number): string {
    const max = this.getMaxSalesValue();
    if (max === 0) return '0%';
    return `${(total / max) * 100}%`;
  }
}