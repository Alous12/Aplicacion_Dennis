import { Component, inject } from '@angular/core';
import { NotificacionesService } from '../core/notificaciones.service';

@Component({
  selector: 'app-avisos',
  template: `
    <div class="avisos" aria-live="polite">
      @for (a of notif.avisos(); track a.id) {
        <div class="aviso" [class]="a.tipo" (click)="notif.cerrar(a.id)">
          <span class="icono">{{ a.tipo === 'exito' ? 'check_circle' : a.tipo === 'error' ? 'error' : 'info' }}</span>
          {{ a.texto }}
        </div>
      }
    </div>
  `,
  styles: `
    .avisos {
      position: fixed;
      z-index: 100;
      left: 50%;
      bottom: max(16px, env(safe-area-inset-bottom));
      transform: translateX(-50%);
      display: grid;
      gap: 8px;
      width: min(440px, calc(100vw - 32px));
    }
    .aviso {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 12px;
      background: #1f2937;
      color: #fff;
      box-shadow: var(--sombra-alta);
      font-weight: 500;
      cursor: pointer;
      animation: entrar 0.2s ease-out;
      &.exito .icono { color: #6ee7a0; }
      &.error { background: #7f1d1d; }
      &.error .icono { color: #fecaca; }
    }
    @keyframes entrar {
      from { transform: translateY(12px); opacity: 0; }
    }
  `,
})
export class Avisos {
  readonly notif = inject(NotificacionesService);
}
