import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { mensajeError } from '../core/auth.interceptor';
import { ConfigService } from '../core/config.service';
import { NotificacionesService } from '../core/notificaciones.service';
import { comprimirImagen } from '../core/utilidades';

/** Solo administrador: logo y nombre de la iglesia, sin tocar el código. */
@Component({
  selector: 'app-configuracion',
  imports: [FormsModule],
  host: { style: '--modulo: var(--c-admin)' },
  template: `
    <div class="pagina" style="max-width: 640px">
      <div class="pagina-encabezado">
        <div>
          <h1><span class="icono">settings</span>Configuración</h1>
          <p>El logo y el nombre aparecen en el menú, en la pantalla de ingreso, en los recibos y en los reportes impresos.</p>
        </div>
      </div>

      <section class="tarjeta">
        <div class="formulario">
          <div class="campo completo">
            <label>Logo de la iglesia</label>
            <div class="logo-zona">
              <div class="vista">
                @if (logo()) {
                  <img [src]="logo()" alt="Vista previa del logo" />
                } @else {
                  <span class="icono">church</span>
                }
              </div>
              <div class="botones">
                <label class="btn" for="logo-archivo"><span class="icono">upload</span> Subir imagen</label>
                <input id="logo-archivo" class="oculto" type="file" accept="image/png,image/jpeg,image/webp" (change)="elegir($event)" />
                @if (logo()) {
                  <button class="btn btn-texto" type="button" (click)="logo.set('')"><span class="icono">delete</span> Quitar logo</button>
                }
              </div>
            </div>
            <span class="ayuda">PNG con fondo transparente o JPG. Se reduce automáticamente; mejor si es cuadrado.</span>
          </div>
          <div class="campo completo">
            <label for="nombre">Nombre de la iglesia</label>
            <input id="nombre" name="nombre" [(ngModel)]="nombre" maxlength="80" [placeholder]="nombrePorDefecto" />
            <span class="ayuda">Déjalo vacío para usar "{{ nombrePorDefecto }}".</span>
          </div>
        </div>
        <div class="acciones mt" style="justify-content: flex-end">
          <button class="btn btn-primario" type="button" (click)="guardar()" [disabled]="guardando()">
            <span class="icono">save</span> {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </section>
    </div>
  `,
  styles: `
    .logo-zona {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .vista {
      width: 112px;
      height: 112px;
      border-radius: 16px;
      border: 1px dashed var(--borde);
      display: grid;
      place-items: center;
      background: var(--superficie-2);
      img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
      .icono {
        font-size: 48px;
        color: var(--texto-2);
      }
    }
    .botones {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .oculto {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
    }
  `,
})
export class Configuracion {
  private config = inject(ConfigService);
  private notif = inject(NotificacionesService);

  readonly nombrePorDefecto = environment.nombreIglesia;
  readonly logo = signal(this.config.logo());
  readonly guardando = signal(false);
  nombre = this.config.nombre() === environment.nombreIglesia ? '' : this.config.nombre();

  async elegir(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    try {
      this.logo.set(await comprimirImagen(archivo, 256, 0.9, true));
    } catch (e) {
      this.notif.error(mensajeError(e));
    }
  }

  async guardar() {
    this.guardando.set(true);
    try {
      await this.config.guardar({ logo: this.logo(), nombre: this.nombre.trim() });
      this.notif.exito('Configuración guardada');
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
