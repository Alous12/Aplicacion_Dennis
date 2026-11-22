import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { mensajeError } from '../core/auth.interceptor';
import { ApiService } from '../core/api.service';
import type { Registro } from '../core/modelos';
import { NotificacionesService } from '../core/notificaciones.service';
import { aISO, deISO, descargarCSV, fechaCorta, fechaLarga, moneda, primerDiaMes, ultimoDiaMes } from '../core/utilidades';
import { CATEGORIA_EGRESO, TIPO_INGRESO } from '../modulos.config';

interface Movimiento {
  id: string;
  fecha: string;
  concepto: string;
  categoria: string;
  ingreso: number;
  egreso: number;
  saldo: number;
  ruta?: unknown[];
}

const suma = (l: Registro[], campo: string) => l.reduce((s, r) => s + (Number(r[campo]) || 0), 0);

/** Registro contable: libro de movimientos (ingresos, ventas y pagos) con saldo acumulado. */
@Component({
  selector: 'app-libro-contable',
  imports: [FormsModule, RouterLink],
  host: { style: '--modulo: var(--c-tesoreria)' },
  template: `
    <div class="pagina">
      <div class="pagina-encabezado">
        <div>
          <h1><span class="icono">menu_book</span>Registro contable</h1>
          <p class="no-imprimir">Todos los movimientos del periodo con saldo acumulado.</p>
          <p class="solo-impresion">{{ nombreIglesia }} · Del {{ fechaLarga(desde) }} al {{ fechaLarga(hasta) }}</p>
        </div>
        <div class="acciones no-imprimir">
          <button class="btn" type="button" (click)="imprimir()"><span class="icono">print</span> Imprimir</button>
          <button class="btn" type="button" (click)="exportar()"><span class="icono">download</span> CSV</button>
        </div>
      </div>

      <div class="barra-filtros no-imprimir">
        <input class="control" type="date" aria-label="Desde" [(ngModel)]="desde" (ngModelChange)="cargar()" />
        <input class="control" type="date" aria-label="Hasta" [(ngModel)]="hasta" (ngModelChange)="cargar()" />
        <label class="check"><input type="checkbox" [ngModel]="incluirVentas()" (ngModelChange)="incluirVentas.set($event)" /> Incluir ventas</label>
      </div>

      <div class="estadisticas">
        <div class="estadistica"><div class="etiqueta">Saldo inicial</div><div class="valor">{{ moneda(saldoInicial()) }}</div></div>
        <div class="estadistica positivo"><div class="etiqueta">Entradas</div><div class="valor">{{ moneda(totales().entradas) }}</div></div>
        <div class="estadistica negativo"><div class="etiqueta">Salidas</div><div class="valor">{{ moneda(totales().salidas) }}</div></div>
        <div class="estadistica"><div class="etiqueta">Saldo final</div><div class="valor" [class.rojo-texto]="saldoFinal() < 0">{{ moneda(saldoFinal()) }}</div></div>
      </div>

      @if (cargando()) {
        <div class="cargando"></div>
      } @else if (!movimientos().length) {
        <div class="tarjeta vacio-estado"><span class="icono">menu_book</span>Sin movimientos en este periodo.</div>
      } @else {
        <div class="tabla-contenedor">
          <table class="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Categoría</th>
                <th class="num">Entrada</th>
                <th class="num">Salida</th>
                <th class="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              @for (m of movimientos(); track m.id) {
                <tr>
                  <td data-label="Fecha">{{ fechaCorta(m.fecha) }}</td>
                  <td data-label="Concepto" class="principal">
                    @if (m.ruta) {
                      <a [routerLink]="m.ruta">{{ m.concepto }}</a>
                    } @else {
                      {{ m.concepto }}
                    }
                  </td>
                  <td data-label="Categoría">{{ m.categoria }}</td>
                  <td data-label="Entrada" class="num verde-texto" [class.vacio]="!m.ingreso">{{ m.ingreso ? moneda(m.ingreso) : '' }}</td>
                  <td data-label="Salida" class="num rojo-texto" [class.vacio]="!m.egreso">{{ m.egreso ? moneda(m.egreso) : '' }}</td>
                  <td data-label="Saldo" class="num negrita">{{ moneda(m.saldo) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class LibroContable {
  private api = inject(ApiService);
  private notif = inject(NotificacionesService);

  readonly nombreIglesia = environment.nombreIglesia;
  readonly moneda = moneda;
  readonly fechaCorta = fechaCorta;
  readonly fechaLarga = fechaLarga;

  desde = primerDiaMes();
  hasta = ultimoDiaMes();
  readonly incluirVentas = signal(true);
  readonly cargando = signal(true);
  private readonly datos = signal({ ingresos: [] as Registro[], egresos: [] as Registro[], ventas: [] as Registro[] });
  private readonly previos = signal({ ingresos: 0, egresos: 0, ventas: 0 });

  readonly saldoInicial = computed(() => {
    const p = this.previos();
    return p.ingresos - p.egresos + (this.incluirVentas() ? p.ventas : 0);
  });

  readonly movimientos = computed<Movimiento[]>(() => {
    const d = this.datos();
    const etiqueta = (lista: { valor: string; etiqueta: string }[], v: string) => lista.find((o) => o.valor === v)?.etiqueta ?? v;
    const filas: Omit<Movimiento, 'saldo'>[] = [
      ...d.ingresos.map((r) => ({
        id: 'i' + r.id,
        fecha: r['fecha'],
        concepto: `${etiqueta(TIPO_INGRESO, r['tipo'])}${r['numeroRecibo'] ? ' · Recibo N.º ' + r['numeroRecibo'] : ''}${r['descripcion'] ? ' · ' + r['descripcion'] : ''}`,
        categoria: 'Ingreso',
        ingreso: Number(r['monto']) || 0,
        egreso: 0,
        ruta: ['/tesoreria/recibo', r.id],
      })),
      ...(this.incluirVentas()
        ? d.ventas.map((r) => ({
            id: 'v' + r.id,
            fecha: r['fecha'],
            concepto: `Venta: ${r['producto']} × ${r['cantidad']}`,
            categoria: r['metodoPago'] === 'qr' ? 'Venta (QR)' : 'Venta (efectivo)',
            ingreso: Number(r['total']) || 0,
            egreso: 0,
          }))
        : []),
      ...d.egresos.map((r) => ({
        id: 'e' + r.id,
        fecha: r['fecha'],
        concepto: `${r['concepto']}${r['beneficiario'] ? ' · ' + r['beneficiario'] : ''}`,
        categoria: etiqueta(CATEGORIA_EGRESO, r['categoria']),
        ingreso: 0,
        egreso: Number(r['monto']) || 0,
      })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha));

    let saldo = this.saldoInicial();
    return filas.map((f) => {
      saldo += f.ingreso - f.egreso;
      return { ...f, saldo: Math.round(saldo * 100) / 100 };
    });
  });

  readonly totales = computed(() => ({
    entradas: this.movimientos().reduce((s, m) => s + m.ingreso, 0),
    salidas: this.movimientos().reduce((s, m) => s + m.egreso, 0),
  }));
  readonly saldoFinal = computed(() => this.saldoInicial() + this.totales().entradas - this.totales().salidas);

  constructor() {
    this.cargar();
  }

  async cargar() {
    if (!this.desde || !this.hasta) return;
    this.cargando.set(true);
    const rango = { desde: this.desde, hasta: this.hasta };
    const d = deISO(this.desde);
    const antes = { hasta: aISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)) };
    try {
      const [ingresos, egresos, ventas, ingPrev, egrPrev, venPrev] = await Promise.all([
        this.api.listar('ingresos', rango),
        this.api.listar('egresos', rango),
        this.api.listar('ventas', rango),
        this.api.listar('ingresos', antes),
        this.api.listar('egresos', antes),
        this.api.listar('ventas', antes),
      ]);
      this.datos.set({ ingresos, egresos, ventas });
      this.previos.set({ ingresos: suma(ingPrev, 'monto'), egresos: suma(egrPrev, 'monto'), ventas: suma(venPrev, 'total') });
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  imprimir() {
    window.print();
  }

  exportar() {
    descargarCSV(`libro_contable_${this.desde}_a_${this.hasta}.csv`, [
      ['Fecha', 'Concepto', 'Categoría', 'Entrada', 'Salida', 'Saldo'],
      ['', 'Saldo inicial', '', '', '', this.saldoInicial()],
      ...this.movimientos().map((m) => [m.fecha, m.concepto, m.categoria, m.ingreso || '', m.egreso || '', m.saldo]),
      ['', 'TOTALES', '', this.totales().entradas, this.totales().salidas, this.saldoFinal()],
    ]);
  }
}
