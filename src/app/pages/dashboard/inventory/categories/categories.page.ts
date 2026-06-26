import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner, IonIcon } from '@ionic/angular/standalone';
import { ProductsService, Category } from '../../../../services/products.service';
import { AuthService } from '../../../../services/auth.service';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { trashOutline, createOutline, closeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner, IonIcon]
})
export class CategoriesPage implements OnInit, OnDestroy {
  // ==========================================
  // PROPIEDADES
  // ==========================================
  categories: Category[] = [];
  filteredCategories: Category[] = [];
  products: any[] = [];
  isLoading: boolean = false;
  showModal: boolean = false;
  editingCategory: Category | null = null;
  parentCategory: Category | null = null; // ✅ NUEVO
  searchQuery: string = '';
  viewMode: 'tree' | 'grid' = 'tree'; // ✅ NUEVO: vista por defecto en árbol
  expandedCategories: Set<string> = new Set(); // ✅ NUEVO
  
  categoriesWithProducts: number = 0;
  categoriesWithoutProducts: number = 0;

  categoryForm = {
    name: '',
    description: '',
    color: '#6B21A8',
    parent_id: '' as string | null // ✅ NUEVO
  };

  businessId: string = '';
  businessType: string = 'tienda';

  colors = [
    '#6B21A8', '#EC4899', '#8B5CF6', '#3B82F6', '#10B981',
    '#F59E0B', '#EF4444', '#6366F1', '#14B8A6', '#F97316',
    '#06B6D4', '#84CC16', '#F43F5E', '#A855F7', '#0EA5E9'
  ];

  private categoriesSubscription?: Subscription;
  private productsSubscription?: Subscription;

  // ==========================================
  // GETTERS
  // ==========================================
  get isFormValid(): boolean {
    return this.categoryForm.name !== '' && this.categoryForm.name.trim().length >= 3;
  }

  // ✅ NUEVO: Categorías raíz (sin padre)
  get rootCategories(): Category[] {
    return this.categories.filter(c => !c.parent_id);
  }

  // ✅ NUEVO: Categorías raíz filtradas
  get rootCategoriesFiltered(): Category[] {
    if (!this.searchQuery.trim()) {
      return this.rootCategories;
    }
    const query = this.searchQuery.toLowerCase();
    return this.rootCategories.filter(cat => {
      // Incluir si la categoría padre coincide
      if (cat.name.toLowerCase().includes(query) || 
          (cat.description && cat.description.toLowerCase().includes(query))) {
        return true;
      }
      // O si alguna de sus subcategorías coincide
      const children = this.getChildren(cat.id);
      return children.some(child => 
        child.name.toLowerCase().includes(query) ||
        (child.description && child.description.toLowerCase().includes(query))
      );
    });
  }

  // ✅ NUEVO: Subcategorías
  get subcategories(): Category[] {
    return this.categories.filter(c => c.parent_id);
  }

  // ==========================================
  // CONSTRUCTOR
  // ==========================================
  constructor(
    private router: Router,
    private productsService: ProductsService,
    private authService: AuthService
  ) {
    addIcons({ trashOutline, createOutline, closeOutline });
  }

