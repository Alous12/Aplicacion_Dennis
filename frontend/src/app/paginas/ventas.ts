import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { mensajeError } from '../core/auth.interceptor';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import type { Registro } from '../core/modelos';
import { NotificacionesService } from '../core/notificaciones.service';
import { aISO, comprimirImagen, descargarCSV, fechaCorta, fechaLarga, hoy, moneda, primerDiaMes, ultimoDiaMes } from '../core/utilidades';
import { Modal } from '../shared/modal';

interface ConfigVentas {
  qrImagen: string;
  qrDescripcion: string;
}

type Rango = 'hoy' | 'semana' | 'mes' | 'personalizado';

@Component({
  selector: 'app-ventas',
  imports: [FormsModule, Modal, RouterLink],
  host: { style: '--modulo: var(--c-ventas)' },
  template: `
    <div class="pagina">
      <div class="pagina-encabezado no-imprimir">
        <div>
          <h1><span class="icono">point_of_sale</span>Ventas</h1>
          <p>Registra ventas con pago por QR o en efectivo y genera reportes.</p>
        </div>
        @if (auth.esAdmin()) {
          <div class="acciones">
            <a class="btn" routerLink="/ventas/productos"><span class="icono">sell</span> Productos</a>
            <button class="btn" type="button" (click)="abrirConfigQR()"><span class="icono">qr_code_2</span> Configurar QR</button>
          </div>
        }
      </div>

      <div class="distribucion">
        <!-- ═══ Nueva venta ═══ -->
        <section class="tarjeta no-imprimir">
          <div class="tarjeta-titulo"><span class="icono">add_shopping_cart</span> Nueva venta</div>
          <form #f="ngForm" (ngSubmit)="registrar(f.invalid)" class="formulario">
            <div class="campo completo">
              <label for="producto" class="requerido">Producto</label>
              <select id="producto" name="productoId" [ngModel]="venta.productoId" (ngModelChange)="elegirProducto($event)" required>
                <option value="" disabled>Elige un producto…</option>
                @for (p of productos(); track p.id) {
                  <option [value]="p.id">{{ p['nombre'] }} — {{ moneda(p['precio']) }}</option>
                }
              </select>
              @if (!productos().length) {
                <span class="ayuda">
                  No hay productos registrados.
                  @if (auth.esAdmin()) {
                    <a routerLink="/ventas/productos">Agregar productos</a>
                  } @else {
                    Pide a un administrador que los agregue.
                  }
                </span>
              }
            </div>
            <div class="campo">
              <label for="cantidad" class="requerido">Cantidad</label>
              <input id="cantidad" name="cantidad" type="number" inputmode="numeric" min="1" step="1" [(ngModel)]="venta.cantidad" required />
            </div>
            <div class="campo">
              <label for="precio" class="requerido">Precio unitario</label>
              <input id="precio" name="precio" type="number" inputmode="decimal" min="0.01" step="0.01" [(ngModel)]="venta.precioUnitario" required />
            </div>

            <div class="total completo">
              <span>Total a cobrar</span>
              <strong>{{ moneda(totalVenta()) }}</strong>
            </div>

            <div class="campo completo">
              <label>Método de pago</label>
              <div class="segmentado">
                <button type="button" [class.activo]="venta.metodoPago === 'qr'" (click)="venta.metodoPago = 'qr'">
                  <span class="icono">qr_code_2</span> QR
                </button>
                <button type="button" [class.activo]="venta.metodoPago === 'efectivo'" (click)="venta.metodoPago = 'efectivo'">
                  <span class="icono">payments</span> Efectivo
                </button>
              </div>
            </div>

            @if (venta.metodoPago === 'qr') {
              <div class="completo qr-caja">
                @if (config().qrImagen) {
                  <button type="button" class="qr-boton" (click)="qrGrande.set(true)" aria-label="Ampliar QR">
                    <img [src]="config().qrImagen" alt="Código QR para pagar" />
                  </button>
                  <p class="pequeno texto-2">Toca el QR para ampliarlo y mostrarlo al comprador.</p>
                  @if (config().qrDescripcion) {
                    <p class="pequeno negrita">{{ config().qrDescripcion }}</p>
                  }
                } @else {
                  <p class="texto-2">Aún no se ha subido la imagen del QR.{{ auth.esAdmin() ? ' Usa “Configurar QR”.' : ' Pide a un administrador que la suba.' }}</p>
                }
              </div>
              <div class="campo completo">
                <label for="ref">N.º de transacción / referencia (opcional)</label>
                <input id="ref" name="referencia" [(ngModel)]="venta.referencia" />
              </div>
            } @else {
              <div class="campo">
                <label for="recibido">Monto recibido</label>
                <input id="recibido" name="recibido" type="number" inputmode="decimal" min="0" step="0.01" [(ngModel)]="recibido" />
              </div>
              <div class="campo">
                <label>Cambio</label>
                <div class="control cambio" [class.rojo-texto]="cambio() < 0">{{ recibido ? moneda(cambio()) : '—' }}</div>
              </div>
            }

            <div class="campo">
              <label for="comprador">Comprador (opcional)</label>
              <input id="comprador" name="comprador" [(ngModel)]="venta.comprador" />
            </div>
            <div class="campo">
              <label for="fecha" class="requerido">Fecha</label>
              <input id="fecha" name="fecha" type="date" [(ngModel)]="venta.fecha" required />
            </div>

            <button class="btn btn-primario btn-bloque completo" type="submit" [disabled]="guardando()">
              <span class="icono">check</span> {{ guardando() ? 'Guardando…' : 'Registrar venta' }}
            </button>
          </form>
        </section>

        <!-- ═══ Reporte ═══ -->
        <section>
          <div class="solo-impresion mb">
            <h2>{{ nombreIglesia }} — Reporte de ventas</h2>
            <p>Del {{ fechaLarga(desde) }} al {{ fechaLarga(hasta) }}</p>
          </div>

          <div class="tarjeta no-imprimir mb">
            <div class="tarjeta-titulo"><span class="icono">summarize</span> Reporte de ventas</div>
            <div class="chips" style="margin-bottom: 8px">
              <button type="button" class="chip" [class.activo]="rango() === 'hoy'" (click)="elegirRango('hoy')">Hoy</button>
              <button type="button" class="chip" [class.activo]="rango() === 'semana'" (click)="elegirRango('semana')">Últimos 7 días</button>
              <button type="button" class="chip" [class.activo]="rango() === 'mes'" (click)="elegirRango('mes')">Este mes</button>
            </div>
            <div class="barra-filtros" style="margin: 0">
              <input class="control" type="date" aria-label="Desde" [(ngModel)]="desde" (ngModelChange)="rango.set('personalizado'); cargar()" />
              <input class="control" type="date" aria-label="Hasta" [(ngModel)]="hasta" (ngModelChange)="rango.set('personalizado'); cargar()" />
              <select class="control" [ngModel]="filtroMetodo()" (ngModelChange)="filtroMetodo.set($event)" aria-label="Método">
                <option value="">Todos los métodos</option>
                <option value="qr">Solo QR</option>
                <option value="efectivo">Solo efectivo</option>
              </select>
            </div>
            <div class="acciones mt">
              <button class="btn" type="button" (click)="imprimir()" [disabled]="!filtradas().length"><span class="icono">print</span> Imprimir / PDF</button>
              <button class="btn" type="button" (click)="exportar()" [disabled]="!filtradas().length"><span class="icono">download</span> Guardar CSV</button>
            </div>
          </div>

          <div class="estadisticas">
            <div class="estadistica"><div class="etiqueta">Total</div><div class="valor">{{ moneda(totales().total) }}</div></div>
            <div class="estadistica"><div class="etiqueta">Por QR</div><div class="valor">{{ moneda(totales().qr) }}</div></div>
            <div class="estadistica"><div class="etiqueta">Efectivo</div><div class="valor">{{ moneda(totales().efectivo) }}</div></div>
            <div class="estadistica"><div class="etiqueta">N.º ventas</div><div class="valor">{{ filtradas().length }}</div></div>
          </div>

          @if (cargando()) {
            <div class="cargando"></div>
          } @else if (!filtradas().length) {
            <div class="tarjeta vacio-estado"><span class="icono">receipt</span>No hay ventas en este periodo.</div>
          } @else {
            <div class="tabla-contenedor mb">
              <table class="tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th class="num">Cant.</th>
                    <th class="num">Total</th>
                    <th>Pago</th>
                    <th>Fecha</th>
                    <th>Comprador</th>
                    @if (auth.esAdmin()) {
                      <th class="no-imprimir"></th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (v of filtradas(); track v.id) {
                    <tr>
                      <td class="principal" data-label="Producto">{{ v['producto'] }}</td>
                      <td class="num" data-label="Cantidad">{{ v['cantidad'] }} × {{ moneda(v['precioUnitario']) }}</td>
                      <td class="num negrita" data-label="Total">{{ moneda(v['total']) }}</td>
                      <td data-label="Pago">
                        <span class="insignia" [class]="v['metodoPago'] === 'qr' ? 'azul' : 'verde'">{{ v['metodoPago'] === 'qr' ? 'QR' : 'Efectivo' }}</span>
                      </td>
                      <td data-label="Fecha">{{ fechaCorta(v['fecha']) }}</td>
                      <td data-label="Comprador" [class.vacio]="!v['comprador']">{{ v['comprador'] }}</td>
                      @if (auth.esAdmin()) {
                        <td class="acciones-celda no-imprimir">
                          <button class="btn btn-icono" type="button" (click)="eliminar(v)" aria-label="Eliminar venta"><span class="icono rojo-texto">delete</span></button>
                        </td>
                      }
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td data-label="Total del periodo" colspan="2">Total del periodo</td>
                    <td class="num" data-label="Total">{{ moneda(totales().total) }}</td>
                    <td colspan="3" class="vacio"></td>
                    @if (auth.esAdmin()) {
                      <td class="vacio no-imprimir"></td>
                    }
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="tarjeta">
              <div class="tarjeta-titulo"><span class="icono">category</span> Resumen por producto</div>
              <ul class="lista-simple">
                @for (p of porProducto(); track p.producto) {
                  <li>
                    <span>{{ p.producto }} <span class="texto-2 pequeno">× {{ p.cantidad }}</span></span>
                    <strong>{{ moneda(p.total) }}</strong>
                  </li>
                }
              </ul>
            </div>
          }
        </section>
      </div>
    </div>

    <!-- QR ampliado para mostrar al comprador -->
    @if (qrGrande()) {
      <div class="qr-pantalla" (click)="qrGrande.set(false)">
        <img [src]="config().qrImagen" alt="Código QR para pagar" />
        <strong>{{ moneda(totalVenta()) }}</strong>
        @if (config().qrDescripcion) {
          <span>{{ config().qrDescripcion }}</span>
        }
        <small>Toca para cerrar</small>
      </div>
    }

    <!-- Configurar QR (solo admin) -->
    <app-modal [abierto]="modalQR()" titulo="Imagen del QR de cobro" (cerrar)="modalQR.set(false)">
      <div class="formulario">
        <div class="campo completo">
          <label for="qr-archivo">Subir imagen del QR (PNG o JPG)</label>
          <input id="qr-archivo" type="file" accept="image/png,image/jpeg,image/webp" (change)="elegirImagen($event)" />
          <span class="ayuda">La imagen se reduce automáticamente antes de guardarse.</span>
        </div>
        @if (qrBorrador()) {
          <div class="completo qr-caja">
            <img [src]="qrBorrador()" alt="Vista previa del QR" style="max-width: 260px" />
          </div>
        }
        <div class="campo completo">
          <label for="qr-desc">Descripción (banco, titular, etc.)</label>
          <input id="qr-desc" [(ngModel)]="qrDescripcionBorrador" />
        </div>
      </div>
      <ng-container pie>
        @if (qrBorrador()) {
          <button class="btn btn-peligro" type="button" (click)="qrBorrador.set('')">Quitar imagen</button>
        }
        <button class="btn" type="button" (click)="modalQR.set(false)">Cancelar</button>
        <button class="btn btn-primario" type="button" (click)="guardarQR()" [disabled]="guardando()"><span class="icono">save</span> Guardar</button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    .distribucion {
      display: grid;
      gap: 16px;
      align-items: start;
      @media (min-width: 1100px) {
        grid-template-columns: 400px 1fr;
      }
    }
    .total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--modulo) 10%, transparent);
      strong {
        font-size: 1.6rem;
        color: var(--modulo);
        font-variant-numeric: tabular-nums;
      }
    }
    .qr-caja {
      text-align: center;
      img {
        width: 100%;
        max-width: 240px;
        border-radius: 12px;
        border: 1px solid var(--borde);
        background: #fff;
      }
      p {
        margin: 6px 0 0;
      }
    }
    .qr-boton {
      border: 0;
      padding: 0;
      background: none;
      cursor: zoom-in;
    }
    .cambio {
      display: flex;
      align-items: center;
      font-weight: 700;
      background: var(--superficie-2);
    }
    .qr-pantalla {
      position: fixed;
      inset: 0;
      z-index: 60;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 24px;
      text-align: center;
      img {
        width: min(88vw, 70vh);
        height: auto;
      }
      strong {
        font-size: 2rem;
      }
      small {
        color: var(--texto-2);
      }
    }
  `,
})
export class Ventas {
  private api = inject(ApiService);
  private notif = inject(NotificacionesService);
  readonly auth = inject(AuthService);

