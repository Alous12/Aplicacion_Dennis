import { Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import type { Modulo } from './crud.config';

export interface Pestana {
  ruta: string;
  etiqueta: string;
  icono: string;
}

/** Contenedor con pestañas (rutas hijas). Se configura desde los datos de la ruta. */
@Component({
  selector: 'app-pagina-pestanas',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  host: { '[style.--modulo]': 'color()' },
  template: `
    <div class="pagina" style="padding-bottom: 0">
      <nav class="pestanas no-imprimir">
        @for (p of pestanas(); track p.ruta) {
          <a [routerLink]="p.ruta" routerLinkActive="activa">
            <span class="icono">{{ p.icono }}</span>{{ p.etiqueta }}
          </a>
        }
      </nav>
    </div>
    <router-outlet />
  `,
  styles: `
    :host { display: block; }
    .pagina { padding-bottom: 0; }
    .pestanas { margin-bottom: 0; }
  `,
})
export class PaginaPestanas {
  readonly pestanas = input<Pestana[]>([]);
  readonly modulo = input<Modulo>('admin');
  readonly color = computed(() => `var(--c-${this.modulo()})`);
}
