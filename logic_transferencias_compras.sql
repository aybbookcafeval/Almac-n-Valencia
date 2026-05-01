-- ===============================================================
-- Lógica de Negocio: Transferencias y Entradas por Compras
-- ===============================================================

-- 1. Función para realizar transferencias entre almacenes
CREATE OR REPLACE FUNCTION realizar_transferencia(
  p_materia_prima_id UUID,
  p_almacen_origen_id UUID,
  p_almacen_destino_id UUID,
  p_cantidad NUMERIC,
  p_bundle_id TEXT,
  p_comentario TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_unidad_medida TEXT;
BEGIN
  -- Obtener la unidad de medida de la materia prima
  SELECT unidad_medida INTO v_unidad_medida 
  FROM materia_prima 
  WHERE id = p_materia_prima_id;

  -- 1. Restar stock del origen
  -- El CHECK (stock >= 0) en la tabla stock_almacen lanzará un error si no hay suficiente
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
    bundle_id, materia_prima_id, almacen_id, tipo, cantidad, unidad_medida, comentario, fecha
  ) VALUES (
    p_bundle_id, p_materia_prima_id, p_almacen_origen_id, 'salida', p_cantidad, v_unidad_medida, 
    COALESCE(p_comentario, '') || ' (Transferencia a ' || (SELECT nombre FROM almacenes WHERE id = p_almacen_destino_id) || ')',
    NOW()
  );

  -- 4. Registrar movimiento de ENTRADA en el destino
  INSERT INTO movimientos (
    bundle_id, materia_prima_id, almacen_id, tipo, cantidad, unidad_medida, comentario, fecha
  ) VALUES (
    p_bundle_id, p_materia_prima_id, p_almacen_destino_id, 'entrada', p_cantidad, v_unidad_medida, 
    COALESCE(p_comentario, '') || ' (Transferencia desde ' || (SELECT nombre FROM almacenes WHERE id = p_almacen_origen_id) || ')',
    NOW()
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Ajuste de registrar_movimiento_almacen para soportar ON CONFLICT (Compras)
CREATE OR REPLACE FUNCTION registrar_movimiento_almacen(
  p_materia_prima_id UUID,
  p_almacen_id UUID,
  p_tipo TEXT,
  p_cantidad NUMERIC,
  p_bundle_id TEXT,
  p_unidad_medida TEXT,
  p_comentario TEXT DEFAULT NULL,
  p_imagen_url TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- 1. Actualizar o Insertar Stock
  IF p_tipo = 'entrada' THEN
    INSERT INTO stock_almacen (materia_prima_id, almacen_id, stock)
    VALUES (p_materia_prima_id, p_almacen_id, p_cantidad)
    ON CONFLICT (materia_prima_id, almacen_id)
    DO UPDATE SET stock = stock_almacen.stock + p_cantidad;
  ELSE
    -- Para salidas, el registro DEBE existir y tener stock suficiente
    UPDATE stock_almacen
    SET stock = stock - p_cantidad
    WHERE materia_prima_id = p_materia_prima_id AND almacen_id = p_almacen_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe registro de stock para este producto en el almacén seleccionado.';
    END IF;
  END IF;

  -- 2. Insertar el movimiento
  INSERT INTO movimientos (
    bundle_id, materia_prima_id, almacen_id, tipo, cantidad, unidad_medida, comentario, imagen_url, fecha
  ) VALUES (
    p_bundle_id, p_materia_prima_id, p_almacen_id, p_tipo, p_cantidad, p_unidad_medida, p_comentario, p_imagen_url, NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
