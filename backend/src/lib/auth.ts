import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { HttpError } from './errores';

export type Rol = 'admin' | 'usuario';

export interface UsuarioToken {
  sub: string; // id del usuario (email en minúsculas)
  email: string;
  nombre: string;
  rol: Rol;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioToken;
    }
  }
}

export function firmarToken(usuario: UsuarioToken): string {
  return jwt.sign(
    { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
    config.jwtSecret,
    { subject: usuario.sub, expiresIn: config.jwtExpiracion },
  );
}

/** Exige un JWT válido en el encabezado Authorization: Bearer <token>. */
export function requiereAuth(req: Request, _res: Response, next: NextFunction) {
  const encabezado = req.headers.authorization ?? '';
  const [tipo, token] = encabezado.split(' ');
  if (tipo !== 'Bearer' || !token) throw new HttpError(401, 'No autenticado');
  try {
    const datos = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    req.usuario = {
      sub: datos.sub as string,
      email: datos.email,
      nombre: datos.nombre,
      rol: datos.rol,
    };
    next();
  } catch {
    throw new HttpError(401, 'Sesión expirada o inválida');
  }
}
