-- Eliminar las versiones antiguas de la función para evitar conflictos de sobrecarga
DROP FUNCTION IF EXISTS public.realizar_transferencia(UUID, UUID, UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.realizar_transferencia(UUID, UUID, UUID, NUMERIC, TEXT, TEXT);

-- Volver a crear la función actualizada con soporte para imagen_url
CREATE OR REPLACE FUNCTION public.realizar_transferencia(
  p_materia_prima_id UUID,
  p_almacen_origen_id UUID,
  p_almacen_destino_id UUID,
  p_cantidad NUMERIC,
  p_bundle_id TEXT,
  p_comentario TEXT DEFAULT NULL,
  p_imagen_url TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_unidad_medida TEXT;
BEGIN
  -- Obtener la unidad de medida de la materia prima
  SELECT unidad_medida INTO v_unidad_medida 
  FROM materia_prima 
  WHERE id = p_materia_prima_id;

  -- 1. Restar stock del origen
  UPDATE stock_almacen
  SET stock = stock - p_cantidad
  WHERE materia_prima_id = p_materia_prima_id AND almacen_id = p_almacen_origen_id;

  -- 2. Sumar stock en el destino (con ON CONFLICT por si no existe el registro)
  INSERT INTO stock_almacen (materia_prima_id, almacen_id, stock)
  VALUES (p_materia_prima_id, p_almacen_destino_id, p_cantidad)
  ON CONFLICT (materia_prima_id, almacen_id)
  DO UPDATE SET stock = stock_almacen.stock + p_cantidad;

  -- 3. Registrar movimiento de SALIDA en el origen
  INSERT INTO movimientos (
    bundle_id, materia_prima_id, almacen_id, tipo, cantidad, unidad_medida, comentario, imagen_url, fecha
  ) VALUES (
    p_bundle_id, p_materia_prima_id, p_almacen_origen_id, 'salida', p_cantidad, v_unidad_medida, 
    COALESCE(p_comentario, '') || ' (Transferencia a ' || (SELECT nombre FROM almacenes WHERE id = p_almacen_destino_id) || ')',
    p_imagen_url,
    NOW()
  );

  -- 4. Registrar movimiento de ENTRADA en el destino
  INSERT INTO movimientos (
    bundle_id, materia_prima_id, almacen_id, tipo, cantidad, unidad_medida, comentario, imagen_url, fecha
  ) VALUES (
    p_bundle_id, p_materia_prima_id, p_almacen_destino_id, 'entrada', p_cantidad, v_unidad_medida, 
    COALESCE(p_comentario, '') || ' (Transferencia desde ' || (SELECT nombre FROM almacenes WHERE id = p_almacen_origen_id) || ')',
    p_imagen_url,
    NOW()
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload Schema
NOTIFY pgrst, 'reload schema';
