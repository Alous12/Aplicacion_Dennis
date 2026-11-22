import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { mensajeError } from '../core/auth.interceptor';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import type { Registro } from '../core/modelos';
import { NotificacionesService } from '../core/notificaciones.service';
import { fechaLarga, moneda, nombreCompleto } from '../core/utilidades';
import { METODO_PAGO, TIPO_INGRESO } from '../modulos.config';

/** Emisión de recibo / constancia imprimible de un ingreso. */
@Component({
  selector: 'app-recibo',
  imports: [RouterLink],
  host: { style: '--modulo: var(--c-tesoreria)' },
  template: `
    <div class="pagina">
      <div class="acciones mb no-imprimir">
        <a class="btn btn-texto" [routerLink]="auth.esAdmin() ? '/tesoreria/ingresos' : '/mi-celula'"><span class="icono">arrow_back</span> Ingresos</a>
        <span style="flex: 1"></span>
        <button class="btn btn-primario" type="button" (click)="imprimir()" [disabled]="!ingreso()"><span class="icono">print</span> Imprimir / PDF</button>
      </div>

      @if (ingreso(); as r) {
        <article class="recibo tarjeta">
          <header>
            <div>
              <span class="icono">church</span>
              <h1>{{ nombreIglesia }}</h1>
            </div>
            <div class="numero">
              <small>{{ r['personaId'] || r['donante'] ? 'CONSTANCIA DE DONACIÓN' : 'RECIBO' }}</small>
              <strong>N.º {{ numero(r) }}</strong>
            </div>
          </header>

          <dl>
            <dt>Fecha</dt>
            <dd>{{ fecha(r['fecha']) }}</dd>
            <dt>Recibido de</dt>
            <dd>{{ donante() || 'Congregación (ofrenda general)' }}</dd>
            <dt>Concepto</dt>
            <dd>{{ etiqueta(tipos, r['tipo']) }}{{ r['descripcion'] ? ' — ' + r['descripcion'] : '' }}</dd>
            <dt>Método de pago</dt>
            <dd>{{ etiqueta(metodos, r['metodo']) }}</dd>
          </dl>

          <div class="monto">
            <span>Monto</span>
            <strong>{{ moneda(r['monto']) }}</strong>
          </div>

          <footer>
            <div class="firma">Firma tesorería</div>
            <div class="firma">Firma de quien entrega</div>
          </footer>
          <p class="pequeno texto-2 gracias">“Cada uno dé como propuso en su corazón… porque Dios ama al dador alegre.” — 2 Corintios 9:7</p>
        </article>
      } @else {
        <div class="cargando"></div>
      }
    </div>
  `,
  styles: `
    .recibo {
      max-width: 640px;
      margin: 0 auto;
      padding: 28px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      border-bottom: 2px solid var(--modulo);
      padding-bottom: 14px;
      margin-bottom: 18px;
      .icono {
        font-size: 36px;
        color: var(--modulo);
      }
      h1 {
        font-size: 1.25rem;
      }
    }
    .numero {
      text-align: right;
      small {
        display: block;
        font-weight: 700;
        color: var(--texto-2);
        letter-spacing: 0.05em;
      }
      strong {
        font-size: 1.3rem;
        color: var(--modulo);
      }
    }
    dl {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 10px 16px;
      margin: 0;
      dt {
        color: var(--texto-2);
        font-weight: 600;
      }
      dd {
        margin: 0;
      }
      @media (max-width: 480px) {
        grid-template-columns: 1fr;
        gap: 2px;
        dd {
          margin-bottom: 10px;
        }
      }
    }
    .monto {
      margin: 22px 0;
      padding: 14px 18px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--modulo) 8%, transparent);
      display: flex;
      justify-content: space-between;
      align-items: center;
      strong {
        font-size: 1.6rem;
      }
    }
    footer {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-top: 56px;
    }
    .firma {
      border-top: 1px solid var(--texto);
      text-align: center;
      padding-top: 6px;
      font-size: 0.85rem;
      color: var(--texto-2);
    }
    .gracias {
      text-align: center;
      margin-top: 24px;
    }
    @media print {
      .recibo {
        border: 1px solid #999;
      }
      .monto {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  `,
})
export class Recibo {
  readonly id = input.required<string>();
  readonly auth = inject(AuthService);
  private api = inject(ApiService);
  private notif = inject(NotificacionesService);

  readonly nombreIglesia = environment.nombreIglesia;
  readonly tipos = TIPO_INGRESO;
  readonly metodos = METODO_PAGO;
  readonly moneda = moneda;
  readonly fecha = fechaLarga;
  readonly ingreso = signal<Registro | null>(null);
  readonly donante = signal('');

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.cargar(id));
    });
  }

  private async cargar(id: string) {
    try {
      const r = await this.api.obtener('ingresos', id);
      let donante = r['donante'] ?? '';
      if (r['personaId']) {
        try {
          donante = nombreCompleto(await this.api.obtener('personas', r['personaId'])) || donante;
        } catch {
          /* persona eliminada */
        }
      }
      this.donante.set(donante);
      this.ingreso.set(r);
    } catch (e) {
      this.notif.error(mensajeError(e));
    }
  }

  numero(r: Registro) {
    return String(r['numeroRecibo'] ?? '—').padStart(6, '0');
  }

  etiqueta(lista: { valor: string; etiqueta: string }[], v: string) {
    return lista.find((o) => o.valor === v)?.etiqueta ?? v;
  }

  imprimir() {
    window.print();
  }
}
