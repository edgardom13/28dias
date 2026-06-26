import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { OrdersService, Order, OrderItem, PaymentMethod } from '../../../../services/orders.service';
import { CustomersService, Customer } from '../../../../services/customers.service';
import { ProductsService } from '../../../../services/products.service';
import { AuthService } from '../../../../services/auth.service';
import { SocketService } from '../../../../services/socket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-orders',
  templateUrl: './orders.page.html',
  styleUrls: ['./orders.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner]
})
export class OrdersPage implements OnInit, OnDestroy {
  // ==========================================
  // PROPIEDADES
  // ==========================================
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  products: any[] = [];
  filteredProducts: any[] = [];
  paymentMethods: PaymentMethod[] = [];
  isLoading: boolean = false;
  
  // Modales
  showCreateModal: boolean = false;
  showDetailsModal: boolean = false;
  showConfirmModal: boolean = false;
  showCustomerDropdown: boolean = false;
  showProductDropdown: boolean = false;
  showConfirmProductDropdown: boolean = false;
  
  selectedOrder: Order | null = null;
  confirmOrder: Order | null = null;
  
  // Filtros
  statusFilter: string = 'all';
  paymentStatusFilter: string = 'all';
  sourceFilter: string = 'all';
  searchQuery: string = '';
  customerSearchQuery: string = '';
  
  // Stats
  totalOrders: number = 0;
  pendingOrders: number = 0;
  processingOrders: number = 0;
  completedOrders: number = 0;

  businessId: string = '';

  // Form para crear pedido
  orderForm = {
    customer_id: '',
    delivery_type: 'pickup' as 'pickup' | 'delivery',
    notes: '',
    delivery_address: '',
    estimated_date: '',
    payment_method: 'Efectivo',
    payment_status: 'paid' as 'unpaid' | 'partial' | 'paid' | 'refunded'
  };

  // Form para CONFIRMAR pedido
  confirmForm = {
    payment_method: '',
    payment_status: 'paid' as 'unpaid' | 'partial' | 'paid' | 'refunded',
    payment_reference: '',
    payment_amount: 0,
    payment_notes: ''
  };

  // Items para crear pedido
  orderItems: OrderItem[] = [];
  newItem = {
    product_name: '',
    quantity: 1,
    price: 0,
    product_id: ''
  };

  // Items para el modal de confirmar
  confirmItems: any[] = [];
  confirmNewItem = {
    product_name: '',
    quantity: 1,
    price: 0,
    product_id: ''
  };
  confirmFilteredProducts: any[] = [];

  private ordersSubscription?: Subscription;
  private customersSubscription?: Subscription;
  private productsSubscription?: Subscription;
  private paymentMethodsSubscription?: Subscription;
  
  // ✅ Suscripciones específicas para eventos de socket
  private socketOrderNewSubscription?: Subscription;
  private socketOrderUpdateSubscription?: Subscription;
  private socketOrderDeleteSubscription?: Subscription;
  private socketNotificationsSubscription?: Subscription; // ✅ NUEVO
  
  // ✅ Debounce para evitar múltiples refresh seguidos
  private refreshTimeout: any = null;

  // ==========================================
  // GETTERS
  // ==========================================
  get orderSubtotal(): number {
    return this.orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  }

  get orderTax(): number {
    return this.orderSubtotal * 0.16;
  }

  get orderTotal(): number {
    return this.orderSubtotal + this.orderTax;
  }

  get isFormValid(): boolean {
    return this.orderItems.length > 0 && 
           this.orderForm.payment_method !== '' &&
           this.orderForm.payment_method !== undefined;
  }

  get confirmSubtotal(): number {
    return this.confirmItems.reduce((sum, item) => sum + item.subtotal, 0);
  }

  get confirmTax(): number {
    return this.confirmSubtotal * 0.16;
  }

  get confirmTotal(): number {
    return this.confirmSubtotal + this.confirmTax;
  }

  get confirmPaymentBalance(): number {
    if (this.confirmForm.payment_status === 'paid') return 0;
    if (this.confirmForm.payment_status === 'partial') {
      return this.confirmTotal - (this.confirmForm.payment_amount || 0);
    }
    return this.confirmTotal;
  }

  shouldShowConfirmButton(order: Order): boolean {
    if (order.status === 'cancelled') return false;
    if (order.payment_status === 'paid') return false;
    return true;
  }

