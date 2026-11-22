import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensajeError } from '../core/auth.interceptor';
import { ApiService } from '../core/api.service';
import type { Registro } from '../core/modelos';
import { NotificacionesService } from '../core/notificaciones.service';
import { deISO, hoy, MESES } from '../core/utilidades';
import { ESTADO_EVENTO, EVENTOS, TIPO_EVENTO } from '../modulos.config';
import { FormularioCampos } from '../shared/formulario-campos';
import { Modal } from '../shared/modal';

type Vista = 'proximos' | 'pasados' | 'todos';

/** Planificación y calendario de eventos y cultos. */
@Component({
  selector: 'app-eventos',
  imports: [FormsModule, RouterLink, Modal, FormularioCampos],
  host: { style: '--modulo: var(--c-eventos)' },
  template: `
    <div class="pagina">
      <div class="pagina-encabezado">
        <div>
          <h1><span class="icono">event</span>Eventos & Cultos</h1>
          <p>Planificación → calendario → publicación → inscripción → ejecución → asistencia → evaluación.</p>
        </div>
        <button class="btn btn-primario" type="button" (click)="nuevo()"><span class="icono">add</span> Nuevo evento</button>
      </div>

      <div class="barra-filtros">
        <div class="segmentado" style="max-width: 420px">
          <button type="button" [class.activo]="vista() === 'proximos'" (click)="vista.set('proximos')">Próximos</button>
          <button type="button" [class.activo]="vista() === 'pasados'" (click)="vista.set('pasados')">Pasados</button>
          <button type="button" [class.activo]="vista() === 'todos'" (click)="vista.set('todos')">Todos</button>
        </div>
        <select class="control" [ngModel]="estado()" (ngModelChange)="estado.set($event)" aria-label="Estado">
          <option value="">Estado: todos</option>
          @for (o of estados; track o.valor) {
            <option [value]="o.valor">{{ o.etiqueta }}</option>
          }
        </select>
      </div>

      @if (cargando()) {
        <div class="cargando"></div>
      } @else if (!grupos().length) {
        <div class="tarjeta vacio-estado"><span class="icono">event_busy</span>No hay eventos para mostrar.</div>
      } @else {
        @for (g of grupos(); track g.clave) {
          <h2 class="mes">{{ g.titulo }}</h2>
          <div class="lista-eventos">
            @for (e of g.eventos; track e.id) {
              <a class="evento tarjeta" [routerLink]="['/eventos', e.id]">
                <div class="fecha-caja">
                  <span class="dia">{{ dia(e) }}</span>
                  <span class="sem">{{ semana(e) }}</span>
                </div>
                <div class="info">
                  <strong>{{ e['titulo'] }}</strong>
                  <span class="texto-2 pequeno">
                    {{ e['hora'] || 'Sin hora' }}{{ e['lugar'] ? ' · ' + e['lugar'] : '' }}
                  </span>
                  <span class="insignias">
                    <span class="insignia" [class]="op(tipos, e['tipo'])?.color">{{ op(tipos, e['tipo'])?.etiqueta }}</span>
                    <span class="insignia" [class]="op(estados, e['estado'])?.color">{{ op(estados, e['estado'])?.etiqueta }}</span>
                    @if (e['asistentes']?.length || e['asistenciaExtra']) {
                      <span class="insignia gris"><span class="icono" style="font-size: 14px">groups</span>{{ (e['asistentes']?.length || 0) + (e['asistenciaExtra'] || 0) }}</span>
                    }
                  </span>
                </div>
                <span class="icono texto-2">chevron_right</span>
              </a>
            }
          </div>
        }
      }
    </div>

    <app-modal [abierto]="modalAbierto()" titulo="Nuevo evento" (cerrar)="modalAbierto.set(false)">
      <form id="form-evento" #f="ngForm" (ngSubmit)="guardar(f.invalid)">
        <app-formulario-campos [campos]="config.campos" [modelo]="borrador" />
      </form>
      <ng-container pie>
        <button class="btn" type="button" (click)="modalAbierto.set(false)">Cancelar</button>
        <button class="btn btn-primario" type="submit" form="form-evento" [disabled]="guardando()">
          <span class="icono">save</span> Guardar
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .mes {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--texto-2);
      margin: 20px 0 8px;
    }
    .lista-eventos {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    }
    .evento {
      display: flex;
      gap: 14px;
      align-items: center;
      padding: 12px;
      color: inherit;
      text-decoration: none;
      transition: border-color 0.15s;
      &:hover {
        border-color: var(--modulo);
      }
    }
    .fecha-caja {
      width: 54px;
      flex-shrink: 0;
      text-align: center;
      border-radius: 10px;
      background: color-mix(in srgb, var(--modulo) 12%, transparent);
      color: var(--modulo);
      padding: 6px 0;
      .dia {
        display: block;
        font-size: 1.4rem;
        font-weight: 800;
        line-height: 1.1;
      }
      .sem {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
      }
    }
    .info {
      flex: 1;
      display: grid;
      gap: 4px;
      min-width: 0;
    }
    .insignias {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  `,
})
export class Eventos {
  private api = inject(ApiService);
  private notif = inject(NotificacionesService);
  private router = inject(Router);

