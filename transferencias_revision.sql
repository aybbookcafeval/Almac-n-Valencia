-- ====================================================================
-- MIGRACIÓN PARA TRANSFERENCIAS EN REVISIÓN
-- ====================================================================

-- 1. Tabla de transferencias principales
CREATE TABLE IF NOT EXISTS public.transferencias (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    almacen_origen_id uuid REFERENCES public.almacenes(id) ON DELETE CASCADE,
    almacen_destino_id uuid REFERENCES public.almacenes(id) ON DELETE CASCADE,
    estado text NOT NULL DEFAULT 'revision' CHECK (estado IN ('revision', 'aprobado', 'anulado')),
    comentario text,
    imagen_url text,
    fecha timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Tabla de items de transferencia
CREATE TABLE IF NOT EXISTS public.transferencia_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    transferencia_id uuid REFERENCES public.transferencias(id) ON DELETE CASCADE,
    materia_prima_id uuid REFERENCES public.materia_prima(id) ON DELETE CASCADE,
    cantidad numeric NOT NULL CHECK (cantidad > 0),
    unidad_medida text NOT NULL
);

-- Políticas RLS - transferencias
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver transferencias" 
ON public.transferencias FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar transferencias" 
ON public.transferencias FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar transferencias" 
ON public.transferencias FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar transferencias" 
ON public.transferencias FOR DELETE 
TO authenticated 
USING (true);

-- Políticas RLS - transferencia_items
ALTER TABLE public.transferencia_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver transferencia_items" 
ON public.transferencia_items FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar transferencia_items" 
ON public.transferencia_items FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar transferencia_items" 
ON public.transferencia_items FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar transferencia_items" 
ON public.transferencia_items FOR DELETE 
TO authenticated 
USING (true);

-- Forzar recarga de esquema HTTP PostgREST
NOTIFY pgrst, 'reload schema';
