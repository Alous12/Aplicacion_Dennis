import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { mensajeError } from '../core/auth.interceptor';
import { ApiService } from '../core/api.service';
import type { Registro } from '../core/modelos';
import { NotificacionesService } from '../core/notificaciones.service';
import { diasHasta, fechaLarga, hoy, moneda, textoDias } from '../core/utilidades';
import { CATEGORIA_EGRESO, FRECUENCIAS, PAGOS_RECURRENTES } from '../modulos.config';
import { FormularioCampos } from '../shared/formulario-campos';
import { Modal } from '../shared/modal';

type Estado = 'vencido' | 'pronto' | 'al-dia' | 'pausado';

/** Tesorería: pagos que se repiten (alquiler, luz, agua, sueldos...) con cuenta regresiva y registro del pago. */
@Component({
  selector: 'app-pagos-recurrentes',
  imports: [FormsModule, Modal, FormularioCampos],
  host: { style: '--modulo: var(--c-tesoreria)' },
  template: `
    <div class="pagina">
      <div class="pagina-encabezado">
        <div>
          <h1><span class="icono">event_repeat</span>Pagos recurrentes</h1>
          <p>Avisa cuántos días faltan para cada pago. Al registrarlo se anota en Pagos y la fecha pasa al siguiente periodo.</p>
        </div>
        <div class="acciones">
          <button class="btn btn-primario" type="button" (click)="nuevo()"><span class="icono">add</span> Nuevo</button>
        </div>
      </div>

      @if (cargando()) {
        <div class="cargando"></div>
      } @else if (!lista().length) {
        <div class="tarjeta vacio-estado"><span class="icono">event_repeat</span>No hay pagos recurrentes. Agrega el alquiler, los servicios, etc.</div>
      } @else {
        <div class="estadisticas">
          <div class="estadistica negativo"><div class="etiqueta">Vencidos</div><div class="valor">{{ conteo().vencido }}</div></div>
          <div class="estadistica"><div class="etiqueta">Por vencer (en aviso)</div><div class="valor">{{ conteo().pronto }}</div></div>
          <div class="estadistica"><div class="etiqueta">Total por mes (aprox.)</div><div class="valor">{{ moneda(totalMensual()) }}</div></div>
        </div>

        <div class="pagos">
          @for (p of lista(); track p.id) {
            <section class="tarjeta pago" [class]="p.estado">
              <div class="cuenta">
                @if (p.estado === 'pausado') {
                  <span class="icono">pause_circle</span>
                  <small>Pausado</small>
                } @else {
                  <strong>{{ p.dias < 0 ? -p.dias : p.dias }}</strong>
                  <small>{{ p.dias < 0 ? 'días de atraso' : p.dias === 1 ? 'día' : 'días' }}</small>
                }
              </div>
              <div class="datos">
                <h2>{{ p['concepto'] }}</h2>
                <p class="texto-2 pequeno">
                  {{ moneda(p['monto']) }} · {{ frecuencia(p['frecuencia']) }}{{ p['beneficiario'] ? ' · ' + p['beneficiario'] : '' }}
                </p>
                <p class="pequeno">
                  @if (p.estado !== 'pausado') {
                    <span class="insignia" [class]="p.estado === 'vencido' ? 'rojo' : p.estado === 'pronto' ? 'ambar' : 'verde'">{{ textoDias(p.dias) }}</span>
                  }
                  Próximo pago: <strong>{{ fechaLarga(p['proximaFecha']) }}</strong>
                  @if (p['ultimoPago']) {
                    <span class="texto-2"> · Último: {{ fechaLarga(p['ultimoPago']) }}</span>
                  }
                </p>
              </div>
              <div class="botones">
                @if (p['activo'] !== false) {
                  <button class="btn btn-primario" type="button" (click)="abrirPago(p)"><span class="icono">task_alt</span> Registrar pago</button>
                }
                <button class="btn btn-icono" type="button" (click)="editar(p)" aria-label="Editar" title="Editar"><span class="icono">edit</span></button>
                <button class="btn btn-icono" type="button" (click)="eliminar(p)" aria-label="Eliminar" title="Eliminar"><span class="icono rojo-texto">delete</span></button>
              </div>
            </section>
          }
        </div>
      }
    </div>

    <app-modal [abierto]="modalForm()" [titulo]="borrador['id'] ? 'Editar pago recurrente' : 'Nuevo pago recurrente'" (cerrar)="modalForm.set(false)">
      <form id="form-recurrente" #f="ngForm" (ngSubmit)="guardar(f.invalid)">
        <app-formulario-campos [campos]="campos" [modelo]="borrador" />
      </form>
      <ng-container pie>
        <button class="btn" type="button" (click)="modalForm.set(false)">Cancelar</button>
        <button class="btn btn-primario" type="submit" form="form-recurrente" [disabled]="guardando()"><span class="icono">save</span> Guardar</button>
      </ng-container>
    </app-modal>

    <app-modal [abierto]="!!pagando()" [titulo]="'Registrar pago: ' + (pagando()?.['concepto'] ?? '')" (cerrar)="pagando.set(null)">
      <form id="form-pago" #fp="ngForm" (ngSubmit)="pagar(fp.invalid)" class="formulario">
        <div class="campo">
          <label for="p-fecha" class="requerido">Fecha del pago</label>
          <input id="p-fecha" name="fecha" type="date" [(ngModel)]="pago.fecha" required />
        </div>
        <div class="campo">
          <label for="p-monto" class="requerido">Monto pagado</label>
          <input id="p-monto" name="monto" type="number" inputmode="decimal" min="0.01" step="0.01" [(ngModel)]="pago.monto" required />
        </div>
        <div class="campo">
          <label for="p-metodo">Método</label>
          <select id="p-metodo" name="metodo" [(ngModel)]="pago.metodo">
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="qr">QR</option>
          </select>
        </div>
        <div class="campo">
          <label for="p-comp">N.º de comprobante / factura</label>
          <input id="p-comp" name="comprobante" [(ngModel)]="pago.comprobante" />
        </div>
        <p class="completo texto-2 pequeno" style="margin: 0">
          Se anotará en <strong>Pagos</strong> y el próximo vencimiento pasará al siguiente periodo ({{ frecuencia(pagando()?.['frecuencia']).toLowerCase() }}).
        </p>
      </form>
      <ng-container pie>
        <button class="btn" type="button" (click)="pagando.set(null)">Cancelar</button>
        <button class="btn btn-primario" type="submit" form="form-pago" [disabled]="guardando()"><span class="icono">task_alt</span> Registrar pago</button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .pagos {
      display: grid;
      gap: 10px;
    }
    .pago {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 14px;
      align-items: center;
      border-left: 4px solid var(--tono, var(--borde));
      &.vencido {
        --tono: var(--peligro);
      }
      &.pronto {
        --tono: var(--aviso);
      }
      &.al-dia {
        --tono: var(--exito);
      }
      @media (min-width: 800px) {
        grid-template-columns: auto 1fr auto;
      }
    }
    .cuenta {
      width: 72px;
      text-align: center;
      strong {
        display: block;
        font-size: 1.8rem;
        line-height: 1;
        color: var(--tono);
        font-variant-numeric: tabular-nums;
      }
      small {
        color: var(--texto-2);
        font-size: 0.72rem;
      }
      .icono {
        font-size: 32px;
        color: var(--texto-2);
      }
    }
    .datos {
      min-width: 0;
      h2 {
        font-size: 1.02rem;
        margin: 0;
      }
      p {
        margin: 4px 0 0;
      }
    }
    .botones {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
      grid-column: 1 / -1;
      @media (min-width: 800px) {
        grid-column: auto;
      }
    }
  `,
})
export class PagosRecurrentes {
  private api = inject(ApiService);
  private notif = inject(NotificacionesService);

