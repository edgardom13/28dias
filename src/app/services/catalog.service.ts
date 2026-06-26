// src/app/services/catalog.service.ts
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

export interface CatalogSettings {
  id?: string;
  business_id: string;
  is_active: boolean;
  is_public: boolean;
  store_name?: string;
  store_description?: string;
  store_logo_url?: string;
  store_banner_url?: string;
  primary_color: string;
  whatsapp_number?: string;
  instagram_url?: string;
  facebook_url?: string;
  tiktok_url?: string;
  show_prices: boolean;
  allow_cart: boolean;
  require_login: boolean;
  currency: string;
  welcome_message: string;
  order_message: string;
  slug?: string;
  total_views: number;
  total_orders: number;
  created_at?: string;
  updated_at?: string;
}

export interface CatalogProduct {
  id: string;
  business_id: string;
  product_id: string;
  is_visible: boolean;
  is_featured: boolean;
  display_order: number;
  catalog_description?: string;
  catalog_price?: number;
  views_count: number;
  // Datos del producto
  name: string;
  description?: string;
  price: number;
  stock: number;
  image?: string;
  sku?: string;
  category_id?: string;
  category_name?: string;
  category_color?: string;
  final_price: number;
  final_description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  constructor(
    private supabase: SupabaseService,
    private authService: AuthService
  ) {}

  // ==========================================
  // ✅ GET SETTINGS (maneja el caso sin datos)
  // ==========================================
  async getSettings(businessId: string): Promise<CatalogSettings | null> {
    try {
      const { data, error } = await this.supabase
        .from('catalog_settings')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (error) {
        console.error('Error getting catalog settings:', error);
        return null;
      }

      if (data) {
        return data;
      }

      console.log('📝 Creando configuración por defecto del catálogo...');
      return await this.createDefaultSettings(businessId);
    } catch (error) {
      console.error('Error getting catalog settings:', error);
      return null;
    }
  }

