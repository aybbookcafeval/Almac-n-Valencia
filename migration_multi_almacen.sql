-- 1. Crear tabla de almacenes
CREATE TABLE almacenes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre text NOT NULL UNIQUE,
  descripcion text,
  created_at timestamptz DEFAULT now()
);

-- 2. Crear tabla de stock por almacén
CREATE TABLE stock_almacen (
  materia_prima_id uuid REFERENCES materia_prima(id) ON DELETE CASCADE,
  almacen_id uuid REFERENCES almacenes(id) ON DELETE CASCADE,
  stock numeric DEFAULT 0 CHECK (stock >= 0),
  PRIMARY KEY (materia_prima_id, almacen_id)
);

-- 3. Insertar almacén por defecto
INSERT INTO almacenes (nombre, descripcion) VALUES ('Principal', 'Almacén principal de materia prima');

-- 4. Migración de datos: Mover stock actual al almacén Principal
INSERT INTO stock_almacen (materia_prima_id, almacen_id, stock)
SELECT id, (SELECT id FROM almacenes WHERE nombre = 'Principal'), stock
FROM materia_prima;

-- 5. Refactorizar tabla movimientos
ALTER TABLE movimientos ADD COLUMN almacen_id uuid REFERENCES almacenes(id);

-- Actualizar movimientos existentes al almacén Principal
UPDATE movimientos SET almacen_id = (SELECT id FROM almacenes WHERE nombre = 'Principal');

-- Hacer que almacen_id sea obligatorio después de la migración
ALTER TABLE movimientos ALTER COLUMN almacen_id SET NOT NULL;

-- 6. Eliminar columna stock de materia_prima (ahora está en stock_almacen)
ALTER TABLE materia_prima DROP COLUMN stock;

-- 7. Función RPC para registro atómico de movimientos
CREATE OR REPLACE FUNCTION registrar_movimiento_almacen(
  p_materia_prima_id uuid,
  p_almacen_id uuid,
  p_tipo text,
  p_cantidad numeric,
  p_bundle_id text,
  p_unidad_medida text,
  p_comentario text DEFAULT NULL,
  p_imagen_url text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_current_stock numeric;
BEGIN
  -- Asegurar que existe el registro de stock para esa materia prima en ese almacén
  INSERT INTO stock_almacen (materia_prima_id, almacen_id, stock)
  VALUES (p_materia_prima_id, p_almacen_id, 0)
  ON CONFLICT (materia_prima_id, almacen_id) DO NOTHING;

  -- Actualizar Stock
  IF p_tipo = 'entrada' THEN
    UPDATE stock_almacen
    SET stock = stock + p_cantidad
    WHERE materia_prima_id = p_materia_prima_id AND almacen_id = p_almacen_id;
  ELSIF p_tipo = 'salida' THEN
    -- Verificar stock suficiente
    SELECT stock INTO v_current_stock
    FROM stock_almacen
    WHERE materia_prima_id = p_materia_prima_id AND almacen_id = p_almacen_id;

    IF v_current_stock < p_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente en el almacén seleccionado';
    END IF;

    UPDATE stock_almacen
    SET stock = stock - p_cantidad
    WHERE materia_prima_id = p_materia_prima_id AND almacen_id = p_almacen_id;
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento inválido';
  END IF;

  -- Insertar registro de movimiento
  INSERT INTO movimientos (
    bundle_id,
    materia_prima_id,
    almacen_id,
    tipo,
    cantidad,
    unidad_medida,
    comentario,
    imagen_url,
    fecha
  ) VALUES (
    p_bundle_id,
    p_materia_prima_id,
    p_almacen_id,
    p_tipo,
    p_cantidad,
    p_unidad_medida,
    p_comentario,
    p_imagen_url,
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Políticas RLS para nuevas tablas
ALTER TABLE almacenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_almacen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver almacenes" ON almacenes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins pueden gestionar almacenes" ON almacenes FOR ALL USING (public.is_admin());

CREATE POLICY "Usuarios autenticados pueden ver stock" ON stock_almacen FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins pueden gestionar stock" ON stock_almacen FOR ALL USING (public.is_admin());
