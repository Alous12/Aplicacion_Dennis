import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { mensajeError } from '../core/auth.interceptor';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import type { Registro } from '../core/modelos';
import { NotificacionesService } from '../core/notificaciones.service';
import { fechaLarga, hoy, nombreCompleto } from '../core/utilidades';
import { TIPO_PERSONA } from '../modulos.config';
import { Modal } from '../shared/modal';

interface RegistroAsistencia {
  id: string;
  fecha: string;
  presentes: string[];
  visitas: number;
  total: number;
  notas: string;
}

/**
 * Control de asistencia de las iglesias en el hogar.
 * Con permiso "miembros" se lleva la de todas; con "hogar", solo la propia.
 */
@Component({
  selector: 'app-asistencia',
  imports: [FormsModule, Modal],
  host: { style: '--modulo: var(--c-miembros)' },
  template: `
    <div class="pagina">
      <div class="pagina-encabezado">
        <div>
          <h1><span class="icono">fact_check</span>Asistencia</h1>
          <p>Marca quién asistió a la reunión de la iglesia en el hogar. Si vino alguien nuevo, añádelo a la lista.</p>
        </div>
      </div>

      @if (cargando()) {
        <div class="cargando"></div>
      } @else if (!hogaresDisponibles().length) {
        <div class="tarjeta vacio-estado">
          <span class="icono">cottage</span>
          {{ auth.puede('miembros') ? 'Todavía no hay iglesias en el hogar registradas.' : 'No tienes una iglesia en el hogar asignada. Pide a un administrador que te la asigne.' }}
        </div>
      } @else {
        <div class="barra-filtros">
          @if (hogaresDisponibles().length > 1) {
            <select class="control" [ngModel]="hogarId()" (ngModelChange)="elegirHogar($event)" aria-label="Iglesia en el hogar">
              @for (h of hogaresDisponibles(); track h.id) {
                <option [value]="h.id">{{ h['nombre'] }}</option>
              }
            </select>
          } @else {
            <span class="insignia verde grande"><span class="icono">cottage</span> {{ hogar()?.['nombre'] }}</span>
          }
          <input class="control" type="date" aria-label="Fecha de la reunión" [ngModel]="fecha()" (ngModelChange)="elegirFecha($event)" />
        </div>

        <div class="distribucion">
          <section class="tarjeta">
            <div class="tarjeta-titulo">
              <span class="icono">groups</span> {{ fechaLarga(fecha()) }}
              <span class="espacio"></span>
              <span class="insignia" [class]="registrado() ? 'verde' : 'gris'">{{ registrado() ? 'Guardada' : 'Sin guardar' }}</span>
            </div>

            <div class="estadisticas compactas">
              <div class="estadistica"><div class="etiqueta">Presentes</div><div class="valor">{{ presentes().length }}</div></div>
              <div class="estadistica"><div class="etiqueta">Visitas sin registrar</div><div class="valor">{{ visitas() || 0 }}</div></div>
              <div class="estadistica"><div class="etiqueta">Total</div><div class="valor">{{ presentes().length + (+visitas() || 0) }}</div></div>
            </div>

            @if (!lista().length) {
              <p class="texto-2">Nadie está asignado a esta iglesia en el hogar todavía. Usa "Añadir a alguien más".</p>
            } @else {
              <div class="acciones-lista">
                <button class="btn btn-texto" type="button" (click)="marcarTodos(true)">Marcar todos</button>
                <button class="btn btn-texto" type="button" (click)="marcarTodos(false)">Desmarcar</button>
              </div>
              <ul class="lista-asistencia">
                @for (p of lista(); track p.id) {
                  @let tipo = tipoDe(p['tipo']);
                  <li>
                    <label [class.presente]="presentes().includes(p.id)">
                      <input type="checkbox" [checked]="presentes().includes(p.id)" (change)="alternar(p.id)" />
                      <span class="nombre">{{ nombre(p) }}</span>
                      @if (p['celulaId'] !== hogarId()) {
                        <span class="insignia gris">De otra iglesia</span>
                      }
                      @if (tipo) {
                        <span class="insignia" [class]="tipo.color">{{ tipo.etiqueta }}</span>
                      }
                    </label>
                  </li>
                }
              </ul>
            }

            <button class="btn btn-bloque mt" type="button" (click)="abrirAgregar()"><span class="icono">person_add</span> Añadir a alguien más</button>

            <div class="formulario mt">
              <div class="campo">
                <label for="visitas">Visitas sin registrar</label>
                <input id="visitas" type="number" inputmode="numeric" min="0" [ngModel]="visitas()" (ngModelChange)="visitas.set($event)" />
                <span class="ayuda">Personas que vinieron pero no quieres registrar.</span>
              </div>
              <div class="campo completo">
                <label for="notas">Notas de la reunión</label>
                <textarea id="notas" [ngModel]="notas()" (ngModelChange)="notas.set($event)"></textarea>
              </div>
            </div>

            <div class="acciones mt" style="justify-content: flex-end">
              @if (registrado()) {
                <button class="btn btn-texto" type="button" (click)="eliminar()"><span class="icono rojo-texto">delete</span> Borrar</button>
              }
              <button class="btn btn-primario" type="button" (click)="guardar()" [disabled]="guardando()">
                <span class="icono">save</span> {{ guardando() ? 'Guardando…' : 'Guardar asistencia' }}
              </button>
            </div>
          </section>

          <section class="tarjeta">
            <div class="tarjeta-titulo"><span class="icono">history</span> Reuniones anteriores</div>
            @if (!historial().length) {
              <p class="texto-2">Todavía no hay asistencias guardadas.</p>
            } @else {
              <ul class="lista-simple">
                @for (a of historial(); track a.id) {
                  <li>
                    <button class="btn btn-texto" type="button" (click)="elegirFecha(a.fecha)">{{ fechaLarga(a.fecha) }}</button>
                    <span class="insignia" [class]="a.fecha === fecha() ? 'azul' : 'gris'">{{ a.total }} asistentes</span>
                  </li>
                }
              </ul>
              <p class="texto-2 pequeno mt">Promedio: <strong>{{ promedio() }}</strong> asistentes por reunión.</p>
            }
          </section>
        </div>
      }
    </div>

    <app-modal [abierto]="modalAgregar()" titulo="Añadir a alguien más" (cerrar)="modalAgregar.set(false)">
      <div class="segmentado mb">
        <button type="button" [class.activo]="modo() === 'nueva'" (click)="modo.set('nueva')"><span class="icono">person_add</span> Persona nueva</button>
        <button type="button" [class.activo]="modo() === 'registrada'" (click)="modo.set('registrada')"><span class="icono">person_search</span> Ya registrada</button>
      </div>

      @if (modo() === 'nueva') {
        <form id="form-nueva" #fn="ngForm" (ngSubmit)="crearPersona(fn.invalid)" class="formulario">
          <div class="campo">
            <label for="n-nombre" class="requerido">Nombre</label>
            <input id="n-nombre" name="nombre" [(ngModel)]="nueva.nombre" required />
          </div>
          <div class="campo">
            <label for="n-apellido">Apellido</label>
            <input id="n-apellido" name="apellido" [(ngModel)]="nueva.apellido" />
          </div>
          <div class="campo">
            <label for="n-tel">Teléfono</label>
            <input id="n-tel" name="telefono" type="tel" inputmode="tel" [(ngModel)]="nueva.telefono" />
          </div>
          <div class="campo">
            <label for="n-tipo">Tipo</label>
            <select id="n-tipo" name="tipo" [(ngModel)]="nueva.tipo">
              <option value="visitante">Visitante</option>
              <option value="miembro">Miembro</option>
            </select>
          </div>
          <div class="campo">
            <label for="n-nac">Fecha de nacimiento</label>
            <input id="n-nac" name="fechaNacimiento" type="date" [(ngModel)]="nueva.fechaNacimiento" />
          </div>
          <div class="campo completo">
            <label class="check"><input type="checkbox" name="quedarse" [(ngModel)]="nueva.quedarse" /> Agregar a la lista de esta iglesia en el hogar</label>
          </div>
        </form>
      } @else {
        <div class="campo">
          <label for="buscar-persona">Buscar persona</label>
          <input id="buscar-persona" type="search" placeholder="Nombre o apellido" [ngModel]="buscar()" (ngModelChange)="buscar.set($event)" />
        </div>
        <ul class="lista-simple resultados">
          @for (p of resultados(); track p.id) {
            <li>
              <span>{{ nombre(p) }}</span>
              <button class="btn" type="button" (click)="agregarRegistrada(p)"><span class="icono">add</span> Añadir</button>
            </li>
          } @empty {
            <li class="texto-2">{{ buscar().trim() ? 'Sin resultados.' : 'Escribe para buscar.' }}</li>
          }
        </ul>
      }

      <ng-container pie>
        <button class="btn" type="button" (click)="modalAgregar.set(false)">Cerrar</button>
        @if (modo() === 'nueva') {
          <button class="btn btn-primario" type="submit" form="form-nueva" [disabled]="guardando()"><span class="icono">person_add</span> Registrar y marcar presente</button>
        }
      </ng-container>
    </app-modal>
  `,
  styles: `
    .distribucion {
      display: grid;
      gap: 16px;
      align-items: start;
      @media (min-width: 1000px) {
        grid-template-columns: 1fr 340px;
      }
    }
    .tarjeta-titulo {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .espacio {
      flex: 1;
    }
    .grande {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      font-size: 0.95rem;
    }
    .compactas {
      margin-bottom: 12px;
    }
    .acciones-lista {
      display: flex;
      gap: 4px;
      justify-content: flex-end;
    }
    .lista-asistencia {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
      label {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        min-height: 48px;
        border: 1px solid var(--borde);
        border-radius: 12px;
        cursor: pointer;
        flex-wrap: wrap;
        &.presente {
          border-color: var(--modulo);
          background: color-mix(in srgb, var(--modulo) 8%, transparent);
        }
      }
      input {
        width: 20px;
        height: 20px;
        accent-color: var(--modulo);
      }
      .nombre {
        flex: 1;
        font-weight: 600;
        min-width: 120px;
      }
    }
    .resultados {
      max-height: 50vh;
      overflow-y: auto;
      margin-top: 8px;
    }
  `,
})
export class Asistencia {
  private api = inject(ApiService);
  private notif = inject(NotificacionesService);
  readonly auth = inject(AuthService);

