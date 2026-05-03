-- 1. Políticas de Storage (Cubo transfer-evidence)
-- Permite visualizar y subir imágenes
INSERT INTO storage.buckets (id, name, public) 
VALUES ('transfer-evidence', 'transfer-evidence', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Permitir subida a usuarios autenticados" ON storage.objects;
CREATE POLICY "Permitir subida a usuarios autenticados" 
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'transfer-evidence');

DROP POLICY IF EXISTS "Permitir lectura publica" ON storage.objects;
CREATE POLICY "Permitir lectura publica" 
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'transfer-evidence');

-- 2. Políticas de Stock Almacén
-- Permite que los usuarios puedan actualizar el stock en sus transferencias
DROP POLICY IF EXISTS "Admins pueden gestionar stock" ON stock_almacen;

CREATE POLICY "Usuarios autenticados pueden gestionar stock"
ON stock_almacen
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Reload Schema
NOTIFY pgrst, 'reload schema';
