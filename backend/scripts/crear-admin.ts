/**
 * Crea (o actualiza) un ADMINISTRADOR directamente en Firestore.
 * Los administradores no se pueden crear desde la web: solo con este script
 * o editando la colección "usuarios" en la consola de Firebase.
 *
 * Uso:
 *   npm run crear-admin -- --email pastor@iglesia.com --nombre "Pastor Juan" --password "ClaveSegura123"
 *
 * --password es opcional: sin él, el admin solo podrá entrar con Google (mismo correo).
 */
import bcrypt from 'bcryptjs';
import { FieldValue } from 'firebase-admin/firestore';
import { parseArgs } from 'node:util';
import { db } from '../src/lib/firebase';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    nombre: { type: 'string' },
    password: { type: 'string' },
  },
});

if (!values.email || !values.nombre) {
  console.error('Uso: npm run crear-admin -- --email correo@x.com --nombre "Nombre" [--password "clave"]');
  process.exit(1);
}
if (values.password && values.password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres');
  process.exit(1);
}

const id = values.email.trim().toLowerCase();
const datos: Record<string, unknown> = {
  email: id,
  nombre: values.nombre,
  rol: 'admin',
  estado: 'activo',
  proveedores: FieldValue.arrayUnion(...(values.password ? ['password', 'google'] : ['google'])),
  creadoEn: FieldValue.serverTimestamp(),
};
if (values.password) datos.passwordHash = await bcrypt.hash(values.password, 10);

await db.collection('usuarios').doc(id).set(datos, { merge: true });
console.log(`✔ Administrador listo: ${id}`);
process.exit(0);
