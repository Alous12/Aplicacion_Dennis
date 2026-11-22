import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { mensajeError } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { NotificacionesService } from '../core/notificaciones.service';

@Component({
  selector: 'app-perfil',
  imports: [FormsModule],
  template: `
    <div class="pagina" style="max-width: 560px">
      <div class="pagina-encabezado">
        <h1><span class="icono">account_circle</span>Mi perfil</h1>
      </div>

      <section class="tarjeta mb">
        <ul class="lista-simple">
          <li><span class="texto-2">Nombre</span><strong>{{ auth.usuario()?.nombre }}</strong></li>
          <li><span class="texto-2">Correo</span><strong>{{ auth.usuario()?.email }}</strong></li>
          <li><span class="texto-2">Rol</span><strong>{{ auth.esAdmin() ? 'Administrador' : 'Usuario' }}</strong></li>
        </ul>
      </section>

      <section class="tarjeta mb">
        <div class="tarjeta-titulo"><span class="icono">lock</span> Cambiar contraseña</div>
        <p class="texto-2 pequeno">Si entras solo con Google, puedes dejar vacía la contraseña actual para crear una.</p>
        <form #f="ngForm" (ngSubmit)="cambiar(f.invalid)" class="formulario">
          <div class="campo completo">
            <label for="actual">Contraseña actual</label>
            <input id="actual" name="actual" type="password" autocomplete="current-password" [(ngModel)]="actual" />
          </div>
          <div class="campo completo">
            <label for="nueva" class="requerido">Nueva contraseña</label>
            <input id="nueva" name="nueva" type="password" autocomplete="new-password" minlength="8" required [(ngModel)]="nueva" />
            <span class="ayuda">Mínimo 8 caracteres.</span>
          </div>
          <button class="btn btn-primario completo" type="submit" [disabled]="guardando()">Actualizar contraseña</button>
        </form>
      </section>

      <button class="btn btn-peligro btn-bloque" type="button" (click)="auth.logout()"><span class="icono">logout</span> Cerrar sesión</button>
    </div>
  `,
})
export class Perfil {
  readonly auth = inject(AuthService);
  private notif = inject(NotificacionesService);
  readonly guardando = signal(false);
  actual = '';
  nueva = '';

  async cambiar(invalido: boolean | null) {
    if (invalido) {
      this.notif.error('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    this.guardando.set(true);
    try {
      this.notif.exito(await this.auth.cambiarPassword(this.actual, this.nueva));
      this.actual = this.nueva = '';
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
