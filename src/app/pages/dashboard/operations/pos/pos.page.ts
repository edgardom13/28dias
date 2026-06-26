import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { ProductsService, Category } from '../../../../services/products.service';
import { AuthService } from '../../../../services/auth.service';
import { SupabaseService } from '../../../../services/supabase.service';
import { SocketService } from '../../../../services/socket.service';
import { Subscription } from 'rxjs';

interface CartItem {
  product: any;
  quantity: number;
  subtotal: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
}

@Component({
  selector: 'app-pos',
  templateUrl: './pos.page.html',
  styleUrls: ['./pos.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner]
})
export class PosPage implements OnInit, OnDestroy {
  private readonly CART_STORAGE_KEY = 'pos_cart';

  products: any[] = [];
  filteredProducts: any[] = [];
  categories: Category[] = [];
  cart: CartItem[] = [];
  searchQuery: string = '';
  selectedCategory: string | null = null;
  isLoading: boolean = false;
  showPaymentModal: boolean = false;
  showReceiptModal: boolean = false;
  showCartModal: boolean = false;
  
  // View mode: 'grid' o 'table'
  viewMode: 'grid' | 'table' = 'grid';
  
  paymentMethod: string = 'cash';
  cashReceived: number = 0;
  change: number = 0;
  lastReceipt: any = null;

  businessId: string = '';
  userEmail: string = '';
  businessName: string = '';
  
  paymentMethods: PaymentMethod[] = [
    { id: 'cash', name: 'Efectivo', icon: '💵' },
    { id: 'card', name: 'Tarjeta', icon: '💳' },
    { id: 'transfer', name: 'Transferencia', icon: '🏦' },
    { id: 'mixed', name: 'Mixto', icon: '🔀' }
  ];

  private productsSubscription?: Subscription;
  private categoriesSubscription?: Subscription;

  get subtotal(): number {
    return this.cart.reduce((sum, item) => sum + item.subtotal, 0);
  }

  get tax(): number {
    return this.subtotal * 0.16;
  }

  get total(): number {
    return this.subtotal + this.tax;
  }

  get cartItemsCount(): number {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  get filteredCategories(): Category[] {
    return this.categories.filter(cat => cat.id !== 'all');
  }

  constructor(
    private router: Router,
    private productsService: ProductsService,
    private authService: AuthService,
    private supabase: SupabaseService,
    private socketService: SocketService
  ) {}

  async ngOnInit() {
    try {
      const profile = await this.authService.getUserProfile();
      if (profile?.profile?.business_id) {
        this.businessId = profile.profile.business_id;
        this.businessName = profile.profile.business_name || 'Mi Negocio';
        
        const { data: { user } } = await this.supabase.auth.getUser();
        this.userEmail = user?.email || '';
        
        console.log('📧 User email:', this.userEmail);
        console.log('🏢 Business name:', this.businessName);
        
        this.loadCartFromStorage();
        await this.loadData();
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  }

  ngOnDestroy() {
    this.productsSubscription?.unsubscribe();
    this.categoriesSubscription?.unsubscribe();
  }

  private loadCartFromStorage(): void {
    try {
      const savedCart = localStorage.getItem(this.CART_STORAGE_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          this.cart = parsed;
          console.log('✅ Carrito cargado desde storage:', this.cart.length, 'items');
        }
      }
    } catch (error) {
      console.error('Error cargando carrito del storage:', error);
      this.cart = [];
    }
  }

  private saveCartToStorage(): void {
    try {
      localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(this.cart));
    } catch (error) {
      console.error('Error guardando carrito en storage:', error);
    }
  }

  private clearCartStorage(): void {
    try {
      localStorage.removeItem(this.CART_STORAGE_KEY);
    } catch (error) {
      console.error('Error limpiando storage del carrito:', error);
    }
  }

  // Cambiar modo de vista
  setViewMode(mode: 'grid' | 'table') {
    this.viewMode = mode;
    localStorage.setItem('pos_view_mode', mode);
  }

  async loadData() {
    this.isLoading = true;
    try {
      // Cargar modo de vista guardado
      const savedMode = localStorage.getItem('pos_view_mode') as 'grid' | 'table';
      if (savedMode === 'grid' || savedMode === 'table') {
        this.viewMode = savedMode;
      }

      await Promise.all([
        this.productsService.getProducts(this.businessId),
        this.productsService.getCategories(this.businessId)
      ]);

      this.productsSubscription = this.productsService.products$.subscribe((products: any[]) => {
        this.products = products;
        this.filteredProducts = products;
        this.validateCartItems();
      });

      this.categoriesSubscription = this.productsService.categories$.subscribe((categories: Category[]) => {
        this.categories = categories;
      });
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private validateCartItems(): void {
    if (this.cart.length === 0) return;

    const validCart: CartItem[] = [];
    let hasChanges = false;

    for (const cartItem of this.cart) {
      const product = this.products.find(p => p.id === cartItem.product.id);
      
      if (product) {
        cartItem.product = product;
        cartItem.subtotal = cartItem.quantity * product.price;
        validCart.push(cartItem);
      } else {
        hasChanges = true;
        console.warn(`Producto ${cartItem.product.id} ya no existe, removiendo del carrito`);
      }
    }

    if (hasChanges || validCart.length !== this.cart.length) {
      this.cart = validCart;
      this.saveCartToStorage();
    }
  }

  searchProducts() {
    let filtered = this.products;

    if (this.selectedCategory) {
      filtered = filtered.filter(p => p.category_id === this.selectedCategory);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query)
      );
    }

    this.filteredProducts = filtered;
  }

  filterByCategory(categoryId: string | null) {
    this.selectedCategory = categoryId;
    this.searchProducts();
  }

  getCartQuantity(productId: string): number {
    const item = this.cart.find(item => item.product.id === productId);
    return item ? item.quantity : 0;
  }

  addToCart(product: any) {
    const existingItem = this.cart.find(item => item.product.id === product.id);

    if (existingItem) {
      existingItem.quantity++;
      existingItem.subtotal = existingItem.quantity * existingItem.product.price;
    } else {
      this.cart.push({
        product,
        quantity: 1,
        subtotal: product.price
      });
    }

    this.saveCartToStorage();
  }

  removeFromCart(productId: string) {
    this.cart = this.cart.filter(item => item.product.id !== productId);
    this.saveCartToStorage();
  }

  updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    const item = this.cart.find(item => item.product.id === productId);
    if (item) {
      item.quantity = quantity;
      item.subtotal = quantity * item.product.price;
    } else if (quantity > 0) {
      const product = this.products.find(p => p.id === productId);
      if (product) {
        this.cart.push({
          product,
          quantity: quantity,
          subtotal: quantity * product.price
        });
      }
    }

    this.saveCartToStorage();
  }

  clearCart() {
    if (confirm('¿Estás seguro de vaciar el carrito?')) {
      this.cart = [];
      this.clearCartStorage();
    }
  }

  openPaymentModal() {
    if (this.cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }
    this.cashReceived = 0;
    this.change = 0;
    this.showPaymentModal = true;
  }

  closePaymentModal() {
    this.showPaymentModal = false;
  }

  calculateChange() {
    if (this.paymentMethod === 'cash') {
      this.change = this.cashReceived - this.total;
      if (this.change < 0) this.change = 0;
    }
  }

async processPayment() {
  if (this.paymentMethod === 'cash' && this.cashReceived < this.total) {
    alert('El efectivo recibido es menor al total');
    return;
  }

  this.isLoading = true;

  try {
    const orderNumber = `ORD-${Date.now()}`;
    const now = new Date().toISOString();

    console.log('🛒 Iniciando proceso de venta...');
    console.log('💰 Total:', this.total);
    console.log('💳 Método de pago:', this.paymentMethod);
    console.log('🏢 Business ID:', this.businessId);

    // ==========================================
    // ✅ CORRECCIÓN: Mapear el método de pago
    // ==========================================
    const paymentMethodName = this.getPaymentMethodName(this.paymentMethod);

    // ==========================================
    // 1. CREAR LA ORDEN EN SUPABASE
    // ==========================================
    console.log('📝 Paso 1: Creando orden...');
    const { data: order, error: orderError } = await this.supabase
      .from('orders')
      .insert({
        business_id: this.businessId,
        customer_id: null,
        order_number: orderNumber,
        status: 'completed',
        delivery_type: 'pickup',
        total: this.total,
        subtotal: this.subtotal,
        tax: this.tax,
        notes: `Venta POS - Pago: ${paymentMethodName}`,
        completed_at: now,
        created_at: now,
        // ✅ CAMPOS DE PAGO - ESTO FALTABA
        payment_method: paymentMethodName,
        payment_status: 'paid', // ✅ SIEMPRE pagado en POS
        payment_amount: this.total, // ✅ Monto completo
        payment_date: now, // ✅ Fecha de pago
        source: 'manual' // ✅ Origen: POS/Manual
      })
      .select()
      .single();

    if (orderError) {
      console.error('❌ Error creando orden:', orderError);
      throw orderError;
    }
    console.log('✅ Orden creada:', order.id);
    console.log('✅ Payment status guardado:', order.payment_status);

    // ==========================================
    // 2. CREAR REGISTRO EN TRANSACTIONS
    // ==========================================
    console.log('💵 Paso 2: Registrando ingreso en transactions...');
    const { data: transaction, error: transactionError } = await this.supabase
      .from('transactions')
      .insert({
        business_id: this.businessId,
        type: 'income',
        category: 'Ventas',
        amount: this.total,
        description: `Venta ${orderNumber}`,
        payment_method: paymentMethodName,
        reference_number: orderNumber,
        notes: `Venta realizada en POS - ${this.cart.length} productos`,
        transaction_date: now
      })
      .select()
      .single();

    if (transactionError) {
      console.error('❌ ERROR CRÍTICO al crear transacción:', transactionError);
      console.error('Detalles:', JSON.stringify(transactionError, null, 2));
      throw transactionError;
    }
    console.log('✅ Ingreso registrado en transactions:', transaction.id);

    // ==========================================
    // 3. CREAR LOS ITEMS DE LA ORDEN
    // ==========================================
    console.log('📦 Paso 3: Creando items de la orden...');
    const orderItems = this.cart.map(item => ({
      order_id: order.id,
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      price: item.product.price,
      subtotal: item.subtotal
    }));

    const { error: itemsError } = await this.supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('❌ Error creando items:', itemsError);
      throw itemsError;
    }
    console.log('✅ Items creados:', orderItems.length);

    // ==========================================
    // 4. ACTUALIZAR STOCK DE PRODUCTOS
    // ==========================================
    console.log('📊 Paso 4: Actualizando stock...');
    for (const item of this.cart) {
      const currentStock = item.product.stock || 0;
      const newStock = Math.max(0, currentStock - item.quantity);

      await this.supabase
        .from('products')
        .update({ 
          stock: newStock,
          updated_at: now
        })
        .eq('id', item.product.id);

      await this.supabase
        .from('inventory_movements')
        .insert({
          business_id: this.businessId,
          product_id: item.product.id,
          movement_type: 'out',
          quantity: item.quantity,
          previous_stock: currentStock,
          new_stock: newStock,
          reason: 'sale',
          notes: `Venta ${orderNumber}`,
          reference_number: orderNumber
        });
    }
    console.log('✅ Stock actualizado');

    // ==========================================
    // 5. RECARGAR PRODUCTOS
    // ==========================================
    await this.productsService.getProducts(this.businessId);

    // ==========================================
    // 6. GENERAR RECIBO
    // ==========================================
    this.lastReceipt = {
      id: order.id,
      receipt_number: orderNumber,
      order_number: orderNumber,
      items: this.cart.map(item => ({
        product: item.product,
        quantity: item.quantity,
        price: item.product.price,
        subtotal: item.subtotal
      })),
      subtotal: this.subtotal,
      tax: this.tax,
      total: this.total,
      payment_method: paymentMethodName,
      cash_received: this.paymentMethod === 'cash' ? this.cashReceived : this.total,
      change: this.change,
      date: new Date()
    };

    // ==========================================
    // 7. CERRAR MODALES Y ABRIR RECIBO
    // ==========================================
    this.showCartModal = false;
    this.showPaymentModal = false;
    this.showReceiptModal = true;

    console.log('🎉 Venta completada exitosamente:', orderNumber);
    console.log('✅ Payment status:', order.payment_status);
    console.log('✅ Payment amount:', order.payment_amount);
    console.log('✅ Payment method:', order.payment_method);

  } catch (error) {
    console.error('❌ ERROR PROCESANDO PAGO:', error);
    console.error('Detalles completos:', JSON.stringify(error, null, 2));
    alert('Error al procesar el pago: ' + (error as any).message);
  } finally {
    this.isLoading = false;
  }
}

  closeReceiptModal() {
    this.showReceiptModal = false;
    this.showCartModal = false;
    this.showPaymentModal = false;
    
    this.cart = [];
    this.clearCartStorage();
    
    this.searchQuery = '';
    this.selectedCategory = null;
    this.filteredProducts = this.products;
    
    this.paymentMethod = 'cash';
    this.cashReceived = 0;
    this.change = 0;
  }

  printReceipt() {
    window.print();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  getPaymentMethodName(paymentMethodId: string): string {
    const method = this.paymentMethods.find(m => m.id === paymentMethodId);
    return method?.name || paymentMethodId;
  }

  onQuantityChange(productId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    this.updateQuantity(productId, value);
  }

  openCartModal() {
    if (this.cart.length === 0) {
      alert('El carrito está vacío');
      return;
    }
    this.cashReceived = 0;
    this.change = 0;
    this.showCartModal = true;
  }

  closeCartModal() {
    this.showCartModal = false;
  }
}