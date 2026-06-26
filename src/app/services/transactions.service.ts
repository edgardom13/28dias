import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { SocketService } from './socket.service';

export interface Transaction {
  id: string;
  business_id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  transaction_date: string;
  created_at?: string;
  updated_at?: string;
}

export interface TransactionStats {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  monthIncome: number;
  monthExpenses: number;
  monthBalance: number;
  weekIncome: number;
  weekExpenses: number;
  weekBalance: number;
  todayIncome: number;
  todayExpenses: number;
  todayBalance: number;
}

export interface TransactionsByCategory {
  category: string;
  amount: number;
  count: number;
}

@Injectable({
  providedIn: 'root'
})
export class TransactionsService {
  private transactionsSubject = new BehaviorSubject<Transaction[]>([]);
  transactions$ = this.transactionsSubject.asObservable();

  constructor(
    private supabase: SupabaseService,
    private socketService: SocketService
  ) {}

  // ==========================================
  // GET TRANSACTIONS
  // ==========================================
  async getTransactions(
    businessId: string,
    type?: string,
    startDate?: string,
    endDate?: string
  ): Promise<Transaction[]> {
    try {
      let query = this.supabase
        .from('transactions')
        .select('*')
        .eq('business_id', businessId)
        .order('transaction_date', { ascending: false });

      if (type && type !== 'all') {
        query = query.eq('type', type);
      }

      if (startDate) {
        query = query.gte('transaction_date', startDate);
      }

      if (endDate) {
        query = query.lte('transaction_date', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      this.transactionsSubject.next(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  // ==========================================
  // CREATE TRANSACTION
  // ==========================================
  async createTransaction(transactionData: Partial<Transaction>): Promise<Transaction> {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .insert({
          business_id: transactionData.business_id,
          type: transactionData.type,
          category: transactionData.category,
          amount: transactionData.amount,
          description: transactionData.description,
          payment_method: transactionData.payment_method || 'cash',
          reference_number: transactionData.reference_number || null,
          notes: transactionData.notes || null,
          transaction_date: transactionData.transaction_date || new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Emitir notificación
      this.emitTransactionNotification(data);

      // Actualizar lista local
      const currentTransactions = this.transactionsSubject.value;
      this.transactionsSubject.next([data, ...currentTransactions]);

      return data;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  // ==========================================
  // UPDATE TRANSACTION
  // ==========================================
  async updateTransaction(transactionId: string, transactionData: Partial<Transaction>): Promise<Transaction> {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .update({
          type: transactionData.type,
          category: transactionData.category,
          amount: transactionData.amount,
          description: transactionData.description,
          payment_method: transactionData.payment_method,
          reference_number: transactionData.reference_number || null,
          notes: transactionData.notes || null,
          transaction_date: transactionData.transaction_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId)
        .select()
        .single();

      if (error) throw error;

      // Actualizar lista local
      const currentTransactions = this.transactionsSubject.value;
      const index = currentTransactions.findIndex(t => t.id === transactionId);
      if (index !== -1) {
        currentTransactions[index] = data;
        this.transactionsSubject.next([...currentTransactions]);
      }

      return data;
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  }

  // ==========================================
  // DELETE TRANSACTION
  // ==========================================
  async deleteTransaction(transactionId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId);

      if (error) throw error;

      // Actualizar lista local
      const currentTransactions = this.transactionsSubject.value;
      this.transactionsSubject.next(currentTransactions.filter(t => t.id !== transactionId));
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  }

  // ==========================================
  // GET TRANSACTION STATISTICS
  // ==========================================
  async getTransactionStats(businessId: string): Promise<TransactionStats> {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('type, amount, transaction_date')
        .eq('business_id', businessId);

      if (error) throw error;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

      const stats: TransactionStats = {
        totalIncome: data?.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
        totalExpenses: data?.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
        balance: 0,
        monthIncome: data?.filter(t => t.type === 'income' && new Date(t.transaction_date) >= monthAgo).reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
        monthExpenses: data?.filter(t => t.type === 'expense' && new Date(t.transaction_date) >= monthAgo).reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
        monthBalance: 0,
        weekIncome: data?.filter(t => t.type === 'income' && new Date(t.transaction_date) >= weekAgo).reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
        weekExpenses: data?.filter(t => t.type === 'expense' && new Date(t.transaction_date) >= weekAgo).reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
        weekBalance: 0,
        todayIncome: data?.filter(t => t.type === 'income' && new Date(t.transaction_date) >= today).reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
        todayExpenses: data?.filter(t => t.type === 'expense' && new Date(t.transaction_date) >= today).reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
        todayBalance: 0
      };

      stats.balance = stats.totalIncome - stats.totalExpenses;
      stats.monthBalance = stats.monthIncome - stats.monthExpenses;
      stats.weekBalance = stats.weekIncome - stats.weekExpenses;
      stats.todayBalance = stats.todayIncome - stats.todayExpenses;

      return stats;
    } catch (error) {
      console.error('Error fetching transaction stats:', error);
      return {
        totalIncome: 0,
        totalExpenses: 0,
        balance: 0,
        monthIncome: 0,
        monthExpenses: 0,
        monthBalance: 0,
        weekIncome: 0,
        weekExpenses: 0,
        weekBalance: 0,
        todayIncome: 0,
        todayExpenses: 0,
        todayBalance: 0
      };
    }
  }

  // ==========================================
  // GET TRANSACTIONS BY CATEGORY
  // ==========================================
  async getTransactionsByCategory(
    businessId: string,
    type: 'income' | 'expense'
  ): Promise<TransactionsByCategory[]> {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('category, amount')
        .eq('business_id', businessId)
        .eq('type', type);

      if (error) throw error;

      const categoryMap: { [key: string]: TransactionsByCategory } = {};

      data?.forEach(t => {
        const category = t.category;
        if (!categoryMap[category]) {
          categoryMap[category] = { category, amount: 0, count: 0 };
        }
        categoryMap[category].amount += t.amount || 0;
        categoryMap[category].count += 1;
      });

      return Object.values(categoryMap).sort((a, b) => b.amount - a.amount);
    } catch (error) {
      console.error('Error fetching transactions by category:', error);
      return [];
    }
  }

  // ==========================================
  // EMIT NOTIFICATION
  // ==========================================
  private emitTransactionNotification(transaction: Transaction) {
    const isIncome = transaction.type === 'income';
    const notification = {
      id: `transaction-${transaction.id}-${Date.now()}`,
      type: isIncome ? 'success' as const : 'warning' as const,
      title: isIncome ? '💰 Nuevo Ingreso Registrado' : '💸 Nuevo Egreso Registrado',
      message: `${transaction.description}: ${this.formatCurrency(transaction.amount)}`,
      timestamp: new Date(),
      read: false,
      link: transaction.type === 'income' ? '/dashboard/income' : '/dashboard/expenses',
      data: {
        transactionId: transaction.id,
        type: transaction.type,
        amount: transaction.amount
      }
    };

    this.socketService.emitNotification(notification);
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  }
}