  readonly fechaLarga = fechaLarga;
  readonly nombre = nombreCompleto;

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly hogares = signal<Registro[]>([]);
  readonly personas = signal<Registro[]>([]);
  readonly historial = signal<RegistroAsistencia[]>([]);
  readonly hogarId = signal('');
  readonly fecha = signal(hoy());
  readonly presentes = signal<string[]>([]);
  readonly visitas = signal<number>(0);
  readonly notas = signal('');
  readonly modalAgregar = signal(false);
  readonly modo = signal<'nueva' | 'registrada'>('nueva');
  readonly buscar = signal('');
  nueva = this.nuevaVacia();

  /** Con "miembros" se ven todas; con "hogar", solo la asignada. */
  readonly hogaresDisponibles = computed(() => {
    if (this.auth.puede('miembros')) return this.hogares();
    const propio = this.auth.usuario()?.celulaId;
    return this.hogares().filter((h) => h.id === propio);
  });
  readonly hogar = computed(() => this.hogares().find((h) => h.id === this.hogarId()));
  readonly registrado = computed(() => this.historial().some((a) => a.fecha === this.fecha()));
  /** Integrantes de la iglesia en el hogar + quienes se marcaron presentes viniendo de otra. */
  readonly lista = computed(() => {
    const id = this.hogarId();
    const marcados = new Set(this.presentes());
    return this.personas()
      .filter((p) => p['celulaId'] === id || marcados.has(p.id))
      .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)));
  });
  readonly resultados = computed(() => {
    const q = this.buscar().trim().toLowerCase();
    if (!q) return [];
    const enLista = new Set(this.lista().map((p) => p.id));
    return this.personas()
      .filter((p) => !enLista.has(p.id) && nombreCompleto(p).toLowerCase().includes(q))
      .slice(0, 20);
  });
  readonly promedio = computed(() => {
    const h = this.historial();
    return h.length ? Math.round((h.reduce((s, a) => s + (a.total || 0), 0) / h.length) * 10) / 10 : 0;
  });

  constructor() {
    this.iniciar();
  }

  private async iniciar() {
    try {
      const [hogares, personas] = await Promise.all([this.api.listar('celulas', {}, true), this.api.listar('personas')]);
      this.hogares.set([...hogares].sort((a, b) => String(a['nombre']).localeCompare(String(b['nombre']))));
      this.personas.set(personas);
      const disponibles = this.hogaresDisponibles();
      const propio = this.auth.usuario()?.celulaId;
      const inicial = disponibles.find((h) => h.id === propio) ?? disponibles[0];
      if (inicial) {
        this.hogarId.set(inicial.id);
        await this.cargarHistorial();
      }
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  tipoDe(v: string) {
    return TIPO_PERSONA.find((o) => o.valor === v);
  }

  async elegirHogar(id: string) {
    this.hogarId.set(id);
    await this.cargarHistorial();
  }

  elegirFecha(f: string) {
    if (!f) return;
    this.fecha.set(f);
    this.aplicarRegistro();
  }

  private async cargarHistorial() {
    try {
      this.historial.set(await this.api.get<RegistroAsistencia[]>(`asistencias?celulaId=${encodeURIComponent(this.hogarId())}`));
    } catch (e) {
      this.historial.set([]);
      this.notif.error(mensajeError(e));
    }
    this.aplicarRegistro();
  }

  /** Carga en el formulario lo guardado para la fecha elegida (o lo deja vacío). */
  private aplicarRegistro() {
    const r = this.historial().find((a) => a.fecha === this.fecha());
    this.presentes.set(r ? [...r.presentes] : []);
    this.visitas.set(r?.visitas ?? 0);
    this.notas.set(r?.notas ?? '');
  }

  alternar(id: string) {
    this.presentes.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  }

  marcarTodos(marcar: boolean) {
    const id = this.hogarId();
    const deOtra = this.presentes().filter((p) => this.personas().find((x) => x.id === p)?.['celulaId'] !== id);
    this.presentes.set(marcar ? [...new Set([...deOtra, ...this.lista().map((p) => p.id)])] : []);
  }

  async guardar() {
    this.guardando.set(true);
    try {
      const r = await this.api.put<RegistroAsistencia>(`asistencias/${encodeURIComponent(this.hogarId())}/${this.fecha()}`, {
        presentes: this.presentes(),
        visitas: Number(this.visitas()) || 0,
        notas: this.notas(),
      });
      this.historial.update((l) => [r, ...l.filter((a) => a.fecha !== r.fecha)].sort((a, b) => b.fecha.localeCompare(a.fecha)));
      this.notif.exito(`Asistencia guardada: ${r.total} asistentes`);
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar() {
    if (!this.notif.confirmar(`¿Borrar la asistencia del ${fechaLarga(this.fecha())}?`)) return;
    try {
      await this.api.borrar(`asistencias/${encodeURIComponent(this.hogarId())}/${this.fecha()}`);
      this.historial.update((l) => l.filter((a) => a.fecha !== this.fecha()));
      this.aplicarRegistro();
      this.notif.exito('Asistencia borrada');
    } catch (e) {
      this.notif.error(mensajeError(e));
    }
  }

  // ───────── Añadir a alguien más ─────────
  private nuevaVacia() {
    return { nombre: '', apellido: '', telefono: '', tipo: 'visitante', fechaNacimiento: '', quedarse: true };
  }

  abrirAgregar() {
    this.nueva = this.nuevaVacia();
    this.buscar.set('');
    this.modo.set('nueva');
    this.modalAgregar.set(true);
  }

  agregarRegistrada(p: Registro) {
    if (!this.presentes().includes(p.id)) this.presentes.update((l) => [...l, p.id]);
    this.notif.exito(`${nombreCompleto(p)} marcado presente. Recuerda guardar la asistencia.`);
    this.modalAgregar.set(false);
  }

  async crearPersona(invalido: boolean | null) {
    if (invalido) {
      this.notif.error('Escribe al menos el nombre');
      return;
    }
    this.guardando.set(true);
    try {
      const { quedarse, ...datos } = this.nueva;
      const p = await this.api.crear('personas', {
        ...datos,
        etapa: datos.tipo === 'visitante' ? 'seguimiento_visitante' : 'integracion_celula',
        celulaId: quedarse ? this.hogarId() : '',
        fechaRegistro: this.fecha(),
        notas: `Registrado en la asistencia de ${this.hogar()?.['nombre'] ?? 'la iglesia en el hogar'}.`,
      });
      this.personas.update((l) => [...l, p]);
      this.presentes.update((l) => [...l, p.id]);
      this.modalAgregar.set(false);
      this.notif.exito(`${nombreCompleto(p)} registrado y marcado presente. Recuerda guardar la asistencia.`);
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
