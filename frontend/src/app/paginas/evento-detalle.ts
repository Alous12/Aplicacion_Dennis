import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensajeError } from '../core/auth.interceptor';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import type { Registro } from '../core/modelos';
import { NotificacionesService } from '../core/notificaciones.service';
import { fechaLarga, nombreCompleto, sinMeta } from '../core/utilidades';
import { ESTADO_EVENTO, ESTADO_VOLUNTARIO, EVENTOS, TIPO_EVENTO } from '../modulos.config';
import { FormularioCampos } from '../shared/formulario-campos';
import { Modal } from '../shared/modal';

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const PASOS = ['planificado', 'publicado', 'realizado', 'evaluado'];

@Component({
  selector: 'app-evento-detalle',
  imports: [FormsModule, RouterLink, Modal, FormularioCampos],
  host: { style: '--modulo: var(--c-eventos)' },
  template: `
    <div class="pagina">
      <a class="btn btn-texto mb" routerLink="/eventos"><span class="icono">arrow_back</span> Calendario</a>

      @if (!evento()) {
        <div class="cargando"></div>
      } @else {
        @let e = evento()!;
        <div class="pagina-encabezado">
          <div>
            <h1>{{ e['titulo'] }}</h1>
            <p>
              <span class="icono" style="font-size: 18px">calendar_today</span> {{ fecha(e['fecha']) }}
              {{ e['hora'] ? '· ' + e['hora'] : '' }} {{ e['lugar'] ? '· ' + e['lugar'] : '' }}
            </p>
            <div class="acciones" style="margin-top: 8px">
              <span class="insignia" [class]="op(tipos, e['tipo'])?.color">{{ op(tipos, e['tipo'])?.etiqueta }}</span>
              <span class="insignia" [class]="op(estados, e['estado'])?.color">{{ op(estados, e['estado'])?.etiqueta }}</span>
            </div>
          </div>
          <div class="acciones">
            <button class="btn" type="button" (click)="editar()"><span class="icono">edit</span> Editar</button>
            @if (auth.esAdmin()) {
              <button class="btn btn-peligro" type="button" (click)="eliminar()"><span class="icono">delete</span></button>
            }
          </div>
        </div>

        <!-- Flujo del evento -->
        <ol class="pasos tarjeta mb">
          @for (p of pasos; track p; let i = $index) {
            <li [class.hecho]="indicePaso() >= i" [class.actual]="indicePaso() === i">
              <span class="punto">{{ indicePaso() > i ? '✓' : i + 1 }}</span>
              {{ op(estados, p)?.etiqueta }}
            </li>
          }
        </ol>

        @if (e['descripcion']) {
          <div class="tarjeta mb" style="white-space: pre-line">{{ e['descripcion'] }}</div>
        }

        <div class="rejilla">
          <!-- Publicación -->
          <section class="tarjeta">
            <div class="tarjeta-titulo"><span class="icono">campaign</span> Publicación (Web / Redes)</div>
            <p class="texto-2 pequeno">Comparte el anuncio por WhatsApp o copia el texto para redes sociales.</p>
            <div class="acciones">
              <a class="btn" [href]="enlaceWhatsapp()" target="_blank" rel="noopener"><span class="icono">share</span> WhatsApp</a>
              <button class="btn" type="button" (click)="copiar()"><span class="icono">content_copy</span> Copiar texto</button>
              @if (e['estado'] === 'planificado') {
                <button class="btn btn-primario" type="button" (click)="cambiarEstado('publicado')">Marcar publicado</button>
              }
            </div>
          </section>

          <!-- Evaluación -->
          <section class="tarjeta">
            <div class="tarjeta-titulo"><span class="icono">reviews</span> Evaluación</div>
            <div class="estrellas" role="radiogroup" aria-label="Calificación">
              @for (n of [1, 2, 3, 4, 5]; track n) {
                <button type="button" [class.on]="calificacion() >= n" (click)="calificacion.set(n)" [attr.aria-label]="n + ' estrellas'">★</button>
              }
            </div>
            <div class="campo mt">
              <label for="coment">Comentarios / lecciones aprendidas</label>
              <textarea id="coment" [(ngModel)]="comentarios"></textarea>
            </div>
            <button class="btn btn-primario mt" type="button" (click)="guardarEvaluacion()"><span class="icono">save</span> Guardar evaluación</button>
          </section>
        </div>

        <!-- Inscripción y asistencia -->
        <section class="tarjeta mt">
          <div class="tarjeta-titulo"><span class="icono">how_to_reg</span> {{ e['requiereInscripcion'] ? 'Inscripción y asistencia' : 'Registro de asistencia' }}</div>
          <div class="estadisticas">
            @if (e['requiereInscripcion']) {
              <div class="estadistica">
                <div class="etiqueta">Inscritos</div>
                <div class="valor">{{ inscritos().size }}{{ e['cupo'] ? ' / ' + e['cupo'] : '' }}</div>
              </div>
            }
            <div class="estadistica">
              <div class="etiqueta">Asistentes registrados</div>
              <div class="valor">{{ asistentes().size }}</div>
            </div>
            <div class="estadistica">
              <div class="etiqueta">Total asistencia</div>
              <div class="valor">{{ asistentes().size + (asistenciaExtra || 0) }}</div>
            </div>
          </div>

          <div class="barra-filtros">
            <div class="buscador campo">
              <span class="icono">search</span>
              <input type="search" placeholder="Buscar persona…" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" />
            </div>
            <div class="campo" style="flex: 0 1 200px">
              <input type="number" min="0" inputmode="numeric" [(ngModel)]="asistenciaExtra" placeholder="Otros asistentes" aria-label="Otros asistentes (no registrados)" title="Asistentes no registrados como personas" />
            </div>
          </div>
          <p class="texto-2 pequeno">“Otros asistentes”: cantidad de personas que asistieron pero no están registradas.</p>

          <ul class="lista-personas">
            @for (p of personasFiltradas(); track p.id) {
              <li>
                <span class="nombre">{{ nombre(p) }} <small class="texto-2">{{ p['tipo'] === 'visitante' ? '· visitante' : '' }}</small></span>
                @if (e['requiereInscripcion']) {
                  <label class="check pequeno"><input type="checkbox" [checked]="inscritos().has(p.id)" (change)="alternar(inscritos, p.id)" /> Inscrito</label>
                }
                <label class="check pequeno"><input type="checkbox" [checked]="asistentes().has(p.id)" (change)="alternar(asistentes, p.id)" /> Asistió</label>
              </li>
            } @empty {
              <li class="texto-2">No hay personas registradas. <a routerLink="/personas">Agregar personas</a></li>
            }
          </ul>
          <div class="acciones mt">
            <button class="btn btn-primario" type="button" (click)="guardarAsistencia()" [disabled]="guardando()">
              <span class="icono">save</span> Guardar asistencia
            </button>
            @if (e['estado'] !== 'realizado' && e['estado'] !== 'evaluado') {
              <button class="btn" type="button" (click)="cambiarEstado('realizado')"><span class="icono">task_alt</span> Marcar como realizado</button>
            }
          </div>
        </section>

        <!-- Coordinación de voluntarios -->
        <section class="tarjeta mt" style="--modulo: var(--c-ministerios)">
          <div class="tarjeta-titulo"><span class="icono">handshake</span> Voluntarios asignados</div>
          <ul class="lista-simple">
            @for (v of asignados(); track v.id) {
              <li>
                <span>
                  <strong>{{ nombrePersona(v['personaId']) }}</strong><br />
                  <span class="texto-2 pequeno">{{ nombreMinisterio(v['ministerioId']) }}{{ v['funcion'] ? ' · ' + v['funcion'] : '' }}</span>
                </span>
                <button class="btn btn-icono" type="button" (click)="asignar(v, false)" aria-label="Quitar"><span class="icono rojo-texto">close</span></button>
              </li>
            } @empty {
              <li class="texto-2">Sin voluntarios asignados.</li>
            }
          </ul>
          @if (disponibles().length) {
            <div class="barra-filtros mt">
              <select class="control" [(ngModel)]="voluntarioElegido" aria-label="Voluntario" style="flex: 1">
                <option value="">Elegir voluntario…</option>
                @for (v of disponibles(); track v.id) {
                  <option [value]="v.id">{{ nombrePersona(v['personaId']) }} — {{ nombreMinisterio(v['ministerioId']) }} ({{ op(estadosVol, v['estado'])?.etiqueta }})</option>
                }
              </select>
              <button class="btn btn-primario" type="button" (click)="asignarElegido()" [disabled]="!voluntarioElegido">Asignar</button>
            </div>
          }
        </section>
      }
    </div>

    <app-modal [abierto]="modalAbierto()" titulo="Editar evento" (cerrar)="modalAbierto.set(false)">
      <form id="form-ev" #f="ngForm" (ngSubmit)="guardarEdicion(f.invalid)">
        <app-formulario-campos [campos]="config.campos" [modelo]="borrador" />
      </form>
      <ng-container pie>
        <button class="btn" type="button" (click)="modalAbierto.set(false)">Cancelar</button>
        <button class="btn btn-primario" type="submit" form="form-ev"><span class="icono">save</span> Guardar</button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .pasos {
      list-style: none;
      margin: 0;
      display: flex;
      gap: 4px;
      overflow-x: auto;
      li {
        flex: 1 0 auto;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--texto-2);
        padding-right: 8px;
      }
      .punto {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--superficie-2);
        border: 2px solid var(--borde);
        font-size: 0.8rem;
        flex-shrink: 0;
      }
      .hecho {
        color: var(--modulo);
        .punto {
          background: var(--modulo);
          border-color: var(--modulo);
          color: #fff;
        }
      }
      .actual .punto {
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--modulo) 25%, transparent);
      }
    }
    .estrellas button {
      font-size: 34px;
      line-height: 1;
      border: 0;
      background: none;
      color: var(--borde);
      cursor: pointer;
      padding: 0 2px;
      &.on {
        color: #f5a623;
      }
    }
    .lista-personas {
      list-style: none;
      padding: 0;
      margin: 8px 0 0;
      max-height: 420px;
      overflow-y: auto;
      border: 1px solid var(--borde);
      border-radius: 10px;
      li {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 4px 12px;
        border-bottom: 1px solid var(--borde);
        &:last-child {
          border-bottom: 0;
        }
      }
      .nombre {
        flex: 1;
        font-weight: 500;
      }
    }
  `,
})
export class EventoDetalle {
  readonly id = input.required<string>();

