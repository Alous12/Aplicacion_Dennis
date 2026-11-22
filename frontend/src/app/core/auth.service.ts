import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type { Sesion, Usuario } from './modelos';
import type { Acceso } from './permisos';

const CLAVE_TOKEN = 'iglesia.token';
const CLAVE_USUARIO = 'iglesia.usuario';

/** Lee el campo exp del JWT para saber si ya venció (la firma la valida el backend). */
function tokenVigente(token: string | null): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function leerAlmacen(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private url = `${environment.apiUrl}/auth`;

  readonly usuario = signal<Usuario | null>(this.usuarioGuardado());
  readonly autenticado = computed(() => this.usuario() !== null);
  readonly esAdmin = computed(() => this.usuario()?.rol === 'admin');
  /** Tiene el permiso "hogar" y una iglesia en el hogar asignada (registra su asistencia e ingresos). */
  readonly tieneHogar = computed(() => this.puede('hogar') && !!this.usuario()?.celulaId);
  /** Texto del rol para mostrar: Administrador, la categoría asignada o Usuario. */
  readonly rolTexto = computed(() => (this.esAdmin() ? 'Administrador' : this.usuario()?.categoria || 'Usuario'));

  /** ¿Puede hacer esto? Los permisos vienen de su categoría (el backend vuelve a comprobarlo siempre). */
  puede(acceso: Acceso): boolean {
    const u = this.usuario();
    if (!u) return false;
    return acceso === 'todos' || u.rol === 'admin' || !!u.permisos?.includes(acceso);
  }

  /** Actualiza categoría, permisos e iglesia en el hogar desde el servidor (por si el admin los cambió). */
  async refrescar() {
    try {
      const u = await firstValueFrom(this.http.get<Usuario>(`${this.url}/yo`));
      this.usuario.set(u);
      try {
        localStorage.setItem(CLAVE_USUARIO, JSON.stringify(u));
      } catch {
        /* almacenamiento no disponible */
      }
    } catch {
      /* si el token venció, el interceptor ya cierra la sesión */
    }
  }

  private usuarioGuardado(): Usuario | null {
    if (!tokenVigente(leerAlmacen(CLAVE_TOKEN))) return null;
    try {
      return JSON.parse(leerAlmacen(CLAVE_USUARIO) ?? 'null');
    } catch {
      return null;
    }
  }

  get token(): string | null {
    const t = leerAlmacen(CLAVE_TOKEN);
    return tokenVigente(t) ? t : null;
  }

  sesionVigente(): boolean {
    const vigente = tokenVigente(leerAlmacen(CLAVE_TOKEN));
    if (!vigente && this.usuario()) this.usuario.set(null);
    return vigente && this.usuario() !== null;
  }

  async login(email: string, password: string) {
    const s = await firstValueFrom(this.http.post<Sesion>(`${this.url}/login`, { email, password }));
    this.guardar(s);
  }

  async registro(nombre: string, email: string, password: string): Promise<string> {
    const r = await firstValueFrom(
      this.http.post<{ mensaje: string }>(`${this.url}/registro`, { nombre, email, password }),
    );
    return r.mensaje;
  }

  /** Abre el popup de Google con Firebase Auth y canjea el ID token por nuestro JWT. */
  async loginGoogle() {
    // Carga diferida: Firebase solo se descarga al pulsar el botón.
    const { initializeApp, getApps } = await import('firebase/app');
    const { getAuth, GoogleAuthProvider, signInWithPopup, signOut } = await import('firebase/auth');
    const app = getApps()[0] ?? initializeApp(environment.firebase);
    const auth = getAuth(app);
    const proveedor = new GoogleAuthProvider();
    proveedor.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, proveedor);
    const idToken = await cred.user.getIdToken();
    await signOut(auth); // la sesión real es nuestro JWT
    const s = await firstValueFrom(this.http.post<Sesion>(`${this.url}/google`, { idToken }));
    this.guardar(s);
  }

  async cambiarPassword(actual: string, nueva: string): Promise<string> {
    const r = await firstValueFrom(
      this.http.post<{ mensaje: string }>(`${this.url}/cambiar-password`, { actual, nueva }),
    );
    return r.mensaje;
  }

  logout(redirigir = true) {
    try {
      localStorage.removeItem(CLAVE_TOKEN);
      localStorage.removeItem(CLAVE_USUARIO);
    } catch {
      /* almacenamiento no disponible */
    }
    this.usuario.set(null);
    if (redirigir) this.router.navigate(['/login']);
  }

  private guardar(s: Sesion) {
    try {
      localStorage.setItem(CLAVE_TOKEN, s.token);
      localStorage.setItem(CLAVE_USUARIO, JSON.stringify(s.usuario));
    } catch {
      /* almacenamiento no disponible */
    }
    this.usuario.set(s.usuario);
  }
}
