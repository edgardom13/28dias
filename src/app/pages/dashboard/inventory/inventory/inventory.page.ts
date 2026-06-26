import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { ProductsService, Product, Category } from '../../../../services/products.service';
import { InventoryService, InventoryMovement, InventoryStats } from '../../../../services/inventory.service';
import { AuthService } from '../../../../services/auth.service';
import { SupabaseService } from '../../../../services/supabase.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.page.html',
  styleUrls: ['./inventory.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner]
})
export class InventoryPage implements OnInit, OnDestroy {
  // ==========================================
  // PROPIEDADES
  // ==========================================
  products: Product[] = [];
  filteredProducts: Product[] = [];
  categories: Category[] = [];
  movements: InventoryMovement[] = [];
  selectedProduct: Product | null = null;
  productMovements: InventoryMovement[] = [];
  
  isLoading: boolean = false;
  showMovementModal: boolean = false;
  showHistoryModal: boolean = false;
  
  searchQuery: string = '';
  selectedCategory: string = 'all';
  stockFilter: string = 'all';
  
  // ✅ NUEVO: Búsqueda de productos en el modal
  productSearchQuery: string = '';
  showProductDropdown: boolean = false;

  stats: InventoryStats = {
    totalProducts: 0,
    totalStock: 0,
    totalValue: 0,
    lowStock: 0,
    outOfStock: 0,
    criticalStock: 0
  };

  movementForm = {
    product_id: '',
    movement_type: 'in' as 'in' | 'out' | 'adjustment' | 'return',
    quantity: 1,
    reason: '',
    notes: '',
    reference_number: '',
    cost_per_unit: 0
  };

  businessId: string = '';
  userId: string = '';

  private productsSubscription?: Subscription;
  private categoriesSubscription?: Subscription;
  private movementsSubscription?: Subscription;

  // ==========================================
  // CONSTRUCTOR
  // ==========================================
  constructor(
    private router: Router,
    private productsService: ProductsService,
    private inventoryService: InventoryService,
    private authService: AuthService,
    private supabase: SupabaseService
  ) {}

