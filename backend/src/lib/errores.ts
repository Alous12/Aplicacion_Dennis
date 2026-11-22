import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function manejadorErrores(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ mensaje: err.message });
    return;
  }
  if (err instanceof ZodError) {
    const detalle = err.issues.map((i) => `${i.path.join('.') || 'dato'}: ${i.message}`).join('; ');
    res.status(400).json({ mensaje: `Datos inválidos — ${detalle}` });
    return;
  }
  if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.too.large') {
    res.status(413).json({ mensaje: 'El archivo es demasiado grande' });
    return;
  }
  console.error(err);
  res.status(500).json({ mensaje: 'Error interno del servidor' });
}