  // ==========================================
  // CREATE DEFAULT SETTINGS
  // ==========================================
  async createDefaultSettings(businessId: string): Promise<CatalogSettings | null> {
    try {
      const { data: business } = await this.supabase
        .from('businesses')
        .select('business_name')
        .eq('id', businessId)
        .single();

      const defaultSettings: Partial<CatalogSettings> = {
        business_id: businessId,
        is_active: false,
        is_public: true,
        store_name: business?.business_name || 'Mi Tienda',
        store_description: 'Bienvenido a nuestro catálogo',
        primary_color: '#9333ea',
        show_prices: true,
        allow_cart: true,
        require_login: false,
        currency: 'MXN',
        welcome_message: '¡Bienvenido! Explora nuestro catálogo',
        order_message: '¡Hola! Me interesa hacer un pedido:',
        total_views: 0,
        total_orders: 0
      };

      const { data, error } = await this.supabase
        .from('catalog_settings')
        .insert(defaultSettings)
        .select()
        .single();

      if (error) {
        console.error('Error creating default settings:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating default settings:', error);
      return null;
    }
  }

  // ==========================================
  // UPDATE SETTINGS
  // ==========================================
  async updateSettings(settingsId: string, updates: Partial<CatalogSettings>): Promise<CatalogSettings | null> {
    try {
      const { data, error } = await this.supabase
        .from('catalog_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', settingsId)
        .select()
        .single();

      if (error) {
        console.error('Error updating settings:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error updating settings:', error);
      return null;
    }
  }

  // ==========================================
  // GET CATALOG PRODUCTS
  // ==========================================
  async getCatalogProducts(businessId: string): Promise<CatalogProduct[]> {
    try {
      const { data: catalogData, error: catalogError } = await this.supabase
        .from('catalog_products')
        .select('*')
        .eq('business_id', businessId)
        .order('display_order', { ascending: true });

      if (catalogError) {
        console.error('Error getting catalog products:', catalogError);
        return [];
      }

      if (!catalogData || catalogData.length === 0) {
        return [];
      }

      const productIds = catalogData.map(c => c.product_id);

      const { data: productsData, error: productsError } = await this.supabase
        .from('products')
        .select('id, name, description, price, stock, image, sku, category_id')
        .in('id', productIds);

      if (productsError) {
        console.error('Error getting products:', productsError);
        return [];
      }

      const categoryIds = [...new Set(productsData?.map(p => p.category_id).filter(id => id))];
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

      const productsMap = new Map(
        (productsData || []).map(p => [p.id, p])
      );

      return catalogData.map((catalogItem: any) => {
        const product = productsMap.get(catalogItem.product_id);
        const category = product?.category_id ? categoriesMap.get(product.category_id) : null;

        return {
          id: catalogItem.id,
          business_id: catalogItem.business_id,
          product_id: catalogItem.product_id,
          is_visible: catalogItem.is_visible,
          is_featured: catalogItem.is_featured,
          display_order: catalogItem.display_order,
          catalog_description: catalogItem.catalog_description,
          catalog_price: catalogItem.catalog_price,
          views_count: catalogItem.views_count,
          name: product?.name || 'Producto eliminado',
          description: product?.description,
          price: product?.price || 0,
          stock: product?.stock || 0,
          image: product?.image,
          sku: product?.sku,
          category_id: product?.category_id,
          category_name: category?.name,
          category_color: category?.color,
          final_price: catalogItem.catalog_price || product?.price || 0,
          final_description: catalogItem.catalog_description || product?.description
        };
      }).filter(p => p.name !== 'Producto eliminado');

    } catch (error) {
      console.error('Error getting catalog products:', error);
      return [];
    }
  }

  // ==========================================
  // SYNC PRODUCTS
  // ==========================================
  async syncProductsToCatalog(businessId: string): Promise<{ added: number; total: number }> {
    try {
      const { data: products, error: productsError } = await this.supabase
        .from('products')
        .select('id')
        .eq('business_id', businessId)
        .eq('is_active', true);

      if (productsError) {
        console.error('Error getting products:', productsError);
        throw productsError;
      }

      if (!products || products.length === 0) {
        return { added: 0, total: 0 };
      }

      const { data: existing, error: existingError } = await this.supabase
        .from('catalog_products')
        .select('product_id, display_order')
        .eq('business_id', businessId);

      if (existingError) {
        console.error('Error getting existing catalog:', existingError);
        throw existingError;
      }

      const existingIds = new Set(existing?.map(e => e.product_id) || []);
      const maxOrder = existing?.reduce((max, e) => Math.max(max, e.display_order || 0), 0) || 0;
      
      const newProducts = products.filter(p => !existingIds.has(p.id));

      if (newProducts.length === 0) {
        return { added: 0, total: products.length };
      }

      const toInsert = newProducts.map((p, index) => ({
        business_id: businessId,
        product_id: p.id,
        is_visible: true,
        is_featured: false,
        display_order: maxOrder + index + 1
      }));

      const { error: insertError } = await this.supabase
        .from('catalog_products')
        .insert(toInsert);

      if (insertError) {
        console.error('Error inserting catalog products:', insertError);
        throw insertError;
      }

      console.log(`✅ ${newProducts.length} productos sincronizados`);
      return { added: newProducts.length, total: products.length };

    } catch (error) {
      console.error('Error syncing products:', error);
      throw error;
    }
  }

  // ==========================================
  // UPDATE CATALOG PRODUCT
  // ==========================================
  async updateCatalogProduct(productId: string, updates: Partial<CatalogProduct>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('catalog_products')
        .update(updates)
        .eq('id', productId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating catalog product:', error);
      throw error;
    }
  }

  async toggleProductVisibility(productId: string, isVisible: boolean): Promise<void> {
    await this.updateCatalogProduct(productId, { is_visible: isVisible });
  }

  async toggleProductFeatured(productId: string, isFeatured: boolean): Promise<void> {
    await this.updateCatalogProduct(productId, { is_featured: isFeatured });
  }

  async updateProductOrder(productId: string, order: number): Promise<void> {
    await this.updateCatalogProduct(productId, { display_order: order });
  }

  // ==========================================
  // ✅ PUBLIC CATALOG (CORREGIDO - Incluye business_id)
  // ==========================================
  async getPublicCatalog(slug: string): Promise<{
    settings: CatalogSettings | null;
    products: CatalogProduct[];
  }> {
    try {
      // Obtener configuración
      const { data: settings, error: settingsError } = await this.supabase
        .from('catalog_settings')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .eq('is_public', true)
        .maybeSingle();

      if (settingsError || !settings) {
        return { settings: null, products: [] };
      }

      // Incrementar contador de vistas
      await this.supabase
        .from('catalog_settings')
        .update({ total_views: (settings.total_views || 0) + 1 })
        .eq('id', settings.id);

      // Obtener productos
      const { data: products, error: productsError } = await this.supabase
        .from('catalog_products')
        .select(`
          *,
          products:product_id (
            name,
            description,
            price,
            stock,
            image,
            sku,
            category_id
          ),
          categories:products(category_id(name, color))
        `)
        .eq('business_id', settings.business_id)
        .eq('is_visible', true)
        .order('is_featured', { ascending: false })
        .order('display_order', { ascending: true });

      if (productsError) throw productsError;

      const mappedProducts: CatalogProduct[] = (products || []).map((item: any) => ({
        id: item.id,
        business_id: item.business_id,
        product_id: item.product_id,
        is_visible: item.is_visible,
        is_featured: item.is_featured,
        display_order: item.display_order,
        catalog_description: item.catalog_description,
        catalog_price: item.catalog_price,
        views_count: item.views_count,
        name: item.products?.name || '',
        description: item.products?.description,
        price: item.products?.price || 0,
        stock: item.products?.stock || 0,
        image: item.products?.image,
        sku: item.products?.sku,
        category_id: item.products?.category_id,
        category_name: item.categories?.[0]?.name,
        category_color: item.categories?.[0]?.color,
        final_price: item.catalog_price || item.products?.price || 0,
        final_description: item.catalog_description || item.products?.description
      }));

      // ✅ Asegurar que settings tenga business_id
      const settingsWithBusinessId: CatalogSettings = {
        ...settings,
        business_id: settings.business_id // ✅ Esto es crucial
      };

      return { 
        settings: settingsWithBusinessId, 
        products: mappedProducts 
      };
    } catch (error) {
      console.error('Error getting public catalog:', error);
      return { settings: null, products: [] };
    }
  }

  // ==========================================
  // UTILS
  // ==========================================
  getCatalogUrl(slug: string): string {
    return `${window.location.origin}/catalogo/${slug}`;
  }

  getWhatsAppShareUrl(slug: string, storeName: string): string {
    const url = this.getCatalogUrl(slug);
    const message = encodeURIComponent(`¡Mira nuestro catálogo! ${storeName}\n${url}`);
    return `https://wa.me/?text=${message}`;
  }

  getWhatsAppOrderUrl(
    phoneNumber: string,
    storeName: string,
    items: { name: string; quantity: number; price: number }[],
    customMessage?: string
  ): string {
    let message = `¡Hola! Me interesa hacer un pedido en *${storeName}*:\n\n`;
    items.forEach((item, index) => {
      message += `${index + 1}. ${item.name} x${item.quantity} - $${item.price}\n`;
    });

    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    message += `\n*Total: $${total}*`;

    if (customMessage) {
      message += `\n\n${customMessage}`;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }
}