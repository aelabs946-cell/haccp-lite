-- =============================================================
--  HACCP-Lite — Script COMPLETO para Supabase
--  ⚠️ Ejecutar TODO de una sola vez en el SQL Editor
-- =============================================================

-- ╔═══════════════════════════════════════╗
-- ║  PASO 1: CREAR TABLAS                 ║
-- ╚═══════════════════════════════════════╝

-- Tabla de empresas (cada cliente es una empresa)
CREATE TABLE IF NOT EXISTS public.restaurants (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre              text        NOT NULL,
  estado_suscripcion  text        NOT NULL DEFAULT 'trial'
                                  CHECK (estado_suscripcion IN ('trial','activo','suspendido','cancelado')),
  fecha_creacion      timestamptz NOT NULL DEFAULT now()
);

-- Tabla de usuarios (vincula auth.users con una empresa)
CREATE TABLE IF NOT EXISTS public.users (
  id              uuid    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id   uuid    NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  nombre          text,
  rol             text    NOT NULL DEFAULT 'empleado'
                          CHECK (rol IN ('admin','empleado')),
  fecha_creacion  timestamptz NOT NULL DEFAULT now()
);

-- Tabla de equipos (neveras, congeladores, etc.)
CREATE TABLE IF NOT EXISTS public.equipment (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id     uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  nombre_equipo     text        NOT NULL,
  tipo              text        NOT NULL DEFAULT 'nevera',
  temp_min_esperada numeric(5,2) DEFAULT 0,
  temp_max_esperada numeric(5,2) DEFAULT 5,
  activo            boolean     NOT NULL DEFAULT true,
  fecha_creacion    timestamptz NOT NULL DEFAULT now()
);

-- Tabla de registros de control (PCC, limpieza, trazabilidad)
CREATE TABLE IF NOT EXISTS public.control_records (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id     uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  tipo              text        NOT NULL CHECK (tipo IN ('pcc','limpieza','trazabilidad','proceso')),
  datos             jsonb       NOT NULL DEFAULT '{}',
  estado            text        NOT NULL DEFAULT 'conforme'
                                CHECK (estado IN ('conforme','no_conforme','accion_correctiva')),
  observaciones     text,
  accion_correctiva text,
  registrado_por    uuid        NOT NULL REFERENCES public.users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ╔═══════════════════════════════════════╗
-- ║  PASO 2: FUNCIÓN HELPER               ║
-- ╚═══════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.get_my_restaurant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- ╔═══════════════════════════════════════╗
-- ║  PASO 3: ACTIVAR SEGURIDAD (RLS)      ║
-- ╚═══════════════════════════════════════╝

ALTER TABLE public.restaurants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_records  ENABLE ROW LEVEL SECURITY;

-- ╔═══════════════════════════════════════╗
-- ║  PASO 4: POLÍTICAS DE SEGURIDAD       ║
-- ╚═══════════════════════════════════════╝

-- restaurants
CREATE POLICY "restaurants_select" ON public.restaurants
  FOR SELECT USING (id = public.get_my_restaurant_id());

-- users
CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (restaurant_id = public.get_my_restaurant_id());

-- equipment
CREATE POLICY "equipment_select" ON public.equipment
  FOR SELECT USING (restaurant_id = public.get_my_restaurant_id());
CREATE POLICY "equipment_insert" ON public.equipment
  FOR INSERT WITH CHECK (restaurant_id = public.get_my_restaurant_id());

-- control_records
CREATE POLICY "records_select" ON public.control_records
  FOR SELECT USING (restaurant_id = public.get_my_restaurant_id());
CREATE POLICY "records_insert" ON public.control_records
  FOR INSERT WITH CHECK (
    restaurant_id = public.get_my_restaurant_id()
    AND registrado_por = auth.uid()
  );

-- ╔═══════════════════════════════════════╗
-- ║  PASO 5: ÍNDICES (velocidad)           ║
-- ╚═══════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_users_restaurant ON public.users (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_equipment_restaurant ON public.equipment (restaurant_id, activo);
CREATE INDEX IF NOT EXISTS idx_records_restaurant_tipo ON public.control_records (restaurant_id, tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_restaurant_fecha ON public.control_records (restaurant_id, created_at DESC);

-- ╔═══════════════════════════════════════╗
-- ║  PASO 6: CREAR TU EMPRESA (MONFRAN)   ║
-- ╚═══════════════════════════════════════╝

INSERT INTO public.restaurants (id, nombre, estado_suscripcion)
VALUES ('a0000000-0000-0000-0000-000000000001', 'MONFRAN', 'activo');

-- ╔═══════════════════════════════════════╗
-- ║  PASO 7: TRIGGER AUTO-PERFIL          ║
-- ╚═══════════════════════════════════════╝
-- Cuando alguien se registra, automáticamente se crea su perfil

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, restaurant_id, nombre, rol)
  VALUES (
    NEW.id,
    COALESCE(
      (NEW.raw_user_meta_data ->> 'restaurant_id')::uuid,
      'a0000000-0000-0000-0000-000000000001'
    ),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'rol', 'empleado')
  );
  RETURN NEW;
END;
$$;

-- Eliminar trigger si ya existe (para evitar error)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ╔═══════════════════════════════════════╗
-- ║  ¡LISTO! ✅                            ║
-- ╚═══════════════════════════════════════╝
-- Se crearon:
--   ✅ Tabla "restaurants" (empresas)
--   ✅ Tabla "users" (usuarios)
--   ✅ Tabla "equipment" (equipos)
--   ✅ Tabla "control_records" (registros HACCP)
--   ✅ Función de seguridad get_my_restaurant_id()
--   ✅ Políticas RLS en todas las tablas
--   ✅ Índices de velocidad
--   ✅ Empresa MONFRAN creada
--   ✅ Trigger auto-creación de perfil
