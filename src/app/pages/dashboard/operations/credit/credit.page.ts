import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { CreditsService, Credit, CreditPayment, CreditStats } from '../../../../services/credits.service';
import { CustomersService, Customer } from '../../../../services/customers.service';
import { AuthService } from '../../../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-credit',
  templateUrl: './credit.page.html',
  styleUrls: ['./credit.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner]
})
export class CreditPage implements OnInit, OnDestroy {
  // ==========================================
  // PROPIEDADES
  // ==========================================
  credits: Credit[] = [];
  filteredCredits: Credit[] = [];
  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  isLoading: boolean = false;
  
  showCreateModal: boolean = false;
  showPaymentModal: boolean = false;
  showDetailsModal: boolean = false;
  showCustomerDropdown: boolean = false;
  
  selectedCredit: Credit | null = null;
  creditPayments: CreditPayment[] = [];
  
  statusFilter: string = 'all';
  searchQuery: string = '';
  customerSearchQuery: string = '';
  
  stats: CreditStats = {
    totalCredits: 0,
    totalAmount: 0,
    pendingAmount: 0,
    paidAmount: 0,
    overdueAmount: 0,
    overdueCount: 0
  };

  creditForm = {
    customer_id: '',
    customer_name: '',
    total_amount: 0,
    due_date: '',
    notes: ''
  };

  paymentForm = {
    amount: 0,
    payment_method: 'cash',
    notes: ''
  };

  businessId: string = '';

  private creditsSubscription?: Subscription;
  private customersSubscription?: Subscription;

  // ==========================================
  // GETTERS
  // ==========================================
  get isCreditFormValid(): boolean {
    return this.creditForm.customer_name.trim().length >= 2 && 
           this.creditForm.total_amount > 0;
  }

  get isPaymentFormValid(): boolean {
    if (!this.selectedCredit) return false;
    return this.paymentForm.amount > 0 && 
           this.paymentForm.amount <= this.selectedCredit.remaining_amount;
  }

  // ==========================================
  // CONSTRUCTOR
  // ==========================================
  constructor(
    private router: Router,
    private creditsService: CreditsService,
    private customersService: CustomersService,
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
    this.creditsSubscription?.unsubscribe();
    this.customersSubscription?.unsubscribe();
  }

