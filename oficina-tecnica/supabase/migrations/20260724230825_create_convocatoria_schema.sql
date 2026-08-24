-- Esquema del sistema de Convocatorias EKA (Telegram). Todas las tablas
-- llevan el prefijo "convocatoria_" para no chocar con el resto del sistema
-- de OFICINA_IA que ya vive en este proyecto.

create table if not exists convocatoria_usuarios (
    id uuid primary key default gen_random_uuid(),
    telegram_chat_id text not null unique,
    telegram_user_id text,
    nombre text,
    username text,
    estado text not null default 'activo',
    primer_registro timestamptz not null default now(),
    ultima_actividad timestamptz
);

create table if not exists convocatoria_especialidades (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique,
    created_at timestamptz not null default now()
);

create table if not exists convocatorias (
    id uuid primary key default gen_random_uuid(),
    titulo text not null,
    planta text,
    fecha_servicio date not null,
    hora_servicio text,
    descripcion text,
    fecha_limite_respuesta timestamptz,
    estado text not null default 'borrador', -- borrador | enviada
    creado_por text,
    created_at timestamptz not null default now(),
    enviada_at timestamptz
);

create table if not exists convocatoria_respuestas (
    id uuid primary key default gen_random_uuid(),
    convocatoria_id uuid not null references convocatorias(id) on delete cascade,
    telegram_chat_id text not null,
    nombre_telegram text,
    username text,
    respuesta text, -- disponible | no_disponible | posiblemente
    especialidad text,
    nombres_completos text,
    dni text,
    telefono text,
    lugar_residencia text,
    experiencia_texto text,
    experiencia_audio_file_id text,
    cv_drive_url text,
    cv_drive_file_id text,
    respondido_at timestamptz,
    unique (convocatoria_id, telegram_chat_id)
);

-- Estado del flujo conversacional (tanto /convocar del admin como las
-- preguntas tras responder disponible/no disponible/posiblemente). Una fila
-- por chat_id; se borra cuando el flujo termina o se cancela.
create table if not exists convocatoria_sesiones (
    telegram_chat_id text primary key,
    paso text not null,
    datos jsonb not null default '{}'::jsonb,
    actualizado_at timestamptz not null default now()
);

create index if not exists idx_convocatoria_respuestas_convocatoria on convocatoria_respuestas(convocatoria_id);

-- Vista de exportacion: pensada para traerla a Google Sheets (via REST /
-- PostgREST) con los hipervinculos de Drive ya incluidos, sin tener que
-- buscar los archivos uno por uno.
create or replace view convocatoria_respuestas_export_v as
select
    c.titulo as convocatoria_titulo,
    c.planta,
    c.fecha_servicio,
    r.nombres_completos,
    r.dni,
    r.telefono,
    r.lugar_residencia,
    r.especialidad,
    r.experiencia_texto,
    r.cv_drive_url,
    r.respuesta,
    r.respondido_at,
    r.convocatoria_id,
    r.telegram_chat_id
from convocatoria_respuestas r
join convocatorias c on c.id = r.convocatoria_id
order by r.respondido_at desc nulls last;
;
