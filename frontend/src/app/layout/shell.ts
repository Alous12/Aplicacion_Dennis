import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth.service';

interface ItemMenu {
  ruta: string;
  etiqueta: string;
  icono: string;
  color: string;
  /** Quién ve el enlace (por defecto, todos). */
  visible?: 'admin' | 'lider';
}

interface SeccionMenu {
  titulo: string;
  items: ItemMenu[];
}

const MENU: SeccionMenu[] = [
  {
    titulo: '',
    items: [{ ruta: '/inicio', etiqueta: 'Inicio', icono: 'home', color: 'var(--primario)' }],
  },
  {
    titulo: 'Miembros & Visitantes',
    items: [
      { ruta: '/personas', etiqueta: 'Personas', icono: 'groups', color: 'var(--c-miembros)' },
      { ruta: '/cumpleanos', etiqueta: 'Cumpleaños', icono: 'cake', color: 'var(--c-miembros)' },
      { ruta: '/celulas', etiqueta: 'Células', icono: 'diversity_3', color: 'var(--c-miembros)' },
    ],
  },
  {
    titulo: 'Eventos & Cultos',
    items: [{ ruta: '/eventos', etiqueta: 'Calendario', icono: 'event', color: 'var(--c-eventos)' }],
  },
  {
    titulo: 'Ministerios & Voluntarios',
    items: [
      { ruta: '/ministerios', etiqueta: 'Ministerios', icono: 'volunteer_activism', color: 'var(--c-ministerios)' },
      { ruta: '/voluntarios', etiqueta: 'Voluntarios', icono: 'handshake', color: 'var(--c-ministerios)' },
    ],
  },
  {
    titulo: 'Gestión de Recursos',
    items: [{ ruta: '/recursos', etiqueta: 'Recursos', icono: 'inventory_2', color: 'var(--c-recursos)' }],
  },
  {
    titulo: 'Tesorería',
    items: [
      { ruta: '/tesoreria', etiqueta: 'Tesorería', icono: 'account_balance', color: 'var(--c-tesoreria)', visible: 'admin' },
      { ruta: '/mi-celula', etiqueta: 'Ingresos de mi célula', icono: 'savings', color: 'var(--c-tesoreria)', visible: 'lider' },
    ],
  },
  {
    titulo: 'Ventas',
    items: [
      { ruta: '/ventas', etiqueta: 'Ventas', icono: 'point_of_sale', color: 'var(--c-ventas)' },
      { ruta: '/ventas/productos', etiqueta: 'Productos', icono: 'sell', color: 'var(--c-ventas)', visible: 'admin' },
    ],
  },
  {
    titulo: 'Administración',
    items: [{ ruta: '/usuarios', etiqueta: 'Usuarios', icono: 'admin_panel_settings', color: 'var(--c-admin)', visible: 'admin' }],
  },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="barra-superior">
      <button class="btn btn-icono" type="button" (click)="menuAbierto.set(true)" aria-label="Abrir menú">
        <span class="icono">menu</span>
      </button>
      <span class="marca-texto">{{ nombreIglesia }}</span>
      <a class="avatar" routerLink="/perfil" [attr.aria-label]="'Perfil de ' + usuario()?.nombre">{{ iniciales() }}</a>
    </header>

    @if (menuAbierto()) {
      <div class="fondo-menu" (click)="menuAbierto.set(false)"></div>
    }

    <nav class="barra-lateral" [class.abierta]="menuAbierto()" aria-label="Menú principal">
      <div class="marca">
        <span class="icono">church</span>
        <div>
          <strong>{{ nombreIglesia }}</strong>
          <small>Gestión integral</small>
        </div>
      </div>

      <div class="secciones">
        @for (s of menu(); track s.titulo) {
          @if (s.titulo) {
            <div class="seccion-titulo">{{ s.titulo }}</div>
          }
          @for (i of s.items; track i.ruta) {
            <a [routerLink]="i.ruta" routerLinkActive="activo" [style.--color]="i.color" (click)="menuAbierto.set(false)">
              <span class="icono">{{ i.icono }}</span>
              {{ i.etiqueta }}
            </a>
          }
        }
      </div>

      <div class="usuario">
        <a routerLink="/perfil" class="usuario-info" (click)="menuAbierto.set(false)">
          <span class="avatar">{{ iniciales() }}</span>
          <span>
            <strong>{{ usuario()?.nombre }}</strong>
            <small>{{ auth.esAdmin() ? 'Administrador' : auth.esLider() ? 'Líder de célula' : 'Usuario' }}</small>
          </span>
        </a>
        <button class="btn btn-icono" type="button" (click)="auth.logout()" title="Cerrar sesión" aria-label="Cerrar sesión">
          <span class="icono">logout</span>
        </button>
      </div>
    </nav>

    <main class="contenido">
      <router-outlet />
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
    }
    .barra-superior {
      position: sticky;
      top: 0;
      z-index: 30;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      padding-top: max(8px, env(safe-area-inset-top));
      background: var(--primario);
      color: #fff;
      .btn-icono {
        color: #fff;
        &:hover {
          background: rgba(255, 255, 255, 0.12);
        }
      }
      .marca-texto {
        flex: 1;
        font-weight: 700;
        font-size: 1.05rem;
      }
    }
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: inline-grid;
      place-items: center;
      background: #fff;
      color: var(--primario);
      font-weight: 700;
      font-size: 0.85rem;
      text-decoration: none;
      flex-shrink: 0;
    }
    .fondo-menu {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      z-index: 39;
    }
    .barra-lateral {
      position: fixed;
      inset: 0 auto 0 0;
      width: min(290px, 86vw);
      z-index: 40;
      background: var(--superficie);
      border-right: 1px solid var(--borde);
      display: flex;
      flex-direction: column;
      transform: translateX(-100%);
      transition: transform 0.22s ease;
      padding-top: env(safe-area-inset-top);
      &.abierta {
        transform: none;
        box-shadow: var(--sombra-alta);
      }
    }
    .marca {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px;
      border-bottom: 1px solid var(--borde);
      .icono {
        font-size: 32px;
        color: var(--primario);
      }
      strong {
        display: block;
      }
      small {
        color: var(--texto-2);
      }
    }
    .secciones {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    .seccion-titulo {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
      color: var(--texto-2);
      padding: 14px 12px 4px;
    }
    .secciones a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      color: var(--texto);
      text-decoration: none;
      font-weight: 500;
      min-height: 44px;
      .icono {
        color: var(--color);
      }
      &:hover {
        background: var(--superficie-2);
      }
      &.activo {
        background: color-mix(in srgb, var(--color) 12%, transparent);
        color: var(--color);
        font-weight: 700;
      }
    }
    .usuario {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      padding-bottom: max(12px, env(safe-area-inset-bottom));
      border-top: 1px solid var(--borde);
      .avatar {
        background: var(--primario);
        color: #fff;
      }
    }
    .usuario-info {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      color: inherit;
      text-decoration: none;
      strong,
      small {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      small {
        color: var(--texto-2);
      }
    }
    @media (min-width: 1024px) {
      .barra-superior,
      .fondo-menu {
        display: none;
      }
      .barra-lateral {
        transform: none;
        width: 260px;
      }
      .contenido {
        margin-left: 260px;
      }
    }
  `,
})
export class Shell {
  readonly auth = inject(AuthService);
  readonly usuario = this.auth.usuario;
  readonly menuAbierto = signal(false);
  readonly nombreIglesia = environment.nombreIglesia;

  readonly menu = computed(() => {
    const admin = this.auth.esAdmin();
    // El admin ya ve toda la Tesorería, así que "Ingresos de mi célula" es solo para líderes no admin.
    const lider = this.auth.esLider() && !admin;
    const ve = (i: ItemMenu) => !i.visible || (i.visible === 'admin' ? admin : lider);
    return MENU.map((s) => ({ ...s, items: s.items.filter(ve) })).filter((s) => s.items.length);
  });

  readonly iniciales = computed(() =>
    (this.usuario()?.nombre ?? '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join(''),
  );

  constructor() {
    // Trae rol y célula actualizados (si un admin asignó una célula, aparece el menú del líder).
    this.auth.refrescar();
    // Cierra el menú al navegar (por ejemplo con el botón atrás del teléfono).
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.menuAbierto.set(false));
  }
}
