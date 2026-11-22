import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type { Registro } from './modelos';

/** Acceso genérico a las colecciones de la API con una pequeña caché en memoria. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;
  private cache = new Map<string, Promise<Registro[]>>();

  listar(coleccion: string, params: Record<string, string> = {}, usarCache = false): Promise<Registro[]> {
    const limpios = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
    const clave = coleccion + JSON.stringify(limpios);
    if (usarCache && this.cache.has(clave)) return this.cache.get(clave)!;
    const p = firstValueFrom(this.http.get<Registro[]>(`${this.base}/${coleccion}`, { params: limpios }));
    this.cache.set(clave, p);
    p.catch(() => this.cache.delete(clave));
    return p;
  }

  obtener(coleccion: string, id: string): Promise<Registro> {
    return firstValueFrom(this.http.get<Registro>(`${this.base}/${coleccion}/${id}`));
  }

  async crear(coleccion: string, datos: Record<string, unknown>): Promise<Registro> {
    const r = await firstValueFrom(this.http.post<Registro>(`${this.base}/${coleccion}`, datos));
    this.invalidar(coleccion);
    return r;
  }

  async actualizar(coleccion: string, id: string, datos: Record<string, unknown>): Promise<Registro> {
    const r = await firstValueFrom(this.http.put<Registro>(`${this.base}/${coleccion}/${id}`, datos));
    this.invalidar(coleccion);
    return r;
  }

  async eliminar(coleccion: string, id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.base}/${coleccion}/${id}`));
    this.invalidar(coleccion);
  }

  get<T>(ruta: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.base}/${ruta}`));
  }
  put<T>(ruta: string, datos: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(`${this.base}/${ruta}`, datos));
  }
  patch<T>(ruta: string, datos: unknown): Promise<T> {
    return firstValueFrom(this.http.patch<T>(`${this.base}/${ruta}`, datos));
  }
  borrar(ruta: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${ruta}`));
  }

  invalidar(coleccion: string) {
    for (const k of this.cache.keys()) if (k.startsWith(coleccion)) this.cache.delete(k);
  }
}
