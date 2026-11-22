# Sistema de Gestión Integral para Iglesia

Aplicación web responsive (pensada primero para teléfono) con los módulos del diagrama:

| Módulo | Qué incluye |
|---|---|
| **Miembros & Visitantes** | Registro de personas, flujo (registro → bautismo/discipulado → integración a iglesia en el hogar / seguimiento de visitante → invitación a actividades), **iglesias en el hogar** con **control de asistencia** (y "añadir a alguien más" en el momento), **cumpleaños** (por mes, próximos 30 días, felicitar por WhatsApp) |
| **Eventos & Cultos** | Planificación, calendario, publicación (WhatsApp / copiar texto para redes), inscripción con cupo, registro de asistencia, voluntarios asignados, evaluación |
| **Ministerios & Voluntarios** | Necesidades y convocatoria por ministerio; solicitudes → revisión de perfil → selección → capacitación → activo; coordinación en eventos; feedback y reconocimiento |
| **Gestión de Recursos** | Inventario (insumos/equipos), espacios, reservas de aulas, mantenimiento |
| **Tesorería** | Ofrendas/diezmos (culto, online, **por iglesia en el hogar**; se preselecciona la de quien registra), recibos numerados e imprimibles, pagos, **pagos recurrentes** con cuenta regresiva y aviso en Inicio, registro contable con saldo, presupuesto, reportes financieros. Los líderes registran los ingresos de su propia iglesia en el hogar. |
| **Ventas** | Catálogo de **productos**, imagen del QR de cobro, registro de ventas eligiendo **QR o efectivo** (con cálculo de cambio). El **precio no se puede modificar**: lo fija el producto registrado. **Cuadre de caja** por día/periodo (QR, efectivo y por persona) para imprimir / PDF / CSV |
| **Administración** | El admin **crea usuarios con contraseña** (o aprueba los que se registran solos), define **roles y permisos** y sube el **logo**. **Los administradores solo se crean en la base de datos.** |

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
- **Roles:** el `admin` (solo en la base de datos) controla todo. Los demás usuarios tienen una **categoría** (Pastor, Anciano, Ministro, Diácono, Líder, Sub líder o las que cree el admin, p. ej. "Subadmin") y reciben **sus permisos**. Las cuentas que se registran solas (correo o Google) quedan **pendientes** hasta que se aprueban.

### Roles y permisos

En **Administración → Roles y permisos** el admin crea categorías y marca qué controla cada una:

| Permiso | Qué permite |
|---|---|
| Personas e iglesias en el hogar | Eliminar personas, crear/editar iglesias en el hogar, asistencia de todas |
| Su iglesia en el hogar | Asistencia e ingresos de la iglesia en el hogar asignada (Líder y Sub líder lo traen por defecto) |
| Eventos y cultos | Eliminar eventos |
| Ministerios y voluntarios | Gestionar ministerios, eliminar voluntarios |
| Recursos | Inventario, espacios, eliminar mantenimientos |
| Tesorería | Toda la tesorería |
| Ventas y productos | Productos y precios, imagen del QR, editar/eliminar ventas |
| Cuadre de caja | Ver todas las ventas de cada día (QR, efectivo y por persona) |
| Usuarios | Crear cuentas, aprobarlas, cambiar contraseñas, asignar iglesia en el hogar |

- **Funciones básicas** (todos los usuarios aprobados): ver la información y registrar personas, eventos, voluntarios, reservas, mantenimientos y ventas (cada vendedor ve solo sus ventas).
- Solo el admin asigna categorías y edita roles, así nadie puede darse más permisos. Quien tiene "Usuarios" no puede modificar a usuarios con permisos.
- Los cambios de permisos aplican **al instante** (el backend los lee de la base en cada petición).
- La lista de permisos está en `backend/src/lib/permisos.ts` y `frontend/src/app/core/permisos.ts` (deben coincidir).


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

El **logo** y el **nombre** se cambian desde la app: **Administración → Configuración** (solo admin). El nombre por defecto y la `moneda` (`BOB` / `es-BO`) están en `frontend/src/environments/environment.ts`.
