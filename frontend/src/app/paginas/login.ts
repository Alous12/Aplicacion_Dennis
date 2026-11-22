import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { mensajeError } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <main class="fondo">
      <section class="caja">
        <div class="logo">
          <span class="icono">church</span>
          <h1>{{ nombreIglesia }}</h1>
          <p>Sistema de gestión integral</p>
        </div>

        <div class="segmentado" role="tablist">
          <button type="button" role="tab" [class.activo]="modo() === 'login'" (click)="cambiar('login')">Ingresar</button>
          <button type="button" role="tab" [class.activo]="modo() === 'registro'" (click)="cambiar('registro')">Crear cuenta</button>
        </div>

        @if (mensaje()) {
          <div class="mensaje" [class.error]="esError()">{{ mensaje() }}</div>
        }

        <form #f="ngForm" (ngSubmit)="enviar(f.invalid)" class="form">
          @if (modo() === 'registro') {
            <div class="campo">
              <label for="nombre">Nombre completo</label>
              <input id="nombre" name="nombre" autocomplete="name" [(ngModel)]="nombre" required minlength="2" />
            </div>
          }
          <div class="campo">
            <label for="email">Correo electrónico</label>
            <input id="email" name="email" type="email" inputmode="email" autocomplete="email" [(ngModel)]="email" required email />
          </div>
          <div class="campo">
            <label for="password">Contraseña</label>
            <div class="con-boton">
              <input
                id="password"
                name="password"
                [type]="verPassword() ? 'text' : 'password'"
                [autocomplete]="modo() === 'login' ? 'current-password' : 'new-password'"
                [(ngModel)]="password"
                required
                [minlength]="modo() === 'registro' ? 8 : 1"
              />
              <button type="button" class="btn btn-icono" (click)="verPassword.set(!verPassword())" [attr.aria-label]="verPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                <span class="icono">{{ verPassword() ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
            @if (modo() === 'registro') {
              <span class="ayuda">Mínimo 8 caracteres. Tu cuenta quedará pendiente hasta que un administrador la apruebe.</span>
            }
          </div>

          <button class="btn btn-primario btn-bloque" type="submit" [disabled]="cargando()">
            {{ cargando() ? 'Un momento…' : modo() === 'login' ? 'Ingresar' : 'Crear cuenta' }}
          </button>
        </form>

        <div class="separador"><span>o</span></div>

        <button class="btn btn-bloque google" type="button" (click)="google()" [disabled]="cargando()">
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
          </svg>
          Continuar con Google
        </button>
      </section>
    </main>
  `,
  styles: `
    .fondo {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 24px 16px;
      background:
        radial-gradient(circle at 15% 20%, rgba(47, 111, 181, 0.35), transparent 45%),
        radial-gradient(circle at 85% 80%, rgba(46, 158, 91, 0.25), transparent 45%),
        linear-gradient(160deg, #1f3a5f, #142640);
    }
    .caja {
      width: min(420px, 100%);
      background: var(--superficie);
      border-radius: 20px;
      padding: 28px 22px;
      box-shadow: var(--sombra-alta);
      display: grid;
      gap: 16px;
      --modulo: var(--primario);
    }
    .logo {
      text-align: center;
      .icono {
        font-size: 48px;
        color: var(--primario);
      }
      h1 {
        font-size: 1.4rem;
        margin-top: 4px;
      }
      p {
        margin: 4px 0 0;
        color: var(--texto-2);
      }
    }
    .form {
      display: grid;
      gap: 14px;
    }
    .con-boton {
      position: relative;
      input {
        padding-right: 48px !important;
      }
      .btn-icono {
        position: absolute;
        right: 2px;
        top: 50%;
        transform: translateY(-50%);
      }
    }
    .mensaje {
      padding: 12px 14px;
      border-radius: 10px;
      background: #e3f4ea;
      color: #1d6e41;
      font-size: 0.9rem;
      font-weight: 500;
      &.error {
        background: #fbe7e7;
        color: #a42828;
      }
    }
    .separador {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--texto-2);
      font-size: 0.85rem;
      &::before,
      &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--borde);
      }
    }
    .google {
      min-height: 46px;
    }
  `,
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly nombreIglesia = environment.nombreIglesia;
  readonly modo = signal<'login' | 'registro'>('login');
  readonly cargando = signal(false);
  readonly mensaje = signal('');
  readonly esError = signal(false);
  readonly verPassword = signal(false);

  nombre = '';
  email = '';
  password = '';

  cambiar(m: 'login' | 'registro') {
    this.modo.set(m);
    this.mensaje.set('');
  }

  async enviar(invalido: boolean | null) {
    if (invalido) {
      this.mostrar(this.modo() === 'registro' ? 'Completa todos los campos (contraseña de al menos 8 caracteres)' : 'Ingresa tu correo y contraseña', true);
      return;
    }
    this.cargando.set(true);
    this.mensaje.set('');
    try {
      if (this.modo() === 'login') {
        await this.auth.login(this.email, this.password);
        this.router.navigateByUrl('/');
      } else {
        const msg = await this.auth.registro(this.nombre, this.email, this.password);
        this.password = '';
        this.modo.set('login');
        this.mostrar(msg, false);
      }
    } catch (e) {
      this.mostrar(mensajeError(e), true);
    } finally {
      this.cargando.set(false);
    }
  }

  async google() {
    this.cargando.set(true);
    this.mensaje.set('');
    try {
      await this.auth.loginGoogle();
      this.router.navigateByUrl('/');
    } catch (e) {
      this.mostrar(mensajeError(e), true);
    } finally {
      this.cargando.set(false);
    }
  }

  private mostrar(texto: string, error: boolean) {
    this.mensaje.set(texto);
    this.esError.set(error);
  }
}
