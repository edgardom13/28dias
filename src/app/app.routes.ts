import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  
  // ============================================
  // RUTAS PÚBLICAS (solo para invitados)
  // ============================================
  {
    path: 'login',
    loadComponent: () => import('./pages/auth-pages/login/login.page').then(m => m.LoginPage),
    canActivate: [guestGuard],
    data: { title: 'Iniciar Sesión' }
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth-pages/register/register.page').then(m => m.RegisterPage),
    canActivate: [guestGuard],
    data: { title: 'Registrarse' }
  },
  {
    path: 'business',
    loadComponent: () => import('./pages/auth-pages/business/business.page').then(m => m.BusinessPage),
    canActivate: [guestGuard],
    data: { title: 'Configurar Negocio' }
  },
  {
    path: 'plans',
    loadComponent: () => import('./pages/auth-pages/plans/plans.page').then(m => m.PlansPage),
    canActivate: [guestGuard],
    data: { title: 'Planes y Precios' }
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/auth-pages/forgot-password/forgot-password.page').then(m => m.ForgotPasswordPage),
    canActivate: [guestGuard],
    data: { title: 'Recuperar contraseña' }
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/auth-pages/reset-password/reset-password.page').then(m => m.ResetPasswordPage),
    data: { title: 'Restablecer contraseña' }
  },
  
  // ============================================
  // RUTAS DE PAGO
  // ============================================
  {
    path: 'payment',
    loadComponent: () => import('./pages/payment/payment.page').then(m => m.PaymentPage),
    data: { title: 'Pago' }
  },
  {
    path: 'payment/success',
    loadComponent: () => import('./pages/payment/payment-success.page').then(m => m.PaymentSuccessPage),
    data: { title: 'Pago Exitoso' }
  },
  {
    path: 'payment/failure',
    loadComponent: () => import('./pages/payment/payment-failure.page').then(m => m.PaymentFailurePage),
    data: { title: 'Pago Fallido' }
  },
  {
    path: 'confirm-email',
    loadComponent: () => import('./pages/auth-pages/confirm-email/confirm-email.page').then(m => m.ConfirmEmailPage),
    data: { title: 'Confirmar Email' }
  },
  
  // ============================================
  // RUTAS PÚBLICAS DEL CATÁLOGO (sin autenticación)
  // ============================================
  {
    path: 'catalogo/:slug',
    loadComponent: () => import('./pages/public/public-catalog/public-catalog.page').then(m => m.PublicCatalogPage),
    data: { title: 'Catálogo' }
  },
  
  // ============================================
  // RUTAS PROTEGIDAS DEL DASHBOARD
  // ============================================
  {
    path: 'dashboard',
    loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    canActivate: [AuthGuard],
    children: [
      // Home
      {
        path: '',
        loadComponent: () => import('./pages/dashboard/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent),
        data: { title: 'Inicio' }
      },
      
      // Operaciones
      {
        path: 'pos',
        loadComponent: () => import('./pages/dashboard/operations/pos/pos.page').then(m => m.PosPage),
        data: { title: 'Nueva Venta' }
      },
      {
        path: 'orders',
        loadComponent: () => import('./pages/dashboard/operations/orders/orders.page').then(m => m.OrdersPage),
        data: { title: 'Pedidos' }
      },
      {
        path: 'credit',
        loadComponent: () => import('./pages/dashboard/operations/credit/credit.page').then(m => m.CreditPage),
        data: { title: 'Fiado' }
      },
      {
        path: 'sales-history',
        loadComponent: () => import('./pages/dashboard/operations/sales-history/sales-history.page').then(m => m.SalesHistoryPage),
        data: { title: 'Historial de Ventas' }
      },
      
      // Inventario
      {
        path: 'products',
        loadComponent: () => import('./pages/dashboard/inventory/products/products.page').then(m => m.ProductsPage),
        data: { title: 'Productos' }
      },
      {
        path: 'categories',
        loadComponent: () => import('./pages/dashboard/inventory/categories/categories.page').then(m => m.CategoriesPage),
        data: { title: 'Categorías' }
      },
      {
        path: 'catalog',
        loadComponent: () => import('./pages/dashboard/inventory/catalog/catalog.page').then(m => m.CatalogPage),
        data: { title: 'Catálogo' }
      },
      {
        path: 'inventory',
        loadComponent: () => import('./pages/dashboard/inventory/inventory/inventory.page').then(m => m.InventoryPage),
        data: { title: 'Inventario' }
      },
      
      // Finanzas
      {
        path: 'income',
        loadComponent: () => import('./pages/dashboard/finances/income/income.page').then(m => m.IncomePage),
        data: { title: 'Ingresos' }
      },
      {
        path: 'expenses',
        loadComponent: () => import('./pages/dashboard/finances/expenses/expenses.page').then(m => m.ExpensesPage),
        data: { title: 'Egresos' }
      },
      {
        path: 'reports',
        loadComponent: () => import('./pages/dashboard/finances/reports/reports.page').then(m => m.ReportsPage),
        data: { title: 'Reportes' }
      },
     
      
      // Clientes
      {
        path: 'customers',
        loadComponent: () => import('./pages/dashboard/customers/customers/customers.page').then(m => m.CustomersPage),
        data: { title: 'Clientes' }
      },
      {
        path: 'marketing',
        loadComponent: () => import('./pages/dashboard/customers/marketing/marketing.page').then(m => m.MarketingPage),
        data: { title: 'Marketing' }
      },
      {
        path: 'loyalty',
        loadComponent: () => import('./pages/dashboard/customers/loyalty/loyalty.page').then(m => m.LoyaltyPage),
        data: { title: 'Programa de Lealtad' }
      },
      
      // Sistema
      {
        path: 'business',
        loadComponent: () => import('./pages/dashboard/business/business.page').then(m => m.BusinessPage),
        data: { title: 'Mi Negocio' }
      },
      {
        path: 'employees',
        loadComponent: () => import('./pages/dashboard/employees/employees.page').then(m => m.EmployeesPage),
        data: { title: 'Empleados' }
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/dashboard/profile/profile.page').then(m => m.ProfilePage),
        data: { title: 'Mi Perfil' }
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/dashboard/settings/settings.page').then(m => m.SettingsPage),
        data: { title: 'Configuración' }
      },
      {
        path: 'payments',
        loadComponent: () => import('./pages/dashboard/payments/payments.page').then(m => m.PaymentsPage),
        data: { title: 'Pagos' }
      },
      {
        path: 'website',
        loadComponent: () => import('./pages/dashboard/website/website.page').then(m => m.WebsitePage),
        data: { title: 'Mi Sitio Web' }
      }
    ]
  },
  
  // ============================================
  // RUTA COMODÍN (404)
  // ============================================
  {
    path: '**',
    redirectTo: 'login'
  }
];