import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner, IonToast } from '@ionic/angular/standalone';
import { CatalogService, CatalogSettings, CatalogProduct } from '../../../../services/catalog.service';
import { AuthService } from '../../../../services/auth.service';
import { SupabaseService } from '../../../../services/supabase.service';

@Component({
  selector: 'app-catalog',
  templateUrl: './catalog.page.html',
  styleUrls: ['./catalog.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner, IonToast]
})
export class CatalogPage implements OnInit {
  isLoading = true;
  isSaving = false;
  isSyncing = false;
  businessId = '';
  hasInventoryProducts = false;
  
  settings: CatalogSettings | null = null;
  products: CatalogProduct[] = [];
  filteredProducts: CatalogProduct[] = [];
  
  // Filtros
  searchQuery = '';
  categoryFilter = 'all';
  visibilityFilter = 'all';
  categories: { id: string; name: string }[] = [];
  
  // Tabs
  activeTab: 'products' | 'settings' | 'preview' = 'products';
  
  // Toast
  showToast = false;
  toastMessage = '';
  toastColor = 'success';
  
  // Copiar link
  linkCopied = false;

  // ✅ NUEVO: Selector de productos
  showProductSelector = false;
  availableProducts: any[] = [];
  productSelectorSearch = '';
  selectedProductIds: Set<string> = new Set();

  constructor(
    public catalogService: CatalogService,
    private authService: AuthService,
    private router: Router,
    private supabase: SupabaseService
  ) {}

  async ngOnInit() {
    const profile = await this.authService.getUserProfile();
    if (profile?.profile?.business_id) {
      this.businessId = profile.profile.business_id;
      await this.loadData();
    }
  }

  async loadData() {
    this.isLoading = true;
    try {
      // 1. Cargar settings
      this.settings = await this.catalogService.getSettings(this.businessId);
      
      // 2. Verificar si hay productos en el inventario
      const { data: inventoryProducts, error } = await this.supabase
        .from('products')
        .select('id, name, description, price, stock, image, sku, category_id')
        .eq('business_id', this.businessId)
        .eq('is_active', true);

      if (error) {
        console.error('Error checking inventory:', error);
      }

      this.hasInventoryProducts = (inventoryProducts?.length || 0) > 0;
      console.log('📦 Productos en inventario:', inventoryProducts?.length || 0);

      // 3. Cargar productos del catálogo
      this.products = await this.catalogService.getCatalogProducts(this.businessId);
      console.log('🛍️ Productos en catálogo:', this.products.length);
      
      // 4. Si no hay productos en el catálogo pero sí en el inventario, sincronizar automáticamente
      if (this.products.length === 0 && this.hasInventoryProducts) {
        console.log('🔄 Sincronizando productos automáticamente...');
        await this.syncProducts();
      }

      // 5. Extraer categorías únicas
      const categoryMap = new Map<string, string>();
      this.products.forEach(p => {
        if (p.category_id && p.category_name) {
          categoryMap.set(p.category_id, p.category_name);
        }
      });
      this.categories = Array.from(categoryMap.entries()).map(([id, name]) => ({ id, name }));

      this.applyFilters();
    } catch (error) {
      console.error('Error loading catalog:', error);
      this.showToastMessage('Error al cargar el catálogo', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  // ✅ NUEVO: Sincronizar productos manualmente
  async syncProducts() {
    this.isSyncing = true;
    try {
      await this.catalogService.syncProductsToCatalog(this.businessId);
      // Recargar productos
      this.products = await this.catalogService.getCatalogProducts(this.businessId);
      this.applyFilters();
      this.showToastMessage(`✅ ${this.products.length} productos sincronizados`, 'success');
    } catch (error) {
      console.error('Error syncing products:', error);
      this.showToastMessage('Error al sincronizar productos', 'danger');
    } finally {
      this.isSyncing = false;
    }
  }

  // ✅ NUEVO: Ir a inventario
  goToInventory() {
    this.router.navigate(['/dashboard/inventory/products']);
  }

  applyFilters() {
    let filtered = [...this.products];

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query))
      );
    }

    if (this.categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.category_id === this.categoryFilter);
    }

    if (this.visibilityFilter === 'visible') {
      filtered = filtered.filter(p => p.is_visible);
    } else if (this.visibilityFilter === 'hidden') {
      filtered = filtered.filter(p => !p.is_visible);
    } else if (this.visibilityFilter === 'featured') {
      filtered = filtered.filter(p => p.is_featured);
    }

    this.filteredProducts = filtered;
  }

  onFilterChange() {
    this.applyFilters();
  }

  // ==========================================
  // ✅ NUEVO: SELECTOR DE PRODUCTOS
  // ==========================================
  async openProductSelector() {
    this.showProductSelector = true;
    this.productSelectorSearch = '';
    
    // Cargar productos del inventario si no están cargados
    if (this.availableProducts.length === 0) {
      await this.loadAvailableProducts();
    }
    
    // Inicializar selección con productos ya visibles
    this.selectedProductIds = new Set(
      this.products.filter(p => p.is_visible).map(p => p.product_id)
    );
  }

  closeProductSelector() {
    this.showProductSelector = false;
    this.productSelectorSearch = '';
  }

  async loadAvailableProducts() {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          price,
          stock,
          image,
          sku,
          category_id,
          is_active
        `)
        .eq('business_id', this.businessId)
        .eq('is_active', true);

      if (error) throw error;

      // Obtener categorías
      const categoryIds = [...new Set(data?.map(p => p.category_id).filter(id => id))];
      let categoriesMap = new Map<string, { name: string; color: string }>();

      if (categoryIds.length > 0) {
        const { data: categoriesData } = await this.supabase
          .from('categories')
          .select('id, name, color')
          .in('id', categoryIds);

        if (categoriesData) {
          categoriesMap = new Map(
            categoriesData.map(c => [c.id, { name: c.name, color: c.color || '#a855f7' }])
          );
        }
      }

      this.availableProducts = (data || []).map((p: any) => {
        const category = p.category_id ? categoriesMap.get(p.category_id) : null;
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          stock: p.stock,
          image: p.image,
          sku: p.sku,
          category_id: p.category_id,
          category_name: category?.name,
          category_color: category?.color
        };
      });

      console.log('📦 Productos disponibles:', this.availableProducts.length);
    } catch (error) {
      console.error('Error loading available products:', error);
    }
  }

  isProductSelected(productId: string): boolean {
    return this.selectedProductIds.has(productId);
  }

  toggleProductSelection(productId: string, event: any) {
    if (event.target.checked) {
      this.selectedProductIds.add(productId);
    } else {
      this.selectedProductIds.delete(productId);
    }
  }

  toggleSelectAll(event: any) {
    if (event.target.checked) {
      this.filteredAvailableProducts.forEach(p => this.selectedProductIds.add(p.id));
    } else {
      this.filteredAvailableProducts.forEach(p => this.selectedProductIds.delete(p.id));
    }
  }

  areAllSelected(): boolean {
    return this.filteredAvailableProducts.length > 0 && 
           this.filteredAvailableProducts.every(p => this.selectedProductIds.has(p.id));
  }

  getSelectedCount(): number {
    return this.selectedProductIds.size;
  }

  async saveProductSelection() {
    try {
      // Actualizar visibilidad de todos los productos del catálogo
      const updates = this.products.map(p => ({
        id: p.id,
        is_visible: this.selectedProductIds.has(p.product_id)
      }));

      await Promise.all(
        updates.map(update => 
          this.catalogService.toggleProductVisibility(update.id, update.is_visible)
        )
      );

      // Recargar productos
      await this.loadData();
      
      this.closeProductSelector();
      this.showToastMessage(`✅ ${this.getSelectedCount()} productos actualizados`, 'success');
    } catch (error) {
      console.error('Error saving selection:', error);
      this.showToastMessage('Error al guardar selección', 'danger');
    }
  }

  get filteredAvailableProducts() {
    if (!this.productSelectorSearch.trim()) {
      return this.availableProducts;
    }
    const query = this.productSelectorSearch.toLowerCase();
    return this.availableProducts.filter(p => 
      p.name.toLowerCase().includes(query) ||
      (p.sku && p.sku.toLowerCase().includes(query))
    );
  }

  // ==========================================
  // ✅ NUEVO: MOSTRAR/OCULTAR TODOS
  // ==========================================
  async showAllProducts() {
    try {
      await Promise.all(
        this.products.map(p => 
          this.catalogService.toggleProductVisibility(p.id, true)
        )
      );
      await this.loadData();
      this.showToastMessage('✅ Todos los productos visibles', 'success');
    } catch (error) {
      this.showToastMessage('Error al mostrar todos', 'danger');
    }
  }

  async hideAllProducts() {
    try {
      await Promise.all(
        this.products.map(p => 
          this.catalogService.toggleProductVisibility(p.id, false)
        )
      );
      await this.loadData();
      this.showToastMessage('🙈 Todos los productos ocultos', 'success');
    } catch (error) {
      this.showToastMessage('Error al ocultar todos', 'danger');
    }
  }

  allProductsVisible(): boolean {
    return this.products.length > 0 && this.products.every(p => p.is_visible);
  }

  // ==========================================
  // PRODUCT ACTIONS
  // ==========================================
  async toggleVisibility(product: CatalogProduct) {
    try {
      await this.catalogService.toggleProductVisibility(product.id, !product.is_visible);
      product.is_visible = !product.is_visible;
      this.showToastMessage(
        product.is_visible ? '✅ Producto visible en catálogo' : '🙈 Producto oculto del catálogo',
        'success'
      );
    } catch (error) {
      this.showToastMessage('Error al actualizar', 'danger');
    }
  }

  async toggleFeatured(product: CatalogProduct) {
    try {
      await this.catalogService.toggleProductFeatured(product.id, !product.is_featured);
      product.is_featured = !product.is_featured;
      this.showToastMessage(
        product.is_featured ? '⭐ Producto destacado' : 'Producto sin destacar',
        'success'
      );
    } catch (error) {
      this.showToastMessage('Error al actualizar', 'danger');
    }
  }

  async moveProduct(product: CatalogProduct, direction: 'up' | 'down') {
    const currentIndex = this.products.findIndex(p => p.id === product.id);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= this.products.length) return;

    // Intercambiar órdenes
    const tempOrder = this.products[currentIndex].display_order;
    this.products[currentIndex].display_order = this.products[newIndex].display_order;
    this.products[newIndex].display_order = tempOrder;

    // Intercambiar posiciones
    [this.products[currentIndex], this.products[newIndex]] = [this.products[newIndex], this.products[currentIndex]];

    // Guardar en BD
    try {
      await Promise.all([
        this.catalogService.updateProductOrder(this.products[currentIndex].id, this.products[currentIndex].display_order),
        this.catalogService.updateProductOrder(this.products[newIndex].id, this.products[newIndex].display_order)
      ]);
      this.applyFilters();
    } catch (error) {
      this.showToastMessage('Error al reordenar', 'danger');
    }
  }

  // ==========================================
  // SETTINGS
  // ==========================================
  async saveSettings() {
    if (!this.settings) return;

    this.isSaving = true;
    try {
      await this.catalogService.updateSettings(this.settings.id!, this.settings);
      this.showToastMessage('✅ Configuración guardada', 'success');
    } catch (error) {
      this.showToastMessage('Error al guardar', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  async toggleCatalog() {
    if (!this.settings) return;

    this.isSaving = true;
    try {
      const newStatus = !this.settings.is_active;
      await this.catalogService.updateSettings(this.settings.id!, { is_active: newStatus });
      this.settings.is_active = newStatus;
      this.showToastMessage(
        newStatus ? '🎉 ¡Catálogo activado!' : '⏸️ Catálogo desactivado',
        'success'
      );
    } catch (error) {
      this.showToastMessage('Error al actualizar', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  // ==========================================
  // SHARE & COPY
  // ==========================================
  copyCatalogLink() {
    if (!this.settings?.slug) return;
    
    const url = this.catalogService.getCatalogUrl(this.settings.slug);
    navigator.clipboard.writeText(url).then(() => {
      this.linkCopied = true;
      this.showToastMessage('🔗 Link copiado al portapapeles', 'success');
      setTimeout(() => this.linkCopied = false, 2000);
    });
  }

  shareWhatsApp() {
    if (!this.settings?.slug || !this.settings.store_name) return;
    
    const url = this.catalogService.getWhatsAppShareUrl(
      this.settings.slug,
      this.settings.store_name
    );
    window.open(url, '_blank');
  }

  openPublicCatalog() {
    if (!this.settings?.slug) return;
    window.open(`/catalogo/${this.settings.slug}`, '_blank');
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

  getVisibleCount(): number {
    return this.products.filter(p => p.is_visible).length;
  }

  getFeaturedCount(): number {
    return this.products.filter(p => p.is_featured).length;
  }

  private showToastMessage(message: string, color: string) {
    this.toastMessage = message;
    this.toastColor = color;
    this.showToast = true;
    setTimeout(() => this.showToast = false, 3000);
  }
}