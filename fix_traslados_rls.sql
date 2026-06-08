-- ====================================================================
-- MIGRACIÓN PARA HABILITAR EDICIÓN Y ELIMINACIÓN DE TRASLADO MGTA
-- ====================================================================
-- Ejecute este script en el Editor de Consultas SQL de su Panel de Supabase.
-- Añade las políticas de UPDATE y DELETE a las tablas de traslados,
-- para que puedan ser editadas y eliminadas desde la aplicación.

-- Políticas de UPDATE y DELETE para traslado_mgta
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar traslados" ON public.traslado_mgta;
CREATE POLICY "Usuarios autenticados pueden actualizar traslados" 
ON public.traslado_mgta 
FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar traslados" ON public.traslado_mgta;
CREATE POLICY "Usuarios autenticados pueden eliminar traslados" 
ON public.traslado_mgta 
FOR DELETE 
TO authenticated 
USING (true);

-- Políticas de UPDATE y DELETE para traslado_mgta_items
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar items de traslados" ON public.traslado_mgta_items;
CREATE POLICY "Usuarios autenticados pueden actualizar items de traslados" 
ON public.traslado_mgta_items 
FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar items de traslados" ON public.traslado_mgta_items;
CREATE POLICY "Usuarios autenticados pueden eliminar items de traslados" 
ON public.traslado_mgta_items 
FOR DELETE 
TO authenticated 
USING (true);

-- Forzar la recarga del caché de esquemas de PostgREST
NOTIFY pgrst, 'reload schema';