  isPosPaidOrder(order: Order): boolean {
    return order.source === 'manual' && order.payment_status === 'paid';
  }

  // ==========================================
  // CONSTRUCTOR
  // ==========================================
  constructor(
    private router: Router,
    private ordersService: OrdersService,
    private customersService: CustomersService,
    private productsService: ProductsService,
    private authService: AuthService,
    private socketService: SocketService
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
        this.setupRealtimeUpdates(); // ✅ Configurar actualizaciones en tiempo real
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  }

  ngOnDestroy() {
    // ✅ Limpiar timeout de debounce
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    
    // ✅ Limpiar todas las suscripciones
    this.ordersSubscription?.unsubscribe();
    this.customersSubscription?.unsubscribe();
    this.productsSubscription?.unsubscribe();
    this.paymentMethodsSubscription?.unsubscribe();
    this.socketOrderNewSubscription?.unsubscribe();
    this.socketOrderUpdateSubscription?.unsubscribe();
    this.socketOrderDeleteSubscription?.unsubscribe();
    this.socketNotificationsSubscription?.unsubscribe(); // ✅ NUEVO
  }

  // ==========================================
  // ✅ CONFIGURAR ACTUALIZACIONES EN TIEMPO REAL
  // ==========================================
  private setupRealtimeUpdates() {
    console.log('📡 Configurando actualizaciones en tiempo real para pedidos...');
    
    // ✅ Escuchar NUEVO PEDIDO desde Supabase Realtime
    this.socketOrderNewSubscription = this.socketService.listen<any>('order:new').subscribe(event => {
      console.log('🆕 Nuevo pedido recibido en tiempo real:', event.data);
      this.debouncedRefreshOrders();
    });

    // ✅ Escuchar ACTUALIZACIÓN DE PEDIDO desde Supabase Realtime
    this.socketOrderUpdateSubscription = this.socketService.listen<any>('order:update').subscribe(event => {
      console.log('🔄 Pedido actualizado en tiempo real:', event.data);
      this.debouncedRefreshOrders();
    });

    // ✅ Escuchar ELIMINACIÓN DE PEDIDO desde Supabase Realtime
    this.socketOrderDeleteSubscription = this.socketService.listen<any>('order:delete').subscribe(event => {
      console.log('🗑️ Pedido eliminado en tiempo real:', event.data);
      this.debouncedRefreshOrders();
    });

    // ✅ Escuchar notificaciones generales (guardar suscripción)
    this.socketNotificationsSubscription = this.socketService.notifications$.subscribe(notifications => {
      const orderNotification = notifications.find(n => 
        n.data?.orderId || n.data?.orderNumber || n.title?.includes('Pedido')
      );

      if (orderNotification) {
        console.log('🔔 Notificación de pedido detectada:', orderNotification);
        this.debouncedRefreshOrders();
      }
    });
  }

  // ==========================================
  // ✅ REFRESCAR PEDIDOS CON DEBOUNCE
  // ==========================================
  private debouncedRefreshOrders() {
    // ✅ Limpiar timeout anterior si existe
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    
    // ✅ Ejecutar refresh después de 300ms (debounce)
    this.refreshTimeout = setTimeout(() => {
      this.refreshOrders();
    }, 300);
  }

  // ==========================================
  // ✅ REFRESCAR PEDIDOS
  // ==========================================
  private async refreshOrders() {
    console.log('🔄 Actualizando lista de pedidos en tiempo real...');
    try {
      await this.ordersService.getOrders(this.businessId);
      console.log('✅ Pedidos actualizados correctamente');
    } catch (error) {
      console.error('❌ Error actualizando pedidos:', error);
    }
  }

