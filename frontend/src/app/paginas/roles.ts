import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { mensajeError } from '../core/auth.interceptor';
import { ApiService } from '../core/api.service';
import { NotificacionesService } from '../core/notificaciones.service';
import { etiquetaPermiso, PERMISOS, type Permiso } from '../core/permisos';
import { Modal } from '../shared/modal';

export interface Categoria {
  id: string;
  nombre: string;
  descripcion: string;
  permisos: Permiso[];
  orden: number;
}

interface Borrador {
  id?: string;
  nombre: string;
  descripcion: string;
  permisos: Permiso[];
}

/**
 * Solo administrador: categorías (roles) de los integrantes y lo que puede controlar cada una.
 * Ejemplos: Pastor, Anciano, Diácono, Líder, Sub líder o un "Subadmin" con los módulos que elijas.
 */
@Component({
  selector: 'app-roles',
  imports: [FormsModule, Modal, RouterLink],
  host: { style: '--modulo: var(--c-admin)' },
  template: `
    <div class="pagina">
      <div class="pagina-encabezado">
        <div>
          <h1><span class="icono">admin_panel_settings</span>Roles y permisos</h1>
          <p>
            Crea las categorías de los integrantes (por ejemplo Pastor, Diácono, Líder o un <strong>Subadmin</strong>) y marca qué puede
            controlar cada una. La categoría de cada persona se asigna en <a routerLink="/usuarios">Usuarios</a>.
          </p>
        </div>
        <div class="acciones">
          <button class="btn btn-primario" type="button" (click)="nuevo()"><span class="icono">add</span> Nuevo rol</button>
        </div>
      </div>

      @if (cargando()) {
        <div class="cargando"></div>
      } @else {
        <div class="roles">
          <section class="tarjeta rol fijo">
            <header>
              <h2><span class="icono">shield_person</span> Administrador</h2>
            </header>
            <p class="texto-2 pequeno">Controla todo, incluidos los roles y la configuración. Solo se crea directamente en la base de datos.</p>
          </section>

          @for (c of categorias(); track c.id) {
            <section class="tarjeta rol">
              <header>
                <h2>{{ c.nombre }}</h2>
                <span class="insignia gris">{{ usuariosPorCategoria()[c.id] ?? 0 }} usuario(s)</span>
                <span class="espacio"></span>
                <button class="btn btn-icono" type="button" (click)="editar(c)" [attr.aria-label]="'Editar ' + c.nombre" title="Editar permisos">
                  <span class="icono">edit</span>
                </button>
                <button class="btn btn-icono" type="button" (click)="eliminar(c)" [attr.aria-label]="'Eliminar ' + c.nombre" title="Eliminar">
                  <span class="icono rojo-texto">delete</span>
                </button>
              </header>
              @if (c.descripcion) {
                <p class="texto-2 pequeno">{{ c.descripcion }}</p>
              }
              <div class="chips">
                @if (c.permisos.length === total) {
                  <span class="insignia morado">Todos los permisos</span>
                } @else {
                  @for (p of c.permisos; track p) {
                    <span class="insignia azul">{{ etiqueta(p) }}</span>
                  } @empty {
                    <span class="texto-2 pequeno">Sin permisos extra: solo las funciones básicas.</span>
                  }
                }
              </div>
            </section>
          } @empty {
            <div class="tarjeta vacio-estado"><span class="icono">badge</span>No hay roles todavía. Crea el primero.</div>
          }
        </div>

        <p class="texto-2 pequeno mt">
          <strong>Funciones básicas</strong> (todos los usuarios aprobados): ver la información, registrar personas, eventos, voluntarios, reservas,
          mantenimientos y ventas. Los cambios de permisos se aplican al instante.
        </p>
      }
    </div>

    <app-modal [abierto]="modalAbierto()" [titulo]="borrador.id ? 'Editar rol' : 'Nuevo rol'" (cerrar)="modalAbierto.set(false)">
      <form id="form-rol" #f="ngForm" (ngSubmit)="guardar(f.invalid)" class="formulario">
        <div class="campo completo">
          <label for="rol-nombre" class="requerido">Nombre del rol</label>
          <input id="rol-nombre" name="nombre" [(ngModel)]="borrador.nombre" required minlength="2" maxlength="60" placeholder="Ej.: Subadmin, Diácono, Tesorero" />
        </div>
        <div class="campo completo">
          <label for="rol-desc">Descripción (opcional)</label>
          <input id="rol-desc" name="descripcion" [(ngModel)]="borrador.descripcion" maxlength="300" />
        </div>
        <div class="completo">
          <div class="permisos-titulo">
            <strong>¿Qué puede controlar?</strong>
            <span class="espacio"></span>
            <button class="btn btn-texto" type="button" (click)="todos(true)">Marcar todo</button>
            <button class="btn btn-texto" type="button" (click)="todos(false)">Quitar todo</button>
          </div>
          <div class="permisos">
            @for (p of permisos; track p.clave) {
              <label class="permiso" [class.marcado]="borrador.permisos.includes(p.clave)">
                <input type="checkbox" [checked]="borrador.permisos.includes(p.clave)" (change)="alternar(p.clave)" />
                <span class="icono">{{ p.icono }}</span>
                <span>
                  <strong>{{ p.etiqueta }}</strong>
                  <small>{{ p.descripcion }}</small>
                </span>
              </label>
            }
          </div>
        </div>
      </form>
      <ng-container pie>
        <button class="btn" type="button" (click)="modalAbierto.set(false)">Cancelar</button>
        <button class="btn btn-primario" type="submit" form="form-rol" [disabled]="guardando()">
          <span class="icono">save</span> {{ guardando() ? 'Guardando…' : 'Guardar' }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .roles {
      display: grid;
      gap: 12px;
      @media (min-width: 900px) {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    .rol {
      header {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      h2 {
        font-size: 1.05rem;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      p {
        margin: 6px 0 10px;
      }
      &.fijo {
        border-style: dashed;
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
  `,
})
export class Roles {
  private api = inject(ApiService);
  private notif = inject(NotificacionesService);

