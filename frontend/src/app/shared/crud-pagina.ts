import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { mensajeError } from '../core/auth.interceptor';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import type { Opcion, Registro } from '../core/modelos';
import { NotificacionesService } from '../core/notificaciones.service';
import { descargarCSV, fechaCorta, moneda, nombreCompleto, primerDiaMes, ultimoDiaMes } from '../core/utilidades';
import type { Campo, ConfigCrud } from './crud.config';
import { FormularioCampos } from './formulario-campos';
import { Modal } from './modal';

const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

/**
 * Página CRUD genérica: lista (tabla en escritorio, tarjetas en teléfono), búsqueda, filtros,
 * rango de fechas, total, exportación CSV y formulario en modal. Se configura con ConfigCrud.
 */
@Component({
  selector: 'app-crud-pagina',
  imports: [FormsModule, RouterLink, Modal, FormularioCampos],
  host: { '[style.--modulo]': 'colorModulo()' },
  template: `
    @let c = config();
    <div class="pagina">
      <div class="pagina-encabezado">
        <div>
          <h1><span class="icono">{{ c.icono }}</span>{{ c.titulo }}</h1>
          @if (c.descripcion) {
            <p>{{ c.descripcion }}</p>
          }
        </div>
        <div class="acciones">
          <button class="btn" type="button" (click)="exportar()" [disabled]="!filtrados().length">
            <span class="icono">download</span> CSV
          </button>
          @if (puedeEscribir()) {
            <button class="btn btn-primario" type="button" (click)="nuevo()">
              <span class="icono">add</span> Nuevo
            </button>
          }
        </div>
      </div>

      <div class="barra-filtros">
        <div class="buscador campo">
          <span class="icono">search</span>
          <input type="search" placeholder="Buscar…" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" />
        </div>
        @for (f of camposFiltro(); track f.clave) {
          <select class="control" [ngModel]="filtros()[f.clave] ?? ''" (ngModelChange)="filtrar(f.clave, $event)" [attr.aria-label]="f.etiqueta">
            <option value="">{{ f.etiqueta }}: todos</option>
            @for (o of opcionesDe(f); track o.valor) {
              <option [value]="o.valor">{{ o.etiqueta }}</option>
            }
          </select>
        }
        @if (c.filtroFecha) {
          <input class="control" type="date" aria-label="Desde" [ngModel]="desde()" (ngModelChange)="desde.set($event); cargar()" />
          <input class="control" type="date" aria-label="Hasta" [ngModel]="hasta()" (ngModelChange)="hasta.set($event); cargar()" />
        }
      </div>

      @if (cargando()) {
        <div class="cargando"></div>
      } @else if (!filtrados().length) {
        <div class="tarjeta vacio-estado">
          <span class="icono">{{ c.icono }}</span>
          No hay registros{{ items().length ? ' con esos filtros' : ' todavía' }}.
        </div>
      } @else {
        <div class="tabla-contenedor">
          <table class="tabla">
            <thead>
              <tr>
                @for (campo of columnas(); track campo.clave) {
                  <th [class.num]="campo.tipo === 'moneda' || campo.tipo === 'numero'">{{ campo.etiqueta }}</th>
                }
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (it of filtrados(); track it.id) {
                <tr>
                  @for (campo of columnas(); track campo.clave) {
                    @let v = celda(it, campo);
                    <td
                      [attr.data-label]="campo.etiqueta"
                      [class.principal]="campo.clave === c.campoPrincipal"
                      [class.num]="campo.tipo === 'moneda' || campo.tipo === 'numero'"
                      [class.vacio]="!v.texto"
                    >
                      @if (v.insignia) {
                        <span class="insignia" [class]="v.color ?? 'gris'">{{ v.texto }}</span>
                      } @else {
                        {{ v.texto }}
                      }
                    </td>
                  }
                  <td class="acciones-celda">
                    @for (a of c.acciones ?? []; track a.etiqueta) {
                      @if (!a.visibleSi || a.visibleSi(it)) {
                        <a class="btn btn-icono" [routerLink]="a.ruta ? a.ruta(it) : null" [title]="a.etiqueta" [attr.aria-label]="a.etiqueta">
                          <span class="icono">{{ a.icono }}</span>
                        </a>
                      }
                    }
                    @if (puedeEditar()) {
                      <button class="btn btn-icono" type="button" (click)="editar(it)" title="Editar" aria-label="Editar">
                        <span class="icono">edit</span>
                      </button>
                    }
                    @if (puedeBorrar()) {
                      <button class="btn btn-icono" type="button" (click)="eliminar(it)" title="Eliminar" aria-label="Eliminar">
                        <span class="icono rojo-texto">delete</span>
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
            @if (c.totalizar) {
              <tfoot>
                <tr>
                  <td [attr.colspan]="columnas().length" [attr.data-label]="'Total (' + filtrados().length + ' registros)'" class="num">{{ total() }}</td>
                  <td class="vacio"></td>
                </tr>
              </tfoot>
            }
          </table>
        </div>
      }
    </div>

    <app-modal [abierto]="modalAbierto()" [titulo]="(borrador['id'] ? 'Editar ' : 'Nuevo ') + c.singular" (cerrar)="modalAbierto.set(false)">
      <form id="form-crud" #f="ngForm" (ngSubmit)="guardar(f.invalid)">
        <app-formulario-campos [campos]="c.campos" [modelo]="borrador" [relaciones]="relaciones()" />
      </form>
      <ng-container pie>
        <button class="btn" type="button" (click)="modalAbierto.set(false)">Cancelar</button>
        <button class="btn btn-primario" type="submit" form="form-crud" [disabled]="guardando()">
          <span class="icono">save</span> {{ guardando() ? 'Guardando…' : 'Guardar' }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class CrudPagina {
  readonly config = input.required<ConfigCrud>();

  private api = inject(ApiService);
  private auth = inject(AuthService);
  private notif = inject(NotificacionesService);

  readonly items = signal<Registro[]>([]);
  readonly cargando = signal(true);
  readonly relaciones = signal<Record<string, Registro[]>>({});
  readonly busqueda = signal('');
  readonly filtros = signal<Record<string, string>>({});
  readonly desde = signal('');
  readonly hasta = signal('');
  readonly modalAbierto = signal(false);
  readonly guardando = signal(false);
  borrador: Record<string, any> = {};

  readonly colorModulo = computed(() => `var(--c-${this.config().modulo})`);
  readonly puedeEscribir = computed(() => this.auth.puede(this.config().escribir));
  readonly puedeEditar = computed(() => this.auth.puede(this.config().editar ?? this.config().escribir));
  readonly puedeBorrar = computed(() => this.auth.puede(this.config().borrar));
  readonly columnas = computed(() => this.config().campos.filter((c) => c.enTabla));
  readonly camposFiltro = computed(() => this.config().campos.filter((c) => c.filtro));

  readonly filtrados = computed(() => {
    const q = normalizar(this.busqueda().trim());
    const f = this.filtros();
    let lista = this.items().filter((it) => Object.entries(f).every(([k, v]) => !v || String(it[k] ?? '') === v));
    if (q) {
      lista = lista.filter((it) =>
        normalizar(this.config().campos.map((c) => this.celda(it, c).texto).join(' ')).includes(q),
      );
    }
    return lista;
  });

  readonly total = computed(() => {
    const campo = this.config().totalizar;
    if (!campo) return '';
    return moneda(this.filtrados().reduce((s, it) => s + (Number(it[campo]) || 0), 0));
  });

  constructor() {
    effect(() => {
      const c = this.config();
      untracked(() => {
        if (c.filtroFecha) {
          this.desde.set(primerDiaMes());
          this.hasta.set(ultimoDiaMes());
        }
        this.cargarRelaciones();
        this.cargar();
      });
    });
  }

  async cargar() {
    this.cargando.set(true);
    try {
      const params: Record<string, string> = this.config().filtroFecha ? { desde: this.desde(), hasta: this.hasta() } : {};
      let lista = await this.api.listar(this.config().coleccion, params);
      const orden = this.config().ordenarPor;
      if (orden) lista = [...lista].sort((a, b) => String(a[orden] ?? '').localeCompare(String(b[orden] ?? '')));
      this.items.set(lista);
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarRelaciones() {
    const colecciones = [...new Set(this.config().campos.filter((c) => c.relacion).map((c) => c.relacion!))];
    const resultado: Record<string, Registro[]> = {};
    await Promise.all(
      colecciones.map(async (col) => {
        try {
          const lista = await this.api.listar(col, {}, true);
          resultado[col] = [...lista].sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)));
        } catch {
          resultado[col] = [];
        }
      }),
    );
    this.relaciones.set(resultado);
  }

  opcionesDe(campo: Campo): Opcion[] {
    if (campo.relacion) {
      return (this.relaciones()[campo.relacion] ?? []).map((r) => ({ valor: r.id, etiqueta: nombreCompleto(r) }));
    }
    return campo.opciones ?? [];
  }

  filtrar(clave: string, valor: string) {
    this.filtros.update((f) => ({ ...f, [clave]: valor }));
  }

  celda(it: Registro, campo: Campo): { texto: string; insignia?: boolean; color?: string } {
    const v = it[campo.clave];
    switch (campo.tipo) {
      case 'select': {
        const o = campo.opciones?.find((op) => op.valor === v);
        return { texto: o?.etiqueta ?? String(v ?? ''), insignia: campo.insignia && !!v, color: o?.color };
      }
      case 'relacion': {
        const r = this.relaciones()[campo.relacion!]?.find((x) => x.id === v);
        return { texto: r ? nombreCompleto(r) : '' };
      }
      case 'moneda':
        return { texto: v === undefined || v === '' ? '' : moneda(v) };
      case 'fecha':
        return { texto: fechaCorta(v) };
      case 'booleano':
        return { texto: v ? 'Sí' : 'No', insignia: true, color: v ? 'verde' : 'gris' };
      default:
        return { texto: v === undefined || v === null ? '' : String(v) };
    }
  }

  nuevo() {
    const b: Record<string, any> = {};
    for (const c of this.config().campos) {
      const d = typeof c.defecto === 'function' ? (c.defecto as () => unknown)() : c.defecto;
      b[c.clave] = d ?? (c.tipo === 'booleano' ? false : c.tipo === 'select' ? (c.opciones?.[0]?.valor ?? '') : '');
      // La iglesia en el hogar se preselecciona con la de quien está registrando.
      if (c.relacion === 'celulas' && !b[c.clave]) b[c.clave] = this.auth.usuario()?.celulaId ?? '';
    }
    this.borrador = b;
    this.modalAbierto.set(true);
  }

  editar(it: Registro) {
    this.borrador = { ...it };
    this.modalAbierto.set(true);
  }

  async guardar(invalido: boolean | null) {
    if (invalido) {
      this.notif.error('Revisa los campos obligatorios');
      return;
    }
    const datos: Record<string, unknown> = {};
    for (const c of this.config().campos) {
      let v = this.borrador[c.clave];
      if ((c.tipo === 'numero' || c.tipo === 'moneda') && (v === '' || v === null || v === undefined)) v = c.requerido ? v : 0;
      if (v === null || v === undefined) v = c.tipo === 'booleano' ? false : '';
      datos[c.clave] = v;
    }
    // Conserva campos no editables en el formulario (p. ej. listas de asistencia).
    const id = this.borrador['id'] as string | undefined;
    this.guardando.set(true);
    try {
      if (id) {
        const extra = Object.fromEntries(
          Object.entries(this.borrador).filter(([k]) => !(k in datos) && !['id', 'creadoEn', 'actualizadoEn', 'creadoPor', 'actualizadoPor'].includes(k)),
        );
        await this.api.actualizar(this.config().coleccion, id, { ...extra, ...datos });
      } else {
        await this.api.crear(this.config().coleccion, datos);
      }
      this.notif.exito(`${this.config().singular} guardado`);
      this.modalAbierto.set(false);
      await this.cargar();
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(it: Registro) {
    const nombre = this.celda(it, this.config().campos.find((c) => c.clave === this.config().campoPrincipal)!).texto;
    if (!this.notif.confirmar(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await this.api.eliminar(this.config().coleccion, it.id);
      this.notif.exito('Eliminado');
      this.items.update((l) => l.filter((x) => x.id !== it.id));
    } catch (e) {
      this.notif.error(mensajeError(e));
    }
  }

  exportar() {
    const cols = this.config().campos;
    const filas = [cols.map((c) => c.etiqueta), ...this.filtrados().map((it) => cols.map((c) => this.celda(it, c).texto))];
    descargarCSV(`${this.config().coleccion}.csv`, filas);
  }
}
