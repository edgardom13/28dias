// src/app/services/socket.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
  data?: any;
}

export interface SocketEvent<T = any> {
  event: string;
  data: T;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class SocketService implements OnDestroy {
  private connectedSubject = new BehaviorSubject<boolean>(false);
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  
  // ✅ Subjects específicos para eventos de pedidos
  private orderNewSubject = new Subject<any>();
  private orderUpdateSubject = new Subject<any>();
  private orderDeleteSubject = new Subject<string>();
  
  public connected$ = this.connectedSubject.asObservable();
  public notifications$ = this.notificationsSubject.asObservable();
  
  private notifications: Notification[] = [];
  
  private realtimeChannel: RealtimeChannel | null = null;
  private ordersChannel: RealtimeChannel | null = null;
  private creditsChannel: RealtimeChannel | null = null;
  private creditPaymentsChannel: RealtimeChannel | null = null;
  
  private businessId: string | null = null;
  private isInitializing = false;
  private retryCount = 0;
  private readonly MAX_RETRIES = 3;

  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService
  ) {
    this.loadNotificationsFromStorage();
    this.initializeRealtime();
  }

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================
  private async initializeRealtime() {
    if (this.isInitializing) return;
    this.isInitializing = true;
    
    try {
      const userProfile = await this.authService.getUserProfile();
      
      if (userProfile?.profile?.business_id) {
        this.businessId = userProfile.profile.business_id;
        this.subscribeToNotifications();
        this.subscribeToOrders();
        this.subscribeToCredits();
        console.log('✅ Realtime inicializado para negocio:', this.businessId);
      }
    } catch (error) {
      console.error('❌ Error inicializando realtime:', error);
    } finally {
      this.isInitializing = false;
    }
  }

  // ==========================================
  // ✅ MÉTODO LIST - Para escuchar eventos específicos
  // ==========================================
  // ✅ MÉTODO LIST - Para escuchar eventos específicos
  // ==========================================
  public listen<T = any>(event: string): Observable<SocketEvent<T>> {
    switch (event) {
      case 'order:new':
        return new Observable<SocketEvent<T>>(observer => {
          const subscription = this.orderNewSubject.subscribe((data: any) => {
            observer.next({ event, data: data as T, timestamp: new Date() });
          });
          return () => subscription.unsubscribe();
        });
      
      case 'order:update':
        return new Observable<SocketEvent<T>>(observer => {
          const subscription = this.orderUpdateSubject.subscribe((data: any) => {
            observer.next({ event, data: data as T, timestamp: new Date() });
          });
          return () => subscription.unsubscribe();
        });
      
      case 'order:delete':
        return new Observable<SocketEvent<T>>(observer => {
          const subscription = this.orderDeleteSubject.subscribe((data: any) => {
            observer.next({ event, data: data as T, timestamp: new Date() });
          });
          return () => subscription.unsubscribe();
        });
      
      default:
        console.warn(`⚠️ Evento no soportado: ${event}`);
        return new Observable<SocketEvent<T>>(observer => observer.complete());
    }
  }

  // ==========================================
  // ✅ MÉTODO EMIT - Para emitir eventos (solo local en Supabase)
  // ==========================================
  public emit(event: string, data?: any): void {
    console.log(`📤 Emitiendo evento local: ${event}`, data);
    
    switch (event) {
      case 'order:new':
        this.orderNewSubject.next(data);
        break;
      case 'order:update':
        this.orderUpdateSubject.next(data);
        break;
      case 'order:delete':
        this.orderDeleteSubject.next(data);
        break;
      default:
        console.warn(`⚠️ Evento no soportado para emit: ${event}`);
    }
  }

  // ==========================================
  // GENERAR NOMBRE ÚNICO DE CANAL
  // ==========================================
  private getUniqueChannelName(baseName: string): string {
    const timestamp = Date.now();
    const suffix = this.businessId ? this.businessId.substring(0, 8) : 'anon';
    return `${baseName}_${suffix}_${timestamp}`;
  }

  // ==========================================
  // LIMPIAR CANAL DE FORMA SEGURA
  // ==========================================
  private safeRemoveChannel(channel: RealtimeChannel | null): void {
    if (!channel) return;
    
    try {
      const supabase = this.supabaseService.getClient();
      supabase.removeChannel(channel);
    } catch (error) {
      console.warn('⚠️ Error removiendo canal (ignorado):', error);
    }
  }