  readonly permisos = PERMISOS;
  readonly total = PERMISOS.length;
  readonly etiqueta = etiquetaPermiso;
  readonly categorias = signal<Categoria[]>([]);
  readonly usuarios = signal<{ categoriaId?: string }[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly modalAbierto = signal(false);
  borrador: Borrador = { nombre: '', descripcion: '', permisos: [] };

  readonly usuariosPorCategoria = computed(() => {
    const c: Record<string, number> = {};
    for (const u of this.usuarios()) if (u.categoriaId) c[u.categoriaId] = (c[u.categoriaId] ?? 0) + 1;
    return c;
  });

  constructor() {
    this.cargar();
  }

  async cargar() {
    try {
      const [cats, usuarios] = await Promise.all([
        this.api.get<Categoria[]>('categorias'),
        this.api.get<{ categoriaId?: string }[]>('usuarios').catch(() => []),
      ]);
      this.categorias.set(cats);
      this.usuarios.set(usuarios);
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  nuevo() {
    this.borrador = { nombre: '', descripcion: '', permisos: [] };
    this.modalAbierto.set(true);
  }

  editar(c: Categoria) {
    this.borrador = { id: c.id, nombre: c.nombre, descripcion: c.descripcion, permisos: [...c.permisos] };
    this.modalAbierto.set(true);
  }

  alternar(p: Permiso) {
    const l = this.borrador.permisos;
    this.borrador.permisos = l.includes(p) ? l.filter((x) => x !== p) : [...l, p];
  }

  todos(marcar: boolean) {
    this.borrador.permisos = marcar ? PERMISOS.map((p) => p.clave) : [];
  }

  async guardar(invalido: boolean | null) {
    if (invalido) {
      this.notif.error('Escribe el nombre del rol');
      return;
    }
    const { id, ...datos } = this.borrador;
    // Conserva el orden del catálogo para que las insignias salgan siempre igual.
    datos.permisos = PERMISOS.map((p) => p.clave).filter((p) => datos.permisos.includes(p));
    this.guardando.set(true);
    try {
      if (id) await this.api.put(`categorias/${id}`, datos);
      else await this.api.crear('categorias', datos);
      this.notif.exito(`Rol "${datos.nombre}" guardado`);
      this.modalAbierto.set(false);
      this.categorias.set(await this.api.get<Categoria[]>('categorias'));
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(c: Categoria) {
    if (!this.notif.confirmar(`¿Eliminar el rol "${c.nombre}"?`)) return;
    try {
      await this.api.borrar(`categorias/${c.id}`);
      this.categorias.update((l) => l.filter((x) => x.id !== c.id));
      this.notif.exito('Rol eliminado');
    } catch (e) {
      this.notif.error(mensajeError(e));
    }
  }
}
