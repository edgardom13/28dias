import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { SocketService } from './socket.service';
import { TransactionsService } from './transactions.service';

// ==========================================
// INTERFACES
// ==========================================
export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Order {
  id: string;
  business_id: string;
  customer_id?: string;
  customer_name?: string;
  order_number: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  delivery_type: 'pickup' | 'delivery';
  
  // ✅ CAMPOS DE PAGO
  payment_method?: string;
  payment_status?: 'unpaid' | 'partial' | 'paid' | 'refunded';
  payment_reference?: string;
  payment_amount?: number;
  payment_date?: string;
  payment_notes?: string;
  source?: 'manual' | 'catalog' | 'website';
  
  total: number;
  subtotal: number;
  tax: number;
  notes?: string;
  delivery_address?: string;
  estimated_date?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
  items?: OrderItem[];
}

export interface PaymentMethod {
  id: string;
  business_id: string;
  name: string;
  type: 'cash' | 'transfer' | 'card' | 'digital_wallet' | 'other';
  is_active: boolean;
  instructions?: string;
  created_at: string;
  updated_at: string;
}

// ==========================================
// SERVICE
// ==========================================
@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private ordersSubject = new BehaviorSubject<Order[]>([]);
  orders$ = this.ordersSubject.asObservable();

  private paymentMethodsSubject = new BehaviorSubject<PaymentMethod[]>([]);
  paymentMethods$ = this.paymentMethodsSubject.asObservable();

  constructor(
    private supabase: SupabaseService,
    private socketService: SocketService,
    private transactionsService: TransactionsService // ✅ INYECTADO
  ) {}

  // ==========================================
  // GET ORDERS
  // ==========================================
  async getOrders(businessId: string, status?: string): Promise<Order[]> {
    try {
      console.log('🔍 Obteniendo pedidos para business:', businessId);
      
      let query = this.supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_id,
            product_name,
            quantity,
            price,
            subtotal
          )
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      // ✅ CORRECCIÓN: Mapeo correcto del payment_status
      const orders = (data || []).map(order => {
        const isActuallyPaid = order.payment_amount > 0 || order.payment_date != null;
        const realPaymentStatus = order.payment_status || (isActuallyPaid ? 'paid' : 'unpaid');
        
        return {
          ...order,
          items: order.order_items || [],
          payment_status: realPaymentStatus,
          payment_method: order.payment_method || 'Pendiente',
          source: order.source || 'manual'
        };
      });

      console.log('✅ Pedidos obtenidos:', orders.length);
      this.ordersSubject.next(orders);
      return orders;
    } catch (error) {
      console.error('❌ Error fetching orders:', error);
      throw error;
    }
  }

  // ==========================================
  // GET PAYMENT METHODS
  // ==========================================
  async getPaymentMethods(businessId: string): Promise<PaymentMethod[]> {
    try {
      const { data, error } = await this.supabase
        .from('business_payment_methods')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const methods = data || [];
      this.paymentMethodsSubject.next(methods);
      return methods;
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      return [];
    }
  }

  // ==========================================
  // CREATE PAYMENT METHOD
  // ==========================================
  async createPaymentMethod(method: Partial<PaymentMethod>): Promise<PaymentMethod> {
    try {
      const { data, error } = await this.supabase
        .from('business_payment_methods')
        .insert({
          business_id: method.business_id,
          name: method.name,
          type: method.type,
          instructions: method.instructions || null,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      if (method.business_id) {
        await this.getPaymentMethods(method.business_id);
      }
      return data;
    } catch (error) {
      console.error('Error creating payment method:', error);
      throw error;
    }
  }

  // ==========================================
  // CREATE ORDER (MANUAL / POS)
  // ✅ CORREGIDO: Crea transacción automáticamente si está pagado
  // ==========================================
  async createOrder(orderData: Partial<Order>, items: OrderItem[]): Promise<Order> {
    try {
      console.log('📦 Creando pedido manual con business_id:', orderData.business_id);
      console.log('💰 Payment status recibido:', orderData.payment_status);
      
      const orderNumber = `ORD-${Date.now()}`;

      // ✅ CORRECCIÓN: Determinar el payment_status correcto
      const paymentStatus = orderData.payment_status || 'paid';
      
      // ✅ CORRECCIÓN: Si está pagado, calcular monto y fecha automáticamente
      let paymentAmount = orderData.payment_amount || 0;
      let paymentDate = orderData.payment_date || null;
      
      if (paymentStatus === 'paid' && paymentAmount === 0) {
        paymentAmount = orderData.total || 0;
        paymentDate = new Date().toISOString();
      }

      const { data: order, error: orderError } = await this.supabase
        .from('orders')
        .insert({
          business_id: orderData.business_id,
          customer_id: orderData.customer_id || null,
          order_number: orderNumber,
          status: orderData.status || 'pending',
          delivery_type: orderData.delivery_type || 'pickup',
          total: orderData.total || 0,
          subtotal: orderData.subtotal || 0,
          tax: orderData.tax || 0,
          notes: orderData.notes || null,
          delivery_address: orderData.delivery_address || null,
          estimated_date: orderData.estimated_date || null,
          // ✅ CAMPOS DE PAGO - Se guardan correctamente
          payment_method: orderData.payment_method || 'Efectivo',
          payment_status: paymentStatus,
          payment_reference: orderData.payment_reference || null,
          payment_amount: paymentAmount,
          payment_date: paymentDate,
          payment_notes: orderData.payment_notes || null,
          source: 'manual' // ✅ Siempre manual desde POS
        })
        .select()
        .single();

      if (orderError) throw orderError;

      console.log('✅ Pedido POS creado con payment_status:', order.payment_status);

      if (items.length > 0) {
        const itemsToInsert = items.map(item => ({
          order_id: order.id,
          product_id: item.product_id || null,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal
        }));

        const { error: itemsError } = await this.supabase
          .from('order_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // ✅ NUEVO: Crear transacción de ingreso si el pedido está pagado
      if (paymentStatus === 'paid' && paymentAmount > 0) {
        await this.createIncomeTransaction(order);
      }

      this.socketService.emitNewOrder(order);

      await this.getOrders(orderData.business_id!);

      return order;
    } catch (error) {
      console.error('❌ Error creating order:', error);
      throw error;
    }
  }

  // ==========================================
  // CREATE ORDER FROM CATALOG (PÚBLICO)
  // ✅ SIEMPRE se crea como NO PAGADO (unpaid)
  // ==========================================
  async createOrderFromCatalog(orderData: Partial<Order>, items: OrderItem[]): Promise<Order> {
    try {
      console.log('🛒 Creando pedido desde catálogo con business_id:', orderData.business_id);
      
      const orderNumber = `CAT-${Date.now()}`;

      // 1. Insertar orden - SIEMPRE como NO PAGADO
      const { data: order, error: orderError } = await this.supabase
        .from('orders')
        .insert({
          business_id: orderData.business_id,
          customer_id: orderData.customer_id || null,
          order_number: orderNumber,
          status: 'pending',
          delivery_type: orderData.delivery_type || 'pickup',
          total: orderData.total || 0,
          subtotal: orderData.subtotal || 0,
          tax: orderData.tax || 0,
          notes: orderData.notes || null,
          delivery_address: orderData.delivery_address || null,
          estimated_date: orderData.estimated_date || null,
          // ✅ CATÁLOGO: SIEMPRE NO PAGADO
          payment_method: 'Pendiente',
          payment_status: 'unpaid',
          payment_reference: null,
          payment_amount: 0,
          payment_date: null,
          payment_notes: orderData.payment_notes || null,
          source: orderData.source || 'catalog'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      console.log('✅ Pedido creado en BD:', order);

      // 2. Insertar items
      if (items.length > 0) {
        const itemsToInsert = items.map(item => ({
          order_id: order.id,
          product_id: item.product_id || null,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal
        }));

        const { error: itemsError } = await this.supabase
          .from('order_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        console.log('✅ Items insertados:', itemsToInsert.length);
      }

      // 3. Crear notificación
      const { error: notificationError } = await this.supabase
        .from('business_notifications')
        .insert({
          business_id: orderData.business_id,
          type: 'success',
          title: '¡Nuevo Pedido Recibido!',
          message: `Pedido ${order.order_number} por $${order.total} - Pendiente de confirmación`,
          link: '/dashboard/orders',
          read: false,
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            total: order.total,
            source: orderData.source || 'catalog',
            paymentStatus: 'unpaid'
          }
        });

      if (notificationError) {
        console.error('⚠️ Error creando notificación:', notificationError);
      } else {
        console.log('✅ Notificación creada en BD');
      }

      // 4. Emitir evento
      this.socketService.emitNewOrder(order);

      // 5. Recargar órdenes
      if (orderData.business_id) {
        console.log('🔄 Recargando pedidos después de crear...');
        await this.getOrders(orderData.business_id);
        console.log('✅ Pedidos recargados');
      }

      return order;
    } catch (error) {
      console.error('❌ Error creating order from catalog:', error);
      throw error;
    }
  }

  // ==========================================
  // UPDATE ORDER STATUS
  // ==========================================
  async updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { data: updatedOrder, error } = await this.supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      const orders = this.ordersSubject.value;
      const index = orders.findIndex(o => o.id === orderId);
      if (index !== -1) {
        orders[index].status = status;
        if (status === 'completed') {
          orders[index].completed_at = new Date().toISOString();
        }
        this.ordersSubject.next([...orders]);
      }
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      throw error;
    }
  }

  // ==========================================
  // DELETE ORDER
  // ==========================================
  async deleteOrder(orderId: string): Promise<void> {
    try {
      const { error: itemsError } = await this.supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      const { error } = await this.supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;

      const orders = this.ordersSubject.value;
      this.ordersSubject.next(orders.filter(o => o.id !== orderId));
    } catch (error) {
      console.error('❌ Error deleting order:', error);
      throw error;
    }
  }

  // ==========================================
  // GET ORDER BY ID
  // ==========================================
  async getOrderById(orderId: string): Promise<Order | null> {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_id,
            product_name,
            quantity,
            price,
            subtotal
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;

      // ✅ CORRECCIÓN: Mismo mapeo inteligente
      const isActuallyPaid = data.payment_amount > 0 || data.payment_date != null;
      const realPaymentStatus = data.payment_status || (isActuallyPaid ? 'paid' : 'unpaid');

      return {
        ...data,
        items: data.order_items || [],
        payment_status: realPaymentStatus,
        payment_method: data.payment_method || 'Pendiente',
        source: data.source || 'manual'
      };
    } catch (error) {
      console.error('❌ Error fetching order:', error);
      return null;
    }
  }

  // ==========================================
  // GET ORDER STATISTICS
  // ==========================================
  async getOrderStatistics(businessId: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select('status')
        .eq('business_id', businessId);

      if (error) throw error;

      const stats = {
        total: data.length,
        pending: data.filter(o => o.status === 'pending').length,
        processing: data.filter(o => o.status === 'processing').length,
        completed: data.filter(o => o.status === 'completed').length,
        cancelled: data.filter(o => o.status === 'cancelled').length
      };

      return stats;
    } catch (error) {
      console.error('❌ Error fetching order statistics:', error);
      return { total: 0, pending: 0, processing: 0, completed: 0, cancelled: 0 };
    }
  }

  // ==========================================
  // DELETE ORDER ITEMS (Para sincronizar)
  // ==========================================
  async deleteOrderItems(orderId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (error) throw error;
    } catch (error) {
      console.error('❌ Error deleting order items:', error);
      throw error;
    }
  }

  // ==========================================
  // INSERT ORDER ITEMS (Para sincronizar)
  // ==========================================
  async insertOrderItems(items: any[]): Promise<void> {
    try {
      if (items.length === 0) return;

      const { error } = await this.supabase
        .from('order_items')
        .insert(items);

      if (error) throw error;
    } catch (error) {
      console.error('❌ Error inserting order items:', error);
      throw error;
    }
  }

  // ==========================================
  // UPDATE ORDER PAYMENT
  // ✅ CORREGIDO: Crea transacción cuando cambia a 'paid'
  // ==========================================
  async updateOrderPayment(
    orderId: string, 
    paymentData: {
      payment_method: string;
      payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded';
      payment_reference?: string;
      payment_amount?: number;
      payment_date?: string;
      payment_notes?: string;
      subtotal?: number;
      tax?: number;
      total?: number;
    }
  ): Promise<void> {
    try {
      // ✅ OBTENER EL PEDIDO ACTUAL PARA COMPARAR
      const currentOrder = await this.getOrderById(orderId);
      if (!currentOrder) {
        throw new Error('Pedido no encontrado');
      }

      const wasPaid = currentOrder.payment_status === 'paid';
      const isNowPaid = paymentData.payment_status === 'paid';

      const updatePayload: any = {
        payment_method: paymentData.payment_method,
        payment_status: paymentData.payment_status,
        updated_at: new Date().toISOString()
      };

      if (paymentData.payment_reference !== undefined) {
        updatePayload.payment_reference = paymentData.payment_reference;
      }
      if (paymentData.payment_amount !== undefined) {
        updatePayload.payment_amount = paymentData.payment_amount;
      }
      if (paymentData.payment_date !== undefined) {
        updatePayload.payment_date = paymentData.payment_date;
      }
      if (paymentData.payment_notes !== undefined) {
        updatePayload.payment_notes = paymentData.payment_notes;
      }
      if (paymentData.subtotal !== undefined) {
        updatePayload.subtotal = paymentData.subtotal;
      }
      if (paymentData.tax !== undefined) {
        updatePayload.tax = paymentData.tax;
      }
      if (paymentData.total !== undefined) {
        updatePayload.total = paymentData.total;
      }

      const { data: updatedOrder, error } = await this.supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      // ✅ NUEVO: Crear transacción si cambió de no pagado a pagado
      if (!wasPaid && isNowPaid && paymentData.payment_amount && paymentData.payment_amount > 0) {
        await this.createIncomeTransaction(updatedOrder);
      }

      const orders = this.ordersSubject.value;
      const index = orders.findIndex(o => o.id === orderId);
      if (index !== -1) {
        orders[index] = { ...orders[index], ...updatedOrder };
        this.ordersSubject.next([...orders]);
      }
    } catch (error) {
      console.error('Error updating order payment:', error);
      throw error;
    }
  }

  // ==========================================
  // ✅ NUEVO MÉTODO: CREAR TRANSACCIÓN DE INGRESO
  // ==========================================
  private async createIncomeTransaction(order: Order): Promise<void> {
    try {
      console.log('💰 Creando transacción de ingreso para pedido:', order.order_number);

      // ✅ VERIFICAR SI YA EXISTE UNA TRANSACCIÓN PARA ESTE PEDIDO
      const { data: existingTransactions } = await this.supabase
        .from('transactions')
        .select('id')
        .eq('business_id', order.business_id)
        .eq('reference_number', order.id)
        .eq('type', 'income')
        .limit(1);

      if (existingTransactions && existingTransactions.length > 0) {
        console.log('⚠️ Ya existe una transacción para este pedido, omitiendo...');
        return;
      }

      // ✅ CREAR LA TRANSACCIÓN
      await this.transactionsService.createTransaction({
        business_id: order.business_id,
        type: 'income',
        category: 'Ventas',
        amount: order.total,
        description: `Pedido #${order.order_number}`,
        payment_method: order.payment_method || 'Efectivo',
        reference_number: order.id,
        notes: `Ingreso por venta de pedido confirmado`,
        transaction_date: order.payment_date || new Date().toISOString()
      });

      console.log('✅ Transacción de ingreso creada exitosamente');
    } catch (error) {
      console.error('❌ Error creando transacción de ingreso:', error);
      // No lanzar error para no romper el flujo principal
    }
  }
}