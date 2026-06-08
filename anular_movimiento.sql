-- ====================================================================
-- MIGRACIÓN PARA ANULAR MOVIMIENTOS
-- ====================================================================

-- Función para anular un bundle de movimientos
-- Esto revierte el stock basándose en los movimientos originales
-- y luego elimina esos movimientos de la tabla (o los marca como anulados).
-- Aquí los eliminaremos por completitud.

CREATE OR REPLACE FUNCTION anular_movimiento_bundle(p_bundle_id TEXT)
RETURNS VOID AS $$
DECLARE
  v_mov RECORD;
  v_is_admin BOOLEAN;
BEGIN
  -- Verificar si el usuario actual es admin
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Solo los administradores pueden realizar esta operación';
  END IF;

  -- Iterar sobre cada movimiento en el bundle
  FOR v_mov IN SELECT * FROM movimientos WHERE bundle_id = p_bundle_id LOOP
    
    -- Revertir el estado del stock
    IF v_mov.tipo = 'entrada' THEN
      -- Si era entrada, lo sacamos (salida)
      UPDATE stock_almacen
      SET stock = stock - v_mov.cantidad
      WHERE materia_prima_id = v_mov.materia_prima_id AND almacen_id = v_mov.almacen_id;
    ELSE
      -- Si era salida, lo reingresamos (entrada)
      UPDATE stock_almacen
      SET stock = stock + v_mov.cantidad
      WHERE materia_prima_id = v_mov.materia_prima_id AND almacen_id = v_mov.almacen_id;
    END IF;

  END LOOP;

  -- Después de revertir todo el stock, eliminamos los movimientos del historial
  DELETE FROM movimientos WHERE bundle_id = p_bundle_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asegurar permisos
GRANT EXECUTE ON FUNCTION anular_movimiento_bundle(TEXT) TO authenticated;
