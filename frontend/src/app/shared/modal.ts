import { Component, HostListener, input, output } from '@angular/core';

/** Modal accesible: en escritorio es un diálogo centrado, en teléfono una hoja a pantalla completa. */
@Component({
  selector: 'app-modal',
  template: `
    @if (abierto()) {
      <div class="fondo" (click)="cerrar.emit()"></div>
      <section class="dialogo" role="dialog" aria-modal="true" [attr.aria-label]="titulo()">
        <header>
          <h2>{{ titulo() }}</h2>
          <button type="button" class="btn btn-icono" (click)="cerrar.emit()" aria-label="Cerrar">
            <span class="icono">close</span>
          </button>
        </header>
        <div class="cuerpo"><ng-content /></div>
        <footer><ng-content select="[pie]" /></footer>
      </section>
    }
  `,
  styles: `
    .fondo {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      z-index: 50;
      animation: aparecer 0.15s ease-out;
    }
    .dialogo {
      position: fixed;
      z-index: 51;
      inset: 0;
      background: var(--superficie);
      display: flex;
      flex-direction: column;
      animation: subir 0.2s ease-out;
    }
    @media (min-width: 700px) {
      .dialogo {
        inset: auto;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(720px, calc(100vw - 32px));
        max-height: calc(100vh - 48px);
        border-radius: 16px;
        box-shadow: var(--sombra-alta);
        animation: aparecer 0.15s ease-out;
      }
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 12px 12px 20px;
      border-bottom: 1px solid var(--borde);
      padding-top: max(12px, env(safe-area-inset-top));
      h2 {
        font-size: 1.1rem;
      }
    }
    .cuerpo {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }
    footer {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 12px 20px;
      border-top: 1px solid var(--borde);
      padding-bottom: max(12px, env(safe-area-inset-bottom));
      &:empty {
        display: none;
      }
    }
    @keyframes aparecer {
      from { opacity: 0; }
    }
    @keyframes subir {
      from { transform: translateY(24px); opacity: 0; }
    }
  `,
})
export class Modal {
  readonly abierto = input(false);
  readonly titulo = input('');
  readonly cerrar = output<void>();

  @HostListener('document:keydown.escape')
  alEscape() {
    if (this.abierto()) this.cerrar.emit();
  }
}
