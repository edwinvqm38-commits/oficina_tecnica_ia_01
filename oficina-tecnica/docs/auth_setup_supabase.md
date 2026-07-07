# Configuracion de login y aprobacion de usuarios

## Flujo objetivo

1. El administrador `edwin.qm@outlook.com` entra con email y contraseña.
2. Otros usuarios entran o se registran con Google/Gmail.
3. Todo usuario nuevo queda `pending` en `public.user_profiles`.
4. Edwin aprueba/rechaza desde `Administrador` o `Usuarios · Acceso`.
5. En `Administrador > Permisos`, Edwin configura acceso por modulo, columnas, precios, proveedor, creacion, edicion y carga de archivos.

## Orden recomendado

1. Ejecutar `supabase/sql/100_clean_start_schema.sql` si es una base limpia.
2. En Supabase Dashboard, crear el usuario admin:
   - Authentication > Users > Add user
   - Email: `edwin.qm@outlook.com`
   - Password: `123456`
   - Marcar como confirmado/autoconfirmado si la UI lo permite.
3. Ejecutar `supabase/sql/130_auth_admin_bootstrap.sql`.
4. Iniciar sesion en `/login`.

## Auth providers

En Supabase Dashboard:

- Authentication > Sign In / Providers > Email:
  - Enable Email provider.
  - Enable password sign-in.
  - Para pruebas, puedes desactivar confirm email. Para produccion, activalo con SMTP propio.

- Authentication > Sign In / Providers > Google:
  - Enable Google.
  - Pegar Client ID y Client Secret de Google Cloud Console.
  - En Google Cloud, usar como Authorized redirect URI el callback que muestra Supabase:
    `https://<project-ref>.supabase.co/auth/v1/callback`

Para este proyecto nuevo:

- Project ref Supabase: `evredshfmwimdgcypxlh`
- Authorized redirect URI en Google Cloud:
  `https://evredshfmwimdgcypxlh.supabase.co/auth/v1/callback`

Si aparece este error:

```json
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

No es un error del codigo de la app. Significa que el proveedor Google todavia no esta activado en:

`Supabase Dashboard > Authentication > Sign In / Providers > Google`

Activa Google, pega el Client ID y Client Secret del OAuth Client de Google Cloud y guarda.

Importante: no confundas estas URLs:

- Google Cloud OAuth redirect URI: `https://evredshfmwimdgcypxlh.supabase.co/auth/v1/callback`
- Redirect de la app despues del login: `http://localhost:3000/auth/callback`
- Redirect de la app en Vercel: `https://TU-DOMINIO.vercel.app/auth/callback`

La primera va en Google Cloud. Las otras van en Supabase URL Configuration.

## URL configuration

Authentication > URL Configuration:

- Site URL local:
  `http://localhost:3000`

- Redirect URLs locales:
  `http://localhost:3000/auth/callback`
  `http://localhost:3001/auth/callback`
  `http://localhost:3000/auth/update-password`
  `http://localhost:3001/auth/update-password`

- Redirect URLs de produccion:
  `https://TU-DOMINIO.vercel.app/auth/callback`
  `https://TU-DOMINIO.vercel.app/auth/update-password`

## Links enviados por correo

Los correos HTML usan `NEXT_PUBLIC_APP_URL` como dominio base si esta variable existe. Esto evita enviar links con `localhost` cuando el correo lo abrira otra persona.

Para pruebas locales puedes dejarlo sin configurar. Para uso real/Vercel, define:

```text
NEXT_PUBLIC_APP_URL=https://TU-DOMINIO.vercel.app
```

En Vercel tambien debes configurar la misma variable en Project Settings > Environment Variables.

## Recuperacion de contraseña

La pantalla `/login` envia el correo de recuperacion y redirige a:

`/auth/update-password`

El usuario cambia su contraseña ahi y vuelve al login.

## Validaciones SQL

```sql
select id, email, role, status, is_super_admin
from public.user_profiles
where lower(email) = 'edwin.qm@outlook.com';

select module_key, can_view, can_create, can_edit
from public.admin_module_permissions
where lower(user_email) = 'edwin.qm@outlook.com'
order by module_key;

select email, full_name, provider, status, created_at
from public.user_access_requests
order by created_at desc
limit 20;
```

## Nota de correo

Supabase permite probar con su envio de correos por defecto, pero para produccion conviene configurar SMTP propio porque el envio por defecto tiene limites bajos y no esta pensado para operacion formal.

## Gmail para envio de correos desde la app

Este flujo es independiente del login con Google de Supabase.

Antes de conectar o enviar correos, habilita la Gmail API en el proyecto Google Cloud del OAuth Client:

```text
https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=560615076744
```

Presiona `Enable` / `Habilitar`. Si la acabas de activar, espera 1 a 5 minutos antes de volver a probar.

Cuando uses el boton `Conectar Gmail` del modal de envio, Google Cloud debe tener autorizadas estas URLs en el OAuth Client usado por:

- `GOOGLE_GMAIL_OAUTH_CLIENT_ID`, si existe.
- Si no existe, la app usa `GOOGLE_DRIVE_OAUTH_CLIENT_ID` como respaldo.

Authorized redirect URIs para desarrollo:

```text
http://localhost:3000/api/gmail/oauth/callback
http://localhost:3001/api/gmail/oauth/callback
```

Para evitar diferencias por puerto u origen dinamico, puedes fijar la URL exacta en `.env.local`:

```text
GOOGLE_GMAIL_OAUTH_REDIRECT_URI=http://localhost:3000/api/gmail/oauth/callback
```

Esa URL debe estar registrada exactamente igual en Google Cloud. Si el dev server corre en `3001`, cambia la variable y Google Cloud a:

```text
GOOGLE_GMAIL_OAUTH_REDIRECT_URI=http://localhost:3001/api/gmail/oauth/callback
```

Authorized redirect URI para Vercel:

```text
https://TU-DOMINIO.vercel.app/api/gmail/oauth/callback
```

Si aparece:

```text
Error 400: redirect_uri_mismatch
```

la URL anterior no esta registrada en Google Cloud, o la app esta usando otro Client ID diferente al que editaste.

No confundir:

- Login Supabase con Google:
  `https://evredshfmwimdgcypxlh.supabase.co/auth/v1/callback`
- Retorno de la app despues del login:
  `http://localhost:3000/auth/callback`
- Conexion Gmail para enviar correos:
  `http://localhost:3000/api/gmail/oauth/callback`
