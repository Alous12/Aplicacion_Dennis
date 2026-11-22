import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { mensajeError } from '../core/auth.interceptor';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import type { Registro } from '../core/modelos';
import { NotificacionesService } from '../core/notificaciones.service';
import { Modal } from '../shared/modal';
import type { Categoria } from './roles';

interface UsuarioApp {
  id: string;
  email: string;
  nombre: string;
  rol: 'admin' | 'usuario';
  estado: 'pendiente' | 'activo' | 'inactivo';
  celulaId: string;
  categoriaId: string;
  proveedores: string[];
  creadoEn: string | null;
  ultimoAcceso: string | null;
}

/**
 * Cuentas de la aplicación (permiso "usuarios").
 * Se crean con contraseña, se aprueban las que se registran solas y se asigna la iglesia en el hogar.
 * La categoría (que define los permisos) solo la asigna el administrador.
 */
@Component({
  selector: 'app-usuarios',
  imports: [FormsModule, Modal, RouterLink],
  host: { style: '--modulo: var(--c-admin)' },
  template: `
    <div class="pagina">
      <div class="pagina-encabezado">
        <div>
          <h1><span class="icono">manage_accounts</span>Usuarios</h1>
          <p>
            Crea cuentas con contraseña, aprueba las que se registran solas y asigna a cada persona su categoría e iglesia en el hogar.
            @if (auth.esAdmin()) {
              Lo que puede hacer cada categoría se define en <a routerLink="/roles">Roles y permisos</a>.
            }
          </p>
        </div>
        <div class="acciones">
          <button class="btn btn-primario" type="button" (click)="abrirNuevo()"><span class="icono">person_add</span> Nuevo usuario</button>
        </div>
      </div>

      <div class="barra-filtros">
        <div class="chips" style="margin: 0">
          @for (f of filtrosEstado; track f.valor) {
            <button type="button" class="chip" [class.activo]="filtro() === f.valor" (click)="filtro.set(f.valor)">
              {{ f.etiqueta }}<span class="num">{{ conteo()[f.valor] ?? 0 }}</span>
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
                <th>Categoría</th>
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
                  <td data-label="Categoría">
                    @if (u.rol === 'admin') {
                      <span class="insignia morado">Administrador</span>
                    } @else if (auth.esAdmin()) {
                      <select class="control" [value]="u.categoriaId" (change)="cambiarCategoria(u, $any($event.target))" aria-label="Categoría">
                        <option value="">— Sin categoría —</option>
                        @for (c of categorias(); track c.id) {
                          <option [value]="c.id" [selected]="c.id === u.categoriaId">{{ c.nombre }}</option>
                        }
                      </select>
                    } @else {
                      <span class="insignia gris">{{ nombreCategoria(u.categoriaId) || 'Sin categoría' }}</span>
                    }
                  </td>
                  <td data-label="Iglesia en el hogar">
                    @if (editable || (auth.esAdmin() && u.rol !== 'admin')) {
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
        Los permisos cambian al instante. Si desactivas a alguien, pierde sus permisos de inmediato y su sesión termina al caducar (máx. 12 h).
        @if (!auth.esAdmin()) {
          Solo un administrador puede modificar a usuarios que tienen permisos.
        }
      </p>
    </div>

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
        @if (auth.esAdmin()) {
          <div class="campo">
            <label for="u-cat">Categoría</label>
            <select id="u-cat" name="categoriaId" [(ngModel)]="nuevo.categoriaId">
              <option value="">— Sin categoría —</option>
              @for (c of categorias(); track c.id) {
                <option [value]="c.id">{{ c.nombre }}</option>
              }
            </select>
          </div>
        }
        <div class="campo" [class.completo]="!auth.esAdmin()">
          <label for="u-hogar">Iglesia en el hogar</label>
          <select id="u-hogar" name="celulaId" [(ngModel)]="nuevo.celulaId">
            <option value="">— Ninguna —</option>
            @for (c of hogares(); track c.id) {
              <option [value]="c.id">{{ c['nombre'] }}</option>
            }
          </select>
        </div>
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
  `,
})
export class Usuarios {
  private api = inject(ApiService);
  private notif = inject(NotificacionesService);
  readonly auth = inject(AuthService);

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
  readonly verClave = signal(false);
  readonly usuarioClave = signal<UsuarioApp | null>(null);
  nuevo = this.nuevoVacio();
  claveNueva = '';

  readonly conteo = computed(() => {
    const c: Record<string, number> = { todos: this.usuarios().length };
    for (const u of this.usuarios()) c[u.estado] = (c[u.estado] ?? 0) + 1;
    return c;
  });
  readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.usuarios()
      .filter((u) => this.filtro() === 'todos' || u.estado === this.filtro())
      .filter((u) => !q || `${u.nombre} ${u.email}`.toLowerCase().includes(q))
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
      this.usuarios.set(lista);
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
    if (u.id === this.auth.usuario()?.sub) return false;
    return !(this.categorias().find((c) => c.id === u.categoriaId)?.permisos.length ?? 0);
  }

  nombreCategoria(id: string) {
    return this.categorias().find((c) => c.id === id)?.nombre ?? '';
  }

  nombreHogar(id: string) {
    return String(this.hogares().find((c) => c.id === id)?.['nombre'] ?? '');
  }

  fecha(iso: string) {
    return new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
  }

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
      const { categoriaId, ...resto } = this.nuevo;
      // La categoría solo la envía el administrador (el servidor lo vuelve a comprobar).
      const creado = (await this.api.crear('usuarios', this.auth.esAdmin() ? { ...resto, categoriaId } : resto)) as unknown as UsuarioApp;
      const u: UsuarioApp = { ...creado, proveedores: ['password'], creadoEn: null, ultimoAcceso: null };
      this.usuarios.update((l) => [...l.filter((x) => x.id !== u.id), u]);
      this.filtro.set('todos');
      this.modalNuevo.set(false);
      this.notif.exito(`Cuenta de ${this.nuevo.nombre} creada. Ya puede ingresar con su correo y contraseña.`);
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

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
}
