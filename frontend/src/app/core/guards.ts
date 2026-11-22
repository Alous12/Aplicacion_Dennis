import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const autenticadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.sesionVigente() ? true : inject(Router).createUrlTree(['/login']);
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.sesionVigente() && auth.esAdmin() ? true : inject(Router).createUrlTree(['/']);
};

/** Administradores o líderes de célula. */
export const liderOAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.sesionVigente() && (auth.esAdmin() || auth.esLider()) ? true : inject(Router).createUrlTree(['/']);
};

export const invitadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.sesionVigente() ? inject(Router).createUrlTree(['/']) : true;
};