  readonly nombreIglesia = environment.nombreIglesia;
  readonly moneda = moneda;
  readonly fechaCorta = fechaCorta;
  readonly fechaLarga = fechaLarga;

  readonly config = signal<ConfigVentas>({ qrImagen: '', qrDescripcion: '' });
  readonly ventas = signal<Registro[]>([]);
  readonly productos = signal<Registro[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly qrGrande = signal(false);
  readonly modalQR = signal(false);
  readonly rango = signal<Rango>('hoy');
  readonly filtroMetodo = signal('');

  venta = this.ventaVacia();
  recibido: number | null = null;
  desde = hoy();
  hasta = hoy();
  readonly qrBorrador = signal('');
  qrDescripcionBorrador = '';

  readonly filtradas = computed(() => this.ventas().filter((v) => !this.filtroMetodo() || v['metodoPago'] === this.filtroMetodo()));
  readonly totales = computed(() => {
    const t = { total: 0, qr: 0, efectivo: 0 };
    for (const v of this.filtradas()) {
      t.total += Number(v['total']) || 0;
      if (v['metodoPago'] === 'qr') t.qr += Number(v['total']) || 0;
      else t.efectivo += Number(v['total']) || 0;
    }
    return t;
  });
  readonly porProducto = computed(() => {
    const m = new Map<string, { producto: string; cantidad: number; total: number }>();
    for (const v of this.filtradas()) {
      const k = String(v['producto']).trim();
      const a = m.get(k) ?? { producto: k, cantidad: 0, total: 0 };
      a.cantidad += Number(v['cantidad']) || 0;
      a.total += Number(v['total']) || 0;
      m.set(k, a);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  });

  constructor() {
    this.cargar();
    this.cargarProductos();
    this.api
      .get<ConfigVentas>('configuracion/ventas')
      .then((c) => this.config.set(c))
      .catch(() => {});
  }

  totalVenta() {
    return Math.round((Number(this.venta.cantidad) || 0) * (Number(this.venta.precioUnitario) || 0) * 100) / 100;
  }

  cambio() {
    return (Number(this.recibido) || 0) - this.totalVenta();
  }

  /** Al elegir un producto se copia su nombre y su precio (el precio se puede ajustar). */
  elegirProducto(id: string) {
    const p = this.productos().find((x) => x.id === id);
    this.venta.productoId = id;
    this.venta.producto = p?.['nombre'] ?? '';
    this.venta.precioUnitario = p ? Number(p['precio']) : null;
  }

  private async cargarProductos() {
    try {
      const lista = await this.api.listar('productos');
      this.productos.set(
        lista.filter((p) => p['activo'] !== false).sort((a, b) => String(a['nombre']).localeCompare(String(b['nombre']))),
      );
    } catch (e) {
      this.notif.error(mensajeError(e));
    }
  }

  private ventaVacia() {
    return { productoId: '', producto: '', cantidad: 1, precioUnitario: null as number | null, comprador: '', metodoPago: 'efectivo' as 'qr' | 'efectivo', referencia: '', fecha: hoy() };
  }

  elegirRango(r: Rango) {
    this.rango.set(r);
    const h = new Date();
    if (r === 'hoy') this.desde = this.hasta = hoy();
    if (r === 'semana') {
      this.desde = aISO(new Date(h.getFullYear(), h.getMonth(), h.getDate() - 6));
      this.hasta = hoy();
    }
    if (r === 'mes') {
      this.desde = primerDiaMes();
      this.hasta = ultimoDiaMes();
    }
    this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    try {
      const lista = await this.api.listar('ventas', { desde: this.desde, hasta: this.hasta });
      this.ventas.set(lista);
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  async registrar(invalido: boolean | null) {
    if (invalido || !this.venta.productoId || !this.venta.precioUnitario) {
      this.notif.error('Elige un producto e indica cantidad y precio');
      return;
    }
    if (this.venta.metodoPago === 'efectivo' && this.recibido && this.cambio() < 0) {
      this.notif.error('El monto recibido es menor al total');
      return;
    }
    this.guardando.set(true);
    try {
      await this.api.crear('ventas', { ...this.venta, referencia: this.venta.metodoPago === 'qr' ? this.venta.referencia : '' });
      this.notif.exito(`Venta registrada: ${moneda(this.totalVenta())}`);
      const metodo = this.venta.metodoPago;
      this.venta = { ...this.ventaVacia(), metodoPago: metodo };
      this.recibido = null;
      await this.cargar();
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(v: Registro) {
    if (!this.notif.confirmar(`¿Eliminar la venta de "${v['producto']}" por ${moneda(v['total'])}?`)) return;
    try {
      await this.api.eliminar('ventas', v.id);
      this.ventas.update((l) => l.filter((x) => x.id !== v.id));
      this.notif.exito('Venta eliminada');
    } catch (e) {
      this.notif.error(mensajeError(e));
    }
  }

  imprimir() {
    window.print();
  }

  exportar() {
    const filas: (string | number)[][] = [
      ['Fecha', 'Producto', 'Cantidad', 'Precio unitario', 'Total', 'Método', 'Referencia', 'Comprador', 'Registrado por'],
      ...this.filtradas().map((v) => [
        v['fecha'],
        v['producto'],
        v['cantidad'],
        v['precioUnitario'],
        v['total'],
        v['metodoPago'] === 'qr' ? 'QR' : 'Efectivo',
        v['referencia'] ?? '',
        v['comprador'] ?? '',
        v['creadoPor'] ?? '',
      ]),
      [],
      ['', '', '', 'Total QR', this.totales().qr],
      ['', '', '', 'Total efectivo', this.totales().efectivo],
      ['', '', '', 'TOTAL', this.totales().total],
    ];
    descargarCSV(`ventas_${this.desde}_a_${this.hasta}.csv`, filas);
  }

  abrirConfigQR() {
    this.qrBorrador.set(this.config().qrImagen);
    this.qrDescripcionBorrador = this.config().qrDescripcion;
    this.modalQR.set(true);
  }

  async elegirImagen(ev: Event) {
    const archivo = (ev.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    try {
      this.qrBorrador.set(await comprimirImagen(archivo));
    } catch (e) {
      this.notif.error(mensajeError(e));
    }
  }

  async guardarQR() {
    this.guardando.set(true);
    try {
      const c = await this.api.put<ConfigVentas>('configuracion/ventas', {
        qrImagen: this.qrBorrador(),
        qrDescripcion: this.qrDescripcionBorrador,
      });
      this.config.set(c);
      this.modalQR.set(false);
      this.notif.exito('QR actualizado');
    } catch (e) {
      this.notif.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
