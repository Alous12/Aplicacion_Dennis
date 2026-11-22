import { environment } from '../../environments/environment';

const formatoMoneda = new Intl.NumberFormat(environment.moneda.locale, {
  style: 'currency',
  currency: environment.moneda.codigo,
  minimumFractionDigits: 2,
});

export function moneda(valor: unknown): string {
  return formatoMoneda.format(Number(valor) || 0);
}

/** Fecha local de hoy en formato AAAA-MM-DD. */
export function hoy(): string {
  return aISO(new Date());
}

export function aISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Convierte 'AAAA-MM-DD' en Date local (sin desfase de zona horaria). */
export function deISO(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

/** Días que faltan desde hoy hasta la fecha (negativo = ya pasó). */
export function diasHasta(iso: string): number {
  return Math.round((deISO(iso).getTime() - deISO(hoy()).getTime()) / 86_400_000);
}

/** "Vence hoy", "Faltan 3 días", "Vencido hace 2 días"... */
export function textoDias(dias: number): string {
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  if (dias > 1) return `Faltan ${dias} días`;
  return `Vencido hace ${-dias} día${dias === -1 ? '' : 's'}`;
}

export function fechaLarga(iso?: string): string {
  if (!iso) return '';
  return deISO(iso).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function fechaCorta(iso?: string): string {
  if (!iso) return '';
  return deISO(iso).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function primerDiaMes(d = new Date()): string {
  return aISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function ultimoDiaMes(d = new Date()): string {
  return aISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Días que faltan para el próximo cumpleaños (0 = hoy) y la edad que cumplirá. */
export function proximoCumpleanos(fechaNacimiento: string): { dias: number; edad: number; fecha: Date } | null {
  if (!fechaNacimiento) return null;
  const nac = deISO(fechaNacimiento);
  const h = new Date();
  const hoyMedianoche = new Date(h.getFullYear(), h.getMonth(), h.getDate());
  let prox = new Date(h.getFullYear(), nac.getMonth(), nac.getDate());
  if (prox < hoyMedianoche) prox = new Date(h.getFullYear() + 1, nac.getMonth(), nac.getDate());
  const dias = Math.round((prox.getTime() - hoyMedianoche.getTime()) / 86_400_000);
  return { dias, edad: prox.getFullYear() - nac.getFullYear(), fecha: prox };
}

export function nombreCompleto(p?: Record<string, any> | null): string {
  if (!p) return '';
  return [p.nombre ?? p.titulo, p.apellido].filter(Boolean).join(' ');
}

/** Quita los metadatos de un registro antes de enviarlo con PUT. */
export function sinMeta(r: Record<string, any>): Record<string, any> {
  const { id, creadoEn, actualizadoEn, creadoPor, actualizadoPor, ...resto } = r;
  return resto;
}

/** Descarga un CSV (abre bien en Excel gracias al BOM). */
export function descargarCSV(nombreArchivo: string, filas: (string | number)[][]) {
  const escapar = (v: string | number) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = String.fromCharCode(0xfeff) + filas.map((f) => f.map(escapar).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

/** Reduce una imagen (p. ej. el QR) y la devuelve como data URL comprimida. */
/** Reduce una imagen y la devuelve como data URL. `transparente` conserva el fondo transparente (logos). */
export function comprimirImagen(archivo: File, ladoMax = 800, calidad = 0.85, transparente = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer la imagen'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Archivo de imagen no válido'));
      img.onload = () => {
        const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        const ctx = canvas.getContext('2d')!;
        if (!transparente) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // PNG mantiene nítidos los QR; si pesa mucho se usa JPEG.
        let data = canvas.toDataURL('image/png');
        if (data.length > 300_000) data = canvas.toDataURL(transparente ? 'image/webp' : 'image/jpeg', calidad);
        resolve(data);
      };
      img.src = lector.result as string;
    };
    lector.readAsDataURL(archivo);
  });
}
