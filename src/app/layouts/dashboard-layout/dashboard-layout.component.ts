import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { SocketService, Notification as SocketNotification } from '../../services/socket.service';
import { NotificationsService } from '../../services/notifications.service';
import { StockNotificationsService } from '../../services/stock-notifications.service';
import { Subscription, filter } from 'rxjs';
import { BusinessConfigService } from '../../services/business-config.service';

// Interfaz para notificaciones (mantener compatibilidad)
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  time: string;
  read: boolean;
  link?: string;
  timestamp?: Date;
}

@Component({
  selector: 'app-dashboard-layout',
  templateUrl: './dashboard-layout.component.html',
  styleUrls: ['./dashboard-layout.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, IonContent]
})
export class DashboardLayoutComponent implements OnInit, OnDestroy {
  sidebarOpen = false;
  darkMode = false;
  currentUser: any = null;
  userProfile: any = null;
  businessName: string = '';
  planType: 'free' | 'premium' = 'free';
  daysRemaining: number = 0;
  isPlanActive: boolean = true;
  activeMenu: string = '/dashboard';
  isAuthReady: boolean = false;
  profileDropdownOpen: boolean = false;
  showSplash: boolean = false; // ✅ Por defecto false

  // Contadores para el sidebar
  pendingOrders: number = 0;
  creditPending: number = 0;
  lowStock: number = 0;

  // Notificaciones
  notificationsOpen = false;
  unreadNotifications = 0;
  notifications: Notification[] = [];
  isSocketConnected: boolean = false;

  businessType: string = 'tienda';
  businessConfig: any = null;

  // Clave para localStorage
  private readonly SPLASH_SHOWN_KEY = 'dashboardSplashShown';

  getPageTitle(): string {
    const routeMap: { [key: string]: string } = {
      '/dashboard': 'Inicio',
      '/dashboard/website': 'Mi Sitio Web',
      '/dashboard/pos': 'Nueva Venta',
      '/dashboard/orders': 'Pedidos',
      '/dashboard/credit': 'Fiado',
      '/dashboard/sales-history': 'Historial',
      '/dashboard/products': 'Productos',
      '/dashboard/categories': 'Categorías',
      '/dashboard/catalog': 'Catálogo',
      '/dashboard/inventory': 'Inventario',
      '/dashboard/income': 'Ingresos',
      '/dashboard/expenses': 'Egresos',
      '/dashboard/reports': 'Reportes',
      '/dashboard/customers': 'Clientes',
      '/dashboard/settings': 'Configuración'
    };
    
    return routeMap[this.activeMenu] || 'Dashboard';
  }

  private userSubscription?: Subscription;
  private authReadySubscription?: Subscription;
  private routerSubscription?: Subscription;
  private notificationsSubscription?: Subscription;
  private unreadCountSubscription?: Subscription;
  private socketConnectionSubscription?: Subscription;

  private readonly menuRoutes = [
    '/dashboard/website',
    '/dashboard/pos',
    '/dashboard/orders',
    '/dashboard/credit',
    '/dashboard/sales-history',
    '/dashboard/products',
    '/dashboard/categories',
    '/dashboard/catalog',
    '/dashboard/inventory',
    '/dashboard/income',
    '/dashboard/expenses',
    '/dashboard/reports',
    '/dashboard/billing',
    '/dashboard/customers',
    '/dashboard/marketing',
    '/dashboard/loyalty',
    '/dashboard/business',
    '/dashboard/employees',
    '/dashboard/settings',
    '/dashboard'
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
    private socketService: SocketService,
    private notificationsService: NotificationsService,
    private stockNotificationsService: StockNotificationsService,
    private businessConfigService: BusinessConfigService 
  ) {}

  ngOnInit() {
    this.checkDarkMode();
    this.setActiveMenu(this.router.url);
    this.sidebarOpen = false;
    
    // ✅ Verificar si ya se mostró el splash en esta sesión
    const splashShown = localStorage.getItem(this.SPLASH_SHOWN_KEY);
    
    // Solo mostrar splash si NO se ha mostrado antes en esta sesión
    if (!splashShown) {
      this.showSplash = true;
    }
    
    // Esperar a que la autenticación esté lista
    this.authReadySubscription = this.authService.authReady$.subscribe(ready => {
      if (ready) {
        this.isAuthReady = true;
        this.loadUserData();

        // ✅ Ocultar splash después de cargar datos (si está visible)
        if (this.showSplash) {
          setTimeout(() => {
            this.showSplash = false;
            // ✅ Marcar como mostrado en localStorage
            localStorage.setItem(this.SPLASH_SHOWN_KEY, 'true');
          }, 2000);
        }
      }
    });

    // Suscribirse a cambios de ruta
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.setActiveMenu(event.urlAfterRedirects || event.url);
      });

    // Suscribirse a notificaciones en tiempo real (socket)
    this.notificationsSubscription = this.socketService.notifications$.subscribe(
      (socketNotifications: SocketNotification[]) => {
        this.loadNotificationsFromSupabase();
      }
    );

    // Suscribirse al contador de no leídas
    this.unreadCountSubscription = this.notificationsService.unreadCount$.subscribe(
      count => {
        this.unreadNotifications = count;
      }
    );

    // Suscribirse al estado de conexión del socket
    this.socketConnectionSubscription = this.socketService.connected$.subscribe(
      connected => {
        this.isSocketConnected = connected;
        if (connected) {
          console.log('✅ Socket conectado - Notificaciones en tiempo real activas');
        }
      }
    );
  }

  async loadUserData() {
    this.userSubscription = this.authService.currentUser$.subscribe(async user => {
      if (user) {
        this.currentUser = user;

        const result = await this.authService.getUserProfile();
        const profile = result?.profile;

        if (profile) {
          this.userProfile = profile;
          this.businessName = profile.business_name || 'Mi Negocio';
          this.planType = profile.plan || 'free';
          this.businessType = profile.business_type || 'tienda';
          this.businessConfig = this.businessConfigService.getConfig(this.businessType);
          this.daysRemaining = this.authService.getDaysRemaining(profile);
          this.isPlanActive = this.authService.isPlanActive(profile);

          localStorage.setItem('businessType', this.businessType);
          localStorage.setItem('businessConfig', JSON.stringify(this.businessConfig));
          
          // Cargar contadores
          this.loadCounters();
          
          // Cargar notificaciones desde Supabase
          if (profile.business_id) {
            await this.loadNotificationsFromSupabase();
            this.checkStockOnLoad(profile.business_id);
          }

          if (!this.isPlanActive && !this.router.url.includes('/dashboard/payments')) {
            this.router.navigate(['/dashboard/payments']);
          }
        } else {
          this.businessName = 'Mi Negocio';
          this.planType = 'free';
          this.daysRemaining = 15;
        }
      } else {
        if (this.isAuthReady) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  async loadCounters() {
    try {
      this.pendingOrders = await this.authService.getPendingOrdersCount?.() ?? 0;
      this.creditPending = await this.authService.getCreditPendingCount?.() ?? 0;
      this.lowStock = await this.authService.getLowStockCount?.() ?? 0;
    } catch (error) {
      console.error('Error cargando contadores:', error);
    }
  }

  async loadNotificationsFromSupabase() {
    if (!this.userProfile?.business_id) return;

    try {
      const dbNotifications = await this.stockNotificationsService.getStockNotifications(
        this.userProfile.business_id,
        50
      );

      this.notifications = dbNotifications.map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        time: this.getTimeAgo(n.created_at),
        read: n.read,
        link: n.link || '/dashboard/products',
        timestamp: new Date(n.created_at)
      }));

      this.updateUnreadCount();
    } catch (error) {
      console.error('Error cargando notificaciones desde Supabase:', error);
      this.notifications = [];
    }
  }

  async checkStockOnLoad(businessId: string) {
    try {
      const result = await this.stockNotificationsService.checkAndNotifyLowStock(businessId);
      
      if (result.lowStock > 0 || result.outOfStock > 0) {
        console.log(`📦 Stock verificado: ${result.lowStock} con stock bajo, ${result.outOfStock} sin stock`);
        await this.loadNotificationsFromSupabase();
      }
    } catch (error) {
      console.error('Error verificando stock:', error);
    }
  }

  // ==========================================
  // NOTIFICATIONS METHODS
  // ==========================================

  toggleNotifications() {
    this.notificationsOpen = !this.notificationsOpen;
    if (this.notificationsOpen) {
      this.loadNotificationsFromSupabase();
    }
  }

  closeNotifications() {
    this.notificationsOpen = false;
  }

  handleNotificationClick(notification: Notification) {
    if (!notification.read) {
      this.markAsRead(notification);
    }
    
    if (notification.link) {
      this.router.navigate([notification.link]);
      this.closeNotifications();
    }
  }

  async markAsRead(notification: Notification, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    
    try {
      await this.stockNotificationsService.markNotificationAsRead(notification.id);
      
      const index = this.notifications.findIndex(n => n.id === notification.id);
      if (index !== -1) {
        this.notifications[index].read = true;
        this.updateUnreadCount();
      }
    } catch (error) {
      console.error('Error marcando notificación como leída:', error);
    }
  }

  async markAllAsRead() {
    if (!this.userProfile?.business_id) return;

    try {
      await this.stockNotificationsService.markAllNotificationsAsRead(this.userProfile.business_id);
      
      this.notifications.forEach(notification => {
        notification.read = true;
      });
      this.updateUnreadCount();
    } catch (error) {
      console.error('Error marcando todas como leídas:', error);
    }
  }

  async clearAllNotifications() {
    if (!this.userProfile?.business_id) return;

    try {
      await this.stockNotificationsService.cleanupOldNotifications(this.userProfile.business_id, 0);
      await this.loadNotificationsFromSupabase();
    } catch (error) {
      console.error('Error limpiando notificaciones:', error);
    }
  }

  updateUnreadCount() {
    this.unreadNotifications = this.notifications.filter(n => !n.read).length;
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

  // ✅ CORREGIDO: Un solo HostListener que maneja ambos dropdowns
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    const profileDropdown = target.closest('.profile-dropdown-wrapper');
    const notificationsWrapper = target.closest('.notifications-wrapper');
    
    // Cerrar perfil si se hace click fuera
    if (!profileDropdown && this.profileDropdownOpen) {
      this.profileDropdownOpen = false;
    }
    
    // Cerrar notificaciones si se hace click fuera
    if (!notificationsWrapper && this.notificationsOpen) {
      this.notificationsOpen = false;
    }
  }

  // ==========================================
  // DARK MODE & SIDEBAR
  // ==========================================

  checkDarkMode() {
    const savedMode = localStorage.getItem('darkMode');
    this.darkMode = savedMode ? JSON.parse(savedMode) : false;
    if (this.darkMode) {
      document.documentElement.classList.add('dark');
    }
  }

  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    localStorage.setItem('darkMode', JSON.stringify(this.darkMode));
    if (this.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
    
    if (this.sidebarOpen && window.innerWidth < 1280) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  // ✅ CORREGIDO: Método mejorado para detectar la ruta activa
  setActiveMenu(route: string) {
    // Limpiar la ruta (quitar query params y hash)
    const cleanRoute = route.split('?')[0].split('#')[0];
    
    // ✅ Buscar TODAS las coincidencias y seleccionar la MÁS ESPECÍFICA (más larga)
    const allMatches = this.menuRoutes.filter(menuRoute => 
      cleanRoute === menuRoute || cleanRoute.startsWith(menuRoute + '/')
    );
    
    // Ordenar por longitud descendente y tomar la primera (la más específica)
    const mostSpecificMatch = allMatches.sort((a, b) => b.length - a.length)[0];
    
    this.activeMenu = mostSpecificMatch || cleanRoute;

    console.log('🎯 Ruta activa:', this.activeMenu, '| Ruta original:', cleanRoute);

    // Cerrar sidebar en mobile
    if (window.innerWidth < 1280) {
      this.sidebarOpen = false;
      document.body.style.overflow = '';
    }
  }

  toggleProfileDropdown() {
    this.profileDropdownOpen = !this.profileDropdownOpen;
    // Cerrar notificaciones si está abierto
    if (this.profileDropdownOpen && this.notificationsOpen) {
      this.notificationsOpen = false;
    }
  }

  closeProfileDropdown() {
    this.profileDropdownOpen = false;
  }

  onNewSale() {
    this.router.navigate(['/dashboard/pos']);
  }

  async logout() {
    // ✅ Limpiar el flag del splash screen al cerrar sesión
    localStorage.removeItem(this.SPLASH_SHOWN_KEY);
    
    this.socketService.disconnect();
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    this.userSubscription?.unsubscribe();
    this.authReadySubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
    this.notificationsSubscription?.unsubscribe();
    this.unreadCountSubscription?.unsubscribe();
    this.socketConnectionSubscription?.unsubscribe();
    
    this.socketService.disconnect();
    document.body.style.overflow = '';
  }
}