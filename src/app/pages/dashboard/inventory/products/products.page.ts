import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductsService, Product, Category } from '../../../../services/products.service';
import { AuthService } from '../../../../services/auth.service';
import { Subscription } from 'rxjs';
import { BusinessConfigService, BusinessField } from '../../../../services/business-config.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
})
export class ProductsPage implements OnInit, OnDestroy {
  products: Product[] = [];
  categories: Category[] = [];
  filteredProducts: Product[] = [];

  businessType: string = 'tienda';
  businessFields: BusinessField[] = [];
  
  searchTerm: string = '';
  filterCategory: string = '';
  filterStock: string = '';
  viewMode: 'grid' | 'list' = 'grid';
  
  showModal: boolean = false;
  editingProduct: Product | null = null;
  isLoading: boolean = false;
  selectedFile: File | null = null;
  
  totalProducts: number = 0;
  inStockCount: number = 0;
  lowStockCount: number = 0;
  outOfStockCount: number = 0;
  
  // ✅ Cambiar a tipo dinámico
  productForm: any = {};

  showCategoryModal: boolean = false;
  categoryForm = {
    name: '',
    description: '',
    color: '#9333ea'
  };

  private productsSubscription?: Subscription;
  private categoriesSubscription?: Subscription;
  private businessId: string = '';

  constructor(
    private productsService: ProductsService,
    private authService: AuthService,
    private businessConfigService: BusinessConfigService
  ) {}

