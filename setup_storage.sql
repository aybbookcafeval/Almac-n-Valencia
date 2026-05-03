-- 1. Crear el bucket si no existe (y hacerlo público para que se puedan ver las imágenes)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('transfer-evidence', 'transfer-evidence', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Permitir que usuarios autenticados puedan subir archivos (INSERT) al bucket
DROP POLICY IF EXISTS "Permitir subida a usuarios autenticados" ON storage.objects;
CREATE POLICY "Permitir subida a usuarios autenticados" 
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'transfer-evidence');

-- 3. Permitir ver (SELECT) a todos para poder leer las imágenes
DROP POLICY IF EXISTS "Permitir lectura publica" ON storage.objects;
CREATE POLICY "Permitir lectura publica" 
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'transfer-evidence');

-- 4. Opcional: Permitir eliminar a los usuarios autenticados (si decides luego borrar imágenes)
DROP POLICY IF EXISTS "Permitir borrado a autenticados" ON storage.objects;
CREATE POLICY "Permitir borrado a autenticados" 
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'transfer-evidence');
