import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take, firstValueFrom } from 'rxjs';

export const AuthGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // ✅ Esperar a que la autenticación esté lista
  await authService.waitForAuthReady();

  // ✅ Ahora verificar si hay usuario
  return firstValueFrom(
    authService.currentUser$.pipe(
      take(1),
      map(user => {
        if (!user) {
          router.navigate(['/login']);
          return false;
        }
        return true;
      })
    )
  );
};