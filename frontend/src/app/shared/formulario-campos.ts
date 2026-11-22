import { Component, input } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import type { Registro } from '../core/modelos';
import { nombreCompleto } from '../core/utilidades';
import type { Campo } from './crud.config';

/** Dibuja los controles de un formulario a partir de una lista de campos. Debe ir dentro de un <form>. */
@Component({
  selector: 'app-formulario-campos',
  imports: [FormsModule],
  // Registra los controles en el <form> del componente padre (para validar con form.invalid).
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
  template: `
    <div class="formulario">
      @for (c of camposVisibles(); track c.clave) {
        <div class="campo" [class.completo]="c.completo || c.tipo === 'textarea'">
          @if (c.tipo === 'booleano') {
            <label class="check">
              <input type="checkbox" [name]="c.clave" [(ngModel)]="modelo()[c.clave]" />
              {{ c.etiqueta }}
            </label>
          } @else {
            <label [for]="'f-' + c.clave" [class.requerido]="c.requerido">{{ c.etiqueta }}</label>
            @switch (c.tipo) {
              @case ('textarea') {
                <textarea [id]="'f-' + c.clave" [name]="c.clave" [(ngModel)]="modelo()[c.clave]" [required]="!!c.requerido"></textarea>
              }
              @case ('select') {
                <select [id]="'f-' + c.clave" [name]="c.clave" [(ngModel)]="modelo()[c.clave]" [required]="!!c.requerido">
                  @for (o of c.opciones; track o.valor) {
                    <option [value]="o.valor">{{ o.etiqueta }}</option>
                  }
                </select>
              }
              @case ('relacion') {
                <select [id]="'f-' + c.clave" [name]="c.clave" [(ngModel)]="modelo()[c.clave]" [required]="!!c.requerido">
                  <option value="">— Ninguno —</option>
                  @for (r of relaciones()[c.relacion!] ?? []; track r.id) {
                    <option [value]="r.id">{{ etiqueta(r) }}</option>
                  }
                </select>
              }
              @case ('numero') {
                <input [id]="'f-' + c.clave" type="number" inputmode="numeric" min="0" [name]="c.clave" [(ngModel)]="modelo()[c.clave]" [required]="!!c.requerido" />
              }
              @case ('moneda') {
                <input [id]="'f-' + c.clave" type="number" inputmode="decimal" min="0" step="0.01" [name]="c.clave" [(ngModel)]="modelo()[c.clave]" [required]="!!c.requerido" />
              }
              @case ('fecha') {
                <input [id]="'f-' + c.clave" type="date" [name]="c.clave" [(ngModel)]="modelo()[c.clave]" [required]="!!c.requerido" />
              }
              @case ('hora') {
                <input [id]="'f-' + c.clave" type="time" [name]="c.clave" [(ngModel)]="modelo()[c.clave]" [required]="!!c.requerido" />
              }
              @case ('email') {
                <input [id]="'f-' + c.clave" type="email" inputmode="email" autocomplete="email" [name]="c.clave" [(ngModel)]="modelo()[c.clave]" [required]="!!c.requerido" />
              }
              @case ('tel') {
                <input [id]="'f-' + c.clave" type="tel" inputmode="tel" autocomplete="tel" [name]="c.clave" [(ngModel)]="modelo()[c.clave]" [required]="!!c.requerido" />
              }
              @default {
                <input [id]="'f-' + c.clave" type="text" [name]="c.clave" [(ngModel)]="modelo()[c.clave]" [required]="!!c.requerido" />
              }
            }
          }
          @if (c.ayuda) {
            <span class="ayuda">{{ c.ayuda }}</span>
          }
        </div>
      }
    </div>
  `,
})
export class FormularioCampos {
  readonly campos = input.required<Campo[]>();
  readonly modelo = input.required<Record<string, any>>();
  readonly relaciones = input<Record<string, Registro[]>>({});

  camposVisibles() {
    const m = this.modelo();
    return this.campos().filter((c) => !c.visibleSi || c.visibleSi(m));
  }

  etiqueta(r: Registro) {
    return nombreCompleto(r);
  }
}
