import { Injectable, signal } from '@angular/core';

export interface Aviso {
  id: number;
  texto: string;
  tipo: 'exito' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  readonly avisos = signal<Aviso[]>([]);
  private siguiente = 1;

  exito(texto: string) {
    this.mostrar(texto, 'exito');
  }
  error(texto: string) {
    this.mostrar(texto, 'error', 6000);
  }
  info(texto: string) {
    this.mostrar(texto, 'info');
  }

  cerrar(id: number) {
    this.avisos.update((l) => l.filter((a) => a.id !== id));
  }

  private mostrar(texto: string, tipo: Aviso['tipo'], ms = 3500) {
    const id = this.siguiente++;
    this.avisos.update((l) => [...l, { id, texto, tipo }]);
    setTimeout(() => this.cerrar(id), ms);
  }

  /** Confirmación nativa (funciona bien en teléfonos). */
  confirmar(texto: string): boolean {
    return window.confirm(texto);
  }
}