  // ==========================================
  // DATA LOADING
  // ==========================================
  async loadData() {
    this.isLoading = true;
    try {
      this.ordersSubscription = this.ordersService.orders$.subscribe((orders: Order[]) => {
        this.orders = orders;
        this.filteredOrders = orders;
        this.updateStats();
        this.filterOrders();
      });

      await this.ordersService.getOrders(this.businessId);

      this.customersSubscription = this.customersService.customers$.subscribe((customers: Customer[]) => {
        this.customers = customers;
        this.filteredCustomers = customers;
      });

      await this.customersService.getCustomers(this.businessId);

      this.productsSubscription = this.productsService.products$.subscribe((products: any[]) => {
        this.products = products;
        this.filteredProducts = products;
        this.confirmFilteredProducts = products;
      });

      await this.productsService.getProducts(this.businessId);

      this.paymentMethodsSubscription = this.ordersService.paymentMethods$.subscribe((methods: PaymentMethod[]) => {
        this.paymentMethods = methods;
      });

      await this.ordersService.getPaymentMethods(this.businessId);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // ==========================================
  // FILTERS & STATS
  // ==========================================
  filterOrders() {
    let filtered = [...this.orders];

    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === this.statusFilter);
    }

    if (this.paymentStatusFilter !== 'all') {
      filtered = filtered.filter(order => (order.payment_status || 'unpaid') === this.paymentStatusFilter);
    }

    if (this.sourceFilter !== 'all') {
      filtered = filtered.filter(order => (order.source || 'manual') === this.sourceFilter);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(order => 
        order.order_number.toLowerCase().includes(query) ||
        (order.customer_name && order.customer_name.toLowerCase().includes(query)) ||
        (order.notes && order.notes.toLowerCase().includes(query)) ||
        (order.payment_method && order.payment_method.toLowerCase().includes(query)) ||
        (order.payment_reference && order.payment_reference.toLowerCase().includes(query))
      );
    }

    this.filteredOrders = filtered;
  }

  updateStats() {
    this.totalOrders = this.orders.length;
    this.pendingOrders = this.orders.filter(o => o.status === 'pending').length;
    this.processingOrders = this.orders.filter(o => o.status === 'processing').length;
    this.completedOrders = this.orders.filter(o => o.status === 'completed').length;
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
  }

  selectCustomer(customer: Customer) {
    this.orderForm.customer_id = customer.id;
    this.customerSearchQuery = customer.name;
    this.showCustomerDropdown = false;
  }

  hideCustomerDropdown() {
    setTimeout(() => {
      this.showCustomerDropdown = false;
    }, 200);
  }

  // ==========================================
  // PRODUCT SEARCH & SELECTION (Crear pedido)
  // ==========================================
  onProductSearch() {
    const query = this.newItem.product_name.toLowerCase().trim();
    
    if (query) {
      this.filteredProducts = this.products.filter(product => 
        product.name.toLowerCase().includes(query) ||
        (product.sku && product.sku.toLowerCase().includes(query))
      );
    } else {
      this.filteredProducts = this.products;
    }
    
    this.newItem.product_id = '';
  }

  selectProduct(product: any) {
    this.newItem.product_name = product.name;
    this.newItem.price = product.price;
    this.newItem.product_id = product.id;
    this.showProductDropdown = false;
    
    setTimeout(() => {
      const quantityInput = document.querySelector('.add-item-form .small') as HTMLInputElement;
      if (quantityInput) {
        quantityInput.focus();
        quantityInput.select();
      }
    }, 100);
  }

  hideProductDropdown() {
    setTimeout(() => {
      this.showProductDropdown = false;
    }, 200);
  }

  // ==========================================
  // PRODUCT SEARCH & SELECTION (Modal Confirmar)
  // ==========================================
  onConfirmProductSearch() {
    const query = this.confirmNewItem.product_name.toLowerCase().trim();
    
    if (query) {
      this.confirmFilteredProducts = this.products.filter(product => 
        product.name.toLowerCase().includes(query) ||
        (product.sku && product.sku.toLowerCase().includes(query))
      );
    } else {
      this.confirmFilteredProducts = this.products;
    }
    
    this.confirmNewItem.product_id = '';
  }

  selectConfirmProduct(product: any) {
    this.confirmNewItem.product_name = product.name;
    this.confirmNewItem.price = product.price;
    this.confirmNewItem.product_id = product.id;
    this.showConfirmProductDropdown = false;
  }

  hideConfirmProductDropdown() {
    setTimeout(() => {
      this.showConfirmProductDropdown = false;
    }, 200);
  }

