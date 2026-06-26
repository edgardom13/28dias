import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CatalogService, CatalogProduct, CatalogSettings } from '../../../services/catalog.service';
import { OrdersService, OrderItem } from '../../../services/orders.service'; // ✅ NUEVO

interface CartItem {
  product: CatalogProduct;
  quantity: number;
}

@Component({
  selector: 'app-public-catalog',
  templateUrl: './public-catalog.page.html',
  styleUrls: ['./public-catalog.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class PublicCatalogPage implements OnInit {
  slug: string = '';
  settings: CatalogSettings | null = null;
  products: CatalogProduct[] = [];
  filteredProducts: CatalogProduct[] = [];
  
  searchQuery: string = '';
  selectedCategory: string = 'all';
  categories: { id: string; name: string; color?: string }[] = [];
  
  cart: CartItem[] = [];
  showCart: boolean = false;
  showProductDetail: boolean = false;
  selectedProduct: CatalogProduct | null = null;
  
  notFound: boolean = false;
  isLoading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private catalogService: CatalogService,
    private ordersService: OrdersService // ✅ NUEVO
  ) {}

  async ngOnInit() {
    this.slug = this.route.snapshot.paramMap.get('slug') || '';
    if (this.slug) {
      await this.loadCatalog();
    } else {
      this.notFound = true;
      this.isLoading = false;
    }
  }

  async loadCatalog() {
    this.isLoading = true;
    try {
      const result = await this.catalogService.getPublicCatalog(this.slug);
      
      if (!result.settings) {
        this.notFound = true;
      } else {
        this.settings = result.settings;
        this.products = result.products;
        
        // Extraer categorías únicas
        const categoryMap = new Map<string, { id: string; name: string; color?: string }>();
        this.products.forEach(p => {
          if (p.category_id && p.category_name) {
            categoryMap.set(p.category_id, {
              id: p.category_id,
              name: p.category_name,
              color: p.category_color
            });
          }
        });
        this.categories = Array.from(categoryMap.values());
        
        this.applyFilters();
        
        // Actualizar título de la página
        document.title = `${this.settings.store_name} - Catálogo`;
      }
    } catch (error) {
      console.error('Error loading catalog:', error);
      this.notFound = true;
    } finally {
      this.isLoading = false;
    }
  }

  clearFilters() {
    this.searchQuery = '';
    this.selectedCategory = 'all';
    this.applyFilters();
  }

  sendDirectWhatsApp(product: CatalogProduct) {
    if (!this.settings?.whatsapp_number) return;
    
    const message = `¡Hola! Me interesa el producto:\n\n*${product.name}*\nPrecio: ${this.formatCurrency(product.final_price)}\n\n¿Está disponible?`;
    
    const cleanPhone = this.settings.whatsapp_number.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
  }

  applyFilters() {
    let filtered = [...this.products];

    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category_id === this.selectedCategory);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.final_description && p.final_description.toLowerCase().includes(query))
      );
    }

    this.filteredProducts = filtered;
  }

  onFilterChange() {
    this.applyFilters();
  }

  openProductDetail(product: CatalogProduct) {
    this.selectedProduct = product;
    this.showProductDetail = true;
    document.body.style.overflow = 'hidden';
  }

  closeProductDetail() {
    this.showProductDetail = false;
    this.selectedProduct = null;
    document.body.style.overflow = '';
  }

  // ==========================================
  // CART
  // ==========================================
  addToCart(product: CatalogProduct) {
    if (!this.settings?.allow_cart) return;
    
    const existing = this.cart.find(item => item.product.id === product.id);
    if (existing) {
      existing.quantity++;
    } else {
      this.cart.push({ product, quantity: 1 });
    }
    
    // Mostrar animación o feedback
    this.showCart = true;
  }

  removeFromCart(productId: string) {
    this.cart = this.cart.filter(item => item.product.id !== productId);
  }

  updateCartQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }
    const item = this.cart.find(i => i.product.id === productId);
    if (item) item.quantity = quantity;
  }

  getCartTotal(): number {
    return this.cart.reduce((sum, item) => sum + (item.product.final_price * item.quantity), 0);
  }

  getCartCount(): number {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  getCartItemsForWhatsApp() {
    return this.cart.map(item => ({
      name: item.product.name,
      quantity: item.quantity,
      price: item.product.final_price * item.quantity
    }));
  }

async sendOrderWhatsApp() {
  if (!this.settings?.whatsapp_number) {
    alert('No está configurado el número de WhatsApp');
    return;
  }
  
  // ✅ SOLO crear pedido si hay productos en el carrito
  if (this.cart.length > 0 && this.settings?.business_id) {
    try {
      await this.createOrderFromCart();
    } catch (error) {
      console.error('Error creando pedido:', error);
      alert('Hubo un error al procesar tu pedido. Por favor, intenta nuevamente.');
      return; // ✅ No abrir WhatsApp si falló la creación
    }
  }
  
  // Generar mensaje de WhatsApp
  let message = '';
  
  if (this.cart.length === 0) {
    // ✨ Mensaje elegante cuando NO hay productos seleccionados (solo consulta)
    message = `Hola, un gusto saludarles. 🤝\n\n`;
    message += `Visité su catálogo online y me gustaría solicitar más información sobre sus productos.\n\n`;
    message += `¿Serían tan amables de brindarme asesoría? Quedo a la espera, muchas gracias.`;
    
  } else {
    // 📦 Mensaje con lista de productos (pedido real)
    message = `¡Hola! Me interesa hacer un pedido:\n\n`;
    message += `*📦 Productos seleccionados:*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    this.cart.forEach((item, index) => {
      const subtotal = item.product.final_price * item.quantity;
      message += `${index + 1}. *${item.product.name}*\n`;
      message += `   Cantidad: ${item.quantity}\n`;
      message += `   Precio: ${this.formatCurrency(subtotal)}\n\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*💰 Total: ${this.formatCurrency(this.getCartTotal())}*\n\n`;
    
    if (this.settings.order_message) {
      message += `${this.settings.order_message}\n\n`;
    }
    
    message += `Quedo atento/a a su respuesta. ¡Gracias! 😊`;
  }
  
  // Limpiar número y abrir WhatsApp
  const cleanPhone = this.settings.whatsapp_number.replace(/\D/g, '');
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  
  window.open(url, '_blank');
  
  // ✅ Limpiar carrito SOLO después de enviar un pedido con productos
  if (this.cart.length > 0) {
    this.cart = [];
    this.showCart = false;
  }
}

// ✅ NUEVO: Método para crear pedido desde el carrito
private async createOrderFromCart(): Promise<void> {
  if (!this.settings?.business_id) {
    throw new Error('No se pudo obtener el business_id del catálogo');
  }

  // Preparar items del pedido
  const orderItems: OrderItem[] = this.cart.map(item => ({
    product_id: item.product.product_id, // ✅ CAMBIO: Usar product_id, no id
    product_name: item.product.name,
    quantity: item.quantity,
    price: item.product.final_price,
    subtotal: item.product.final_price * item.quantity
  }));

  // Calcular totales
  const subtotal = this.getCartTotal();
  const tax = subtotal * 0.16; // 16% IVA
  const total = subtotal + tax;

  // Crear pedido
  await this.ordersService.createOrderFromCatalog({
    business_id: this.settings.business_id,
    status: 'pending',
    delivery_type: 'pickup',
    notes: 'Pedido desde catálogo público',
    subtotal: subtotal,
    tax: tax,
    total: total
  }, orderItems);

  console.log('✅ Pedido creado desde catálogo público');
}

  // ==========================================
  // UTILS
  // ==========================================
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: this.settings?.currency || 'MXN'
    }).format(amount);
  }

  getStoreInitial(): string {
    const name = this.settings?.store_name || '';
    return name.charAt(0).toUpperCase() || 'T';
  }

  getWhatsAppUrl(): string {
    if (!this.settings?.whatsapp_number) return '';
    const cleanPhone = this.settings.whatsapp_number.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}`;
  }

  getPrimaryColor(): string {
    return this.settings?.primary_color || '#9333ea';
  }
}