import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ConfigGeneral {
  logo: string;
  nombre: string;
}

const CLAVE = 'iglesia.config';

/** Logo y nombre de la iglesia, editables por el administrador (sin tocar el código). */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private http = inject(HttpClient);
  private datos = signal<ConfigGeneral>(this.guardada());

  readonly logo = computed(() => this.datos().logo);
  readonly nombre = computed(() => this.datos().nombre || environment.nombreIglesia);

  constructor() {
    this.aplicarFavicon();
    this.cargar();
  }

  async cargar() {
    try {
      const c = await firstValueFrom(this.http.get<ConfigGeneral>(`${environment.apiUrl}/configuracion/general`));
      this.establecer(c);
    } catch {
      /* sin conexión: se usa lo guardado */
    }
  }

  async guardar(c: ConfigGeneral) {
    const r = await firstValueFrom(this.http.put<ConfigGeneral>(`${environment.apiUrl}/configuracion/general`, c));
    this.establecer(r);
  }

  private establecer(c: ConfigGeneral) {
    this.datos.set({ logo: c.logo ?? '', nombre: c.nombre ?? '' });
    try {
      localStorage.setItem(CLAVE, JSON.stringify(this.datos()));
    } catch {
      /* almacenamiento no disponible */
    }
    this.aplicarFavicon();
  }

  /** Muestra el logo como ícono de la pestaña del navegador. */
  private aplicarFavicon() {
    const logo = this.datos().logo;
    if (!logo || typeof document === 'undefined') return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = logo;
  }

  private guardada(): ConfigGeneral {
    try {
      const c = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
      if (c && typeof c === 'object') return { logo: c.logo ?? '', nombre: c.nombre ?? '' };
    } catch {
      /* nada guardado */
    }
    return { logo: '', nombre: '' };
  }
}