  readonly moneda = moneda;
  readonly fechaLarga = fechaLarga;
  readonly textoDias = textoDias;
  readonly campos = PAGOS_RECURRENTES.campos;

  readonly items = signal<Registro[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly modalForm = signal(false);
  readonly pagando = signal<Registro | null>(null);
  borrador: Record<string, any> = {};
  pago = { fecha: hoy(), monto: 0, metodo: 'efectivo', comprobante: '' };

  /** Ordenados por urgencia: vencidos primero, pausados al final. */
  readonly lista = computed(() =>
    this.items()
      .map((p): Registro & { dias: number; estado: Estado } => {
        const dias = diasHasta(String(p['proximaFecha'] ?? hoy()));
        const estado: Estado =
          p['activo'] === false ? 'pausado' : dias < 0 ? 'vencido' : dias <= (Number(p['diasAviso']) || 0) ? 'pronto' : 'al-dia';
        return { ...p, dias, estado };
      })
      .sort((a, b) => Number(a.estado === 'pausado') - Number(b.estado === 'pausado') || a.dias - b.dias),
  );
  readonly conteo = computed(() => {
    const c = { vencido: 0, pronto: 0 };
    for (const p of this.lista()) if (p.estado === 'vencido' || p.estado === 'pronto') c[p.estado]++;
    return c;
  });
  /** Equivalente mensual de todos los pagos activos (semanal × 4,33, anual ÷ 12, etc.). */
  readonly totalMensual = computed(() => {
    const factor: Record<string, number> = { semanal: 52 / 12, quincenal: 26 / 12, mensual: 1, bimestral: 1 / 2, trimestral: 1 / 3, semestral: 1 / 6, anual: 1 / 12 };
    return this.items()
      .filter((p) => p['activo'] !== false)
      .reduce((s, p) => s + (Number(p['monto']) || 0) * (factor[p['frecuencia']] ?? 1), 0);
  });

  constructor() {
    this.cargar();
  }

  async cargar() {
    try {
      this.items.set(await this.api.listar('pagos-recurrentes'));
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  frecuencia(v: string | undefined) {
    return FRECUENCIAS.find((o) => o.valor === v)?.etiqueta ?? '';
  }

  categoria(v: string) {
    return CATEGORIA_EGRESO.find((o) => o.valor === v)?.etiqueta ?? v;
  }

  nuevo() {
    const b: Record<string, any> = {};
    for (const c of this.campos) {
      const d = typeof c.defecto === 'function' ? (c.defecto as () => unknown)() : c.defecto;
      b[c.clave] = d ?? (c.tipo === 'booleano' ? false : c.tipo === 'select' ? (c.opciones?.[0]?.valor ?? '') : '');
    }
    this.borrador = b;
    this.modalForm.set(true);
  }

  editar(p: Registro) {
    this.borrador = Object.fromEntries(this.campos.map((c) => [c.clave, p[c.clave]]));
    this.borrador['id'] = p.id;
    this.modalForm.set(true);
  }

  async guardar(invalido: boolean | null) {
    if (invalido) {
      this.notif.error('Revisa los campos obligatorios');
      return;
    }
    const { id, ...datos } = this.borrador;
    this.guardando.set(true);
    try {
      if (id) await this.api.actualizar('pagos-recurrentes', id, datos);
      else await this.api.crear('pagos-recurrentes', datos);
      this.modalForm.set(false);
      this.notif.exito('Pago recurrente guardado');
      await this.cargar();
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  abrirPago(p: Registro) {
    this.pago = { fecha: hoy(), monto: Number(p['monto']) || 0, metodo: p['metodo'] ?? 'efectivo', comprobante: '' };
    this.pagando.set(p);
  }

  async pagar(invalido: boolean | null) {
    const p = this.pagando();
    if (!p) return;
    if (invalido) {
      this.notif.error('Indica la fecha y el monto');
      return;
    }
    this.guardando.set(true);
    try {
      const r = await this.api.post<{ proximaFecha: string }>(`pagos-recurrentes/${p.id}/pagar`, this.pago);
      this.api.invalidar('egresos');
      this.items.update((l) => l.map((x) => (x.id === p.id ? { ...x, proximaFecha: r.proximaFecha, ultimoPago: this.pago.fecha } : x)));
      this.pagando.set(null);
      this.notif.exito(`Pago registrado. Próximo: ${fechaLarga(r.proximaFecha)}`);
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(p: Registro) {
    if (!this.notif.confirmar(`¿Eliminar el pago recurrente "${p['concepto']}"? Los pagos ya registrados se conservan.`)) return;
    try {
      await this.api.eliminar('pagos-recurrentes', p.id);
      this.items.update((l) => l.filter((x) => x.id !== p.id));
      this.notif.exito('Eliminado');
    } catch (e) {
      this.notif.error(mensajeError(e));
    }
  }
}