  // ==========================================
  // LIFECYCLE
  // ==========================================
  async ngOnInit() {
    try {
      const profile = await this.authService.getUserProfile();
      if (profile?.profile?.business_id) {
        this.businessId = profile.profile.business_id;
        this.businessType = profile.profile.business_type || 'tienda';
        await this.loadCategories();
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  }

  ngOnDestroy() {
    this.categoriesSubscription?.unsubscribe();
    this.productsSubscription?.unsubscribe();
  }

  // ==========================================
  // DATA LOADING
  // ==========================================
  async loadCategories() {
    this.isLoading = true;
    try {
      await Promise.all([
        this.productsService.getCategories(this.businessId),
        this.productsService.getProducts(this.businessId)
      ]);
      
      this.categoriesSubscription = this.productsService.categories$.subscribe((categories: Category[]) => {
        this.categories = categories;
        this.updateStats();
        this.filterCategories();
      });

      this.productsSubscription = this.productsService.products$.subscribe((products: any[]) => {
        this.products = products;
        this.updateStats();
      });
    } catch (error) {
      console.error('Error cargando categorías:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // ==========================================
  // FILTERS & STATS
  // ==========================================
  filterCategories() {
    if (!this.searchQuery.trim()) {
      this.filteredCategories = [...this.categories];
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredCategories = this.categories.filter((cat: Category) => 
        cat.name.toLowerCase().includes(query) ||
        (cat.description && cat.description.toLowerCase().includes(query))
      );
    }
  }

  updateStats() {
    this.categoriesWithProducts = this.categories.filter(cat => 
      this.getProductCount(cat.id) > 0
    ).length;
    
    this.categoriesWithoutProducts = this.categories.filter(cat => 
      this.getProductCount(cat.id) === 0
    ).length;
  }

  getProductCount(categoryId: string): number {
    return this.products.filter((p: any) => p.category_id === categoryId).length;
  }

  // ==========================================
  // ✅ NUEVO: MÉTODOS DE JERARQUÍA
  // ==========================================
  
  // Obtener hijos de una categoría
  getChildren(parentId: string): Category[] {
    return this.categories.filter(c => c.parent_id === parentId);
  }

  // Verificar si una categoría tiene hijos
  hasChildren(categoryId: string): boolean {
    return this.getChildren(categoryId).length > 0;
  }

  // Contar hijos
  getChildrenCount(categoryId: string): number {
    return this.getChildren(categoryId).length;
  }

  // Obtener nombre del padre
  getParentName(parentId: string): string {
    const parent = this.categories.find(c => c.id === parentId);
    return parent ? parent.name : '';
  }

  // Toggle expandir/colapsar
  toggleExpand(categoryId: string): void {
    if (this.expandedCategories.has(categoryId)) {
      this.expandedCategories.delete(categoryId);
    } else {
      this.expandedCategories.add(categoryId);
    }
  }

  // Verificar si está expandido
  isExpanded(categoryId: string): boolean {
    return this.expandedCategories.has(categoryId);
  }

  // ==========================================
  // MODAL ACTIONS
  // ==========================================
  openCreateModal() {
    this.editingCategory = null;
    this.parentCategory = null;
    this.categoryForm = {
      name: '',
      description: '',
      color: '#6B21A8',
      parent_id: ''
    };
    this.showModal = true;
  }

  // ✅ NUEVO: Abrir modal para crear subcategoría
  openCreateSubcategoryModal(parent: Category) {
    this.editingCategory = null;
    this.parentCategory = parent;
    this.categoryForm = {
      name: '',
      description: '',
      color: parent.color || '#6B21A8', // Hereda el color del padre
      parent_id: parent.id
    };
    this.showModal = true;
  }

  editCategory(category: Category) {
    this.editingCategory = category;
    this.parentCategory = null;
    this.categoryForm = {
      name: category.name,
      description: category.description || '',
      color: category.color || '#6B21A8',
      parent_id: category.parent_id || ''
    };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editingCategory = null;
    this.parentCategory = null;
    this.categoryForm = {
      name: '',
      description: '',
      color: '#6B21A8',
      parent_id: ''
    };
  }

  selectColor(color: string) {
    this.categoryForm.color = color;
  }

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================
  async saveCategory() {
    if (!this.categoryForm.name || this.categoryForm.name.trim().length < 3) {
      alert('El nombre debe tener al menos 3 caracteres');
      return;
    }

    this.isLoading = true;

    try {
      const categoryData = {
        name: this.categoryForm.name,
        description: this.categoryForm.description,
        color: this.categoryForm.color,
        parent_id: this.categoryForm.parent_id || null
      };

      if (this.editingCategory) {
        await this.productsService.updateCategory(this.editingCategory.id, categoryData);
        console.log('✅ Categoría actualizada');
      } else {
        await this.productsService.createCategory(
          this.businessId,
          categoryData.name,
          categoryData.description,
          categoryData.color,
          categoryData.parent_id // ✅ NUEVO: Pasar parent_id
        );
        console.log('✅ Categoría creada');
        
        // Auto-expandir el padre si se creó una subcategoría
        if (categoryData.parent_id) {
          this.expandedCategories.add(categoryData.parent_id);
        }
      }

      this.closeModal();

    } catch (error) {
      console.error('Error guardando categoría:', error);
      alert('Error al guardar la categoría');
    } finally {
      this.isLoading = false;
    }
  }

  async deleteCategory(category: Category) {
    const children = this.getChildren(category.id);
    let message = `¿Estás seguro de eliminar "${category.name}"?`;
    
    if (children.length > 0) {
      message += `\n\n⚠️ Esta categoría tiene ${children.length} subcategoría(s) que también serán eliminadas.`;
    }
    
    message += '\n\nEsta acción no se puede deshacer.';
    
    const confirmed = confirm(message);
    if (!confirmed) return;

    this.isLoading = true;

    try {
      // ✅ NUEVO: Eliminar primero las subcategorías
      if (children.length > 0) {
        for (const child of children) {
          await this.productsService.deleteCategory(child.id);
        }
      }
      
      await this.productsService.deleteCategory(category.id);
      console.log('✅ Categoría eliminada');
    } catch (error) {
      console.error('Error eliminando categoría:', error);
      alert('Error al eliminar la categoría');
    } finally {
      this.isLoading = false;
    }
  }
}