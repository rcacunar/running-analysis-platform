# Running Analysis Platform

Plataforma multiusuario para subir sesiones ZIP exportadas por Sensor Logger, analizarlas en background y comparar rendimiento, esfuerzo, fases de sprint y playback.

## Stack

- `apps/web`: Next.js + TypeScript + Supabase SSR
- `services/analysis`: FastAPI + worker Python + Redis queue
- `supabase/migrations`: esquema SQL para Supabase self-hosted o Supabase Cloud
- `docker-compose.yml`: stack de aplicación para Coolify o Docker Compose

## Flujo

1. Usuario inicia sesión con Supabase Auth.
2. Sube un ZIP desde la web.
3. Next.js guarda el ZIP en Supabase Storage y crea la fila `sessions`.
4. Next.js encola el análisis en `analysis-api`.
5. `analysis-worker` descarga el ZIP, ejecuta el core Python y persiste resultados.
6. El usuario ve sus sesiones, detalle, playback y comparaciones.

## Estructura de datos

- `sessions`
- `session_summaries`
- `session_sprints`
- `session_bouts`
- `session_phases`
- `session_playback_points`
- `session_feature_points`
- `session_exports`
- `saved_comparisons`

Todas las tablas sensibles usan `RLS` por `user_id`.

## Arranque local

1. Copia `.env.example` a `.env` y completa tus claves de Supabase.
2. Aplica la migración SQL en tu instancia Supabase:
   - `supabase/migrations/20260325_001_running_analysis.sql`
3. Levanta la app:

```bash
docker compose up --build
```

## Coolify

- Crea un servicio Docker Compose apuntando a este repo.
- Define las variables de entorno del archivo `.env.example`.
- Conecta el dominio del frontend al servicio `web`.
- En Coolify, deja `web` como servicio proxied y mantén `analysis-api`, `analysis-worker` y `redis` solo en red interna.
- Los puertos del `docker-compose.yml` están definidos como internos (`expose`), no publicados al host.
- Supabase puede ir en otra app/stack mientras exponga URL pública o interna accesible desde estos servicios.

## Notas

- El motor de análisis reutiliza el core Python ya construido y no necesita migrar a TypeScript.
- Los buckets esperados son `session-zips` y `session-exports`.
- Si quieres descargas firmadas en vez de acceso directo a Storage, ese ajuste se hace en Next.js sin tocar el worker.
