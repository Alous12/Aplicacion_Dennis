import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { mensajeError } from '../core/auth.interceptor';
import { ApiService } from '../core/api.service';
import type { Opcion, Registro } from '../core/modelos';
import { NotificacionesService } from '../core/notificaciones.service';
import { aISO, descargarCSV, MESES, moneda } from '../core/utilidades';
import { CATEGORIA_EGRESO, ORIGEN_INGRESO, TIPO_INGRESO } from '../modulos.config';

interface Fila {
  clave: string;
  etiqueta: string;
  monto: number;
  presupuesto?: number;
}

/** Agrupa una lista sumando un campo; devuelve filas ordenadas de mayor a menor. */
function agrupar(lista: Registro[], campo: string, montoCampo: string, etiquetas: (v: string) => string): Fila[] {
  const m = new Map<string, number>();
  for (const r of lista) {
    const k = String(r[campo] || '—');
    m.set(k, (m.get(k) ?? 0) + (Number(r[montoCampo]) || 0));
  }
  return [...m.entries()].map(([clave, monto]) => ({ clave, etiqueta: etiquetas(clave), monto })).sort((a, b) => b.monto - a.monto);
}

const etiquetaDe = (lista: Opcion[]) => (v: string) => lista.find((o) => o.valor === v)?.etiqueta ?? v;

/** Reportes financieros por periodo: resumen, desgloses, comparación con presupuesto y tendencia mensual. */
@Component({
  selector: 'app-reportes',
  imports: [FormsModule],
  host: { style: '--modulo: var(--c-tesoreria)' },
  template: `
    <div class="pagina">
      <div class="pagina-encabezado">
        <div>
          <h1><span class="icono">bar_chart</span>Reportes financieros</h1>
          <p>{{ nombreIglesia }} · {{ periodoTexto() }}</p>
        </div>
        <div class="acciones no-imprimir">
          <button class="btn" type="button" (click)="imprimir()"><span class="icono">print</span> Imprimir / PDF</button>
          <button class="btn" type="button" (click)="exportar()"><span class="icono">download</span> CSV</button>
        </div>
      </div>

      <div class="barra-filtros no-imprimir">
        <select class="control" [ngModel]="anio()" (ngModelChange)="anio.set(+$event); cargar()" aria-label="Año">
          @for (a of anios; track a) {
            <option [value]="a">{{ a }}</option>
          }
        </select>
        <select class="control" [ngModel]="mes()" (ngModelChange)="mes.set(+$event)" aria-label="Mes">
          <option [value]="0">Todo el año</option>
          @for (m of meses; track $index) {
            <option [value]="$index + 1">{{ m }}</option>
          }
        </select>
      </div>

      @if (cargando()) {
        <div class="cargando"></div>
      } @else {
        <div class="estadisticas">
          <div class="estadistica positivo"><div class="etiqueta">Ofrendas / diezmos / donaciones</div><div class="valor">{{ moneda(t().ingresos) }}</div></div>
          <div class="estadistica positivo"><div class="etiqueta">Ventas</div><div class="valor">{{ moneda(t().ventas) }}</div></div>
          <div class="estadistica negativo"><div class="etiqueta">Pagos y gastos</div><div class="valor">{{ moneda(t().egresos) }}</div></div>
          <div class="estadistica" [class.positivo]="t().balance >= 0" [class.negativo]="t().balance < 0">
            <div class="etiqueta">Balance</div>
            <div class="valor">{{ moneda(t().balance) }}</div>
          </div>
        </div>

        @if (mes() === 0) {
          <section class="tarjeta mb">
            <div class="tarjeta-titulo"><span class="icono">calendar_month</span> Balance mes a mes ({{ anio() }})</div>
            <div class="tabla-contenedor" style="box-shadow: none">
              <table class="tabla">
                <thead>
                  <tr><th>Mes</th><th class="num">Entradas</th><th class="num">Salidas</th><th class="num">Balance</th></tr>
                </thead>
                <tbody>
                  @for (f of porMes(); track f.mes) {
                    <tr>
                      <td data-label="Mes" class="principal">{{ f.mes }}</td>
                      <td data-label="Entradas" class="num">{{ moneda(f.entradas) }}</td>
                      <td data-label="Salidas" class="num">{{ moneda(f.salidas) }}</td>
                      <td data-label="Balance" class="num negrita" [class.rojo-texto]="f.balance < 0">{{ moneda(f.balance) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <div class="rejilla">
          @for (b of bloques(); track b.titulo) {
            <section class="tarjeta">
              <div class="tarjeta-titulo"><span class="icono">{{ b.icono }}</span> {{ b.titulo }}</div>
              @if (!b.filas.length) {
                <p class="texto-2">Sin datos en el periodo.</p>
              } @else {
                <ul class="barras">
                  @for (f of b.filas; track f.clave) {
                    <li [title]="f.etiqueta + ': ' + moneda(f.monto) + (f.presupuesto ? ' de ' + moneda(f.presupuesto) + ' presupuestado' : '')">
                      <div class="fila-texto">
                        <span>{{ f.etiqueta }}</span>
                        <strong>{{ moneda(f.monto) }}</strong>
                      </div>
                      <div class="pista">
                        <div class="barra" [style.width.%]="ancho(f, b.maximo)"></div>
                        @if (f.presupuesto) {
                          <div class="meta" [style.left.%]="(f.presupuesto / b.maximo) * 100"></div>
                        }
                      </div>
                      @if (f.presupuesto) {
                        <div class="pequeno texto-2">
                          Presupuesto {{ moneda(f.presupuesto) }} ·
                          <span [class.rojo-texto]="b.tipo === 'egreso' && f.monto > f.presupuesto">{{ porcentaje(f) }}% ejecutado</span>
                        </div>
                      }
                    </li>
                  }
                </ul>
                <div class="fila-texto total"><span>Total</span><strong>{{ moneda(b.total) }}</strong></div>
              }
            </section>
          }
        </div>
        @if (hayPresupuesto()) {
          <p class="texto-2 pequeno mt">La línea vertical en cada barra marca el monto presupuestado para el periodo.</p>
        }
      }
    </div>
  `,
  styles: `
    .barras {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 12px;
    }
    .fila-texto {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 0.9rem;
      margin-bottom: 4px;
      strong {
        font-variant-numeric: tabular-nums;
      }
      &.total {
        border-top: 1px solid var(--borde);
        margin-top: 12px;
        padding-top: 10px;
      }
    }
    .pista {
      position: relative;
      height: 10px;
      border-radius: 4px;
      background: var(--superficie-2);
    }
    .barra {
      height: 100%;
      border-radius: 0 4px 4px 0;
      background: var(--primario);
      min-width: 2px;
    }
    .meta {
      position: absolute;
      top: -3px;
      bottom: -3px;
      width: 2px;
      background: var(--texto);
    }
    @media print {
      .barra,
      .meta {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `,
})
export class Reportes {
  private api = inject(ApiService);
  private notif = inject(NotificacionesService);

