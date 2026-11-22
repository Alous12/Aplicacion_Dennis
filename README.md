# Sistema de Gestión Integral para Iglesia

Aplicación web responsive (pensada primero para teléfono) con los módulos del diagrama:

| Módulo | Qué incluye |
|---|---|
| **Miembros & Visitantes** | Registro de personas, flujo (registro → bautismo/discipulado → integración a célula / seguimiento de visitante → invitación a actividades), células, **cumpleaños** (por mes, próximos 30 días, felicitar por WhatsApp) |
| **Eventos & Cultos** | Planificación, calendario, publicación (WhatsApp / copiar texto para redes), inscripción con cupo, registro de asistencia, voluntarios asignados, evaluación |
| **Ministerios & Voluntarios** | Necesidades y convocatoria por ministerio; solicitudes → revisión de perfil → selección → capacitación → activo; coordinación en eventos; feedback y reconocimiento |
| **Gestión de Recursos** | Inventario (insumos/equipos), espacios, reservas de aulas, mantenimiento |
| **Tesorería** | Ofrendas/diezmos (culto, online, **por célula**), recibos/constancias numerados e imprimibles, pagos (proveedores, nómina, gastos), registro contable con saldo, presupuesto, reportes financieros. Los **líderes de célula** registran los ingresos de su propia célula. |
| **Ventas** | Catálogo de **productos** (lo gestiona el admin), imagen del QR de cobro (la sube el admin), registro de ventas eligiendo **QR o efectivo** (con cálculo de cambio), reporte por periodo para **imprimir / guardar PDF / CSV** |
| **Administración** | Aprobar / desactivar usuarios y asignar **líderes de célula**. **Los administradores solo se crean en la base de datos.** |

## Arquitectura

```
Dennis/
├── frontend/   Angular 21 (standalone, signals, zoneless)
├── backend/    Node + Express + TypeScript → se despliega como Netlify Function
└── netlify.toml  (un solo sitio: frontend + /api)
```

- **Base de datos:** Firestore (Firebase), accedida **solo desde el backend** con Firebase Admin.
- **Autenticación:** JWT propio (firmado por el backend, 12 h).
  - Correo + contraseña (bcrypt).
  - Google: el frontend abre el popup de Google con Firebase Auth, envía el ID token al backend, que lo verifica y entrega el JWT de la app.
- **Roles:** `admin` y `usuario`. Las cuentas nuevas (correo o Google) quedan **pendientes** hasta que un admin las aprueba. Desde la web no se pueden crear admins ni cambiar roles.

### Permisos por defecto

| Módulo | usuario | líder de célula | admin |
|---|---|---|---|
| Personas, eventos, voluntarios, reservas, mantenimiento, ventas | ver, crear, editar | igual que usuario | todo |
| Células, ministerios, inventario, espacios, productos, imagen del QR | solo ver | solo ver | todo |
| Ingresos de **su** célula | sin acceso | ver, registrar, imprimir recibo | todo |
| Resto de Tesorería, usuarios | sin acceso | sin acceso | todo |
| Eliminar registros | solo reservas de espacios | solo reservas de espacios | todo |

Un líder de célula es un usuario normal al que un admin le asigna una célula en **Usuarios**. El cambio aplica al instante.

Se cambian en `backend/src/routes/modulos.ts` **y** `frontend/src/app/modulos.config.ts` (deben coincidir).

---

## 1. Configurar Firebase (una sola vez)

1. Crea un proyecto en <https://console.firebase.google.com> (plan **Spark**, gratis).
2. **Firestore Database** → Crear base de datos → modo producción → región cercana (p. ej. `southamerica-east1`).
   - Reglas: deja todo bloqueado (el backend usa Admin SDK, que ignora las reglas):
     ```
     rules_version = '2';
     service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }
     ```
3. **Authentication** → Método de acceso → habilita **Google**.
   - En *Configuración → Dominios autorizados* agrega tu dominio de Netlify (ej. `mi-iglesia.netlify.app`).
4. **Configuración del proyecto → Tus apps → Web (`</>`)** → copia `apiKey`, `authDomain`, `projectId`, `appId` en `frontend/src/environments/environment.ts`.
5. **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada** → descarga el JSON (¡no lo subas a git!).

## 2. Desarrollo local

```bash
# Backend
cd backend
npm install
cp .env.example .env        # completa JWT_SECRET y los 3 datos FIREBASE_* del JSON
npm run dev                 # http://localhost:3000/api

# Frontend (otra terminal)
cd frontend
npm install
npm start                   # http://localhost:4200  (proxy /api → :3000)
```

## 3. Crear el primer administrador

Los admins **no** se pueden crear desde la web:

```bash
cd backend
npm run crear-admin pastor@iglesia.com "Pastor Juan" "UnaClaveSegura123"
```

Sin `--password` el admin entra solo con Google (mismo correo).
También puedes crearlo a mano en la consola de Firestore: colección `usuarios`, ID del documento = correo en minúsculas, campos `email`, `nombre`, `rol: "admin"`, `estado: "activo"`.

## 4. Desplegar en Netlify

1. Sube el proyecto a GitHub (el `.gitignore` ya excluye `.env` y claves).
2. Netlify → *Add new site → Import from Git* → elige el repo. `netlify.toml` ya define build, carpeta publicada y funciones.
3. *Site configuration → Environment variables*:

   | Variable | Valor |
   |---|---|
   | `JWT_SECRET` | cadena larga aleatoria (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
   | `FIREBASE_PROJECT_ID` | del JSON de la cuenta de servicio |
   | `FIREBASE_CLIENT_EMAIL` | del JSON |
   | `FIREBASE_PRIVATE_KEY` | del JSON, completa, con los `\n` tal cual |

4. Deploy. Agrega el dominio de Netlify en los **Dominios autorizados** de Firebase Authentication.

## Moneda y nombre

En `frontend/src/environments/environment.ts`: `nombreIglesia` y `moneda` (por defecto `BOB` / `es-BO`).
