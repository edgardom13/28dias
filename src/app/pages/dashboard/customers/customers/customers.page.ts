import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { CustomersService, Customer } from '../../../../services/customers.service';
import { AuthService } from '../../../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-customers',
  templateUrl: './customers.page.html',
  styleUrls: ['./customers.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner]
})
export class CustomersPage implements OnInit, OnDestroy {
  // ==========================================
  // PROPIEDADES
  // ==========================================
  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  isLoading: boolean = false;
  showModal: boolean = false;
  editingCustomer: Customer | null = null;
  searchQuery: string = '';
  viewMode: 'grid' | 'table' = 'grid';
  
  totalCustomers: number = 0;
  activeCustomers: number = 0;
  totalRevenue: number = 0;

  customerForm = {
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  };

  businessId: string = '';

  private customersSubscription?: Subscription;

  // ==========================================
  // GETTERS
  // ==========================================
  get isFormValid(): boolean {
    return this.customerForm.name.trim().length >= 3;
  }

  // ==========================================
  // CONSTRUCTOR
  // ==========================================
  constructor(
    private router: Router,
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
        await this.loadCustomers();
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  }

  ngOnDestroy() {
    this.customersSubscription?.unsubscribe();
  }

  // ==========================================
  // VIEW MODE
  // ==========================================
  setViewMode(mode: 'grid' | 'table') {
    this.viewMode = mode;
  }

  // ==========================================
  // DATA LOADING
  // ==========================================
  async loadCustomers() {
    this.isLoading = true;
    try {
      this.customersSubscription = this.customersService.customers$.subscribe((customers: Customer[]) => {
        this.customers = customers;
        this.filteredCustomers = customers;
        this.updateStats();
      });

      await this.customersService.getCustomers(this.businessId);
    } catch (error) {
      console.error('Error cargando clientes:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // ==========================================
  // FILTERS & STATS
  // ==========================================
  filterCustomers() {
    if (!this.searchQuery.trim()) {
      this.filteredCustomers = [...this.customers];
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredCustomers = this.customers.filter((customer: Customer) => 
        customer.name.toLowerCase().includes(query) ||
        (customer.email && customer.email.toLowerCase().includes(query)) ||
        (customer.phone && customer.phone.toLowerCase().includes(query))
      );
    }
  }

  updateStats() {
    this.totalCustomers = this.customers.length;
    this.activeCustomers = this.customers.filter(c => c.total_purchases > 0).length;
    this.totalRevenue = this.customers.reduce((sum, c) => sum + c.total_spent, 0);
  }

  // ==========================================
  // MODAL ACTIONS
  // ==========================================
  openCreateModal() {
    this.editingCustomer = null;
    this.customerForm = {
      name: '',
      email: '',
      phone: '',
      address: '',
      notes: ''
    };
    this.showModal = true;
  }

  editCustomer(customer: Customer) {
    this.editingCustomer = customer;
    this.customerForm = {
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || ''
    };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editingCustomer = null;
    this.customerForm = {
      name: '',
      email: '',
      phone: '',
      address: '',
      notes: ''
    };
  }

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================
  async saveCustomer() {
    if (!this.customerForm.name || this.customerForm.name.trim().length < 3) {
      alert('El nombre debe tener al menos 3 caracteres');
      return;
    }

    this.isLoading = true;

    try {
      if (this.editingCustomer) {
        await this.customersService.updateCustomer(this.editingCustomer.id, this.customerForm);
        console.log('✅ Cliente actualizado');
      } else {
        await this.customersService.createCustomer(this.businessId, this.customerForm);
        console.log('✅ Cliente creado');
      }

      this.closeModal();

    } catch (error) {
      console.error('Error guardando cliente:', error);
      alert('Error al guardar el cliente');
    } finally {
      this.isLoading = false;
    }
  }

  async deleteCustomer(customer: Customer) {
    const confirmed = confirm(`¿Estás seguro de eliminar a "${customer.name}"? Esta acción no se puede deshacer.`);
    
    if (!confirmed) return;

    this.isLoading = true;

    try {
      await this.customersService.deleteCustomer(customer.id);
      console.log('✅ Cliente eliminado');
    } catch (error) {
      console.error('Error eliminando cliente:', error);
      alert('Error al eliminar el cliente');
    } finally {
      this.isLoading = false;
    }
  }

  viewCustomerDetails(customer: Customer) {
    // TODO: Navegar a página de detalles
    console.log('Ver detalles de:', customer);
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

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  getCustomerColor(customerId: string): string {
    const colors = [
      '#6B21A8', '#EC4899', '#8B5CF6', '#3B82F6', '#10B981',
      '#F59E0B', '#EF4444', '#6366F1', '#14B8A6', '#F97316'
    ];
    const index = parseInt(customerId) % colors.length;
    return colors[index];
  }
}