  readonly nombreIglesia = environment.nombreIglesia;
  readonly moneda = moneda;
  readonly meses = MESES;
  readonly anios = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  readonly anio = signal(new Date().getFullYear());
  readonly mes = signal(new Date().getMonth() + 1);
  readonly cargando = signal(true);
  private readonly datosAnio = signal({
    ingresos: [] as Registro[],
    egresos: [] as Registro[],
    ventas: [] as Registro[],
    presupuestos: [] as Registro[],
    celulas: [] as Registro[],
  });

  /** Filtra los datos del año al mes elegido (0 = año completo). */
  private readonly periodo = computed(() => {
    const d = this.datosAnio();
    const m = this.mes();
    const delMes = (l: Registro[]) => (m === 0 ? l : l.filter((r) => Number(String(r['fecha']).slice(5, 7)) === m));
    return { ingresos: delMes(d.ingresos), egresos: delMes(d.egresos), ventas: delMes(d.ventas) };
  });

  readonly periodoTexto = computed(() => (this.mes() === 0 ? `Año ${this.anio()}` : `${MESES[this.mes() - 1]} ${this.anio()}`));

  readonly t = computed(() => {
    const p = this.periodo();
    const s = (l: Registro[], c: string) => l.reduce((a, r) => a + (Number(r[c]) || 0), 0);
    const ingresos = s(p.ingresos, 'monto');
    const ventas = s(p.ventas, 'total');
    const egresos = s(p.egresos, 'monto');
    return { ingresos, ventas, egresos, balance: ingresos + ventas - egresos };
  });

  /** Monto presupuestado por categoría para el periodo (anual prorrateado si se ve un mes). */
  private readonly presupuestoPorCategoria = computed(() => {
    const m = this.mes();
    const r = new Map<string, number>();
    for (const p of this.datosAnio().presupuestos) {
      const pm = Number(p['mes']) || 0;
      let monto = 0;
      if (m === 0) monto = Number(p['montoPlanificado']);
      else if (pm === m) monto = Number(p['montoPlanificado']);
      else if (pm === 0) monto = Number(p['montoPlanificado']) / 12;
      if (monto) r.set(p['categoria'], (r.get(p['categoria']) ?? 0) + monto);
    }
    return r;
  });
  readonly hayPresupuesto = computed(() => this.presupuestoPorCategoria().size > 0);