  addConfirmItem() {
    if (!this.confirmNewItem.product_name || this.confirmNewItem.quantity <= 0 || this.confirmNewItem.price <= 0) {
      alert('⚠️ Completa todos los campos del producto');
      return;
    }

    this.confirmItems.push({
      id: `temp-${Date.now()}`,
      product_name: this.confirmNewItem.product_name,
      quantity: this.confirmNewItem.quantity,
      price: this.confirmNewItem.price,
      subtotal: this.confirmNewItem.quantity * this.confirmNewItem.price,
      product_id: this.confirmNewItem.product_id,
      is_new: true
    });

    this.confirmNewItem = {
      product_name: '',
      quantity: 1,
      price: 0,
      product_id: ''
    };
    this.confirmFilteredProducts = this.products;
  }

  removeConfirmItem(index: number) {
    this.confirmItems.splice(index, 1);
  }

  updateConfirmItemSubtotal(index: number) {
    const item = this.confirmItems[index];
    if (item.quantity < 1) item.quantity = 1;
    item.subtotal = item.quantity * item.price;
  }

  // ==========================================
  // MODAL ACTIONS
  // ==========================================
  openCreateModal() {
    this.selectedOrder = null;
    
    const defaultPaymentMethod = this.paymentMethods.length > 0 
      ? this.paymentMethods[0].name 
      : 'Efectivo';
    
    this.orderForm = {
      customer_id: '',
      delivery_type: 'pickup',
      notes: '',
      delivery_address: '',
      estimated_date: '',
      payment_method: defaultPaymentMethod,
      payment_status: 'paid'
    };
    
    this.orderItems = [];
    this.newItem = {
      product_name: '',
      quantity: 1,
      price: 0,
      product_id: ''
    };
    this.customerSearchQuery = '';
    this.filteredCustomers = this.customers;
    this.filteredProducts = this.products;
    this.showCreateModal = true;
    document.body.style.overflow = 'hidden';
  }

