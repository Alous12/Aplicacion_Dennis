import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import type { Registro } from '../core/modelos';
import { fechaLarga, hoy, moneda, nombreCompleto, primerDiaMes, proximoCumpleanos, ultimoDiaMes } from '../core/utilidades';
import { TIPO_EVENTO } from '../modulos.config';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink],
  template: `
    <div class="pagina">
      <div class="pagina-encabezado">
        <div>
          <h1>Hola, {{ primerNombre() }} 👋</h1>
          <p>{{ fechaHoy }}</p>
        </div>
        <div class="acciones">
          <a class="btn" routerLink="/personas"><span class="icono">person_add</span> Persona</a>
          <a class="btn btn-primario" routerLink="/ventas"><span class="icono">point_of_sale</span> Nueva venta</a>
        </div>
      </div>

      @if (cargando()) {
        <div class="cargando"></div>
      } @else {
        <div class="estadisticas">
          <div class="estadistica" style="--modulo: var(--c-miembros)">
            <div class="etiqueta">Miembros</div>
            <div class="valor">{{ miembros() }}</div>
          </div>
          <div class="estadistica" style="--modulo: var(--c-miembros)">
            <div class="etiqueta">Visitantes</div>
            <div class="valor">{{ visitantes() }}</div>
          </div>
          <div class="estadistica" style="--modulo: var(--c-eventos)">
            <div class="etiqueta">Eventos próximos</div>
            <div class="valor">{{ proximosEventos().length }}</div>
          </div>
          @if (auth.esAdmin()) {
            <div class="estadistica positivo">
              <div class="etiqueta">Ingresos del mes</div>
              <div class="valor">{{ moneda(ingresosMes()) }}</div>
            </div>
            <div class="estadistica negativo">
              <div class="etiqueta">Pagos del mes</div>
              <div class="valor">{{ moneda(egresosMes()) }}</div>
            </div>
          }
          <div class="estadistica" style="--modulo: var(--c-ventas)">
            <div class="etiqueta">Ventas del mes</div>
            <div class="valor">{{ moneda(ventasMes()) }}</div>
          </div>
        </div>

        <div class="rejilla">
          <section class="tarjeta" style="--modulo: var(--c-miembros)">
            <div class="tarjeta-titulo"><span class="icono">cake</span> Cumpleaños (próximos 30 días)</div>
            @if (!cumpleanos().length) {
              <p class="texto-2">No hay cumpleaños próximos.</p>
            } @else {
              <ul class="lista-simple">
                @for (c of cumpleanos(); track c.persona.id) {
                  <li>
                    <span>
                      <strong>{{ nombre(c.persona) }}</strong><br />
                      <span class="texto-2 pequeno">Cumple {{ c.edad }} años</span>
                    </span>
                    <span class="insignia" [class]="c.dias === 0 ? 'verde' : c.dias <= 7 ? 'ambar' : 'azul'">
                      {{ c.dias === 0 ? '¡Hoy! 🎉' : c.dias === 1 ? 'Mañana' : 'en ' + c.dias + ' días' }}
                    </span>
                  </li>
                }
              </ul>
            }
            <a class="btn btn-texto mt" routerLink="/cumpleanos">Ver todos <span class="icono">chevron_right</span></a>
          </section>

          <section class="tarjeta" style="--modulo: var(--c-eventos)">
            <div class="tarjeta-titulo"><span class="icono">event</span> Próximos eventos y cultos</div>
            @if (!proximosEventos().length) {
              <p class="texto-2">No hay eventos programados.</p>
            } @else {
              <ul class="lista-simple">
                @for (e of proximosEventos().slice(0, 6); track e.id) {
                  <li>
                    <a [routerLink]="['/eventos', e.id]" style="color: inherit; text-decoration: none">
                      <strong>{{ e['titulo'] }}</strong><br />
                      <span class="texto-2 pequeno">{{ fecha(e['fecha']) }} {{ e['hora'] ? '· ' + e['hora'] : '' }}</span>
                    </a>
                    <span class="insignia" [class]="tipoEvento(e['tipo'])?.color ?? 'gris'">{{ tipoEvento(e['tipo'])?.etiqueta }}</span>
                  </li>
                }
              </ul>
            }
            <a class="btn btn-texto mt" routerLink="/eventos">Ver calendario <span class="icono">chevron_right</span></a>
          </section>

          <section class="tarjeta" style="--modulo: var(--c-miembros)">
            <div class="tarjeta-titulo"><span class="icono">person_search</span> Visitantes en seguimiento</div>
            @if (!enSeguimiento().length) {
              <p class="texto-2">No hay visitantes en seguimiento.</p>
            } @else {
              <ul class="lista-simple">
                @for (p of enSeguimiento().slice(0, 6); track p.id) {
                  <li>
                    <strong>{{ nombre(p) }}</strong>
                    @if (p['telefono']) {
                      <a class="btn btn-icono" [href]="'tel:' + p['telefono']" aria-label="Llamar"><span class="icono">call</span></a>
                    }
                  </li>
                }
              </ul>
            }
            <a class="btn btn-texto mt" routerLink="/personas">Ver personas <span class="icono">chevron_right</span></a>
          </section>
        </div>
      }
    </div>
  `,
})
export class Inicio {
  private api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly cargando = signal(true);
  readonly personas = signal<Registro[]>([]);
  readonly eventos = signal<Registro[]>([]);
  readonly ingresos = signal<Registro[]>([]);
  readonly egresos = signal<Registro[]>([]);
  readonly ventas = signal<Registro[]>([]);

