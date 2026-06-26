import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { BehaviorSubject } from 'rxjs';

export interface Product {
  id: string;
  business_id: string;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  image?: string;
  category_id?: string;
  brand?: string;
  cost: number;
  price: number;
  stock: number;
  min_stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductFormData {
  name: string;
  sku: string;
  barcode?: string;
  category_id?: string;
  brand?: string;
  cost: number;
  price: number;
  stock: number;
  min_stock: number;
  description?: string;
  image?: string;
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
  updated_at: string;
  parent_id?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private supabase: SupabaseClient;
  private productsSubject = new BehaviorSubject<Product[]>([]);
  private categoriesSubject = new BehaviorSubject<Category[]>([]);

  products$ = this.productsSubject.asObservable();
  categories$ = this.categoriesSubject.asObservable();

  constructor(private supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getClient();
  }

  // ============================================
  // PRODUCTOS
  // ============================================

  async getProducts(businessId: string): Promise<Product[]> {
    if (!businessId || businessId === 'null' || businessId === 'undefined') {
      console.error('getProducts: businessId inválido:', businessId);
      this.productsSubject.next([]);
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting products:', error);
        throw error;
      }

      this.productsSubject.next(data || []);
      return data || [];
    } catch (error) {
      console.error('Error getting products:', error);
      throw error;
    }
  }

  async createProduct(businessId: string, productData: ProductFormData): Promise<Product> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .insert([
          {
            business_id: businessId,
            ...productData,
            is_active: true
          }
        ])
        .select()
        .single();

      if (error) throw error;

      const currentProducts = this.productsSubject.value;
      this.productsSubject.next([data, ...currentProducts]);

      return data;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  async updateProduct(productId: string, productData: Partial<ProductFormData>): Promise<Product> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .update(productData)
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;

      const currentProducts = this.productsSubject.value;
      const updatedProducts = currentProducts.map(p => p.id === productId ? { ...p, ...data } : p);
      this.productsSubject.next(updatedProducts);

      return data;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', productId);

      if (error) throw error;

      const currentProducts = this.productsSubject.value;
      const filteredProducts = currentProducts.filter(p => p.id !== productId);
      this.productsSubject.next(filteredProducts);
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  async checkSkuExists(businessId: string, sku: string, excludeProductId?: string): Promise<boolean> {
    try {
      let query = this.supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('sku', sku)
        .eq('is_active', true);

      if (excludeProductId) {
        query = query.neq('id', excludeProductId);
      }

      const { count, error } = await query;
      if (error) throw error;
      return (count || 0) > 0;
    } catch (error) {
      console.error('Error checking SKU:', error);
      return false;
    }
  }

  // ============================================
  // CATEGORÍAS
  // ============================================

  async getCategories(businessId: string): Promise<Category[]> {
    if (!businessId || businessId === 'null' || businessId === 'undefined') {
      console.error('getCategories: businessId inválido:', businessId);
      this.categoriesSubject.next([]);
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('categories')
        .select('*')
        .eq('business_id', businessId)
        .order('name');

      if (error) {
        console.error('Error getting categories:', error);
        throw error;
      }

      this.categoriesSubject.next(data || []);
      return data || [];
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  }

async createCategory(
  businessId: string, 
  name: string, 
  description?: string, 
  color?: string,
  parentId?: string | null // ✅ NUEVO
): Promise<Category> {
  const { data, error } = await this.supabase
    .from('categories')
    .insert({
      business_id: businessId,
      name: name,
      description: description || null,
      color: color || '#9333ea',
      parent_id: parentId || null, // ✅ NUEVO
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;

  const currentCategories = this.categoriesSubject.value;
  this.categoriesSubject.next([data, ...currentCategories]);

  return data;
}

  async updateCategory(categoryId: string, categoryData: Partial<Category>): Promise<Category> {
  const { data, error } = await this.supabase
    .from('categories')
    .update({
      name: categoryData.name,
      description: categoryData.description || null,
      color: categoryData.color || '#9333ea',
      parent_id: categoryData.parent_id || null, // ✅ NUEVO
      updated_at: new Date().toISOString()
    })
    .eq('id', categoryId)
    .select()
    .single();

  if (error) throw error;

  const currentCategories = this.categoriesSubject.value;
  const index = currentCategories.findIndex(c => c.id === categoryId);
  if (index !== -1) {
    currentCategories[index] = data;
    this.categoriesSubject.next([...currentCategories]);
  }

  return data;
}

  async deleteCategory(categoryId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      const currentCategories = this.categoriesSubject.value;
      const filteredCategories = currentCategories.filter(c => c.id !== categoryId);
      this.categoriesSubject.next(filteredCategories);
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  async getProductStats(businessId: string) {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('stock, min_stock')
        .eq('business_id', businessId)
        .eq('is_active', true);

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        inStock: data?.filter(p => p.stock > p.min_stock).length || 0,
        lowStock: data?.filter(p => p.stock <= p.min_stock && p.stock > 0).length || 0,
        outOfStock: data?.filter(p => p.stock === 0).length || 0
      };

      return stats;
    } catch (error) {
      console.error('Error getting product stats:', error);
      return { total: 0, inStock: 0, lowStock: 0, outOfStock: 0 };
    }
  }

  // ============================================
  // EXPORTAR
  // ============================================

  async exportProductsToCSV(businessId: string): Promise<string> {
    try {
      const products = await this.getProducts(businessId);
      const categories = this.categoriesSubject.value;

      const csvHeader = 'Nombre,SKU,Código de Barras,Categoría,Marca,Costo,Precio,Stock,Stock Mínimo,Descripción\n';
      
      const csvRows = products.map(product => {
        const category = categories.find(c => c.id === product.category_id);
        return [
          `"${product.name}"`,
          product.sku,
          product.barcode || '',
          category?.name || '',
          product.brand || '',
          product.cost,
          product.price,
          product.stock,
          product.min_stock,
          `"${product.description || ''}"`
        ].join(',');
      }).join('\n');

      return csvHeader + csvRows;
    } catch (error) {
      console.error('Error exporting products:', error);
      throw error;
    }
  }

  // ============================================
  // IMÁGENES
  // ============================================

  async uploadProductImage(businessId: string, file: File): Promise<string> {
  try {
    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      throw new Error('El archivo debe ser una imagen');
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('La imagen no debe superar los 5MB');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${businessId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    console.log('📤 Subiendo imagen:', fileName);

    // Subir el archivo
    const { data, error } = await this.supabase.storage
      .from('productos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ Error subiendo imagen:', error);
      throw error;
    }

    console.log('✅ Imagen subida:', data);

    // Obtener la URL pública
    const { data: publicUrlData } = this.supabase.storage
      .from('productos')
      .getPublicUrl(fileName);

    console.log('🔗 URL pública:', publicUrlData.publicUrl);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error en uploadProductImage:', error);
    throw error;
  }
}

}