  viewOrderDetails(order: Order) {
    this.selectedOrder = order;
    this.showDetailsModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeCreateModal() {
    this.showCreateModal = false;
    document.body.style.overflow = '';
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedOrder = null;
    document.body.style.overflow = '';
  }

  // ==========================================
  // CONFIRM ORDER MODAL - INTEGRAL
  // ==========================================
  openConfirmModal(order: Order) {
    this.confirmOrder = order;
    
    this.confirmItems = (order.items || []).map(item => ({
      ...item,
      is_new: false
    }));

    const hasValidPaymentMethod = order.payment_method && 
                                   order.payment_method !== 'Pendiente' && 
                                   order.payment_method !== '';
    
    this.confirmForm = {
      payment_method: hasValidPaymentMethod ? order.payment_method! : '',
      payment_status: 'paid',
      payment_reference: order.payment_reference || '',
      payment_amount: order.total,
      payment_notes: order.payment_notes || ''
    };

    this.confirmNewItem = {
      product_name: '',
      quantity: 1,
      price: 0,
      product_id: ''
    };
    this.confirmFilteredProducts = this.products;

    this.showConfirmModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeConfirmModal() {
    this.showConfirmModal = false;
    this.confirmOrder = null;
    this.confirmItems = [];
    document.body.style.overflow = '';
  }

  isConfirmFormValid(): boolean {
    if (this.confirmItems.length === 0) return false;
    if (!this.confirmForm.payment_method || this.confirmForm.payment_method === '') return false;
    if (!this.confirmForm.payment_status) return false;
    
    if (this.confirmForm.payment_status === 'partial') {
      if (!this.confirmForm.payment_amount || this.confirmForm.payment_amount <= 0) {
        return false;
      }
      if (this.confirmForm.payment_amount > this.confirmTotal) {
        return false;
      }
    }
    
    return true;
  }

  async saveConfirmOrder() {
    if (!this.confirmOrder) return;

    if (this.confirmItems.length === 0) {
      alert('⚠️ El pedido debe tener al menos un producto');
      return;
    }

    if (!this.confirmForm.payment_method || this.confirmForm.payment_method === '') {
      alert('⚠️ Debes seleccionar el método de pago');
      return;
    }

    this.isLoading = true;

    try {
      const newSubtotal = this.confirmSubtotal;
      const newTax = this.confirmTax;
      const newTotal = this.confirmTotal;

      let paymentAmount = 0;
      let paymentDate: string | undefined = undefined;
      let newStatus: 'pending' | 'processing' | 'completed' = 'processing';

      if (this.confirmForm.payment_status === 'paid') {
        paymentAmount = newTotal;
        paymentDate = new Date().toISOString();
        newStatus = 'completed';
      } else if (this.confirmForm.payment_status === 'partial') {
        paymentAmount = this.confirmForm.payment_amount;
        paymentDate = new Date().toISOString();
        newStatus = 'processing';
      } else {
        newStatus = 'processing';
      }

      // 1. Actualizar información de pago
      await this.ordersService.updateOrderPayment(
        this.confirmOrder.id,
        {
          payment_method: this.confirmForm.payment_method,
          payment_status: this.confirmForm.payment_status,
          payment_reference: this.confirmForm.payment_reference || undefined,
          payment_amount: paymentAmount,
          payment_date: paymentDate,
          payment_notes: this.confirmForm.payment_notes || undefined,
          subtotal: newSubtotal,
          tax: newTax,
          total: newTotal
        }
      );

      // 2. Sincronizar items
      await this.syncOrderItems(this.confirmOrder.id, this.confirmItems);

      // 3. Actualizar estado del pedido según el pago
      if (this.confirmOrder.status !== newStatus) {
        await this.ordersService.updateOrderStatus(this.confirmOrder.id, newStatus);
        console.log(`✅ Estado actualizado: ${this.confirmOrder.status} → ${newStatus}`);
      }

      // ✅ NO emitir evento local - Supabase Realtime lo detectará automáticamente
      // this.socketService.emit('order:update', this.confirmOrder); // ❌ ELIMINADO

      this.closeConfirmModal();
      console.log('✅ Pedido confirmado correctamente');
    } catch (error) {
      console.error('Error confirmando pedido:', error);
      alert('❌ Error al confirmar el pedido');
    } finally {
      this.isLoading = false;
    }
  }

  async syncOrderItems(orderId: string, items: any[]) {
    try {
      await this.ordersService.deleteOrderItems(orderId);

      if (items.length > 0) {
        const itemsToInsert = items.map(item => ({
          order_id: orderId,
          product_id: item.product_id || null,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal
        }));

        await this.ordersService.insertOrderItems(itemsToInsert);
      }

      // ✅ NO recargar aquí - Supabase Realtime lo detectará
      // await this.ordersService.getOrders(this.businessId); // ❌ ELIMINADO
    } catch (error) {
      console.error('Error sincronizando items:', error);
      throw error;
    }
  }

  // ==========================================
  // ORDER ITEMS (Crear pedido)
  // ==========================================
  addItem() {
    if (!this.newItem.product_name || this.newItem.quantity <= 0 || this.newItem.price <= 0) {
      alert('⚠️ Completa todos los campos del item');
      return;
    }

    this.orderItems.push({
      product_name: this.newItem.product_name,
      quantity: this.newItem.quantity,
      price: this.newItem.price,
      subtotal: this.newItem.quantity * this.newItem.price,
      product_id: this.newItem.product_id
    } as any);

    this.newItem = {
      product_name: '',
      quantity: 1,
      price: 0,
      product_id: ''
    };
    
    this.filteredProducts = this.products;
  }

  removeItem(index: number) {
    this.orderItems.splice(index, 1);
  }

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================
  async createOrder() {
    if (this.orderItems.length === 0) {
      alert('⚠️ Debes agregar al menos un item al pedido');
      return;
    }

    if (!this.orderForm.payment_method) {
      alert('⚠️ Selecciona un método de pago');
      return;
    }

    if (this.orderForm.delivery_type === 'delivery' && !this.orderForm.delivery_address?.trim()) {
      alert('⚠️ Ingresa la dirección de entrega');
      return;
    }

    this.isLoading = true;

    try {
      let paymentAmount = 0;
      let paymentDate: string | undefined = undefined;

      if (this.orderForm.payment_status === 'paid') {
        paymentAmount = this.orderTotal;
        paymentDate = new Date().toISOString();
      }

      const newOrder = await this.ordersService.createOrder({
        business_id: this.businessId,
        customer_id: this.orderForm.customer_id || undefined,
        status: 'pending',
        delivery_type: this.orderForm.delivery_type as 'pickup' | 'delivery',
        notes: this.orderForm.notes,
        delivery_address: this.orderForm.delivery_address,
        estimated_date: this.orderForm.estimated_date,
        subtotal: this.orderSubtotal,
        tax: this.orderTax,
        total: this.orderTotal,
        payment_method: this.orderForm.payment_method,
        payment_status: this.orderForm.payment_status,
        payment_amount: paymentAmount,
        payment_date: paymentDate,
        source: 'manual'
      }, this.orderItems);

      // ✅ NO emitir evento local - Supabase Realtime lo detectará automáticamente
      // this.socketService.emitNewOrder(newOrder); // ❌ ELIMINADO

      this.closeCreateModal();
      console.log('✅ Pedido creado correctamente');
    } catch (error) {
      console.error('Error creando pedido:', error);
      alert('❌ Error al crear el pedido');
    } finally {
      this.isLoading = false;
    }
  }

  async cancelOrder(order: Order) {
    const confirmed = confirm(`¿Estás seguro de cancelar el pedido ${order.order_number}?`);
    if (!confirmed) return;

    this.isLoading = true;

    try {
      await this.ordersService.updateOrderStatus(order.id, 'cancelled');
      
      // ✅ NO emitir evento local - Supabase Realtime lo detectará automáticamente
      // this.socketService.emit('order:update', { ...order, status: 'cancelled' }); // ❌ ELIMINADO
      
      console.log('✅ Pedido cancelado');
    } catch (error) {
      console.error('Error cancelando pedido:', error);
      alert('Error al cancelar el pedido');
    } finally {
      this.isLoading = false;
    }
  }

  async deleteOrder(order: Order) {
    const confirmed = confirm(`¿Estás seguro de eliminar el pedido ${order.order_number}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    this.isLoading = true;

    try {
      await this.ordersService.deleteOrder(order.id);
      
      // ✅ NO emitir evento local - Supabase Realtime lo detectará automáticamente
      // this.socketService.emit('order:delete', order.id); // ❌ ELIMINADO
      
      console.log('✅ Pedido eliminado');
    } catch (error) {
      console.error('Error eliminando pedido:', error);
      alert('Error al eliminar el pedido');
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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'pending': return 'pending';
      case 'processing': return 'processing';
      case 'completed': return 'completed';
      case 'cancelled': return 'cancelled';
      default: return 'pending';
    }
  }

  getStatusText(status: string): string {
    const texts: { [key: string]: string } = {
      'pending': 'Pendiente',
      'processing': 'En Proceso',
      'completed': 'Completado',
      'cancelled': 'Cancelado'
    };
    return texts[status] || status;
  }

  getPaymentStatusBadgeClass(status: string): string {
    switch (status) {
      case 'unpaid': return 'unpaid';
      case 'partial': return 'partial';
      case 'paid': return 'paid';
      case 'refunded': return 'refunded';
      default: return 'unpaid';
    }
  }

  getPaymentStatusText(status: string): string {
    const texts: { [key: string]: string } = {
      'unpaid': 'No Pagado',
      'partial': 'Pago Parcial',
      'paid': 'Pagado',
      'refunded': 'Reembolsado'
    };
    return texts[status] || 'Sin información';
  }

  getSourceBadgeClass(source: string): string {
    switch (source) {
      case 'manual': return 'manual';
      case 'catalog': return 'catalog';
      case 'website': return 'website';
      default: return 'manual';
    }
  }

  getSourceText(source: string): string {
    const texts: { [key: string]: string } = {
      'manual': 'Manual',
      'catalog': 'Catálogo',
      'website': 'Sitio Web'
    };
    return texts[source] || source;
  }

  getSourceIcon(source: string): string {
    const icons: { [key: string]: string } = {
      'manual': '✍️',
      'catalog': '📱',
      'website': '🌐'
    };
    return icons[source] || '📦';
  }

  getPaymentMethodIcon(method: string): string {
    const lower = method.toLowerCase();
    if (lower.includes('efectivo') || lower.includes('cash')) return '💵';
    if (lower.includes('transfer')) return '🏦';
    if (lower.includes('tarjeta') || lower.includes('card')) return '💳';
    if (lower.includes('digital') || lower.includes('wallet')) return '📱';
    return '💰';
  }

  getCustomerName(customerId: string): string {
    if (!customerId) return 'Cliente anónimo';
    const customer = this.customers.find(c => c.id === customerId);
    return customer ? customer.name : 'Cliente no registrado';
  }

  getInitials(name: string): string {
    if (!name || name === 'Cliente anónimo') return '👤';
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
}