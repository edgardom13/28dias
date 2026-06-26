import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { SocketService, Notification } from './socket.service';

export interface Credit {
  id: string;
  business_id: string;
  customer_id?: string;
  order_id?: string;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: 'pending' | 'partial' | 'paid' | 'cancelled';
  due_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  payments?: CreditPayment[];
}

export interface CreditPayment {
  id: string;
  credit_id: string;
  business_id: string;
  amount: number;
  payment_method: string;
  notes?: string;
  created_at?: string;
}

export interface CreditStats {
  totalCredits: number;
  totalAmount: number;
  pendingAmount: number;
  paidAmount: number;
  overdueAmount: number;
  overdueCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class CreditsService {
  private creditsSubject = new BehaviorSubject<Credit[]>([]);
  credits$ = this.creditsSubject.asObservable();

  constructor(
    private supabase: SupabaseService,
    private socketService: SocketService
  ) {}

  // ==========================================
  // GET CREDITS
  // ==========================================
  async getCredits(businessId: string, status?: string): Promise<Credit[]> {
    try {
      let query = this.supabase
        .from('credits')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      this.creditsSubject.next(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching credits:', error);
      throw error;
    }
  }

  // ==========================================
  // CREATE CREDIT
  // ==========================================
  async createCredit(creditData: Partial<Credit>): Promise<Credit> {
    try {
      const { data, error } = await this.supabase
        .from('credits')
        .insert({
          business_id: creditData.business_id,
          customer_id: creditData.customer_id || null,
          order_id: creditData.order_id || null,
          customer_name: creditData.customer_name,
          total_amount: creditData.total_amount || 0,
          paid_amount: 0,
          remaining_amount: creditData.total_amount || 0,
          status: 'pending',
          due_date: creditData.due_date || null,
          notes: creditData.notes || null
        })
        .select()
        .single();

      if (error) throw error;

      // Emitir notificación en tiempo real
      this.emitCreditNotification(data, 'created');

      // ✅ NUEVO: Crear notificación persistente en BD
      await this.createCreditNotification(
        creditData.business_id!,
        'info',
        '💳 Nuevo Fiado Registrado',
        `Se registró un fiado de $${data.total_amount} para ${data.customer_name}`,
        '/dashboard/credit'
      );

      // Actualizar lista local
      const currentCredits = this.creditsSubject.value;
      this.creditsSubject.next([data, ...currentCredits]);

      return data;
    } catch (error) {
      console.error('Error creating credit:', error);
      throw error;
    }
  }

  // ==========================================
  // ADD PAYMENT
  // ==========================================
  async addPayment(paymentData: Partial<CreditPayment>): Promise<CreditPayment> {
    try {
      const { data, error } = await this.supabase
        .from('credit_payments')
        .insert({
          credit_id: paymentData.credit_id,
          business_id: paymentData.business_id,
          amount: paymentData.amount,
          payment_method: paymentData.payment_method || 'cash',
          notes: paymentData.notes || null
        })
        .select()
        .single();

      if (error) throw error;

      // Emitir notificación de abono en tiempo real
      this.emitPaymentNotification(data);

      // Recargar créditos para actualizar montos
      const credit = await this.getCreditById(paymentData.credit_id!);
      if (credit) {
        // ✅ NUEVO: Crear notificación persistente de abono
        await this.createCreditNotification(
          paymentData.business_id!,
          'success',
          '💰 Abono Recibido',
          `${credit.customer_name} abonó $${data.amount}`,
          '/dashboard/credit'
        );

        // ✅ NUEVO: Si el fiado se completó, notificar
        if (credit.remaining_amount === 0 && credit.status === 'paid') {
          await this.createCreditNotification(
            paymentData.business_id!,
            'success',
            '✅ Fiado Completado',
            `El fiado de ${credit.customer_name} por $${credit.total_amount} ha sido liquidado`,
            '/dashboard/credit'
          );
        }

        const currentCredits = this.creditsSubject.value;
        const index = currentCredits.findIndex(c => c.id === paymentData.credit_id);
        if (index !== -1) {
          currentCredits[index] = credit;
          this.creditsSubject.next([...currentCredits]);
        }
      }

      return data;
    } catch (error) {
      console.error('Error adding payment:', error);
      throw error;
    }
  }

  // ==========================================
  // GET CREDIT BY ID
  // ==========================================
  async getCreditById(creditId: string): Promise<Credit | null> {
    try {
      const { data, error } = await this.supabase
        .from('credits')
        .select('*')
        .eq('id', creditId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching credit:', error);
      return null;
    }
  }

  // ==========================================
  // GET PAYMENTS BY CREDIT
  // ==========================================
  async getPaymentsByCredit(creditId: string): Promise<CreditPayment[]> {
    try {
      const { data, error } = await this.supabase
        .from('credit_payments')
        .select('*')
        .eq('credit_id', creditId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching payments:', error);
      return [];
    }
  }

  // ==========================================
  // UPDATE CREDIT STATUS
  // ==========================================
  async updateCreditStatus(creditId: string, status: Credit['status']): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('credits')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', creditId);

      if (error) throw error;

      // Obtener crédito actualizado para notificación
      const credit = await this.getCreditById(creditId);
      if (credit && status === 'cancelled') {
        await this.createCreditNotification(
          credit.business_id,
          'warning',
          '❌ Fiado Cancelado',
          `Se canceló el fiado de ${credit.customer_name} por $${credit.total_amount}`,
          '/dashboard/credit'
        );
      }

      // Actualizar lista local
      const credits = this.creditsSubject.value;
      const index = credits.findIndex(c => c.id === creditId);
      if (index !== -1) {
        credits[index].status = status;
        this.creditsSubject.next([...credits]);
      }
    } catch (error) {
      console.error('Error updating credit status:', error);
      throw error;
    }
  }

  // ==========================================
  // DELETE CREDIT
  // ==========================================
  async deleteCredit(creditId: string): Promise<void> {
    try {
      // Obtener crédito antes de eliminar para notificación
      const credit = await this.getCreditById(creditId);

      // Eliminar pagos primero
      const { error: paymentsError } = await this.supabase
        .from('credit_payments')
        .delete()
        .eq('credit_id', creditId);

      if (paymentsError) throw paymentsError;

      // Eliminar crédito
      const { error } = await this.supabase
        .from('credits')
        .delete()
        .eq('id', creditId);

      if (error) throw error;

      // ✅ NUEVO: Notificación de eliminación
      if (credit) {
        await this.createCreditNotification(
          credit.business_id,
          'error',
          '🗑️ Fiado Eliminado',
          `Se eliminó el fiado de ${credit.customer_name}`,
          '/dashboard/credit'
        );
      }

      // Actualizar lista local
      const credits = this.creditsSubject.value;
      this.creditsSubject.next(credits.filter(c => c.id !== creditId));
    } catch (error) {
      console.error('Error deleting credit:', error);
      throw error;
    }
  }

  // ==========================================
  // GET CREDIT STATISTICS
  // ==========================================
  async getCreditStats(businessId: string): Promise<CreditStats> {
    try {
      const { data, error } = await this.supabase
        .from('credits')
        .select('total_amount, paid_amount, remaining_amount, status, due_date')
        .eq('business_id', businessId)
        .neq('status', 'cancelled');

      if (error) throw error;

      const now = new Date();
      const stats: CreditStats = {
        totalCredits: data?.length || 0,
        totalAmount: data?.reduce((sum, c) => sum + (c.total_amount || 0), 0) || 0,
        pendingAmount: data?.reduce((sum, c) => sum + (c.remaining_amount || 0), 0) || 0,
        paidAmount: data?.reduce((sum, c) => sum + (c.paid_amount || 0), 0) || 0,
        overdueAmount: data
          ?.filter(c => c.status !== 'paid' && c.due_date && new Date(c.due_date) < now)
          .reduce((sum, c) => sum + (c.remaining_amount || 0), 0) || 0,
        overdueCount: data
          ?.filter(c => c.status !== 'paid' && c.due_date && new Date(c.due_date) < now)
          .length || 0
      };

      return stats;
    } catch (error) {
      console.error('Error fetching credit stats:', error);
      return {
        totalCredits: 0,
        totalAmount: 0,
        pendingAmount: 0,
        paidAmount: 0,
        overdueAmount: 0,
        overdueCount: 0
      };
    }
  }

  // ==========================================
  // ✅ NUEVO: VERIFICAR Y NOTIFICAR FIADOS VENCIDOS
  // ==========================================
  async checkAndNotifyOverdueCredits(businessId: string): Promise<{
    overdueCount: number;
    overdueAmount: number;
    soonOverdueCount: number;
  }> {
    try {
      const credits = await this.getCredits(businessId);
      const now = new Date();
      
      // Fiados vencidos
      const overdueCredits = credits.filter(credit => {
        if (!credit.due_date) return false;
        if (credit.status === 'paid' || credit.status === 'cancelled') return false;
        const dueDate = new Date(credit.due_date);
        return dueDate < now && credit.remaining_amount > 0;
      });

      const overdueAmount = overdueCredits.reduce((sum, c) => sum + c.remaining_amount, 0);

      // Notificación de fiados vencidos
      if (overdueCredits.length > 0) {
        await this.createCreditNotification(
          businessId,
          'warning',
          `⚠️ ${overdueCredits.length} Fiado${overdueCredits.length > 1 ? 's' : ''} Vencido${overdueCredits.length > 1 ? 's' : ''}`,
          `Tienes $${overdueAmount.toFixed(2)} por cobrar en fiados vencidos`,
          '/dashboard/credit'
        );

        console.log(`✅ Notificación creada: ${overdueCredits.length} fiados vencidos`);
      }

      // Fiados próximos a vencer (3 días)
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      const soonOverdueCredits = credits.filter(credit => {
        if (!credit.due_date) return false;
        if (credit.status === 'paid' || credit.status === 'cancelled') return false;
        const dueDate = new Date(credit.due_date);
        return dueDate > now && dueDate <= threeDaysFromNow && credit.remaining_amount > 0;
      });

      if (soonOverdueCredits.length > 0) {
        await this.createCreditNotification(
          businessId,
          'info',
          `📅 ${soonOverdueCredits.length} Fiado${soonOverdueCredits.length > 1 ? 's' : ''} Próximo${soonOverdueCredits.length > 1 ? 's' : ''} a Vencer`,
          `${soonOverdueCredits.length} fiado${soonOverdueCredits.length > 1 ? 's' : ''} vencerá${soonOverdueCredits.length > 1 ? 'n' : ''} en los próximos 3 días`,
          '/dashboard/credit'
        );

        console.log(`✅ Notificación creada: ${soonOverdueCredits.length} fiados próximos a vencer`);
      }

      return {
        overdueCount: overdueCredits.length,
        overdueAmount: overdueAmount,
        soonOverdueCount: soonOverdueCredits.length
      };

    } catch (error) {
      console.error('Error verificando fiados vencidos:', error);
      return { overdueCount: 0, overdueAmount: 0, soonOverdueCount: 0 };
    }
  }

  // ==========================================
  // ✅ NUEVO: CREAR NOTIFICACIÓN PERSISTENTE
  // ==========================================
  private async createCreditNotification(
    businessId: string,
    type: 'info' | 'success' | 'warning' | 'error',
    title: string,
    message: string,
    link: string
  ): Promise<void> {
    try {
      // Verificar si ya existe una notificación similar reciente (últimas 24 horas)
      const { data: existing } = await this.supabase
        .from('business_notifications')
        .select('id')
        .eq('business_id', businessId)
        .eq('type', type)
        .ilike('message', `%${message}%`)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();

      if (existing) {
        console.log(`⏭️ Notificación ya existe: ${title}`);
        return;
      }

      // Insertar notificación
      const { error } = await this.supabase
        .from('business_notifications')
        .insert({
          business_id: businessId,
          type: type,
          title: title,
          message: message,
          link: link,
          read: false
        });

      if (error) {
        console.error('Error creando notificación:', error);
      } else {
        console.log(`✅ Notificación creada: ${title}`);
      }

    } catch (error) {
      console.error('Error en createCreditNotification:', error);
    }
  }

  // ==========================================
  // EMIT NOTIFICATIONS EN TIEMPO REAL
  // ==========================================
  private emitCreditNotification(credit: Credit, action: 'created' | 'updated') {
    const notification: Notification = {
      id: `credit-${credit.id}-${Date.now()}`,
      type: 'warning',
      title: action === 'created' ? '💳 Nuevo Fiado Registrado' : '💳 Fiado Actualizado',
      message: `${credit.customer_name} debe $${credit.remaining_amount}`,
      timestamp: new Date(),
      read: false,
      link: '/dashboard/credit',
      data: {
        creditId: credit.id,
        customerName: credit.customer_name,
        totalAmount: credit.total_amount,
        remainingAmount: credit.remaining_amount
      }
    };

    this.socketService.emitNotification(notification);
  }

  private emitPaymentNotification(payment: CreditPayment) {
    const notification: Notification = {
      id: `payment-${payment.id}-${Date.now()}`,
      type: 'success',
      title: '💰 Abono Recibido',
      message: `Se registró un abono de $${payment.amount}`,
      timestamp: new Date(),
      read: false,
      link: '/dashboard/credit',
      data: {
        paymentId: payment.id,
        amount: payment.amount,
        creditId: payment.credit_id
      }
    };

    this.socketService.emitNotification(notification);
  }
}