import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** Adjunta el JWT a cada llamada a la API y cierra sesión si el servidor responde 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const esApi = req.url.startsWith(environment.apiUrl);
  const token = auth.token;
  const peticion = esApi && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(peticion).pipe(
    catchError((err: HttpErrorResponse) => {
      const esLoginORegistro = /\/auth\/(login|registro|google)$/.test(req.url);
      if (esApi && err.status === 401 && !esLoginORegistro) auth.logout();
      return throwError(() => err);
    }),
  );
};

/** Extrae un mensaje legible de un error HTTP o de Firebase. */
export function mensajeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'No hay conexión con el servidor';
    return err.error?.mensaje ?? `Error ${err.status}`;
  }
  const codigo = (err as { code?: string })?.code;
  if (codigo === 'auth/popup-closed-by-user' || codigo === 'auth/cancelled-popup-request') return 'Inicio con Google cancelado';
  if (codigo === 'auth/popup-blocked') return 'El navegador bloqueó la ventana de Google';
  if (codigo === 'auth/unauthorized-domain') return 'Este dominio no está autorizado en Firebase Authentication';
  return (err as Error)?.message ?? 'Ocurrió un error inesperado';
}
