import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { mensajeError } from '../core/auth.interceptor';
import { ApiService } from '../core/api.service';
import type { Registro } from '../core/modelos';
import { NotificacionesService } from '../core/notificaciones.service';
import { deISO, MESES, nombreCompleto, proximoCumpleanos } from '../core/utilidades';

/** Cumpleaños de los integrantes por mes (dato que faltaba en el diagrama). */
@Component({
  selector: 'app-cumpleanos',
  imports: [FormsModule, RouterLink],
  host: { style: '--modulo: var(--c-miembros)' },
  template: `
    <div class="pagina">
      <div class="pagina-encabezado">
        <div>
          <h1><span class="icono">cake</span>Cumpleaños</h1>
          <p>Cumpleaños de los integrantes. Registra la fecha de nacimiento en <a routerLink="/personas">Personas</a>.</p>
        </div>
        <div class="acciones no-imprimir">
          <button class="btn" type="button" (click)="imprimir()"><span class="icono">print</span> Imprimir</button>
        </div>
      </div>

      <div class="chips no-imprimir">
        @for (m of meses; track $index) {
          <button type="button" class="chip" [class.activo]="mes() === $index" (click)="mes.set($index)">
            {{ m }}<span class="num">{{ conteoPorMes()[$index] || '' }}</span>
          </button>
        }
      </div>

      <h2 class="solo-impresion mb">Cumpleaños de {{ meses[mes()] }}</h2>

      @if (cargando()) {
        <div class="cargando"></div>
      } @else if (!delMes().length) {
        <div class="tarjeta vacio-estado"><span class="icono">cake</span>No hay cumpleaños en {{ meses[mes()] }}.</div>
      } @else {
        <div class="tabla-contenedor">
          <table class="tabla">
            <thead>
              <tr>
                <th>Día</th>
                <th>Nombre</th>
                <th>Cumple</th>
                <th>Teléfono</th>
                <th class="no-imprimir"></th>
              </tr>
            </thead>
            <tbody>
              @for (c of delMes(); track c.p.id) {
                <tr>
                  <td data-label="Día"><span class="insignia" [class]="c.esHoy ? 'verde' : 'azul'">{{ c.dia }} {{ c.esHoy ? '· ¡Hoy!' : '' }}</span></td>
                  <td data-label="Nombre" class="principal">{{ nombre(c.p) }}</td>
                  <td data-label="Cumple">{{ c.edad }} años</td>
                  <td data-label="Teléfono">{{ c.p['telefono'] }}</td>
                  <td class="acciones-celda no-imprimir">
                    @if (c.p['telefono']) {
                      <a class="btn btn-icono" [href]="whatsapp(c.p)" target="_blank" rel="noopener" title="Felicitar por WhatsApp" aria-label="Felicitar por WhatsApp">
                        <span class="icono verde-texto">chat</span>
                      </a>
                      <a class="btn btn-icono" [href]="'tel:' + c.p['telefono']" title="Llamar" aria-label="Llamar"><span class="icono">call</span></a>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (sinFecha() > 0) {
        <p class="texto-2 pequeno mt no-imprimir">{{ sinFecha() }} persona(s) no tienen fecha de nacimiento registrada.</p>
      }
    </div>
  `,
})
export class Cumpleanos {
  private api = inject(ApiService);
  private notif = inject(NotificacionesService);

  readonly meses = MESES;
  readonly mes = signal(new Date().getMonth());
  readonly personas = signal<Registro[]>([]);
  readonly cargando = signal(true);
  readonly nombre = nombreCompleto;

  readonly conFecha = computed(() => this.personas().filter((p) => p['fechaNacimiento']));
  readonly sinFecha = computed(() => this.personas().length - this.conFecha().length);
  readonly conteoPorMes = computed(() => {
    const c = Array(12).fill(0);
    for (const p of this.conFecha()) c[deISO(p['fechaNacimiento']).getMonth()]++;
    return c;
  });
  readonly delMes = computed(() => {
    const h = new Date();
    return this.conFecha()
      .map((p) => {
        const n = deISO(p['fechaNacimiento']);
        const prox = proximoCumpleanos(p['fechaNacimiento'])!;
        return {
          p,
          mes: n.getMonth(),
          dia: n.getDate(),
          edad: h.getFullYear() - n.getFullYear() + (this.mes() < h.getMonth() ? 1 : 0),
          esHoy: prox.dias === 0,
        };
      })
      .filter((c) => c.mes === this.mes())
      .sort((a, b) => a.dia - b.dia);
  });

  constructor() {
    this.api
      .listar('personas', {}, true)
      .then((l) => this.personas.set(l))
      .catch((e) => this.notif.error(mensajeError(e)))
      .finally(() => this.cargando.set(false));
  }

  whatsapp(p: Registro) {
    const numero = String(p['telefono']).replace(/\D/g, '');
    const texto = encodeURIComponent(`¡Feliz cumpleaños, ${p['nombre']}! 🎉 Que Dios te bendiga grandemente en este nuevo año de vida.`);
    return `https://wa.me/${numero}?text=${texto}`;
  }

  imprimir() {
    window.print();
  }
}
