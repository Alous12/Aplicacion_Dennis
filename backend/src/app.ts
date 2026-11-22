import cors from 'cors';
import express, { Router } from 'express';
import { config } from './config';
import { requiereAuth } from './lib/auth';
import { HttpError, manejadorErrores } from './lib/errores';
import { errorConfiguracion } from './lib/firebase';
import { auth } from './routes/auth';
import { configuracion } from './routes/configuracion';
import { modulos } from './routes/modulos';
import { usuariosRouter } from './routes/usuarios';

export const app = express();

app.disable('x-powered-by');
if (config.corsOrigen) app.use(cors({ origin: config.corsOrigen.split(',') }));
app.use(express.json({ limit: '1mb' }));

const api = Router();
// Diagnóstico: abre /api/salud en el navegador para saber si la configuración del servidor está bien.
api.get('/salud', (_req, res) => {
  if (errorConfiguracion) {
    res.status(500).json({ ok: false, problema: errorConfiguracion });
    return;
  }
  res.json({ ok: true });
});
// Si la configuración está mal, todas las rutas explican el problema en vez de fallar sin mensaje.
api.use((_req, _res, next) => {
  if (errorConfiguracion) throw new HttpError(500, `Configuración del servidor incompleta: ${errorConfiguracion}`);
  next();
});
api.use('/auth', auth);
api.use(requiereAuth); // todo lo que sigue requiere JWT
api.use('/usuarios', usuariosRouter);
api.use('/configuracion', configuracion);
api.use(modulos);

// En Netlify la ruta puede llegar como /api/... (redirect) o /.netlify/functions/api/...
app.use(['/api', '/.netlify/functions/api'], api);
app.use(manejadorErrores);
