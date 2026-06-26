import { Injectable } from '@angular/core';

export interface BusinessField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'boolean' | 'array' | 'file';
  required?: boolean;
  placeholder?: string;
  options?: string[];
  grid?: 'full' | 'half';
  defaultValue?: any;
}

export interface BusinessConfig {
  id: string;
  name: string;
  icon: string;
  fields: BusinessField[];
  productCategories: string[];
}

@Injectable({
  providedIn: 'root'
})
export class BusinessConfigService {
  
  private configs: BusinessConfig[] = [
    {
      id: 'tienda',
      name: 'Tienda',
      icon: 'bi-shop',
      productCategories: ['General', 'Electrónica', 'Hogar', 'Limpieza', 'Otros'],
      fields: [
        { key: 'name', label: 'Nombre del producto', type: 'text', required: true, grid: 'full', placeholder: 'Ej: Camiseta básica' },
        { key: 'sku', label: 'SKU', type: 'text', required: true, grid: 'half', placeholder: 'CAM-001' },
        { key: 'barcode', label: 'Código de barras', type: 'text', grid: 'half', placeholder: '7501234567890' },
        { key: 'category_id', label: 'Categoría', type: 'select', required: true, grid: 'half' },
        { key: 'brand', label: 'Marca', type: 'text', grid: 'half', placeholder: 'Nike' },
        { key: 'cost', label: 'Costo ($)', type: 'number', grid: 'half', placeholder: '0.00' },
        { key: 'price', label: 'Precio ($)', type: 'number', required: true, grid: 'half', placeholder: '0.00' },
        { key: 'stock', label: 'Stock', type: 'number', required: true, grid: 'half', placeholder: '0' },
        { key: 'min_stock', label: 'Stock mínimo', type: 'number', grid: 'half', placeholder: '5' },
        { key: 'description', label: 'Descripción', type: 'textarea', grid: 'full', placeholder: 'Descripción del producto...' },
        { key: 'image', label: 'Imagen', type: 'file', grid: 'full' }
      ]
    },
    {
      id: 'restaurante',
      name: 'Restaurante',
      icon: 'bi-cup-hot-fill',
      productCategories: ['Entrantes', 'Platos Fuertes', 'Postres', 'Bebidas', 'Ensaladas', 'Sopas'],
      fields: [
        { key: 'name', label: 'Nombre del plato', type: 'text', required: true, grid: 'full', placeholder: 'Ej: Pasta Carbonara' },
        { key: 'category_id', label: 'Categoría', type: 'select', required: true, grid: 'half' },
        { key: 'cost', label: 'Costo ($)', type: 'number', grid: 'half', placeholder: '0.00' },
        { key: 'price', label: 'Precio ($)', type: 'number', required: true, grid: 'half', placeholder: '0.00' },
        { key: 'preparation_time', label: 'Tiempo preparación (min)', type: 'number', grid: 'half', placeholder: '15' },
        { key: 'is_available', label: 'Disponible', type: 'boolean', grid: 'half', defaultValue: true },
        { key: 'allergens', label: 'Alérgenos', type: 'array', grid: 'full', options: ['Gluten', 'Lactosa', 'Frutos secos', 'Huevo', 'Mariscos', 'Soya'] },
        { key: 'description', label: 'Descripción', type: 'textarea', grid: 'full', placeholder: 'Ingredientes y descripción...' },
        { key: 'image', label: 'Imagen', type: 'file', grid: 'full' }
      ]
    },
    {
      id: 'floristeria',
      name: 'Floristería',
      icon: 'bi-flower1',
      productCategories: ['Ramos', 'Flores individuales', 'Plantas', 'Arreglos', 'Eventos', 'Accesorios'],
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true, grid: 'full', placeholder: 'Ej: Rosas rojas x12' },
        { key: 'sku', label: 'SKU', type: 'text', grid: 'half', placeholder: 'ROS-001' },
        { key: 'category_id', label: 'Categoría', type: 'select', required: true, grid: 'half' },
        { key: 'season', label: 'Temporada', type: 'select', grid: 'half', options: ['Todo el año', 'Primavera', 'Verano', 'Otoño', 'Invierno'] },
        { key: 'cost', label: 'Costo ($)', type: 'number', grid: 'half', placeholder: '0.00' },
        { key: 'price', label: 'Precio ($)', type: 'number', required: true, grid: 'half', placeholder: '0.00' },
        { key: 'stock', label: 'Stock', type: 'number', required: true, grid: 'half', placeholder: '0' },
        { key: 'min_stock', label: 'Stock mínimo', type: 'number', grid: 'half', placeholder: '5' },
        { key: 'description', label: 'Descripción', type: 'textarea', grid: 'full', placeholder: 'Cuidados, características...' },
        { key: 'image', label: 'Imagen', type: 'file', grid: 'full' }
      ]
    },
    {
      id: 'taller',
      name: 'Taller Mecánico',
      icon: 'bi-gear-fill',
      productCategories: ['Servicios', 'Repuestos', 'Mano de obra', 'Aceites', 'Herramientas', 'Accesorios'],
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true, grid: 'full', placeholder: 'Ej: Cambio de aceite' },
        { key: 'sku', label: 'Código', type: 'text', grid: 'half', placeholder: 'SER-001' },
        { key: 'category_id', label: 'Categoría', type: 'select', required: true, grid: 'half' },
        { key: 'cost', label: 'Costo ($)', type: 'number', grid: 'half', placeholder: '0.00' },
        { key: 'price', label: 'Precio ($)', type: 'number', required: true, grid: 'half', placeholder: '0.00' },
        { key: 'preparation_time', label: 'Tiempo estimado (min)', type: 'number', grid: 'half', placeholder: '60' },
        { key: 'stock', label: 'Stock (si aplica)', type: 'number', grid: 'half', placeholder: '0' },
        { key: 'description', label: 'Descripción', type: 'textarea', grid: 'full', placeholder: 'Detalles del servicio o repuesto...' },
        { key: 'image', label: 'Imagen', type: 'file', grid: 'full' }
      ]
    },
    {
      id: 'perfumeria',
      name: 'Perfumería',
      icon: 'bi-droplet-fill',
      productCategories: ['Hombre', 'Mujer', 'Unisex', 'Niños', 'Corporal', 'Maquillaje'],
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true, grid: 'full', placeholder: 'Ej: Perfume X 100ml' },
        { key: 'sku', label: 'SKU', type: 'text', required: true, grid: 'half', placeholder: 'PER-001' },
        { key: 'barcode', label: 'Código de barras', type: 'text', grid: 'half', placeholder: '7501234567890' },
        { key: 'category_id', label: 'Categoría', type: 'select', required: true, grid: 'half' },
        { key: 'brand', label: 'Marca', type: 'text', grid: 'half', placeholder: 'Dior' },
        { key: 'volume', label: 'Volumen (ml)', type: 'text', grid: 'half', placeholder: '100ml' },
        { key: 'cost', label: 'Costo ($)', type: 'number', grid: 'half', placeholder: '0.00' },
        { key: 'price', label: 'Precio ($)', type: 'number', required: true, grid: 'half', placeholder: '0.00' },
        { key: 'stock', label: 'Stock', type: 'number', required: true, grid: 'half', placeholder: '0' },
        { key: 'min_stock', label: 'Stock mínimo', type: 'number', grid: 'half', placeholder: '3' },
        { key: 'description', label: 'Descripción', type: 'textarea', grid: 'full', placeholder: 'Notas olfativas, duración...' },
        { key: 'image', label: 'Imagen', type: 'file', grid: 'full' }
      ]
    },
    {
      id: 'ropa',
      name: 'Tienda de Ropa',
      icon: 'bi-handbag-fill',
      productCategories: ['Hombre', 'Mujer', 'Niños', 'Accesorios', 'Calzado', 'Ofertas'],
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true, grid: 'full', placeholder: 'Ej: Camisa manga larga' },
        { key: 'sku', label: 'SKU', type: 'text', required: true, grid: 'half', placeholder: 'CAM-001' },
        { key: 'barcode', label: 'Código de barras', type: 'text', grid: 'half', placeholder: '7501234567890' },
        { key: 'category_id', label: 'Categoría', type: 'select', required: true, grid: 'half' },
        { key: 'brand', label: 'Marca', type: 'text', grid: 'half', placeholder: 'Zara' },
        { key: 'size', label: 'Talla', type: 'text', grid: 'half', placeholder: 'M, L, XL' },
        { key: 'color', label: 'Color', type: 'text', grid: 'half', placeholder: 'Azul' },
        { key: 'cost', label: 'Costo ($)', type: 'number', grid: 'half', placeholder: '0.00' },
        { key: 'price', label: 'Precio ($)', type: 'number', required: true, grid: 'half', placeholder: '0.00' },
        { key: 'stock', label: 'Stock', type: 'number', required: true, grid: 'half', placeholder: '0' },
        { key: 'min_stock', label: 'Stock mínimo', type: 'number', grid: 'half', placeholder: '5' },
        { key: 'description', label: 'Descripción', type: 'textarea', grid: 'full', placeholder: 'Material, estilo...' },
        { key: 'image', label: 'Imagen', type: 'file', grid: 'full' }
      ]
    },
    {
      id: 'accesorios',
      name: 'Accesorios',
      icon: 'bi-gem',
      productCategories: ['Joyería', 'Relojes', 'Bolsos', 'Cinturones', 'Gafas', 'Otros'],
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true, grid: 'full', placeholder: 'Ej: Collar de plata' },
        { key: 'sku', label: 'SKU', type: 'text', grid: 'half', placeholder: 'ACC-001' },
        { key: 'category_id', label: 'Categoría', type: 'select', required: true, grid: 'half' },
        { key: 'brand', label: 'Marca', type: 'text', grid: 'half', placeholder: 'Pandora' },
        { key: 'material', label: 'Material', type: 'text', grid: 'half', placeholder: 'Plata 925' },
        { key: 'color', label: 'Color', type: 'text', grid: 'half', placeholder: 'Dorado' },
        { key: 'cost', label: 'Costo ($)', type: 'number', grid: 'half', placeholder: '0.00' },
        { key: 'price', label: 'Precio ($)', type: 'number', required: true, grid: 'half', placeholder: '0.00' },
        { key: 'stock', label: 'Stock', type: 'number', required: true, grid: 'half', placeholder: '0' },
        { key: 'min_stock', label: 'Stock mínimo', type: 'number', grid: 'half', placeholder: '3' },
        { key: 'description', label: 'Descripción', type: 'textarea', grid: 'full', placeholder: 'Detalles del accesorio...' },
        { key: 'image', label: 'Imagen', type: 'file', grid: 'full' }
      ]
    },
    {
      id: 'regalos',
      name: 'Tienda de Regalos',
      icon: 'bi-gift-fill',
      productCategories: ['Cumpleaños', 'Aniversario', 'Boda', 'Navidad', 'Día de la Madre', 'Personalizados'],
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true, grid: 'full', placeholder: 'Ej: Caja de regalo premium' },
        { key: 'sku', label: 'SKU', type: 'text', grid: 'half', placeholder: 'REG-001' },
        { key: 'category_id', label: 'Categoría', type: 'select', required: true, grid: 'half' },
        { key: 'occasion', label: 'Ocasión', type: 'text', grid: 'half', placeholder: 'Cumpleaños' },
        { key: 'cost', label: 'Costo ($)', type: 'number', grid: 'half', placeholder: '0.00' },
        { key: 'price', label: 'Precio ($)', type: 'number', required: true, grid: 'half', placeholder: '0.00' },
        { key: 'stock', label: 'Stock', type: 'number', required: true, grid: 'half', placeholder: '0' },
        { key: 'min_stock', label: 'Stock mínimo', type: 'number', grid: 'half', placeholder: '5' },
        { key: 'description', label: 'Descripción', type: 'textarea', grid: 'full', placeholder: 'Contenido, tamaño...' },
        { key: 'image', label: 'Imagen', type: 'file', grid: 'full' }
      ]
    },
    {
      id: 'jardineria',
      name: 'Jardinería',
      icon: 'bi-tree-fill',
      productCategories: ['Plantas', 'Herramientas', 'Sustratos', 'Macetas', 'Fertilizantes', 'Semillas'],
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true, grid: 'full', placeholder: 'Ej: Monstera Deliciosa' },
        { key: 'sku', label: 'SKU', type: 'text', grid: 'half', placeholder: 'JAR-001' },
        { key: 'category_id', label: 'Categoría', type: 'select', required: true, grid: 'half' },
        { key: 'season', label: 'Temporada', type: 'select', grid: 'half', options: ['Todo el año', 'Primavera', 'Verano', 'Otoño', 'Invierno'] },
        { key: 'cost', label: 'Costo ($)', type: 'number', grid: 'half', placeholder: '0.00' },
        { key: 'price', label: 'Precio ($)', type: 'number', required: true, grid: 'half', placeholder: '0.00' },
        { key: 'stock', label: 'Stock', type: 'number', required: true, grid: 'half', placeholder: '0' },
        { key: 'min_stock', label: 'Stock mínimo', type: 'number', grid: 'half', placeholder: '3' },
        { key: 'description', label: 'Descripción', type: 'textarea', grid: 'full', placeholder: 'Cuidados, luz, agua...' },
        { key: 'image', label: 'Imagen', type: 'file', grid: 'full' }
      ]
    },
    {
      id: 'zapatos',
      name: 'Tienda de Zapatos',
      icon: 'bi-shoe',
      productCategories: ['Hombre', 'Mujer', 'Niños', 'Deportivos', 'Formales', 'Casuales'],
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true, grid: 'full', placeholder: 'Ej: Tenis running' },
        { key: 'sku', label: 'SKU', type: 'text', required: true, grid: 'half', placeholder: 'ZAP-001' },
        { key: 'barcode', label: 'Código de barras', type: 'text', grid: 'half', placeholder: '7501234567890' },
        { key: 'category_id', label: 'Categoría', type: 'select', required: true, grid: 'half' },
        { key: 'brand', label: 'Marca', type: 'text', grid: 'half', placeholder: 'Nike' },
        { key: 'size', label: 'Talla', type: 'text', grid: 'half', placeholder: '27, 28, 29' },
        { key: 'color', label: 'Color', type: 'text', grid: 'half', placeholder: 'Negro' },
        { key: 'cost', label: 'Costo ($)', type: 'number', grid: 'half', placeholder: '0.00' },
        { key: 'price', label: 'Precio ($)', type: 'number', required: true, grid: 'half', placeholder: '0.00' },
        { key: 'stock', label: 'Stock', type: 'number', required: true, grid: 'half', placeholder: '0' },
        { key: 'min_stock', label: 'Stock mínimo', type: 'number', grid: 'half', placeholder: '3' },
        { key: 'description', label: 'Descripción', type: 'textarea', grid: 'full', placeholder: 'Material, uso...' },
        { key: 'image', label: 'Imagen', type: 'file', grid: 'full' }
      ]
    },
    {
      id: 'cafe',
      name: 'Café',
      icon: 'bi-cup-straw',
      productCategories: ['Cafés calientes', 'Cafés fríos', 'Tés', 'Postres', 'Desayunos', 'Extras'],
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true, grid: 'full', placeholder: 'Ej: Cappuccino' },
        { key: 'category_id', label: 'Categoría', type: 'select', required: true, grid: 'half' },
        { key: 'size', label: 'Tamaño', type: 'select', grid: 'half', options: ['Chico', 'Mediano', 'Grande'] },
        { key: 'cost', label: 'Costo ($)', type: 'number', grid: 'half', placeholder: '0.00' },
        { key: 'price', label: 'Precio ($)', type: 'number', required: true, grid: 'half', placeholder: '0.00' },
        { key: 'preparation_time', label: 'Tiempo preparación (min)', type: 'number', grid: 'half', placeholder: '5' },
        { key: 'is_available', label: 'Disponible', type: 'boolean', grid: 'half', defaultValue: true },
        { key: 'description', label: 'Descripción', type: 'textarea', grid: 'full', placeholder: 'Ingredientes, origen del grano...' },
        { key: 'image', label: 'Imagen', type: 'file', grid: 'full' }
      ]
    },
    {
      id: 'bar',
      name: 'Bar',
      icon: 'bi-cup-fill',
      productCategories: ['Cervezas', 'Cócteles', 'Licores', 'Vinos', 'Tapas', 'Sin alcohol'],
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true, grid: 'full', placeholder: 'Ej: Margarita' },
        { key: 'category_id', label: 'Categoría', type: 'select', required: true, grid: 'half' },
        { key: 'volume', label: 'Volumen', type: 'text', grid: 'half', placeholder: '350ml' },
        { key: 'cost', label: 'Costo ($)', type: 'number', grid: 'half', placeholder: '0.00' },
        { key: 'price', label: 'Precio ($)', type: 'number', required: true, grid: 'half', placeholder: '0.00' },
        { key: 'stock', label: 'Stock', type: 'number', grid: 'half', placeholder: '0' },
        { key: 'is_available', label: 'Disponible', type: 'boolean', grid: 'half', defaultValue: true },
        { key: 'description', label: 'Descripción', type: 'textarea', grid: 'full', placeholder: 'Ingredientes, graduación...' },
        { key: 'image', label: 'Imagen', type: 'file', grid: 'full' }
      ]
    },
    {
      id: 'comida-rapida',
      name: 'Comidas Rápidas',
      icon: 'bi-egg-fried',
      productCategories: ['Hamburguesas', 'Pizzas', 'Pollos', 'Ensaladas', 'Bebidas', 'Postres'],
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true, grid: 'full', placeholder: 'Ej: Hamburguesa clásica' },
        { key: 'category_id', label: 'Categoría', type: 'select', required: true, grid: 'half' },
        { key: 'cost', label: 'Costo ($)', type: 'number', grid: 'half', placeholder: '0.00' },
        { key: 'price', label: 'Precio ($)', type: 'number', required: true, grid: 'half', placeholder: '0.00' },
        { key: 'preparation_time', label: 'Tiempo preparación (min)', type: 'number', grid: 'half', placeholder: '10' },
        { key: 'is_available', label: 'Disponible', type: 'boolean', grid: 'half', defaultValue: true },
        { key: 'allergens', label: 'Alérgenos', type: 'array', grid: 'full', options: ['Gluten', 'Lactosa', 'Huevo', 'Soya'] },
        { key: 'ingredients', label: 'Ingredientes', type: 'textarea', grid: 'full', placeholder: 'Lista de ingredientes...' },
        { key: 'description', label: 'Descripción', type: 'textarea', grid: 'full', placeholder: 'Descripción del plato...' },
        { key: 'image', label: 'Imagen', type: 'file', grid: 'full' }
      ]
    },
    {
      id: 'licoreria',
      name: 'Licorería',
      icon: 'bi-wine',
      productCategories: ['Cervezas', 'Vinos', 'Licores', 'Tequilas', 'Whiskys', 'Aguardiente'],
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true, grid: 'full', placeholder: 'Ej: Vino tinto reserva' },
        { key: 'sku', label: 'SKU', type: 'text', grid: 'half', placeholder: 'LIC-001' },
        { key: 'barcode', label: 'Código de barras', type: 'text', grid: 'half', placeholder: '7501234567890' },
        { key: 'category_id', label: 'Categoría', type: 'select', required: true, grid: 'half' },
        { key: 'brand', label: 'Marca', type: 'text', grid: 'half', placeholder: 'Smirnoff' },
        { key: 'volume', label: 'Volumen', type: 'text', grid: 'half', placeholder: '750ml' },
        { key: 'alcohol_content', label: 'Graduación alcohólica', type: 'text', grid: 'half', placeholder: '40%' },
        { key: 'country_origin', label: 'País de origen', type: 'text', grid: 'half', placeholder: 'México' },
        { key: 'cost', label: 'Costo ($)', type: 'number', grid: 'half', placeholder: '0.00' },
        { key: 'price', label: 'Precio ($)', type: 'number', required: true, grid: 'half', placeholder: '0.00' },
        { key: 'stock', label: 'Stock', type: 'number', required: true, grid: 'half', placeholder: '0' },
        { key: 'min_stock', label: 'Stock mínimo', type: 'number', grid: 'half', placeholder: '6' },
        { key: 'description', label: 'Descripción', type: 'textarea', grid: 'full', placeholder: 'Notas, maridaje...' },
        { key: 'image', label: 'Imagen', type: 'file', grid: 'full' }
      ]
    },
    {
      id: 'panaderia',
      name: 'Panadería',
      icon: 'bi-basket-fill',
      productCategories: ['Panes', 'Dulces', 'Salados', 'Pasteles', 'Galletas', 'Bebidas'],
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true, grid: 'full', placeholder: 'Ej: Pan artesanal' },
        { key: 'category_id', label: 'Categoría', type: 'select', required: true, grid: 'half' },
        { key: 'cost', label: 'Costo ($)', type: 'number', grid: 'half', placeholder: '0.00' },
        { key: 'price', label: 'Precio ($)', type: 'number', required: true, grid: 'half', placeholder: '0.00' },
        { key: 'stock', label: 'Stock', type: 'number', required: true, grid: 'half', placeholder: '0' },
        { key: 'min_stock', label: 'Stock mínimo', type: 'number', grid: 'half', placeholder: '10' },
        { key: 'preparation_time', label: 'Tiempo preparación (min)', type: 'number', grid: 'half', placeholder: '60' },
        { key: 'is_available', label: 'Disponible', type: 'boolean', grid: 'half', defaultValue: true },
        { key: 'allergens', label: 'Alérgenos', type: 'array', grid: 'full', options: ['Gluten', 'Lactosa', 'Huevo', 'Frutos secos'] },
        { key: 'description', label: 'Descripción', type: 'textarea', grid: 'full', placeholder: 'Ingredientes, peso...' },
        { key: 'image', label: 'Imagen', type: 'file', grid: 'full' }
      ]
    }
  ];

  // Obtener configuración por tipo de negocio
  getConfig(businessType: string): BusinessConfig {
    return this.configs.find(c => c.id === businessType) || this.configs[0]; // Default: tienda
  }

  // Obtener todos los tipos
  getAllTypes(): { id: string; name: string; icon: string }[] {
    return this.configs.map(c => ({ id: c.id, name: c.name, icon: c.icon }));
  }

  // Obtener campos de un tipo
  getFields(businessType: string): BusinessField[] {
    return this.getConfig(businessType).fields;
  }

  // Obtener categorías por defecto
  getDefaultCategories(businessType: string): string[] {
    return this.getConfig(businessType).productCategories;
  }
}