  // ==========================================
  // LIFECYCLE
  // ==========================================
  async ngOnInit() {
    try {
      const profile = await this.authService.getUserProfile();
      if (profile?.profile?.business_id) {
        this.businessId = profile.profile.business_id;
        const { data: { user } } = await this.supabase.auth.getUser();
        this.userId = user?.id || '';
        await this.loadData();
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  }

  ngOnDestroy() {
    this.productsSubscription?.unsubscribe();
    this.categoriesSubscription?.unsubscribe();
    this.movementsSubscription?.unsubscribe();
  }

  // ==========================================
  // DATA LOADING
  // ==========================================
  async loadData() {
    this.isLoading = true;
    try {
      this.productsSubscription = this.productsService.products$.subscribe((products: Product[]) => {
        this.products = products;
        this.applyFilters();
      });

      this.categoriesSubscription = this.productsService.categories$.subscribe((categories: Category[]) => {
        this.categories = categories;
      });

      this.movementsSubscription = this.inventoryService.movements$.subscribe((movements: InventoryMovement[]) => {
        this.movements = movements;
      });

      await Promise.all([
        this.productsService.getProducts(this.businessId),
        this.productsService.getCategories(this.businessId),
        this.inventoryService.getMovements(this.businessId),
        this.loadStats()
      ]);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async loadStats() {
    try {
      this.stats = await this.inventoryService.getInventoryStats(this.businessId);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  }

  // ==========================================
  // ✅ NUEVO: BÚSQUEDA DE PRODUCTOS EN MODAL
  // ==========================================
  get filteredProductsForSelect(): Product[] {
    if (!this.productSearchQuery.trim()) {
      return this.products.slice(0, 50); // Mostrar solo 50 al inicio
    }
    const query = this.productSearchQuery.toLowerCase();
    return this.products.filter(p => 
      p.name.toLowerCase().includes(query) ||
      (p.sku && p.sku.toLowerCase().includes(query))
    ).slice(0, 50); // Limitar a 50 resultados
  }

  onProductSearchFocus() {
    this.showProductDropdown = true;
  }

  onProductSearchBlur() {
    // Pequeño delay para permitir clicks en las opciones
    setTimeout(() => {
      this.showProductDropdown = false;
    }, 200);
  }

  selectProductForMovement(product: Product) {
    this.movementForm.product_id = product.id;
    this.productSearchQuery = `${product.name} (Stock: ${product.stock || 0})`;
    this.showProductDropdown = false;
  }

  clearProductSelection() {
    this.movementForm.product_id = '';
    this.productSearchQuery = '';
  }

  // ==========================================
  // FILTERS
  // ==========================================
  applyFilters() {
    let filtered = [...this.products];

    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category_id === this.selectedCategory);
    }

    // ✅ CORREGIDO: Stock bajo ahora es <= 5, crítico es <= 3
    if (this.stockFilter === 'low') {
      filtered = filtered.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 5);
    } else if (this.stockFilter === 'out') {
      filtered = filtered.filter(p => (p.stock || 0) === 0);
    } else if (this.stockFilter === 'critical') {
      filtered = filtered.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 3);
    } else if (this.stockFilter === 'available') {
      filtered = filtered.filter(p => (p.stock || 0) > 5);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query))
      );
    }

    this.filteredProducts = filtered;
  }

  onFilterChange() {
    this.applyFilters();
  }

  // ==========================================
  // MOVEMENT MODAL
  // ==========================================
  openMovementModal(product?: Product) {
    if (product) {
      this.movementForm.product_id = product.id;
      this.productSearchQuery = `${product.name} (Stock: ${product.stock || 0})`;
    } else {
      this.movementForm = {
        product_id: '',
        movement_type: 'in',
        quantity: 1,
        reason: '',
        notes: '',
        reference_number: '',
        cost_per_unit: 0
      };
      this.productSearchQuery = '';
    }
    this.showMovementModal = true;
  }

  closeMovementModal() {
    this.showMovementModal = false;
    this.showProductDropdown = false;
    this.productSearchQuery = '';
  }

  // ==========================================
  // HISTORY MODAL
  // ==========================================
  async viewProductHistory(product: Product) {
    this.selectedProduct = product;
    try {
      this.productMovements = await this.inventoryService.getProductMovements(this.businessId, product.id);
      this.showHistoryModal = true;
    } catch (error) {
      console.error('Error cargando historial:', error);
      alert('Error al cargar el historial');
    }
  }

  closeHistoryModal() {
    this.showHistoryModal = false;
    this.selectedProduct = null;
    this.productMovements = [];
  }

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================
  async saveMovement() {
    if (!this.movementForm.product_id) {
      alert('Selecciona un producto');
      return;
    }

    if (this.movementForm.quantity <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    this.isLoading = true;

    try {
      const product = this.products.find(p => p.id === this.movementForm.product_id);
      if (!product) {
        throw new Error('Producto no encontrado');
      }

      const previousStock = product.stock || 0;
      let newStock = previousStock;

      switch (this.movementForm.movement_type) {
        case 'in':
        case 'return':
          newStock = previousStock + this.movementForm.quantity;
          break;
        case 'out':
          newStock = previousStock - this.movementForm.quantity;
          if (newStock < 0) {
            throw new Error('No hay suficiente stock');
          }
          break;
        case 'adjustment':
          newStock = this.movementForm.quantity;
          break;
      }

      await this.inventoryService.createMovement({
        business_id: this.businessId,
        product_id: this.movementForm.product_id,
        user_id: this.userId,
        movement_type: this.movementForm.movement_type,
        quantity: this.movementForm.quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        reason: this.movementForm.reason,
        notes: this.movementForm.notes,
        reference_number: this.movementForm.reference_number,
        cost_per_unit: this.movementForm.cost_per_unit || product.cost || product.price,
        total_cost: (this.movementForm.cost_per_unit || product.cost || product.price) * this.movementForm.quantity
      });

      await Promise.all([
        this.productsService.getProducts(this.businessId),
        this.loadStats()
      ]);

      this.closeMovementModal();
      console.log('✅ Movimiento registrado');
    } catch (error: any) {
      console.error('Error registrando movimiento:', error);
      alert(error.message || 'Error al registrar el movimiento');
    } finally {
      this.isLoading = false;
    }
  }

  async deleteMovement(movementId: string) {
    const confirmed = confirm('¿Estás seguro de eliminar este movimiento? El stock NO se revertirá automáticamente.');
    if (!confirmed) return;

    this.isLoading = true;

    try {
      await this.inventoryService.deleteMovement(movementId);
      console.log('✅ Movimiento eliminado');
    } catch (error) {
      console.error('Error eliminando movimiento:', error);
      alert('Error al eliminar el movimiento');
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

  getMovementTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'in': 'Entrada',
      'out': 'Salida',
      'adjustment': 'Ajuste',
      'return': 'Devolución'
    };
    return labels[type] || type;
  }

  getMovementTypeClass(type: string): string {
    return `type-${type}`;
  }

  // ✅ CORREGIDO: Umbrales actualizados
  getStockStatus(stock: number): string {
    if (stock === 0) return 'out';
    if (stock <= 3) return 'critical';
    if (stock <= 5) return 'low';
    return 'good';
  }

  getStockStatusLabel(stock: number): string {
    if (stock === 0) return 'Sin stock';
    if (stock <= 3) return 'Crítico';
    if (stock <= 5) return 'Bajo';
    return 'Disponible';
  }

  getSelectedProduct(): Product | undefined {
    return this.products.find(p => p.id === this.movementForm.product_id);
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category?.name || 'Sin categoría';
  }
}