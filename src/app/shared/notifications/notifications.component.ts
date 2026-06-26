// src/app/shared/notifications/notifications.component.ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationsService } from '../../services/notifications.service';
import { SocketService, Notification } from '../../services/socket.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notifications-wrapper" [class.open]="isOpen">
      <button class="notification-btn" (click)="toggleNotifications()">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        <span class="notification-badge" *ngIf="unreadCount > 0">{{ unreadCount }}</span>
      </button>

      <div class="notifications-dropdown" *ngIf="isOpen">
        <div class="notifications-header">
          <h3>Notificaciones</h3>
          <div class="notifications-actions">
            <button class="mark-read-btn" (click)="markAllAsRead()" *ngIf="unreadCount > 0">
              Marcar todo como leído
            </button>
            <span class="unread-count" *ngIf="unreadCount > 0">{{ unreadCount }} nuevas</span>
          </div>
        </div>

        <div class="notifications-list">
          <div *ngIf="notifications.length === 0" class="no-notifications">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
            </svg>
            <p>No tienes notificaciones</p>
          </div>

          <div *ngFor="let notification of notifications" 
               class="notification-item" 
               [class.unread]="!notification.read"
               [class.type-info]="notification.type === 'info'"
               [class.type-success]="notification.type === 'success'"
               [class.type-warning]="notification.type === 'warning'"
               [class.type-error]="notification.type === 'error'"
               (click)="handleNotificationClick(notification)">
            
            <div class="notification-icon">
              <svg *ngIf="notification.type === 'success'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <svg *ngIf="notification.type === 'error'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              <svg *ngIf="notification.type === 'warning'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <svg *ngIf="notification.type === 'info'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>

            <div class="notification-content">
              <p class="notification-title">{{ notification.title }}</p>
              <p class="notification-message">{{ notification.message }}</p>
              <span class="notification-time">{{ getTimeAgo(notification.timestamp) }}</span>
            </div>

            <button class="notification-mark-read" 
                    (click)="markAsRead(notification.id, $event)" 
                    *ngIf="!notification.read">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="notifications-footer" *ngIf="notifications.length > 0">
          <button class="clear-all-btn" (click)="clearAll()">
            Limpiar todas
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .notifications-wrapper {
      position: relative;
    }

    .notification-btn {
      position: relative;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      svg {
        width: 20px;
        height: 20px;
        color: #64748b;
      }

      &:hover {
        background-color: #f1f5f9;
      }

      .dark & {
        border-color: #334155;
        
        svg {
          color: #94a3b8;
        }

        &:hover {
          background-color: #1e293b;
        }
      }
    }

    .notification-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9px;
      background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%);
      color: white;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(147, 51, 234, 0.3);
    }

    .notifications-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 380px;
      max-width: 90vw;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
      border: 1px solid #e2e8f0;
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-10px);
      transition: all 0.2s;

      .dark & {
        background: #1e293b;
        border-color: #334155;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
      }

      @media (max-width: 640px) {
        position: fixed;
        top: 80px;
        right: 8px;
        left: 8px;
        width: auto;
        max-width: none;
      }
    }

    .notifications-wrapper.open .notifications-dropdown {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }

    .notifications-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .dark & {
        border-bottom-color: #334155;
      }

      h3 {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
        margin: 0;

        .dark & {
          color: white;
        }
      }
    }

    .notifications-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .mark-read-btn {
      font-size: 12px;
      font-weight: 600;
      color: #9333ea;
      background: transparent;
      border: none;
      cursor: pointer;
      transition: color 0.2s;

      &:hover {
        color: #7e22ce;
      }

      .dark & {
        color: #c084fc;

        &:hover {
          color: #a855f7;
        }
      }
    }

    .unread-count {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;

      .dark & {
        color: #94a3b8;
      }
    }

    .notifications-list {
      max-height: 400px;
      overflow-y: auto;
      padding: 8px;

      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
      }

      &::-webkit-scrollbar-thumb {
        background-color: #cbd5e1;
        border-radius: 9999px;

        .dark & {
          background-color: #475569;
        }
      }
    }

    .notification-item {
      display: flex;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;

      &:hover {
        background-color: #f8fafc;
      }

      .dark & {
        &:hover {
          background-color: #334155;
        }
      }

      &.unread {
        background-color: rgba(147, 51, 234, 0.05);

        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 70%;
          background: linear-gradient(180deg, #9333ea 0%, #7c3aed 100%);
          border-radius: 0 3px 3px 0;
        }

        .dark & {
          background-color: rgba(147, 51, 234, 0.1);
        }
      }

      &.type-info .notification-icon {
        background-color: #dbeafe;
        color: #2563eb;

        .dark & {
          background-color: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }
      }

      &.type-success .notification-icon {
        background-color: #dcfce7;
        color: #16a34a;

        .dark & {
          background-color: rgba(34, 197, 94, 0.2);
          color: #4ade80;
        }
      }

      &.type-warning .notification-icon {
        background-color: #fef9c3;
        color: #ca8a04;

        .dark & {
          background-color: rgba(234, 179, 8, 0.2);
          color: #facc15;
        }
      }

      &.type-error .notification-icon {
        background-color: #fee2e2;
        color: #dc2626;

        .dark & {
          background-color: rgba(239, 68, 68, 0.2);
          color: #f87171;
        }
      }
    }

    .notification-icon {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #f1f5f9;
      color: #64748b;

      .dark & {
        background-color: #334155;
        color: #94a3b8;
      }

      svg {
        width: 20px;
        height: 20px;
      }
    }

    .notification-content {
      flex: 1;
      min-width: 0;
    }

    .notification-title {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 4px 0;
      line-height: 1.4;

      .dark & {
        color: white;
      }
    }

    .notification-message {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 6px 0;
      line-height: 1.4;

      .dark & {
        color: #94a3b8;
      }
    }

    .notification-time {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 500;

      .dark & {
        color: #64748b;
      }
    }

    .notification-mark-read {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: none;
      background-color: transparent;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      &:hover {
        background-color: #f1f5f9;
        color: #9333ea;
      }

      .dark & {
        &:hover {
          background-color: #334155;
          color: #c084fc;
        }
      }

      svg {
        width: 16px;
        height: 16px;
      }
    }

    .no-notifications {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;

      svg {
        width: 48px;
        height: 48px;
        color: #cbd5e1;
        margin-bottom: 12px;

        .dark & {
          color: #475569;
        }
      }

      p {
        font-size: 14px;
        color: #64748b;
        margin: 0;

        .dark & {
          color: #94a3b8;
        }
      }
    }

    .notifications-footer {
      padding: 12px 20px;
      border-top: 1px solid #e2e8f0;

      .dark & {
        border-top-color: #334155;
      }
    }

    .clear-all-btn {
      width: 100%;
      padding: 10px;
      font-size: 13px;
      font-weight: 600;
      color: #dc2626;
      background-color: #fef2f2;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background-color: #fee2e2;
      }

      .dark & {
        background-color: rgba(239, 68, 68, 0.1);
        color: #f87171;

        &:hover {
          background-color: rgba(239, 68, 68, 0.2);
        }
      }
    }
  `]
})
export class NotificationsComponent implements OnInit, OnDestroy {
  isOpen = false;
  notifications: Notification[] = [];
  unreadCount = 0;
  private notificationsSubscription?: Subscription;
  private unreadSubscription?: Subscription;

  constructor(
    private notificationsService: NotificationsService,
    private socketService: SocketService,
    private router: Router
  ) {}

  ngOnInit() {
    // Cargar notificaciones iniciales
    this.notifications = this.notificationsService.getNotifications();
    
    // Suscribirse a cambios en las notificaciones del socket
    this.notificationsSubscription = this.socketService.notifications$.subscribe(
      (notifications: Notification[]) => {
        this.notifications = notifications;
      }
    );

    // Suscribirse al contador de no leídas
    this.unreadSubscription = this.notificationsService.unreadCount$.subscribe(
      (count: number) => {
        this.unreadCount = count;
      }
    );
  }

  toggleNotifications() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.notifications = this.notificationsService.getNotifications();
    }
  }

  closeNotifications() {
    this.isOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    const notificationsWrapper = target.closest('.notifications-wrapper');
    
    if (this.isOpen && notificationsWrapper === null) {
      this.closeNotifications();
    }
  }

  handleNotificationClick(notification: Notification) {
    if (!notification.read) {
      this.notificationsService.markAsRead(notification.id);
    }
    
    if (notification.link) {
      this.router.navigate([notification.link]);
      this.closeNotifications();
    }
  }

  markAsRead(notificationId: string, event: Event) {
    event.stopPropagation();
    this.notificationsService.markAsRead(notificationId);
  }

  markAllAsRead() {
    this.notificationsService.markAllAsRead();
  }

  clearAll() {
    this.notificationsService.clearAll();
  }

  getTimeAgo(date: Date | string): string {
    const now = new Date();
    const timestamp = new Date(date);
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `Hace ${days} día${days > 1 ? 's' : ''}`;
    if (hours > 0) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    return 'Justo ahora';
  }

  ngOnDestroy() {
    this.notificationsSubscription?.unsubscribe();
    this.unreadSubscription?.unsubscribe();
  }
}