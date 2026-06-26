// src/app/services/notifications.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SocketService, Notification } from './socket.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private socketService: SocketService) {
    this.socketService.loadNotificationsFromStorage();
    
    this.socketService.notifications$.subscribe(notifications => {
      const unread = notifications.filter(n => !n.read).length;
      this.unreadCountSubject.next(unread);
    });
  }

  getNotifications() {
    return this.socketService.getNotifications();
  }

  getUnreadCount() {
    return this.unreadCountSubject.getValue();
  }

  markAsRead(notificationId: string) {
    this.socketService.markAsRead(notificationId);
  }

  markAllAsRead() {
    this.socketService.markAllAsRead();
  }

  removeNotification(notificationId: string) {
    this.socketService.removeNotification(notificationId);
  }

  clearAll() {
    this.socketService.clearAllNotifications();
  }

  // ✅ ELIMINADO: Método sendTestNotification que usaba emitEvent
}