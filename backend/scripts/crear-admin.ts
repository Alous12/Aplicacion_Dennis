/**
 * Crea (o actualiza) un ADMINISTRADOR directamente en Firestore.
 * Los administradores no se pueden crear desde la web: solo con este script
 * o editando la colección "usuarios" en la consola de Firebase.
 *
 * Uso (funciona igual en PowerShell, CMD y bash):
 *   npm run crear-admin pastor@iglesia.com "Pastor Juan" "ClaveSegura123"
 *
 * También con etiquetas, llamando al script directamente:
 *   npx tsx scripts/crear-admin.ts --email pastor@iglesia.com --nombre "Pastor Juan" --password "ClaveSegura123"
 *
 * La contraseña es opcional: sin ella, el admin solo podrá entrar con Google (mismo correo).
 */
import bcrypt from 'bcryptjs';
import { FieldValue } from 'firebase-admin/firestore';
import { parseArgs } from 'node:util';

const { values: etiquetas, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    email: { type: 'string' },
    nombre: { type: 'string' },
    password: { type: 'string' },
  },
});
const values = {
  email: etiquetas.email ?? positionals[0],
  nombre: etiquetas.nombre ?? positionals[1],
  password: etiquetas.password ?? positionals[2],
};

if (!values.email || !values.nombre || !values.email.includes('@')) {
  console.error('Uso: npm run crear-admin correo@x.com "Nombre Apellido" "contraseña"');
  process.exit(1);
}
if (values.password && values.password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres');
  process.exit(1);
}

// Se importa después de validar para no conectar a Firebase si los argumentos están mal.
const { db } = await import('../src/lib/firebase');

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