  // ==========================================
  // DATA LOADING
  // ==========================================
  async loadData() {
    this.isLoading = true;
    try {
      this.creditsSubscription = this.creditsService.credits$.subscribe((credits: Credit[]) => {
        this.credits = credits;
        this.applyFilters();
      });

      this.customersSubscription = this.customersService.customers$.subscribe((customers: Customer[]) => {
        this.customers = customers;
        this.filteredCustomers = customers;
      });

      await Promise.all([
        this.creditsService.getCredits(this.businessId),
        this.customersService.getCustomers(this.businessId),
        this.loadStats()
      ]);

      // ✅ NUEVO: Verificar y notificar fiados vencidos al cargar
      await this.creditsService.checkAndNotifyOverdueCredits(this.businessId);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async loadStats() {
    try {
      this.stats = await this.creditsService.getCreditStats(this.businessId);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  }

  // ==========================================
  // FILTERS
  // ==========================================
  applyFilters() {
    let filtered = [...this.credits];

    if (this.statusFilter !== 'all') {
      if (this.statusFilter === 'overdue') {
        const now = new Date();
        filtered = filtered.filter(c => 
          c.status !== 'paid' && 
          c.status !== 'cancelled' && 
          c.due_date && 
          new Date(c.due_date) < now
        );
      } else {
        filtered = filtered.filter(c => c.status === this.statusFilter);
      }
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.customer_name.toLowerCase().includes(query) ||
        (c.notes && c.notes.toLowerCase().includes(query))
      );
    }

    this.filteredCredits = filtered;
  }

  onFilterChange() {
    this.applyFilters();
  }

  // ==========================================
  // CUSTOMER SEARCH & SELECTION
  // ==========================================
  onCustomerSearch() {
    const query = this.customerSearchQuery.toLowerCase().trim();
    
    if (query) {
      this.filteredCustomers = this.customers.filter(customer => 
        customer.name.toLowerCase().includes(query) ||
        (customer.email && customer.email.toLowerCase().includes(query)) ||
        (customer.phone && customer.phone.includes(query))
      );
    } else {
      this.filteredCustomers = this.customers;
    }
    
    this.creditForm.customer_name = this.customerSearchQuery;
  }

  selectCustomer(customer: Customer) {
    this.creditForm.customer_id = customer.id;
    this.creditForm.customer_name = customer.name;
    this.customerSearchQuery = customer.name;
    this.showCustomerDropdown = false;
  }

  hideCustomerDropdown() {
    setTimeout(() => {
      this.showCustomerDropdown = false;
    }, 200);
  }

  // ==========================================
  // MODAL ACTIONS
  // ==========================================
  openCreateModal() {
    this.creditForm = {
      customer_id: '',
      customer_name: '',
      total_amount: 0,
      due_date: '',
      notes: ''
    };
    this.customerSearchQuery = '';
    this.filteredCustomers = this.customers;
    this.showCreateModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeCreateModal() {
    this.showCreateModal = false;
    document.body.style.overflow = '';
  }

  openPaymentModal(credit: Credit) {
    this.selectedCredit = credit;
    this.paymentForm = {
      amount: credit.remaining_amount,
      payment_method: 'cash',
      notes: ''
    };
    this.showPaymentModal = true;
    document.body.style.overflow = 'hidden';
  }

  closePaymentModal() {
    this.showPaymentModal = false;
    this.selectedCredit = null;
    document.body.style.overflow = '';
  }

  async viewCreditDetails(credit: Credit) {
    this.selectedCredit = credit;
    try {
      this.creditPayments = await this.creditsService.getPaymentsByCredit(credit.id);
      this.showDetailsModal = true;
      document.body.style.overflow = 'hidden';
    } catch (error) {
      console.error('Error cargando detalles:', error);
      alert('Error al cargar los detalles');
    }
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedCredit = null;
    this.creditPayments = [];
    document.body.style.overflow = '';
  }

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================
  async createCredit() {
    if (!this.isCreditFormValid) {
      alert('Completa todos los campos requeridos');
      return;
    }

    this.isLoading = true;

    try {
      await this.creditsService.createCredit({
        business_id: this.businessId,
        customer_id: this.creditForm.customer_id || undefined,
        customer_name: this.creditForm.customer_name,
        total_amount: this.creditForm.total_amount,
        due_date: this.creditForm.due_date || undefined,
        notes: this.creditForm.notes
      });

      await this.loadStats();
      this.closeCreateModal();
      console.log('✅ Fiado registrado');
    } catch (error) {
      console.error('Error creando fiado:', error);
      alert('Error al registrar el fiado');
    } finally {
      this.isLoading = false;
    }
  }

  async addPayment() {
    if (!this.selectedCredit || !this.isPaymentFormValid) {
      alert('Ingresa un monto válido');
      return;
    }

    this.isLoading = true;

    try {
      await this.creditsService.addPayment({
        credit_id: this.selectedCredit.id,
        business_id: this.businessId,
        amount: this.paymentForm.amount,
        payment_method: this.paymentForm.payment_method,
        notes: this.paymentForm.notes
      });

      this.creditPayments = await this.creditsService.getPaymentsByCredit(this.selectedCredit.id);
      
      const updatedCredit = await this.creditsService.getCreditById(this.selectedCredit.id);
      if (updatedCredit) {
        this.selectedCredit = updatedCredit;
      }

      await this.loadStats();
      this.paymentForm = {
        amount: this.selectedCredit?.remaining_amount || 0,
        payment_method: 'cash',
        notes: ''
      };

      console.log('✅ Abono registrado');
    } catch (error) {
      console.error('Error registrando abono:', error);
      alert('Error al registrar el abono');
    } finally {
      this.isLoading = false;
    }
  }

  async cancelCredit(credit: Credit) {
    const confirmed = confirm(`¿Estás seguro de cancelar el fiado de ${credit.customer_name}?`);
    if (!confirmed) return;

    this.isLoading = true;

    try {
      await this.creditsService.updateCreditStatus(credit.id, 'cancelled');
      await this.loadStats();
      console.log('✅ Fiado cancelado');
    } catch (error) {
      console.error('Error cancelando fiado:', error);
      alert('Error al cancelar el fiado');
    } finally {
      this.isLoading = false;
    }
  }

  async deleteCredit(credit: Credit) {
    const confirmed = confirm(`¿Estás seguro de eliminar el fiado de ${credit.customer_name}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    this.isLoading = true;

    try {
      await this.creditsService.deleteCredit(credit.id);
      await this.loadStats();
      console.log('✅ Fiado eliminado');
    } catch (error) {
      console.error('Error eliminando fiado:', error);
      alert('Error al eliminar el fiado');
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

  getStatusBadgeClass(status: string): string {
    const classes: { [key: string]: string } = {
      'pending': 'pending',
      'partial': 'partial',
      'paid': 'paid',
      'cancelled': 'cancelled',
      'overdue': 'overdue'
    };
    return classes[status] || '';
  }

  getStatusText(status: string): string {
    const texts: { [key: string]: string } = {
      'pending': 'Pendiente',
      'partial': 'Parcial',
      'paid': 'Pagado',
      'cancelled': 'Cancelado',
      'overdue': 'Vencido'
    };
    return texts[status] || status;
  }

  isOverdue(credit: Credit): boolean {
    if (!credit.due_date || credit.status === 'paid' || credit.status === 'cancelled') {
      return false;
    }
    return new Date(credit.due_date) < new Date();
  }

  getProgressPercentage(credit: Credit): number {
    if (credit.total_amount === 0) return 0;
    return (credit.paid_amount / credit.total_amount) * 100;
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

  getTodayDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}