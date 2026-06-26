import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { TransactionsService, Transaction, TransactionStats, TransactionsByCategory } from '../../../../services/transactions.service';
import { AuthService } from '../../../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.page.html',
  styleUrls: ['./expenses.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner]
})
export class ExpensesPage implements OnInit, OnDestroy {
  // ==========================================
  // PROPIEDADES
  // ==========================================
  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  isLoading: boolean = false;
  showModal: boolean = false;
  editingTransaction: Transaction | null = null;
  
  searchQuery: string = '';
  categoryFilter: string = 'all';
  dateFilter: string = 'all';
  startDate: string = '';
  endDate: string = '';

  stats: TransactionStats = {
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    monthIncome: 0,
    monthExpenses: 0,
    monthBalance: 0,
    weekIncome: 0,
    weekExpenses: 0,
    weekBalance: 0,
    todayIncome: 0,
    todayExpenses: 0,
    todayBalance: 0
  };

  transactionsByCategory: TransactionsByCategory[] = [];

  transactionForm = {
    type: 'expense' as 'income' | 'expense',
    category: '',
    amount: 0,
    description: '',
    payment_method: 'cash',
    reference_number: '',
    notes: '',
    transaction_date: new Date().toISOString().split('T')[0]
  };

  businessId: string = '';

  expenseCategories = [
    'Rentas',
    'Servicios (Luz, Agua, Internet)',
    'Suministros',
    'Sueldos y Salarios',
    'Marketing y Publicidad',
    'Transporte',
    'Mantenimiento',
    'Impuestos',
    'Otros egresos'
  ];

  paymentMethods = [
    { id: 'cash', name: 'Efectivo', icon: '💵' },
    { id: 'card', name: 'Tarjeta', icon: '' },
    { id: 'transfer', name: 'Transferencia', icon: '🏦' },
    { id: 'check', name: 'Cheque', icon: '📝' }
  ];

  private transactionsSubscription?: Subscription;

  // ==========================================
  // CONSTRUCTOR
  // ==========================================
  constructor(
    private router: Router,
    private transactionsService: TransactionsService,
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
    this.transactionsSubscription?.unsubscribe();
  }

  async ionViewWillEnter() {
    if (this.businessId) {
      await this.loadData();
    }
  }

  // ==========================================
  // DATA LOADING
  // ==========================================
  async loadData() {
    this.isLoading = true;
    try {
      this.transactionsSubscription = this.transactionsService.transactions$.subscribe((transactions: Transaction[]) => {
        this.transactions = transactions.filter(t => t.type === 'expense');
        this.applyFilters();
      });

      await Promise.all([
        this.transactionsService.getTransactions(this.businessId, 'expense'),
        this.loadStats(),
        this.loadCategoryData()
      ]);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async loadStats() {
    try {
      this.stats = await this.transactionsService.getTransactionStats(this.businessId);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  }

  async loadCategoryData() {
    try {
      this.transactionsByCategory = await this.transactionsService.getTransactionsByCategory(this.businessId, 'expense');
    } catch (error) {
      console.error('Error cargando datos por categoría:', error);
    }
  }

  // ==========================================
  // FILTERS
  // ==========================================
  applyFilters() {
    let filtered = [...this.transactions];

    // Filtro por categoría
    if (this.categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === this.categoryFilter);
    }

    // Filtro por fecha
    if (this.dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date;

      if (this.dateFilter === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (this.dateFilter === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (this.dateFilter === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (this.dateFilter === 'custom' && this.startDate) {
        startDate = new Date(this.startDate);
      } else {
        startDate = new Date(0);
      }

      const endDate = this.dateFilter === 'custom' && this.endDate 
        ? new Date(this.endDate) 
        : now;

      filtered = filtered.filter(t => {
        const transactionDate = new Date(t.transaction_date);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }

    // Filtro por búsqueda
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        (t.notes && t.notes.toLowerCase().includes(query)) ||
        (t.reference_number && t.reference_number.toLowerCase().includes(query))
      );
    }

    this.filteredTransactions = filtered;
  }

  onFilterChange() {
    this.applyFilters();
  }

  // ==========================================
  // MODAL ACTIONS
  // ==========================================
  openCreateModal() {
    this.editingTransaction = null;
    this.transactionForm = {
      type: 'expense',
      category: this.expenseCategories[0],
      amount: 0,
      description: '',
      payment_method: 'cash',
      reference_number: '',
      notes: '',
      transaction_date: new Date().toISOString().split('T')[0]
    };
    this.showModal = true;
  }

  editTransaction(transaction: Transaction) {
    this.editingTransaction = transaction;
    this.transactionForm = {
      type: transaction.type,
      category: transaction.category,
      amount: transaction.amount,
      description: transaction.description,
      payment_method: transaction.payment_method,
      reference_number: transaction.reference_number || '',
      notes: transaction.notes || '',
      transaction_date: transaction.transaction_date.split('T')[0]
    };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editingTransaction = null;
  }

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================
  async saveTransaction() {
    if (!this.transactionForm.description || this.transactionForm.amount <= 0) {
      alert('Completa todos los campos requeridos');
      return;
    }

    this.isLoading = true;

    try {
      if (this.editingTransaction) {
        await this.transactionsService.updateTransaction(this.editingTransaction.id, {
          ...this.transactionForm,
          business_id: this.businessId,
          transaction_date: new Date(this.transactionForm.transaction_date).toISOString()
        });
        console.log('✅ Egreso actualizado');
      } else {
        await this.transactionsService.createTransaction({
          ...this.transactionForm,
          business_id: this.businessId,
          transaction_date: new Date(this.transactionForm.transaction_date).toISOString()
        });
        console.log('✅ Egreso registrado');
      }

      await Promise.all([
        this.loadStats(),
        this.loadCategoryData()
      ]);

      this.closeModal();
    } catch (error) {
      console.error('Error guardando egreso:', error);
      alert('Error al guardar el egreso');
    } finally {
      this.isLoading = false;
    }
  }

  async deleteTransaction(transaction: Transaction) {
    const confirmed = confirm(`¿Estás seguro de eliminar este egreso de ${this.formatCurrency(transaction.amount)}?`);
    if (!confirmed) return;

    this.isLoading = true;

    try {
      await this.transactionsService.deleteTransaction(transaction.id);
      await Promise.all([
        this.loadStats(),
        this.loadCategoryData()
      ]);
      console.log('✅ Egreso eliminado');
    } catch (error) {
      console.error('Error eliminando egreso:', error);
      alert('Error al eliminar el egreso');
    } finally {
      this.isLoading = false;
    }
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

  getPaymentMethodIcon(method: string): string {
    const paymentMethod = this.paymentMethods.find(p => p.id === method);
    return paymentMethod?.icon || '💰';
  }

  getPaymentMethodName(method: string): string {
    const paymentMethod = this.paymentMethods.find(p => p.id === method);
    return paymentMethod?.name || method;
  }

  getCategoryPercentage(category: string): number {
    if (this.stats.totalExpenses === 0) return 0;
    const categoryData = this.transactionsByCategory.find(c => c.category === category);
    return categoryData ? (categoryData.amount / this.stats.totalExpenses) * 100 : 0;
  }
}