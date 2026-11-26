# Conectar Supabase

1. En el proyecto Supabase abre **SQL Editor**, pega `supabase/schema.sql` y ejecuta el script.
2. En **Project Settings → API Keys** copia el **Project URL** y la clave **Publishable** (`sb_publishable_...`). No uses `service_role` ni una clave `sb_secret_...` en la app.
3. Para desarrollo, crea `.env.local` en la raíz (está ignorado por Git):

   ```env
   VITE_SUPABASE_URL=https://TU-PROJECT-REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE
   ```

4. Reinicia `npm run dev` después de editar las variables.
5. En Vercel, abre **Project → Settings → Environment Variables** y crea las mismas dos variables para **Production** (y Preview si corresponde). Luego usa **Redeploy** en el último despliegue.

La app consulta `teams`, `team_attempts` y `competition_settings`. El SQL habilita RLS y Realtime para esas tablas. Las políticas incluidas permiten lectura y escritura pública para facilitar la puesta en marcha; cualquier persona con acceso al sitio podría modificar los datos. Antes de usarlo públicamente, agrega autenticación y limita las políticas de escritura a administradores.
