import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import type { Permiso } from './permisos';

export const autenticadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.sesionVigente() ? true : inject(Router).createUrlTree(['/login']);
};

/** Solo el administrador principal (roles, permisos y configuración). */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.sesionVigente() && auth.esAdmin() ? true : inject(Router).createUrlTree(['/']);
};

/** Deja pasar si el usuario tiene ALGUNO de los permisos indicados. */
export function permisoGuard(...permisos: Permiso[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    return auth.sesionVigente() && permisos.some((p) => auth.puede(p)) ? true : inject(Router).createUrlTree(['/']);
  };
}

export const invitadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.sesionVigente() ? inject(Router).createUrlTree(['/']) : true;
};
