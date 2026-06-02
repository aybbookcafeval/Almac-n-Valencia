-- ====================================================================
-- MIGRACIÓN PARA LA SECCIÓN "TRASLADO MGTA"
-- ====================================================================
-- Ejecute este script en el Editor de Consultas SQL de su Panel de Supabase.
-- Crea las tablas cabecera/detalle correspondientes, habilita RLS, y aplica
-- las políticas para que todos los usuarios autenticados las gestionen.

-- 1. Crear tabla de Cabecera: traslado_mgta
CREATE TABLE IF NOT EXISTS public.traslado_mgta (
    id TEXT PRIMARY KEY, -- ID legible único generado por la app Ej: TM-20260602-ABCD
    fecha TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    comentario TEXT,
    tasa_dolar NUMERIC DEFAULT 1.0,
    tasa_euro NUMERIC DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Crear tabla de Detalle: traslado_mgta_items
CREATE TABLE IF NOT EXISTS public.traslado_mgta_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    traslado_id TEXT NOT NULL REFERENCES public.traslado_mgta(id) ON DELETE CASCADE,
    materia_prima_id UUID NOT NULL REFERENCES public.materia_prima(id) ON DELETE CASCADE,
    almacen_origen_id UUID NOT NULL REFERENCES public.almacenes(id) ON DELETE CASCADE,
    cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
    unidad_medida TEXT NOT NULL,
    costo_euro NUMERIC DEFAULT 0,
    costo_calculado NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Habilitar la seguridad de nivel de fila (Row Level Security - RLS)
ALTER TABLE public.traslado_mgta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traslado_mgta_items ENABLE ROW LEVEL SECURITY;

-- 4. Crear Políticas para la Cabecera de Traslados (traslado_mgta)
DROP POLICY IF EXISTS "Usuarios autenticados pueden leer traslados" ON public.traslado_mgta;
CREATE POLICY "Usuarios autenticados pueden leer traslados" 
ON public.traslado_mgta 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar traslados" ON public.traslado_mgta;
CREATE POLICY "Usuarios autenticados pueden insertar traslados" 
ON public.traslado_mgta 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 5. Crear Políticas para los Ítems de Traslados (traslado_mgta_items)
DROP POLICY IF EXISTS "Usuarios autenticados pueden leer items de traslados" ON public.traslado_mgta_items;
CREATE POLICY "Usuarios autenticados pueden leer items de traslados" 
ON public.traslado_mgta_items 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar items de traslados" ON public.traslado_mgta_items;
CREATE POLICY "Usuarios autenticados pueden insertar items de traslados" 
ON public.traslado_mgta_items 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 6. Forzar la recarga del caché de esquemas de PostgREST
NOTIFY pgrst, 'reload schema';
