import { app } from './app';
import { config } from './config';

// Servidor local para desarrollo. En producción se usa netlify/functions/api.ts
app.listen(config.puerto, () => {
  console.log(`API escuchando en http://localhost:${config.puerto}/api`);
});