  readonly fechaHoy = fechaLarga(hoy());
  readonly moneda = moneda;
  readonly fecha = fechaLarga;
  readonly nombre = nombreCompleto;

  readonly primerNombre = computed(() => this.auth.usuario()?.nombre.split(' ')[0] ?? '');
  readonly miembros = computed(() => this.personas().filter((p) => p['tipo'] === 'miembro').length);
  readonly visitantes = computed(() => this.personas().filter((p) => p['tipo'] === 'visitante').length);
  readonly enSeguimiento = computed(() => this.personas().filter((p) => p['etapa'] === 'seguimiento_visitante'));
  readonly proximosEventos = computed(() =>
    this.eventos()
      .filter((e) => e['estado'] !== 'cancelado')
      .sort((a, b) => (a['fecha'] + (a['hora'] ?? '')).localeCompare(b['fecha'] + (b['hora'] ?? ''))),
  );
  readonly cumpleanos = computed(() =>
    this.personas()
      .map((persona) => ({ persona, ...proximoCumpleanos(persona['fechaNacimiento'])! }))
      .filter((c) => c.dias !== undefined && c.dias <= 30)
      .sort((a, b) => a.dias - b.dias),
  );
  readonly suma = (l: Registro[], campo: string) => l.reduce((s, r) => s + (Number(r[campo]) || 0), 0);
  readonly ingresosMes = computed(() => this.suma(this.ingresos(), 'monto'));
  readonly egresosMes = computed(() => this.suma(this.egresos(), 'monto'));
  readonly ventasMes = computed(() => this.suma(this.ventas(), 'total'));

  constructor() {
    this.cargar();
  }

  tipoEvento(v: string) {
    return TIPO_EVENTO.find((o) => o.valor === v);
  }

  private async cargar() {
    const mes = { desde: primerDiaMes(), hasta: ultimoDiaMes() };
    const seguro = (p: Promise<Registro[]>) => p.catch(() => [] as Registro[]);
    const [personas, eventos, ventas] = await Promise.all([
      seguro(this.api.listar('personas', {}, true)),
      seguro(this.api.listar('eventos', { desde: hoy() })),
      seguro(this.api.listar('ventas', mes)),
    ]);
    this.personas.set(personas);
    this.eventos.set(eventos);
    this.ventas.set(ventas);
    if (this.auth.esAdmin()) {
      const [ing, egr] = await Promise.all([seguro(this.api.listar('ingresos', mes)), seguro(this.api.listar('egresos', mes))]);
      this.ingresos.set(ing);
      this.egresos.set(egr);
    }
    this.cargando.set(false);
  }
}
