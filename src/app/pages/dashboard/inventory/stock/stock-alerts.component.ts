// src/app/pages/dashboard/inventory/stock-alerts/stock-alerts.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StockNotificationsService, StockAlert } from '../../../../services/stock-notifications.service';
import { Router } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-stock-alerts',
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Alertas de Stock</h1>
        <p>Productos con stock bajo o sin stock</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card warning">
          <div class="stat-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div class="stat-content">
            <p class="stat-label">Stock Bajo</p>
            <p class="stat-value">{{ lowStockCount }}</p>
          </div>
        </div>

        <div class="stat-card danger">
          <div class="stat-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
            </svg>
          </div>
          <div class="stat-content">
            <p class="stat-label">Sin Stock</p>
            <p class="stat-value">{{ outOfStockCount }}</p>
          </div>
        </div>
      </div>

      <div class="alerts-section">
        <h2>Productos con Stock Bajo</h2>
        <div class="alerts-list" *ngIf="lowStockProducts.length > 0">
          <div *ngFor="let product of lowStockProducts" class="alert-item">
            <div class="alert-info">
              <h3>{{ product.productName }}</h3>
              <p>Stock actual: <strong>{{ product.currentStock }}</strong> / Mínimo: {{ product.minStock }}</p>
            </div>
            <button class="btn-restock" (click)="goToProduct(product.productId)">
              Reabastecer
            </button>
          </div>
        </div>
        <div class="empty-state" *ngIf="lowStockProducts.length === 0">
          <p>No hay productos con stock bajo</p>
        </div>
      </div>

      <div class="alerts-section">
        <h2>Productos Sin Stock</h2>
        <div class="alerts-list" *ngIf="outOfStockProducts.length > 0">
          <div *ngFor="let product of outOfStockProducts" class="alert-item out-of-stock">
            <div class="alert-info">
              <h3>{{ product.productName }}</h3>
              <p>Sin unidades disponibles</p>
            </div>
            <button class="btn-restock" (click)="goToProduct(product.productId)">
              Reabastecer
            </button>
          </div>
        </div>
        <div class="empty-state" *ngIf="outOfStockProducts.length === 0">
          <p>Todos los productos tienen stock</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 2rem;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .page-header h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 0.5rem 0;
    }

    .page-header p {
      color: #64748b;
      margin: 0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.5rem;
      background: white;
      border-radius: 1rem;
      border: 1px solid #e2e8f0;

      &.warning {
        border-left: 4px solid #eab308;
      }

      &.danger {
        border-left: 4px solid #ef4444;
      }
    }

    .stat-icon {
      width: 3rem;
      height: 3rem;
      border-radius: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fef9c3;
      color: #ca8a04;

      svg {
        width: 1.5rem;
        height: 1.5rem;
      }
    }

    .stat-card.danger .stat-icon {
      background: #fee2e2;
      color: #dc2626;
    }

    .stat-content {
      flex: 1;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #64748b;
      margin: 0 0 0.25rem 0;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    .alerts-section {
      margin-bottom: 2rem;

      h2 {
        font-size: 1.25rem;
        font-weight: 600;
        color: #0f172a;
        margin: 0 0 1rem 0;
      }
    }

    .alerts-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .alert-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      transition: all 0.2s;

      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      &.out-of-stock {
        border-left: 4px solid #ef4444;
      }
    }

    .alert-info {
      flex: 1;

      h3 {
        font-size: 1rem;
        font-weight: 600;
        color: #0f172a;
        margin: 0 0 0.25rem 0;
      }

      p {
        font-size: 0.875rem;
        color: #64748b;
        margin: 0;

        strong {
          color: #ef4444;
          font-weight: 700;
        }
      }
    }

    .btn-restock {
      padding: 0.625rem 1.25rem;
      background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%);
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(147, 51, 234, 0.4);
      }
    }

    .empty-state {
      padding: 3rem;
      text-align: center;
      background: #f8fafc;
      border-radius: 0.75rem;
      color: #64748b;
    }
  `]
})
export class StockAlertsComponent implements OnInit {
  lowStockProducts: StockAlert[] = [];
  outOfStockProducts: StockAlert[] = [];
  lowStockCount = 0;
  outOfStockCount = 0;
  businessId: string = '';

  constructor(
    private stockNotificationsService: StockNotificationsService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    const profile = await this.authService.getUserProfile();
    if (profile?.profile?.business_id) {
      this.businessId = profile.profile.business_id;
      await this.loadStockAlerts();
    }
  }

  async loadStockAlerts() {
    this.lowStockProducts = await this.stockNotificationsService.getLowStockProducts(this.businessId);
    this.outOfStockProducts = await this.stockNotificationsService.getOutOfStockProducts(this.businessId);
    
    this.lowStockCount = this.lowStockProducts.length;
    this.outOfStockCount = this.outOfStockProducts.length;
  }

  goToProduct(productId: string) {
    this.router.navigate([`/dashboard/inventory/product/${productId}`]);
  }
}