  async ngOnInit() {
    this.businessType = localStorage.getItem('businessType') || 'tienda';
    this.businessFields = this.businessConfigService.getFields(this.businessType);
    
    try {
      const profile = await this.authService.getUserProfile();
      
      if (profile?.profile?.business_id) {
        this.businessId = profile.profile.business_id;
        console.log('Business ID cargado:', this.businessId);
        await this.loadData();
      } else {
        console.error('No se encontró business_id en el perfil del usuario');
        alert('No se pudo cargar la información de tu negocio. Por favor, cierra sesión y vuelve a ingresar.');
      }
    } catch (error) {
      console.error('Error en ngOnInit:', error);
      alert('Error al cargar la página de productos');
    }

    this.productsSubscription = this.productsService.products$.subscribe((products: Product[]) => {
      this.products = products;
      this.updateStats();
      this.filterProducts();
    });

    this.categoriesSubscription = this.productsService.categories$.subscribe((categories: Category[]) => {
      this.categories = categories;
    });
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  async loadData() {
    this.isLoading = true;
    try {
      await Promise.all([
        this.productsService.getProducts(this.businessId),
        this.productsService.getCategories(this.businessId)
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error al cargar los datos');
    } finally {
      this.isLoading = false;
    }
  }

  updateStats() {
    this.totalProducts = this.products.length;
    this.inStockCount = this.products.filter(p => p.stock > p.min_stock).length;
    this.lowStockCount = this.products.filter(p => p.stock <= p.min_stock && p.stock > 0).length;
    this.outOfStockCount = this.products.filter(p => p.stock === 0).length;
  }

  filterProducts() {
    this.filteredProducts = this.products.filter(product => {
      const matchesSearch = !this.searchTerm || 
        product.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (product.barcode && product.barcode.includes(this.searchTerm));

      const matchesCategory = !this.filterCategory || product.category_id === this.filterCategory;

      let matchesStock = true;
      if (this.filterStock === 'in-stock') {
        matchesStock = product.stock > product.min_stock;
      } else if (this.filterStock === 'low-stock') {
        matchesStock = product.stock <= product.min_stock && product.stock > 0;
      } else if (this.filterStock === 'out-of-stock') {
        matchesStock = product.stock === 0;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : 'Sin categoría';
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  // ✅ Inicializar productForm dinámicamente
  initProductForm() {
    const form: any = {};
    this.businessFields.forEach(field => {
      if (field.defaultValue !== undefined) {
        form[field.key] = field.defaultValue;
      } else if (field.type === 'array') {
        form[field.key] = [];
      } else if (field.type === 'boolean') {
        form[field.key] = false;
      } else if (field.type === 'number') {
        form[field.key] = 0;
      } else {
        form[field.key] = '';
      }
    });
    this.productForm = form;
  }

  openCreateModal() {
    this.editingProduct = null;
    this.selectedFile = null;
    this.initProductForm();
    this.showModal = true;
  }

 // En el método editProduct, reemplaza estas líneas:
editProduct(product: Product) {
  this.editingProduct = product;
  this.selectedFile = null;
  
  // Inicializar formulario con valores por defecto
  this.initProductForm();
  
  // ✅ Convertir product a any para poder indexar
  const productAny = product as any;
  
  // Sobrescribir con datos del producto
  this.businessFields.forEach(field => {
    if (productAny[field.key] !== undefined) {
      this.productForm[field.key] = productAny[field.key];
    }
  });
  
  // Asegurar campos básicos
  this.productForm.image = product.image || '';
  
  this.showModal = true;
}

  closeModal() {
    this.showModal = false;
    this.editingProduct = null;
    this.selectedFile = null;
    this.initProductForm();
  }

  // ✅ Validación dinámica según campos requeridos
  validateForm(): boolean {
    const requiredFields = this.businessFields.filter(f => f.required);
    
    for (const field of requiredFields) {
      const value = this.productForm[field.key];
      if (value === undefined || value === null || value === '') {
        alert(`Por favor completa el campo: ${field.label}`);
        return false;
      }
    }
    
    return true;
  }

  async saveProduct() {
    // Validación dinámica
    if (!this.validateForm()) {
      return;
    }

    // Verificar SKU solo si el campo existe
    if (this.productForm.sku) {
      try {
        const skuExists = await this.productsService.checkSkuExists(
          this.businessId, 
          this.productForm.sku,
          this.editingProduct?.id
        );

        if (skuExists) {
          alert('Ya existe un producto con ese SKU');
          return;
        }
      } catch (error) {
        console.warn('Error verificando SKU:', error);
      }
    }

    this.isLoading = true;

    try {
      let imageUrl = this.productForm.image;

      // Subir imagen solo si hay una nueva
      if (this.selectedFile) {
        try {
          imageUrl = await this.productsService.uploadProductImage(this.businessId, this.selectedFile);
        } catch (uploadError) {
          console.error('Error subiendo imagen:', uploadError);
          if (this.editingProduct?.image) {
            imageUrl = this.editingProduct.image;
          } else {
            imageUrl = '';
          }
        }
      }

      // ✅ Construir productData dinámicamente
      const productData: any = {
        business_id: this.businessId
      };

      this.businessFields.forEach(field => {
        const value = this.productForm[field.key];
        
        // Ignorar campo de imagen (se maneja aparte)
        if (field.key === 'image') return;
        
        // Ignorar valores vacíos o undefined
        if (value === undefined || value === null || value === '') {
          return;
        }
        
        // Ignorar arrays vacíos
        if (Array.isArray(value) && value.length === 0) {
          return;
        }
        
        productData[field.key] = value;
      });

      // Agregar imagen
      if (imageUrl) {
        productData.image = imageUrl;
      }

      // Guardar en BD
      if (this.editingProduct) {
        await this.productsService.updateProduct(this.editingProduct.id, productData);
        console.log('✅ Producto actualizado');
      } else {
        await this.productsService.createProduct(this.businessId, productData);
        console.log('✅ Producto creado');
      }

      // Cerrar modal
      this.closeModal();

    } catch (error) {
      console.error('Error guardando producto:', error);
      alert('No se pudo guardar el producto. Intenta nuevamente.');
    } finally {
      this.isLoading = false;
    }
  }

  async deleteProduct(product: Product) {
    const isConfirmed = confirm(`¿Estás seguro de eliminar "${product.name}"? Esta acción no se puede deshacer.`);

    if (!isConfirmed) return;

    this.isLoading = true;

    try {
      await this.productsService.deleteProduct(product.id);
      console.log('✅ Producto eliminado');
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error al eliminar el producto');
    } finally {
      this.isLoading = false;
    }
  }

  async exportProducts() {
    this.isLoading = true;

    try {
      const csv = await this.productsService.exportProductsToCSV(this.businessId);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `productos_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ Productos exportados');
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Error al exportar los productos');
    } finally {
      this.isLoading = false;
    }
  }

  openCategoryModal() {
    this.categoryForm = {
      name: '',
      description: '',
      color: '#9333ea'
    };
    this.showCategoryModal = true;
  }

  closeCategoryModal() {
    this.showCategoryModal = false;
    this.categoryForm = {
      name: '',
      description: '',
      color: '#9333ea'
    };
  }

  async saveCategory() {
    if (!this.categoryForm.name.trim()) {
      alert('Por favor ingresa un nombre para la categoría');
      return;
    }

    this.isLoading = true;

    try {
      const newCategory = await this.productsService.createCategory(
        this.businessId,
        this.categoryForm.name.trim(),
        this.categoryForm.description.trim() || undefined,
        this.categoryForm.color
      );

      this.productForm.category_id = newCategory.id;
      
      this.closeCategoryModal();
      
      console.log('✅ Categoría creada');
      
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Error al crear la categoría. Es posible que ya exista una con ese nombre.');
    } finally {
      this.isLoading = false;
    }
  }

  removeCurrentImage() {
    this.productForm.image = '';
    this.selectedFile = null;
  }

  // Helpers para arrays (alérgenos, etc.)
  isOptionSelected(fieldKey: string, option: string): boolean {
    const arr = this.productForm[fieldKey] as string[];
    return arr && arr.includes(option);
  }

  toggleOption(fieldKey: string, option: string) {
    if (!this.productForm[fieldKey]) {
      this.productForm[fieldKey] = [];
    }
    const arr = this.productForm[fieldKey] as string[];
    const index = arr.indexOf(option);
    if (index > -1) {
      arr.splice(index, 1);
    } else {
      arr.push(option);
    }
  }

  ngOnDestroy() {
    this.productsSubscription?.unsubscribe();
    this.categoriesSubscription?.unsubscribe();
  }
}