  readonly config = EVENTOS;
  readonly tipos = TIPO_EVENTO;
  readonly estados = ESTADO_EVENTO;
  readonly eventos = signal<Registro[]>([]);
  readonly cargando = signal(true);
  readonly vista = signal<Vista>('proximos');
  readonly estado = signal('');
  readonly modalAbierto = signal(false);
  readonly guardando = signal(false);
  borrador: Record<string, any> = {};

  readonly grupos = computed(() => {
    const h = hoy();
    const v = this.vista();
    let lista = this.eventos().filter((e) => !this.estado() || e['estado'] === this.estado());
    if (v === 'proximos') lista = lista.filter((e) => e['fecha'] >= h);
    if (v === 'pasados') lista = lista.filter((e) => e['fecha'] < h);
    const orden = (a: Registro, b: Registro) => (a['fecha'] + a['hora']).localeCompare(b['fecha'] + b['hora']);
    lista = [...lista].sort(v === 'pasados' ? (a, b) => orden(b, a) : orden);
    const mapa = new Map<string, Registro[]>();
    for (const e of lista) {
      const clave = String(e['fecha']).slice(0, 7);
      mapa.set(clave, [...(mapa.get(clave) ?? []), e]);
    }
    return [...mapa.entries()].map(([clave, eventos]) => {
      const [a, m] = clave.split('-').map(Number);
      return { clave, titulo: `${MESES[m - 1]} ${a}`, eventos };
    });
  });

  constructor() {
    this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    try {
      this.eventos.set(await this.api.listar('eventos'));
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  op(lista: { valor: string; etiqueta: string; color?: string }[], v: string) {
    return lista.find((o) => o.valor === v);
  }

  dia(e: Registro) {
    return deISO(e['fecha']).getDate();
  }

  semana(e: Registro) {
    return deISO(e['fecha']).toLocaleDateString('es', { weekday: 'short' });
  }

  nuevo() {
    this.borrador = { titulo: '', tipo: 'culto', estado: 'planificado', fecha: hoy(), hora: '', lugar: '', requiereInscripcion: false, cupo: 0, descripcion: '' };
    this.modalAbierto.set(true);
  }

  async guardar(invalido: boolean | null) {
    if (invalido) {
      this.notif.error('Completa el título y la fecha');
      return;
    }
    this.guardando.set(true);
    try {
      const e = await this.api.crear('eventos', { ...this.borrador, cupo: Number(this.borrador['cupo']) || 0 });
      this.notif.exito('Evento creado');
      this.modalAbierto.set(false);
      this.router.navigate(['/eventos', e.id]);
    } catch (err) {
      this.notif.error(mensajeError(err));
    } finally {
      this.guardando.set(false);
    }
  }
}
