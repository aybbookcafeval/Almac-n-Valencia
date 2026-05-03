-- Fix RLS para permitir a usuarios normales transferir stock
DROP POLICY IF EXISTS "Admins pueden gestionar stock" ON stock_almacen;

-- Cambiamos a que todos los autenticados puedan gestionar el stock
CREATE POLICY "Usuarios autenticados pueden gestionar stock"
ON stock_almacen
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
