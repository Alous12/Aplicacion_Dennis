import 'dotenv/config';

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

export const config = {
  get jwtSecret() {
    return requerida('JWT_SECRET');
  },
  jwtExpiracion: (process.env.JWT_EXPIRES_IN ?? '12h') as `${number}h`,
  corsOrigen: process.env.CORS_ORIGIN ?? '',
  puerto: Number(process.env.PORT ?? 3000),
};