  // ==========================================
  // SUSCRIPCIÓN A NOTIFICACIONES
  // ==========================================
  private subscribeToNotifications() {
    if (!this.businessId) return;

    const supabase = this.supabaseService.getClient();
    
    if (this.realtimeChannel) {
      this.safeRemoveChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    
    const channelName = this.getUniqueChannelName('notifications');
    
    this.realtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'business_notifications',
          filter: `business_id=eq.${this.businessId}`
        },
        (payload: any) => {
          console.log('🔔 Nueva notificación INSERT:', payload);
          const newNotification = this.mapPayloadToNotification(payload.new);
          this.addNotification(newNotification);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'business_notifications',
          filter: `business_id=eq.${this.businessId}`
        },
        (payload: any) => {
          const updatedNotification = this.mapPayloadToNotification(payload.new);
          this.updateNotification(updatedNotification);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'business_notifications',
          filter: `business_id=eq.${this.businessId}`
        },
        (payload: any) => {
          this.removeNotification(payload.old['id']);
        }
      )
      .subscribe((status: string, err?: any) => {
        console.log('📡 Estado del canal realtime:', status);
        
        if (status === 'SUBSCRIBED') {
          this.connectedSubject.next(true);
          this.retryCount = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.connectedSubject.next(false);
          
          if (this.retryCount < this.MAX_RETRIES) {
            this.retryCount++;
            console.log(`🔄 Reintentando conexión (${this.retryCount}/${this.MAX_RETRIES})...`);
            
            if (this.realtimeChannel) {
              this.safeRemoveChannel(this.realtimeChannel);
              this.realtimeChannel = null;
            }
            
            setTimeout(() => {
              this.subscribeToNotifications();
            }, 3000 * this.retryCount);
          } else {
            console.warn('⚠️ Máximo de reintentos alcanzado.');
          }
        } else if (status === 'CLOSED') {
          this.connectedSubject.next(false);
        }
      });
  }

  // ==========================================
  // ✅ SUSCRIPCIÓN A PEDIDOS - CON EMISIÓN DE EVENTOS
  // ==========================================
  private subscribeToOrders() {
    if (!this.businessId) return;

    const supabase = this.supabaseService.getClient();
    
    if (this.ordersChannel) {
      this.safeRemoveChannel(this.ordersChannel);
      this.ordersChannel = null;
    }
    
    const channelName = this.getUniqueChannelName('orders');
    
    this.ordersChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `business_id=eq.${this.businessId}`
        },
        (payload: any) => {
          console.log('🛒 Nuevo pedido INSERT:', payload);
          
          // ✅ Emitir evento para que el componente lo escuche
          this.orderNewSubject.next(payload.new);
          
          // Crear notificación
          const newNotification: Notification = {
            id: `order-${payload.new.id}-${Date.now()}`,
            type: 'success',
            title: '¡Nuevo Pedido Recibido!',
            message: `Pedido ${payload.new.order_number} por $${payload.new.total}`,
            timestamp: new Date(),
            read: false,
            link: '/dashboard/orders',
            data: {
              orderId: payload.new.id,
              orderNumber: payload.new.order_number,
              total: payload.new.total
            }
          };
          
          this.addNotification(newNotification);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `business_id=eq.${this.businessId}`
        },
        (payload: any) => {
          console.log('🔄 Pedido UPDATE:', payload);
          
          // ✅ Emitir evento para que el componente lo escuche
          this.orderUpdateSubject.next(payload.new);
          
          if (payload.new.status !== payload.old?.status) {
            const statusTexts: { [key: string]: string } = {
              'pending': 'Pendiente',
              'processing': 'En Proceso',
              'completed': 'Completado',
              'cancelled': 'Cancelado'
            };
            
            const newNotification: Notification = {
              id: `order-status-${payload.new.id}-${Date.now()}`,
              type: payload.new.status === 'completed' ? 'success' : 'info',
              title: 'Estado del Pedido Actualizado',
              message: `Pedido ${payload.new.order_number}: ${statusTexts[payload.new.status] || payload.new.status}`,
              timestamp: new Date(),
              read: false,
              link: '/dashboard/orders',
              data: {
                orderId: payload.new.id,
                orderNumber: payload.new.order_number,
                status: payload.new.status
              }
            };
            
            this.addNotification(newNotification);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'orders',
          filter: `business_id=eq.${this.businessId}`
        },
        (payload: any) => {
          console.log('🗑️ Pedido DELETE:', payload);
          
          // ✅ Emitir evento para que el componente lo escuche
          this.orderDeleteSubject.next(payload.old.id);
        }
      )
      .subscribe((status: string) => {
        console.log('📡 Estado del canal de pedidos:', status);
      });
  }

  // ==========================================
  // SUSCRIPCIÓN A CRÉDITOS
  // ==========================================
  private subscribeToCredits() {
    if (!this.businessId) return;

    const supabase = this.supabaseService.getClient();
    
    if (this.creditsChannel) {
      this.safeRemoveChannel(this.creditsChannel);
      this.creditsChannel = null;
    }
    
    if (this.creditPaymentsChannel) {
      this.safeRemoveChannel(this.creditPaymentsChannel);
      this.creditPaymentsChannel = null;
    }
    
    const creditsChannelName = this.getUniqueChannelName('credits');
    const paymentsChannelName = this.getUniqueChannelName('credit_payments');
    
    this.creditsChannel = supabase
      .channel(creditsChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'credits',
          filter: `business_id=eq.${this.businessId}`
        },
        (payload: any) => {
          const newNotification: Notification = {
            id: `credit-${payload.new.id}-${Date.now()}`,
            type: 'warning',
            title: '¡Nuevo Fiado Registrado!',
            message: `${payload.new.customer_name} debe $${payload.new.total_amount}`,
            timestamp: new Date(),
            read: false,
            link: '/dashboard/credit',
            data: {
              creditId: payload.new.id,
              customerName: payload.new.customer_name,
              totalAmount: payload.new.total_amount
            }
          };
          
          this.addNotification(newNotification);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'credits',
          filter: `business_id=eq.${this.businessId}`
        },
        (payload: any) => {
          if (payload.new.status !== payload.old?.status) {
            const statusTexts: { [key: string]: string } = {
              'pending': 'Pendiente',
              'partial': 'Pago Parcial',
              'paid': 'Pagado',
              'cancelled': 'Cancelado'
            };
            
            const newNotification: Notification = {
              id: `credit-status-${payload.new.id}-${Date.now()}`,
              type: payload.new.status === 'paid' ? 'success' : 'info',
              title: 'Estado de Fiado Actualizado',
              message: `${payload.new.customer_name}: ${statusTexts[payload.new.status] || payload.new.status}`,
              timestamp: new Date(),
              read: false,
              link: '/dashboard/credit',
              data: {
                creditId: payload.new.id,
                customerName: payload.new.customer_name,
                status: payload.new.status
              }
            };
            
            this.addNotification(newNotification);
          }
        }
      )
      .subscribe((status: string) => {
        console.log('📡 Estado del canal de créditos:', status);
      });

    this.creditPaymentsChannel = supabase
      .channel(paymentsChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'credit_payments',
          filter: `business_id=eq.${this.businessId}`
        },
        (payload: any) => {
          const newNotification: Notification = {
            id: `payment-${payload.new.id}-${Date.now()}`,
            type: 'success',
            title: '¡Abono Recibido!',
            message: `Se registró un abono de $${payload.new.amount}`,
            timestamp: new Date(),
            read: false,
            link: '/dashboard/credit',
            data: {
              paymentId: payload.new.id,
              amount: payload.new.amount,
              creditId: payload.new.credit_id
            }
          };
          
          this.addNotification(newNotification);
        }
      )
      .subscribe((status: string) => {
        console.log('📡 Estado del canal de pagos:', status);
      });
  }

  // ==========================================
  // EMITIR EVENTOS (COMPATIBILIDAD)
  // ==========================================
  public emitNewOrder(order: any) {
    console.log('📦 Emitiendo nuevo pedido:', order);
    
    // Emitir evento local
    this.orderNewSubject.next(order);
    
    const newNotification: Notification = {
      id: `order-${order.id}-${Date.now()}`,
      type: 'success',
      title: '¡Nuevo Pedido Creado!',
      message: `Pedido ${order.order_number} por $${order.total}`,
      timestamp: new Date(),
      read: false,
      link: '/dashboard/orders',
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        total: order.total
      }
    };
    
    this.addNotification(newNotification);
  }

  public emitNotification(notification: Notification) {
    this.addNotification(notification);
  }

  // ==========================================
  // MAPEO DE PAYLOAD A NOTIFICACIÓN
  // ==========================================
  private mapPayloadToNotification(payload: any): Notification {
    return {
      id: payload.id,
      type: payload.type || 'info',
      title: payload.title || 'Notificación',
      message: payload.message || '',
      timestamp: new Date(payload.created_at || Date.now()),
      read: payload.read || false,
      link: payload.link || '/dashboard',
      data: payload.data
    };
  }

  // ==========================================
  // GESTIÓN DE NOTIFICACIONES
  // ==========================================
  private addNotification(notification: Notification) {
    const exists = this.notifications.find(n => n.id === notification.id);
    if (!exists) {
      this.notifications.unshift(notification);
      if (this.notifications.length > 100) {
        this.notifications = this.notifications.slice(0, 100);
      }
      this.notificationsSubject.next([...this.notifications]);
      this.saveNotificationsToStorage();
    }
  }

  private updateNotification(notification: Notification) {
    const index = this.notifications.findIndex(n => n.id === notification.id);
    if (index !== -1) {
      this.notifications[index] = notification;
      this.notificationsSubject.next([...this.notifications]);
      this.saveNotificationsToStorage();
    }
  }

  public getNotifications(): Notification[] {
    return this.notifications;
  }

  public markAsRead(notificationId: string) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.notificationsSubject.next([...this.notifications]);
      this.saveNotificationsToStorage();
    }
  }

  public markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
    this.notificationsSubject.next([...this.notifications]);
    this.saveNotificationsToStorage();
  }

  public removeNotification(notificationId: string) {
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
    this.notificationsSubject.next([...this.notifications]);
    this.saveNotificationsToStorage();
  }

  public clearAllNotifications() {
    this.notifications = [];
    this.notificationsSubject.next([]);
    this.saveNotificationsToStorage();
  }

  // ==========================================
  // STORAGE
  // ==========================================
  private saveNotificationsToStorage() {
    try {
      localStorage.setItem('notifications', JSON.stringify(this.notifications));
    } catch (error) {
      console.error('Error guardando notificaciones:', error);
    }
  }

  public loadNotificationsFromStorage() {
    const stored = localStorage.getItem('notifications');
    if (stored) {
      try {
        this.notifications = JSON.parse(stored).map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }));
        this.notificationsSubject.next([...this.notifications]);
      } catch (error) {
        console.error('Error cargando notificaciones:', error);
      }
    }
  }

  public async loadNotificationsFromSupabase(businessId: string, limit: number = 50) {
    const supabase = this.supabaseService.getClient();
    
    const { data, error } = await supabase
      .from('business_notifications')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error cargando notificaciones:', error);
      return;
    }

    this.notifications = (data || []).map((n: any) => this.mapPayloadToNotification(n));
    this.notificationsSubject.next([...this.notifications]);
    this.saveNotificationsToStorage();
  }

  // ==========================================
  // CONEXIÓN / DESCONEXIÓN
  // ==========================================
  public disconnect() {
    this.safeRemoveChannel(this.realtimeChannel);
    this.safeRemoveChannel(this.ordersChannel);
    this.safeRemoveChannel(this.creditsChannel);
    this.safeRemoveChannel(this.creditPaymentsChannel);
    
    this.realtimeChannel = null;
    this.ordersChannel = null;
    this.creditsChannel = null;
    this.creditPaymentsChannel = null;
    
    this.connectedSubject.next(false);
    this.retryCount = 0;
  }

  public connect() {
    if (this.businessId) {
      this.retryCount = 0;
      if (!this.realtimeChannel) {
        this.subscribeToNotifications();
      }
      if (!this.ordersChannel) {
        this.subscribeToOrders();
      }
      if (!this.creditsChannel) {
        this.subscribeToCredits();
      }
    }
  }

  ngOnDestroy() {
    this.disconnect();
    this.orderNewSubject.complete();
    this.orderUpdateSubject.complete();
    this.orderDeleteSubject.complete();
  }
}