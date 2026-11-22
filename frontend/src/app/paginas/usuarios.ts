import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { mensajeError } from '../core/auth.interceptor';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import type { Registro } from '../core/modelos';
import { NotificacionesService } from '../core/notificaciones.service';
import { etiquetaPermiso, PERMISOS, type Permiso } from '../core/permisos';
import { Modal } from '../shared/modal';

/** Categoría del integrante (Pastor, Diácono, Líder…): solo un identificador, no da permisos. */
export interface Categoria {
  id: string;
  nombre: string;
  orden: number;
}

interface UsuarioApp {
  id: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'usuario';
  estado: 'pendiente' | 'activo' | 'inactivo';
  celulaId: string;
  categoriaId: string;
  permisos: Permiso[];
  proveedores: string[];
  creadoEn: string | null;
  ultimoAcceso: string | null;
}

/**
 * Cuentas de la aplicación (permiso "usuarios").
 * Se crean con contraseña, se aprueban las que se registran solas y se asigna categoría e iglesia en el hogar.
 * Los PERMISOS se configuran a cada persona (independientes de su categoría) y solo los cambia el administrador.
 */
@Component({
  selector: 'app-usuarios',
  imports: [FormsModule, Modal],
  host: { style: '--modulo: var(--c-admin)' },
  template: `
    <div class="pagina">
      <div class="pagina-encabezado">
        <div>
          <h1><span class="icono">manage_accounts</span>Usuarios</h1>
          <p>
            Crea cuentas con contraseña, aprueba las que se registran solas y asigna a cada persona su categoría e iglesia en el hogar.
            @if (auth.esAdmin()) {
              Con <strong>Permisos</strong> eliges qué puede controlar cada uno, sin importar su categoría.
            }
          </p>
        </div>
        <div class="acciones">
          <button class="btn" type="button" (click)="modalCategorias.set(true)"><span class="icono">sell</span> Categorías</button>
          <button class="btn btn-primario" type="button" (click)="abrirNuevo()"><span class="icono">person_add</span> Nuevo usuario</button>
        </div>
      </div>

      <div class="barra-filtros">
        <div class="chips" style="margin: 0">
          @for (f of filtrosEstado; track f.valor) {
            <button type="button" class="chip" [class.activo]="filtro() === f.valor" (click)="filtro.set(f.valor)">
              {{ f.etiqueta }}<span class="num">{{ conteo()[f.valor] || 0 }}</span>
            </button>
          }
        </div>
        <div class="buscador campo">
          <span class="icono">search</span>
          <input type="search" placeholder="Buscar…" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" />
        </div>
      </div>

      @if (cargando()) {
        <div class="cargando"></div>
      } @else if (!filtrados().length) {
        <div class="tarjeta vacio-estado"><span class="icono">person_off</span>No hay usuarios en esta categoría.</div>
      } @else {
        <div class="tabla-contenedor">
          <table class="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Categoría y permisos</th>
                <th>Iglesia en el hogar</th>
                <th>Estado</th>
                <th>Último acceso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (u of filtrados(); track u.id) {
                @let editable = modificable(u);
                <tr>
                  <td class="principal" data-label="Nombre">{{ u.nombre }}</td>
                  <td data-label="Correo">{{ u.email }}</td>
                  <td data-label="Categoría y permisos">
                    @if (u.rol === 'admin') {
                      <span class="insignia morado">Administrador · todos los permisos</span>
                    } @else {
                      <div class="categoria-permisos">
                        @if (editable) {
                          <select class="control" [value]="u.categoriaId" (change)="cambiarCategoria(u, $any($event.target))" aria-label="Categoría">
                            <option value="">— Sin categoría —</option>
                            @for (c of categorias(); track c.id) {
                              <option [value]="c.id" [selected]="c.id === u.categoriaId">{{ c.nombre }}</option>
                            }
                          </select>
                        } @else {
                          <span class="insignia gris">{{ nombreCategoria(u.categoriaId) || 'Sin categoría' }}</span>
                        }
                        @if (auth.esAdmin()) {
                          <button class="btn" type="button" (click)="abrirPermisos(u)" [title]="resumenPermisos(u)">
                            <span class="icono">tune</span> Permisos
                            <span class="contador" [class.lleno]="u.permisos.length">{{ u.permisos.length === total ? 'todos' : u.permisos.length }}</span>
                          </button>
                        } @else if (u.permisos.length) {
                          <span class="insignia azul" [title]="resumenPermisos(u)">{{ u.permisos.length }} permiso(s)</span>
                        }
                      </div>
                    }
                  </td>
                  <td data-label="Iglesia en el hogar">
                    @if (editable) {
                      <select class="control" [value]="u.celulaId" (change)="asignarHogar(u, $any($event.target))" aria-label="Iglesia en el hogar">
                        <option value="">— Ninguna —</option>
                        @for (c of hogares(); track c.id) {
                          <option [value]="c.id" [selected]="c.id === u.celulaId">{{ c['nombre'] }}</option>
                        }
                      </select>
                    } @else {
                      {{ nombreHogar(u.celulaId) }}
                    }
                  </td>
                  <td data-label="Estado">
                    <span class="insignia" [class]="u.estado === 'activo' ? 'verde' : u.estado === 'pendiente' ? 'ambar' : 'rojo'">{{ u.estado }}</span>
                  </td>
                  <td data-label="Último acceso">{{ u.ultimoAcceso ? fecha(u.ultimoAcceso) : 'Nunca' }}</td>
                  <td class="acciones-celda">
                    @if (editable) {
                      @if (u.estado !== 'activo') {
                        <button class="btn btn-primario" type="button" (click)="cambiarEstado(u, 'activo')"><span class="icono">check</span> Aprobar</button>
                      } @else {
                        <button class="btn" type="button" (click)="cambiarEstado(u, 'inactivo')"><span class="icono">block</span> Desactivar</button>
                      }
                      <button class="btn btn-icono" type="button" (click)="abrirClave(u)" title="Cambiar contraseña" aria-label="Cambiar contraseña">
                        <span class="icono">key</span>
                      </button>
                      <button class="btn btn-icono" type="button" (click)="eliminar(u)" title="Eliminar" aria-label="Eliminar usuario">
                        <span class="icono rojo-texto">delete</span>
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <p class="texto-2 pequeno mt">
        La categoría solo identifica el cargo; lo que cada persona puede hacer se define en sus permisos. Los cambios aplican al instante.
        Si desactivas a alguien, pierde sus permisos de inmediato y su sesión termina al caducar (máx. 12 h).
        @if (!auth.esAdmin()) {
          Solo un administrador puede dar permisos o modificar a usuarios que tienen permisos.
        }
      </p>
    </div>

    <!-- Permisos de un usuario (solo admin) -->
    <app-modal [abierto]="!!usuarioPermisos()" [titulo]="'Permisos de ' + (usuarioPermisos()?.nombre ?? '')" (cerrar)="usuarioPermisos.set(null)">
      @if (usuarioPermisos(); as u) {
        <p class="texto-2 pequeno" style="margin-top: 0">
          Categoría: <strong>{{ nombreCategoria(u.categoriaId) || 'sin categoría' }}</strong>. Marca lo que esta persona podrá controlar
          además de las funciones básicas (ver la información y registrar personas, eventos, voluntarios, reservas, mantenimientos y ventas).
        </p>
      }
      <div class="permisos-titulo">
        <strong>¿Qué puede controlar?</strong>
        <span class="espacio"></span>
        <button class="btn btn-texto" type="button" (click)="todosPermisos(true)">Marcar todo</button>
        <button class="btn btn-texto" type="button" (click)="todosPermisos(false)">Quitar todo</button>
      </div>
      <div class="permisos">
        @for (p of catalogo; track p.clave) {
          <label class="permiso" [class.marcado]="permisosBorrador().includes(p.clave)">
            <input type="checkbox" [checked]="permisosBorrador().includes(p.clave)" (change)="alternarPermiso(p.clave)" />
            <span class="icono">{{ p.icono }}</span>
            <span>
              <strong>{{ p.etiqueta }}</strong>
              <small>{{ p.descripcion }}</small>
            </span>
          </label>
        }
      </div>
      <ng-container pie>
        <button class="btn" type="button" (click)="usuarioPermisos.set(null)">Cancelar</button>
        <button class="btn btn-primario" type="button" (click)="guardarPermisos()" [disabled]="guardando()">
          <span class="icono">save</span> {{ guardando() ? 'Guardando…' : 'Guardar permisos' }}
        </button>
      </ng-container>
    </app-modal>

    <!-- Categorías (identificadores) -->
    <app-modal [abierto]="modalCategorias()" titulo="Categorías" (cerrar)="modalCategorias.set(false)">
      <p class="texto-2 pequeno" style="margin-top: 0">Identifican el cargo de cada integrante (Pastor, Diácono, Líder…). No dan permisos.</p>
      <ul class="lista-categorias">
        @for (c of categorias(); track c.id) {
          <li>
            <input class="control" [value]="c.nombre" (change)="renombrarCategoria(c, $any($event.target))" [attr.aria-label]="'Nombre de ' + c.nombre" maxlength="60" />
            <span class="texto-2 pequeno">{{ usosCategoria()[c.id] || 0 }} usuario(s)</span>
            <button class="btn btn-icono" type="button" (click)="eliminarCategoria(c)" [attr.aria-label]="'Eliminar ' + c.nombre" title="Eliminar">
              <span class="icono rojo-texto">delete</span>
            </button>
          </li>
        }
      </ul>
      <form class="nueva-categoria" (ngSubmit)="crearCategoria()">
        <input class="control" name="nuevaCategoria" [(ngModel)]="nuevaCategoria" placeholder="Nueva categoría (p. ej. Subadmin)" maxlength="60" />
        <button class="btn btn-primario" type="submit" [disabled]="nuevaCategoria.trim().length < 2"><span class="icono">add</span> Agregar</button>
      </form>
      <ng-container pie>
        <button class="btn" type="button" (click)="modalCategorias.set(false)">Listo</button>
      </ng-container>
    </app-modal>

    <!-- Nuevo usuario -->
    <app-modal [abierto]="modalNuevo()" titulo="Nuevo usuario" (cerrar)="modalNuevo.set(false)">
      <form id="form-usuario" #f="ngForm" (ngSubmit)="crear(f.invalid)" class="formulario">
        <div class="campo completo">
          <label for="u-nombre" class="requerido">Nombre completo</label>
          <input id="u-nombre" name="nombre" [(ngModel)]="nuevo.nombre" required minlength="2" autocomplete="off" />
        </div>
        <div class="campo completo">
          <label for="u-email" class="requerido">Correo</label>
          <input id="u-email" name="email" type="email" inputmode="email" [(ngModel)]="nuevo.email" required email autocomplete="off" />
          <span class="ayuda">Con este correo ingresará (también puede entrar con Google si es una cuenta de Gmail).</span>
        </div>
        <div class="campo completo">
          <label for="u-clave" class="requerido">Contraseña</label>
          <div class="con-boton">
            <input id="u-clave" name="password" [type]="verClave() ? 'text' : 'password'" [(ngModel)]="nuevo.password" required minlength="8" autocomplete="new-password" />
            <button class="btn btn-icono" type="button" (click)="verClave.set(!verClave())" [attr.aria-label]="verClave() ? 'Ocultar' : 'Mostrar'">
              <span class="icono">{{ verClave() ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
          <span class="ayuda">Mínimo 8 caracteres. Entrégasela a la persona; podrá cambiarla en "Mi perfil".</span>
        </div>
        <div class="campo">
          <label for="u-cat">Categoría</label>
          <select id="u-cat" name="categoriaId" [(ngModel)]="nuevo.categoriaId">
            <option value="">— Sin categoría —</option>
            @for (c of categorias(); track c.id) {
              <option [value]="c.id">{{ c.nombre }}</option>
            }
          </select>
        </div>
        <div class="campo">
          <label for="u-hogar">Iglesia en el hogar</label>
          <select id="u-hogar" name="celulaId" [(ngModel)]="nuevo.celulaId">
            <option value="">— Ninguna —</option>
            @for (c of hogares(); track c.id) {
              <option [value]="c.id">{{ c['nombre'] }}</option>
            }
          </select>
        </div>
        @if (auth.esAdmin()) {
          <p class="completo texto-2 pequeno" style="margin: 0">Al crear la cuenta se abrirá el panel para configurar sus permisos.</p>
        }
      </form>
      <ng-container pie>
        <button class="btn" type="button" (click)="modalNuevo.set(false)">Cancelar</button>
        <button class="btn btn-primario" type="submit" form="form-usuario" [disabled]="guardando()">
          <span class="icono">person_add</span> {{ guardando() ? 'Creando…' : 'Crear usuario' }}
        </button>
      </ng-container>
    </app-modal>

    <!-- Cambiar contraseña de otro usuario -->
    <app-modal [abierto]="!!usuarioClave()" [titulo]="'Contraseña de ' + (usuarioClave()?.nombre ?? '')" (cerrar)="usuarioClave.set(null)">
      <form id="form-clave" #fc="ngForm" (ngSubmit)="guardarClave(fc.invalid)" class="formulario">
        <div class="campo completo">
          <label for="c-nueva" class="requerido">Nueva contraseña</label>
          <input id="c-nueva" name="clave" type="text" [(ngModel)]="claveNueva" required minlength="8" autocomplete="new-password" />
          <span class="ayuda">Mínimo 8 caracteres. Entrégasela a la persona.</span>
        </div>
      </form>
      <ng-container pie>
        <button class="btn" type="button" (click)="usuarioClave.set(null)">Cancelar</button>
        <button class="btn btn-primario" type="submit" form="form-clave" [disabled]="guardando()"><span class="icono">key</span> Guardar</button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .con-boton {
      display: flex;
      gap: 4px;
      input {
        flex: 1;
      }
    }
    .barra-filtros {
      align-items: center;
    }
    .categoria-permisos {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
      select {
        min-width: 140px;
      }
    }
    .contador {
      min-width: 20px;
      padding: 0 6px;
      border-radius: 999px;
      font-size: 0.75rem;
      background: var(--superficie-2);
      color: var(--texto-2);
      &.lleno {
        background: var(--modulo);
        color: #fff;
      }
    }
    .espacio {
      flex: 1;
    }
    .permisos-titulo {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }
    .permisos {
      display: grid;
      gap: 8px;
      @media (min-width: 700px) {
        grid-template-columns: 1fr 1fr;
      }
    }
    .permiso {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid var(--borde);
      border-radius: 12px;
      cursor: pointer;
      min-height: 44px;
      input {
        margin-top: 3px;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        accent-color: var(--modulo);
      }
      .icono {
        color: var(--texto-2);
      }
      strong,
      small {
        display: block;
      }
      small {
        color: var(--texto-2);
        line-height: 1.35;
      }
      &.marcado {
        border-color: var(--modulo);
        background: color-mix(in srgb, var(--modulo) 8%, transparent);
        .icono {
          color: var(--modulo);
        }
      }
    }
    .lista-categorias {
      list-style: none;
      margin: 0 0 12px;
      padding: 0;
      display: grid;
      gap: 6px;
      li {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      input {
        flex: 1;
        min-width: 0;
      }
    }
    .nueva-categoria {
      display: flex;
      gap: 8px;
      input {
        flex: 1;
        min-width: 0;
      }
    }
  `,
})
export class Usuarios {
  private api = inject(ApiService);
  private notif = inject(NotificacionesService);
  readonly auth = inject(AuthService);