  readonly bloques = computed(() => {
    const p = this.periodo();
    const pres = this.presupuestoPorCategoria();
    const celulas = this.datosAnio().celulas;
    const conPresupuesto = (filas: Fila[]) => filas.map((f) => ({ ...f, presupuesto: pres.get(f.clave) }));
    const ingresosCelula = p.ingresos.filter((r) => r['origen'] === 'celula');
    const definiciones = [
      { titulo: 'Ingresos por tipo', icono: 'savings', tipo: 'ingreso', filas: conPresupuesto(agrupar(p.ingresos, 'tipo', 'monto', etiquetaDe(TIPO_INGRESO))) },
      { titulo: 'Ingresos por origen', icono: 'call_split', tipo: 'ingreso', filas: agrupar(p.ingresos, 'origen', 'monto', etiquetaDe(ORIGEN_INGRESO)) },
      {
        titulo: 'Ingresos por célula',
        icono: 'diversity_3',
        tipo: 'ingreso',
        filas: agrupar(ingresosCelula, 'celulaId', 'monto', (id) => celulas.find((c) => c.id === id)?.['nombre'] ?? 'Sin célula'),
      },
      { titulo: 'Pagos por categoría', icono: 'payments', tipo: 'egreso', filas: conPresupuesto(agrupar(p.egresos, 'categoria', 'monto', etiquetaDe(CATEGORIA_EGRESO))) },
      {
        titulo: 'Ventas por método de pago',
        icono: 'point_of_sale',
        tipo: 'ingreso',
        filas: agrupar(p.ventas, 'metodoPago', 'total', (v) => (v === 'qr' ? 'QR' : 'Efectivo')).map((f) => ({ ...f, presupuesto: undefined as number | undefined })),
      },
    ];
    return definiciones.map((b) => ({
      ...b,
      total: b.filas.reduce((s, f) => s + f.monto, 0),
      maximo: Math.max(1, ...b.filas.map((f) => Math.max(f.monto, f.presupuesto ?? 0))),
    }));
  });

  readonly porMes = computed(() => {
    const d = this.datosAnio();
    return MESES.map((mes, i) => {
      const enMes = (l: Registro[]) => l.filter((r) => Number(String(r['fecha']).slice(5, 7)) === i + 1);
      const s = (l: Registro[], c: string) => l.reduce((a, r) => a + (Number(r[c]) || 0), 0);
      const entradas = s(enMes(d.ingresos), 'monto') + s(enMes(d.ventas), 'total');
      const salidas = s(enMes(d.egresos), 'monto');
      return { mes, entradas, salidas, balance: entradas - salidas };
    });
  });

  constructor() {
    this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    const a = this.anio();
    const rango = { desde: aISO(new Date(a, 0, 1)), hasta: aISO(new Date(a, 11, 31)) };
    try {
      const [ingresos, egresos, ventas, presupuestos, celulas] = await Promise.all([
        this.api.listar('ingresos', rango),
        this.api.listar('egresos', rango),
        this.api.listar('ventas', rango),
        this.api.listar('presupuestos'),
        this.api.listar('celulas', {}, true),
      ]);
      this.datosAnio.set({ ingresos, egresos, ventas, presupuestos: presupuestos.filter((p) => Number(p['anio']) === a), celulas });
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  ancho(f: Fila, maximo: number) {
    return (f.monto / maximo) * 100;
  }

  porcentaje(f: Fila) {
    return f.presupuesto ? Math.round((f.monto / f.presupuesto) * 100) : 0;
  }

  imprimir() {
    window.print();
  }

  exportar() {
    const filas: (string | number)[][] = [
      [`Reporte financiero — ${this.periodoTexto()}`],
      [],
      ['Concepto', 'Monto'],
      ['Ofrendas / diezmos / donaciones', this.t().ingresos],
      ['Ventas', this.t().ventas],
      ['Pagos y gastos', this.t().egresos],
      ['Balance', this.t().balance],
    ];
    for (const b of this.bloques()) {
      filas.push([], [b.titulo, 'Monto', 'Presupuesto']);
      for (const f of b.filas) filas.push([f.etiqueta, f.monto, f.presupuesto ?? '']);
    }
    descargarCSV(`reporte_${this.periodoTexto().replace(/\s+/g, '_')}.csv`, filas);
  }
}
