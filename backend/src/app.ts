import cors from 'cors';
import express, { Router } from 'express';
import { config } from './config';
import { requiereAuth } from './lib/auth';
import { manejadorErrores } from './lib/errores';
import { auth } from './routes/auth';
import { configuracion } from './routes/configuracion';
import { modulos } from './routes/modulos';
import { usuariosRouter } from './routes/usuarios';

export const app = express();

app.disable('x-powered-by');
if (config.corsOrigen) app.use(cors({ origin: config.corsOrigen.split(',') }));
app.use(express.json({ limit: '1mb' }));

const api = Router();
api.get('/salud', (_req, res) => {
  res.json({ ok: true });
});
api.use('/auth', auth);
api.use(requiereAuth); // todo lo que sigue requiere JWT
api.use('/usuarios', usuariosRouter);
api.use('/configuracion', configuracion);
api.use(modulos);

// En Netlify la ruta puede llegar como /api/... (redirect) o /.netlify/functions/api/...
app.use(['/api', '/.netlify/functions/api'], api);
app.use(manejadorErrores);