  readonly catalogo = PERMISOS;
  readonly total = PERMISOS.length;
  readonly filtrosEstado = [
    { valor: 'pendiente', etiqueta: 'Pendientes' },
    { valor: 'activo', etiqueta: 'Activos' },
    { valor: 'inactivo', etiqueta: 'Inactivos' },
    { valor: 'todos', etiqueta: 'Todos' },
  ];
  readonly usuarios = signal<UsuarioApp[]>([]);
  readonly hogares = signal<Registro[]>([]);
  readonly categorias = signal<Categoria[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly filtro = signal('pendiente');
  readonly busqueda = signal('');
  readonly modalNuevo = signal(false);
  readonly modalCategorias = signal(false);
  readonly verClave = signal(false);
  readonly usuarioClave = signal<UsuarioApp | null>(null);
  readonly usuarioPermisos = signal<UsuarioApp | null>(null);
  readonly permisosBorrador = signal<Permiso[]>([]);
  nuevo = this.nuevoVacio();
  claveNueva = '';
  nuevaCategoria = '';

  readonly conteo = computed(() => {
    const c: Record<string, number> = { todos: this.usuarios().length };
    for (const u of this.usuarios()) c[u.estado] = (c[u.estado] ?? 0) + 1;
    return c;
  });
  readonly usosCategoria = computed(() => {
    const c: Record<string, number> = {};
    for (const u of this.usuarios()) if (u.categoriaId) c[u.categoriaId] = (c[u.categoriaId] ?? 0) + 1;
    return c;
  });
  readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.usuarios()
      .filter((u) => this.filtro() === 'todos' || u.estado === this.filtro())
      .filter((u) => !q || `${u.nombre} ${u.email} ${this.nombreCategoria(u.categoriaId)}`.toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  constructor() {
    this.cargar();
  }

  async cargar() {
    try {
      const [lista, hogares, categorias] = await Promise.all([
        this.api.get<UsuarioApp[]>('usuarios'),
        this.api.listar('celulas', {}, true).catch(() => [] as Registro[]),
        this.api.get<Categoria[]>('categorias').catch(() => [] as Categoria[]),
      ]);
      this.hogares.set([...hogares].sort((a, b) => String(a['nombre']).localeCompare(String(b['nombre']))));
      this.categorias.set(categorias);
      this.usuarios.set(lista.map((u) => ({ ...u, permisos: u.permisos ?? [] })));
      if (!lista.some((u) => u.estado === 'pendiente')) this.filtro.set('todos');
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  private nuevoVacio() {
    return { nombre: '', email: '', password: '', categoriaId: '', celulaId: '' };
  }

  /** Igual que en el backend: nadie toca a un admin; quien no es admin no toca a usuarios con permisos ni a sí mismo. */
  modificable(u: UsuarioApp): boolean {
    if (u.rol === 'admin') return false;
    if (this.auth.esAdmin()) return true;
    return u.id !== this.auth.usuario()?.sub && !u.permisos.length;
  }

  nombreCategoria(id: string) {
    return this.categorias().find((c) => c.id === id)?.nombre ?? '';
  }

  nombreHogar(id: string) {
    return String(this.hogares().find((c) => c.id === id)?.['nombre'] ?? '');
  }

  resumenPermisos(u: UsuarioApp) {
    if (!u.permisos.length) return 'Solo funciones básicas';
    return u.permisos.map(etiquetaPermiso).join(', ');
  }

  fecha(iso: string) {
    return new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
  }

  // ───────── Crear ─────────
  abrirNuevo() {
    this.nuevo = this.nuevoVacio();
    this.verClave.set(false);
    this.modalNuevo.set(true);
  }

  async crear(invalido: boolean | null) {
    if (invalido) {
      this.notif.error('Revisa el nombre, el correo y la contraseña (mínimo 8 caracteres)');
      return;
    }
    this.guardando.set(true);
    try {
      const creado = (await this.api.crear('usuarios', this.nuevo)) as unknown as UsuarioApp;
      const u: UsuarioApp = { ...creado, permisos: creado.permisos ?? [], proveedores: ['password'], creadoEn: null, ultimoAcceso: null };
      this.usuarios.update((l) => [...l.filter((x) => x.id !== u.id), u]);
      this.filtro.set('todos');
      this.modalNuevo.set(false);
      this.notif.exito(`Cuenta de ${u.nombre} creada. Ya puede ingresar con su correo y contraseña.`);
      if (this.auth.esAdmin()) this.abrirPermisos(u);
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  // ───────── Permisos (solo admin) ─────────
  abrirPermisos(u: UsuarioApp) {
    this.permisosBorrador.set([...u.permisos]);
    this.usuarioPermisos.set(u);
  }

  alternarPermiso(p: Permiso) {
    this.permisosBorrador.update((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]));
  }

  todosPermisos(marcar: boolean) {
    this.permisosBorrador.set(marcar ? PERMISOS.map((p) => p.clave) : []);
  }

  async guardarPermisos() {
    const u = this.usuarioPermisos();
    if (!u) return;
    this.guardando.set(true);
    try {
      const r = await this.api.put<{ permisos: Permiso[] }>(`usuarios/${encodeURIComponent(u.id)}/permisos`, {
        permisos: this.permisosBorrador(),
      });
      this.usuarios.update((l) => l.map((x) => (x.id === u.id ? { ...x, permisos: r.permisos } : x)));
      this.usuarioPermisos.set(null);
      this.notif.exito(
        r.permisos.length ? `${u.nombre}: ${r.permisos.length} permiso(s) guardados` : `${u.nombre} queda solo con las funciones básicas`,
      );
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  // ───────── Cambios en la fila ─────────
  private async actualizar(u: UsuarioApp, cambios: Partial<UsuarioApp>, mensaje: string, control?: HTMLSelectElement, anterior = '') {
    try {
      await this.api.patch(`usuarios/${encodeURIComponent(u.id)}`, cambios);
      this.usuarios.update((l) => l.map((x) => (x.id === u.id ? { ...x, ...cambios } : x)));
      this.notif.exito(mensaje);
    } catch (e) {
      this.notif.error(mensajeError(e));
      // Si el servidor rechazó el cambio, el selector vuelve a mostrar el valor real.
      if (control) control.value = anterior;
    }
  }

  cambiarEstado(u: UsuarioApp, estado: UsuarioApp['estado']) {
    return this.actualizar(u, { estado }, estado === 'activo' ? `${u.nombre} aprobado` : `${u.nombre} desactivado`);
  }

  cambiarCategoria(u: UsuarioApp, control: HTMLSelectElement) {
    const categoriaId = control.value;
    const nombre = this.nombreCategoria(categoriaId);
    const mensaje = nombre ? `${u.nombre} ahora es ${nombre}` : `${u.nombre} ya no tiene categoría`;
    return this.actualizar(u, { categoriaId }, mensaje, control, u.categoriaId);
  }

  asignarHogar(u: UsuarioApp, control: HTMLSelectElement) {
    const celulaId = control.value;
    const hogar = this.nombreHogar(celulaId);
    const mensaje = hogar ? `${u.nombre} asignado a ${hogar}` : `${u.nombre} ya no tiene iglesia en el hogar`;
    return this.actualizar(u, { celulaId }, mensaje, control, u.celulaId);
  }

  // ───────── Contraseña y eliminación ─────────
  abrirClave(u: UsuarioApp) {
    this.claveNueva = '';
    this.usuarioClave.set(u);
  }

  async guardarClave(invalido: boolean | null) {
    const u = this.usuarioClave();
    if (!u) return;
    if (invalido) {
      this.notif.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    this.guardando.set(true);
    try {
      await this.api.put(`usuarios/${encodeURIComponent(u.id)}/password`, { password: this.claveNueva });
      this.usuarioClave.set(null);
      this.notif.exito(`Contraseña de ${u.nombre} actualizada`);
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(u: UsuarioApp) {
    if (!this.notif.confirmar(`¿Eliminar la cuenta de ${u.nombre}?`)) return;
    try {
      await this.api.borrar(`usuarios/${encodeURIComponent(u.id)}`);
      this.usuarios.update((l) => l.filter((x) => x.id !== u.id));
      this.notif.exito('Usuario eliminado');
    } catch (e) {
      this.notif.error(mensajeError(e));
    }
  }

  // ───────── Categorías ─────────
  async crearCategoria() {
    const nombre = this.nuevaCategoria.trim();
    if (nombre.length < 2) return;
    try {
      const c = (await this.api.crear('categorias', { nombre })) as unknown as Categoria;
      this.categorias.update((l) => [...l, c]);
      this.nuevaCategoria = '';
      this.notif.exito(`Categoría "${nombre}" creada`);
    } catch (e) {
      this.notif.error(mensajeError(e));
    }
  }

  async renombrarCategoria(c: Categoria, control: HTMLInputElement) {
    const nombre = control.value.trim();
    if (nombre === c.nombre) return;
    if (nombre.length < 2) {
      control.value = c.nombre;
      this.notif.error('El nombre es muy corto');
      return;
    }
    try {
      await this.api.put(`categorias/${c.id}`, { nombre });
      this.categorias.update((l) => l.map((x) => (x.id === c.id ? { ...x, nombre } : x)));
      this.notif.exito('Categoría renombrada');
    } catch (e) {
      control.value = c.nombre;
      this.notif.error(mensajeError(e));
    }
  }

  async eliminarCategoria(c: Categoria) {
    if (!this.notif.confirmar(`¿Eliminar la categoría "${c.nombre}"?`)) return;
    try {
      await this.api.borrar(`categorias/${c.id}`);
      this.categorias.update((l) => l.filter((x) => x.id !== c.id));
      this.notif.exito('Categoría eliminada');
    } catch (e) {
      this.notif.error(mensajeError(e));
    }
  }
}