  private api = inject(ApiService);
  private notif = inject(NotificacionesService);
  private router = inject(Router);
  readonly auth = inject(AuthService);

  readonly config = EVENTOS;
  readonly tipos = TIPO_EVENTO;
  readonly estados = ESTADO_EVENTO;
  readonly estadosVol = ESTADO_VOLUNTARIO;
  readonly pasos = PASOS;
  readonly fecha = fechaLarga;
  readonly nombre = nombreCompleto;

  readonly evento = signal<Registro | null>(null);
  readonly personas = signal<Registro[]>([]);
  readonly ministerios = signal<Registro[]>([]);
  readonly voluntarios = signal<Registro[]>([]);
  readonly inscritos = signal(new Set<string>());
  readonly asistentes = signal(new Set<string>());
  readonly calificacion = signal(0);
  readonly busqueda = signal('');
  readonly guardando = signal(false);
  readonly modalAbierto = signal(false);
  comentarios = '';
  asistenciaExtra = 0;
  voluntarioElegido = '';
  borrador: Record<string, any> = {};

  readonly indicePaso = computed(() => PASOS.indexOf(this.evento()?.['estado']));
  readonly personasFiltradas = computed(() => {
    const q = normalizar(this.busqueda().trim());
    const lista = [...this.personas()].sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)));
    return q ? lista.filter((p) => normalizar(nombreCompleto(p)).includes(q)) : lista;
  });
  readonly asignados = computed(() => this.voluntarios().filter((v) => (v['eventosAsignados'] ?? []).includes(this.id())));
  readonly disponibles = computed(() =>
    this.voluntarios().filter(
      (v) => ['asignado', 'capacitacion', 'activo'].includes(v['estado']) && !(v['eventosAsignados'] ?? []).includes(this.id()),
    ),
  );

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.cargar(id));
    });
  }

  private async cargar(id: string) {
    try {
      const [e, personas, ministerios, voluntarios] = await Promise.all([
        this.api.obtener('eventos', id),
        this.api.listar('personas', {}, true),
        this.api.listar('ministerios', {}, true),
        this.api.listar('voluntarios'),
      ]);
      this.aplicar(e);
      this.personas.set(personas);
      this.ministerios.set(ministerios);
      this.voluntarios.set(voluntarios);
    } catch (err) {
      this.notif.error(mensajeError(err));
      this.router.navigate(['/eventos']);
    }
  }

  private aplicar(e: Registro) {
    this.evento.set(e);
    this.inscritos.set(new Set(e['inscritos'] ?? []));
    this.asistentes.set(new Set(e['asistentes'] ?? []));
    this.calificacion.set(e['evaluacionCalificacion'] ?? 0);
    this.comentarios = e['evaluacionComentarios'] ?? '';
    this.asistenciaExtra = e['asistenciaExtra'] ?? 0;
  }

  op(lista: { valor: string; etiqueta: string; color?: string }[], v: string) {
    return lista.find((o) => o.valor === v);
  }

  nombrePersona(id: string) {
    return nombreCompleto(this.personas().find((p) => p.id === id)) || '(persona eliminada)';
  }

  nombreMinisterio(id: string) {
    return this.ministerios().find((m) => m.id === id)?.['nombre'] ?? '';
  }

  alternar(conjunto: typeof this.inscritos, id: string) {
    conjunto.update((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  /** Guarda el evento completo combinando el estado local con los cambios indicados. */
  private async guardar(cambios: Record<string, unknown>, mensaje: string) {
    const e = this.evento();
    if (!e) return;
    this.guardando.set(true);
    try {
      const datos = {
        ...sinMeta(e),
        inscritos: [...this.inscritos()],
        asistentes: [...this.asistentes()],
        asistenciaExtra: Number(this.asistenciaExtra) || 0,
        ...cambios,
      };
      this.aplicar(await this.api.actualizar('eventos', e.id, datos));
      this.notif.exito(mensaje);
    } catch (err) {
      this.notif.error(mensajeError(err));
    } finally {
      this.guardando.set(false);
    }
  }

  guardarAsistencia() {
    const e = this.evento()!;
    if (e['requiereInscripcion'] && e['cupo'] && this.inscritos().size > e['cupo']) {
      this.notif.error(`Se superó el cupo de ${e['cupo']} inscritos`);
      return;
    }
    this.guardar({}, 'Asistencia guardada');
  }

  guardarEvaluacion() {
    this.guardar(
      { evaluacionCalificacion: this.calificacion(), evaluacionComentarios: this.comentarios, estado: 'evaluado' },
      'Evaluación guardada',
    );
  }

  cambiarEstado(estado: string) {
    this.guardar({ estado }, 'Estado actualizado');
  }

  editar() {
    this.borrador = { ...this.evento()! };
    this.modalAbierto.set(true);
  }

  async guardarEdicion(invalido: boolean | null) {
    if (invalido) {
      this.notif.error('Completa el título y la fecha');
      return;
    }
    const cambios = Object.fromEntries(this.config.campos.map((c) => [c.clave, this.borrador[c.clave]]));
    cambios['cupo'] = Number(cambios['cupo']) || 0;
    await this.guardar(cambios, 'Evento actualizado');
    this.modalAbierto.set(false);
  }

  async eliminar() {
    if (!this.notif.confirmar('¿Eliminar este evento?')) return;
    try {
      await this.api.eliminar('eventos', this.id());
      this.notif.exito('Evento eliminado');
      this.router.navigate(['/eventos']);
    } catch (err) {
      this.notif.error(mensajeError(err));
    }
  }

  async asignar(v: Registro, agregar: boolean) {
    const actuales: string[] = v['eventosAsignados'] ?? [];
    const eventosAsignados = agregar ? [...actuales, this.id()] : actuales.filter((x) => x !== this.id());
    try {
      const nuevo = await this.api.actualizar('voluntarios', v.id, { ...sinMeta(v), eventosAsignados });
      this.voluntarios.update((l) => l.map((x) => (x.id === v.id ? nuevo : x)));
      this.voluntarioElegido = '';
    } catch (err) {
      this.notif.error(mensajeError(err));
    }
  }

  asignarElegido() {
    const v = this.voluntarios().find((x) => x.id === this.voluntarioElegido);
    if (v) this.asignar(v, true);
  }

  private textoAnuncio() {
    const e = this.evento()!;
    return [
      `📢 ${e['titulo']}`,
      `📅 ${fechaLarga(e['fecha'])}${e['hora'] ? ' a las ' + e['hora'] : ''}`,
      e['lugar'] ? `📍 ${e['lugar']}` : '',
      e['descripcion'] ? `\n${e['descripcion']}` : '',
      '\n¡Te esperamos! 🙌',
    ]
      .filter(Boolean)
      .join('\n');
  }

  enlaceWhatsapp() {
    return `https://wa.me/?text=${encodeURIComponent(this.textoAnuncio())}`;
  }

  async copiar() {
    try {
      await navigator.clipboard.writeText(this.textoAnuncio());
      this.notif.exito('Texto copiado');
    } catch {
      this.notif.error('No se pudo copiar');
    }
  }
}
