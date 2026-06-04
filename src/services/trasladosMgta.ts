import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { TrasladoMgta, TrasladoMgtaFormData, TrasladoMgtaItem } from '../types';

// Helper to parse rates and costs stored in the comment string
export function parseTrasladoComentario(comentarioRaw: string | undefined): {
  comentario: string;
  tasa_dolar: number;
  tasa_euro: number;
  costos_euro: number[];
  manual_items: any[];
} {
  const result = {
    comentario: comentarioRaw || '',
    tasa_dolar: 1.0,
    tasa_euro: 1.0,
    costos_euro: [] as number[],
    manual_items: [] as any[],
  };

  if (!comentarioRaw) return result;

  const trimmed = comentarioRaw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const data = JSON.parse(trimmed);
      if (data && data._isCostoMeta) {
        result.comentario = data.comentario || '';
        result.tasa_dolar = Number(data.tasa_dolar) || 1.0;
        result.tasa_euro = Number(data.tasa_euro) || 1.0;
        result.costos_euro = Array.isArray(data.costos_euro) ? data.costos_euro.map(Number) : [];
        result.manual_items = Array.isArray(data.manual_items) ? data.manual_items : [];
      }
    } catch (e) {
      // Not a valid JSON or not our metadata, keep as plaintext
    }
  }

  return result;
}

// Helper to serialize rates and costs into the comment string
export function serializeTrasladoComentario(
  comentario: string,
  tasa_dolar: number,
  tasa_euro: number,
  costos_euro: number[],
  manual_items?: any[]
): string {
  return JSON.stringify({
    _isCostoMeta: true,
    comentario: comentario || '',
    tasa_dolar: Number(tasa_dolar) || 1.0,
    tasa_euro: Number(tasa_euro) || 1.0,
    costos_euro: costos_euro.map(Number),
    manual_items: manual_items || [],
  });
}

let mockTraslados: TrasladoMgta[] = [
  {
    id: 'TM-20260602-ABCD',
    fecha: new Date().toISOString(),
    comentario: 'Envío inicial de harina, azúcar y aceite vegetal a sede MGTA',
    created_at: new Date().toISOString(),
    items: [
      {
        id: 'item-1',
        traslado_id: 'TM-20260602-ABCD',
        materia_prima_id: '1',
        almacen_origen_id: 'default',
        cantidad: 15,
        unidad_medida: 'kg',
        materia_prima_nombre: 'Harina de Trigo',
        almacen_origen_nombre: 'Almacén Central',
        costo_euro: 1.25,
        costo_calculado: 1.35,
      },
      {
        id: 'item-2',
        traslado_id: 'TM-20260602-ABCD',
        materia_prima_id: '2',
        almacen_origen_id: 'default',
        cantidad: 10,
        unidad_medida: 'kg',
        materia_prima_nombre: 'Azúcar Refinada',
        almacen_origen_nombre: 'Almacén Central',
        costo_euro: 0.95,
        costo_calculado: 1.03,
      }
    ]
  }
];

export async function getTrasladosMgta(): Promise<TrasladoMgta[]> {
  if (!isSupabaseConfigured()) {
    const enrichedMock = mockTraslados.map(t => {
      const meta = parseTrasladoComentario(t.comentario);
      
      const dbItemsOnly = (t.items || []).filter(itm => itm.materia_prima_id !== '__manual__');
      const manualItems = meta.manual_items || [];
      const mergedItems = [...dbItemsOnly, ...manualItems];

      return {
        ...t,
        comentario: meta.comentario,
        tasa_dolar: meta.tasa_dolar,
        tasa_euro: meta.tasa_euro,
        items: mergedItems.map((itm) => {
          const costo_euro = itm.costo_euro || 0;
          const calculated = meta.tasa_dolar > 0 ? (meta.tasa_euro / meta.tasa_dolar) * costo_euro * itm.cantidad : 0;
          return {
            ...itm,
            costo_euro,
            costo_calculado: calculated || 0,
          };
        })
      };
    });
    return enrichedMock.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }

  const { data, error } = await supabase
    .from('traslado_mgta')
    .select(`
      id,
      fecha,
      comentario,
      created_at,
      items:traslado_mgta_items (
        id,
        traslado_id,
        materia_prima_id,
        almacen_origen_id,
        cantidad,
        unidad_medida,
        materia_prima:materia_prima(nombre),
        almacen:almacenes(nombre)
      )
    `)
    .order('fecha', { ascending: false });

  if (error) {
    console.error('Error fetching traslados_mgta:', error);
    throw error;
  }

  return (data || []).map((t: any) => {
    const meta = parseTrasladoComentario(t.comentario);
    
    const dbItemsMapped = (t.items || []).map((itm: any, index: number) => {
      const costo_euro = meta.costos_euro[index] !== undefined ? meta.costos_euro[index] : 0;
      const qty = Number(itm.cantidad);
      const costo_calculado = meta.tasa_dolar > 0 ? (meta.tasa_euro / meta.tasa_dolar) * costo_euro * qty : 0;
      return {
        id: itm.id,
        traslado_id: itm.traslado_id,
        materia_prima_id: itm.materia_prima_id,
        almacen_origen_id: itm.almacen_origen_id,
        cantidad: qty,
        unidad_medida: itm.unidad_medida,
        materia_prima_nombre: itm.materia_prima?.nombre || 'Producto Desconocido',
        almacen_origen_nombre: itm.almacen?.nombre || 'Almacén Desconocido',
        costo_euro,
        costo_calculado,
      };
    });

    const manualItems = meta.manual_items || [];
    const mergedItems = [...dbItemsMapped, ...manualItems];

    return {
      id: t.id,
      fecha: t.fecha,
      comentario: meta.comentario,
      tasa_dolar: meta.tasa_dolar,
      tasa_euro: meta.tasa_euro,
      created_at: t.created_at,
      items: mergedItems
    };
  });
}

export async function createTrasladoMgta(
  data: TrasladoMgtaFormData, 
  displayNames: { products: Record<string, string>, warehouses: Record<string, string> }
): Promise<TrasladoMgta> {
  const customId = `TM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  
  const dbItemsData = data.items.filter(item => !item.is_manual);
  const manualItemsData = data.items.filter(item => item.is_manual);

  const manualItemsMapped: TrasladoMgtaItem[] = manualItemsData.map((item, index) => {
    const costo_euro = item.costo_euro || 0;
    const calculated = (data.tasa_dolar && data.tasa_dolar > 0) ? ((data.tasa_euro || 1.0) / data.tasa_dolar) * costo_euro * item.cantidad : 0;
    return {
      id: `manual-item-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 5)}`,
      traslado_id: customId,
      materia_prima_id: '__manual__',
      almacen_origen_id: item.almacen_origen_id || 'default',
      cantidad: item.cantidad,
      unidad_medida: item.unidad_medida || 'unidades',
      materia_prima_nombre: item.manual_nombre || 'Producto Manual',
      almacen_origen_nombre: displayNames.warehouses[item.almacen_origen_id] || 'Almacén',
      costo_euro,
      costo_calculado: calculated,
    };
  });

  const serializedComment = serializeTrasladoComentario(
    data.comentario || '',
    data.tasa_dolar || 1.0,
    data.tasa_euro || 1.0,
    data.items.map(item => item.costo_euro || 0),
    manualItemsMapped
  );

  if (!isSupabaseConfigured()) {
    const newDbItems: TrasladoMgtaItem[] = dbItemsData.map((item, index) => {
      const costo_euro = item.costo_euro || 0;
      const calculated = (data.tasa_dolar && data.tasa_dolar > 0) ? ((data.tasa_euro || 1.0) / data.tasa_dolar) * costo_euro * item.cantidad : 0;
      return {
        id: `mock-item-${Date.now()}-${index}`,
        traslado_id: customId,
        materia_prima_id: item.materia_prima_id,
        almacen_origen_id: item.almacen_origen_id,
        cantidad: item.cantidad,
        unidad_medida: item.unidad_medida,
        materia_prima_nombre: displayNames.products[item.materia_prima_id] || 'Producto',
        almacen_origen_nombre: displayNames.warehouses[item.almacen_origen_id] || 'Almacén',
        costo_euro,
        costo_calculado: calculated,
      };
    });

    const newTraslado: TrasladoMgta = {
      id: customId,
      fecha: new Date().toISOString(),
      comentario: serializedComment,
      created_at: new Date().toISOString(),
      items: [...newDbItems, ...manualItemsMapped],
    };

    mockTraslados.push(newTraslado);
    return newTraslado;
  }

  // Step 1: Insert into 'traslado_mgta'
  const { error: mainError } = await supabase
    .from('traslado_mgta')
    .insert({
      id: customId,
      comentario: serializedComment,
      tasa_dolar: data.tasa_dolar || 1.0,
      tasa_euro: data.tasa_euro || 1.0
    });

  if (mainError) {
    console.error('Error recording main traslado:', mainError);
    throw mainError;
  }

  // Step 2: Insert into 'traslado_mgta_items' and update stock via registrar_movimiento_almacen ONLY for standard db items
  for (const item of dbItemsData) {
    const { error: detailError } = await supabase
      .from('traslado_mgta_items')
      .insert({
        traslado_id: customId,
        materia_prima_id: item.materia_prima_id,
        almacen_origen_id: item.almacen_origen_id,
        cantidad: item.cantidad,
        unidad_medida: item.unidad_medida
      });

    if (detailError) {
      console.error('Error inserting detail row:', detailError);
      throw detailError;
    }

    const { error: rpcError } = await supabase.rpc('registrar_movimiento_almacen', {
      p_materia_prima_id: item.materia_prima_id,
      p_almacen_id: item.almacen_origen_id,
      p_tipo: 'salida',
      p_cantidad: item.cantidad,
      p_bundle_id: customId,
      p_unidad_medida: item.unidad_medida,
      p_comentario: `Traslado MGTA ref: ${customId}. ${data.comentario || ''}`,
      p_imagen_url: null
    });

    if (rpcError) {
      console.error('Error executing registrar_movimiento_almacen for Traslado MGTA:', rpcError);
      throw rpcError;
    }
  }

  // Fetch new list and find the one we created
  const fetched = await getTrasladosMgta();
  const created = fetched.find(t => t.id === customId);
  if (!created) {
    throw new Error('Traslado creado pero no se pudo recuperar de la base de datos.');
  }
  return created;
}

export async function removeTrasladoMgta(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    mockTraslados = mockTraslados.filter(t => t.id !== id);
    return;
  }

  // 1. Fetch current items to revert stock
  const { data: items, error: fetchError } = await supabase
    .from('traslado_mgta_items')
    .select('*')
    .eq('traslado_id', id);

  if (fetchError) throw fetchError;

  // 2. Revert stock
  for (const item of (items || [])) {
    const { error: rpcError } = await supabase.rpc('registrar_movimiento_almacen', {
      p_materia_prima_id: item.materia_prima_id,
      p_almacen_id: item.almacen_origen_id,
      p_tipo: 'entrada',
      p_cantidad: item.cantidad,
      p_bundle_id: id,
      p_unidad_medida: item.unidad_medida,
      p_comentario: `Reversión por eliminación de Traslado MGTA ref: ${id}`,
      p_imagen_url: null
    });
    if (rpcError) throw rpcError;
  }

  // 3. Delete from DB (this might cascade, but let's delete items first just in case)
  await supabase.from('traslado_mgta_items').delete().eq('traslado_id', id);
  const { error: deleteError } = await supabase.from('traslado_mgta').delete().eq('id', id);

  if (deleteError) throw deleteError;
}

export async function editTrasladoMgta(
  id: string,
  data: TrasladoMgtaFormData,
  displayNames: { products: Record<string, string>, warehouses: Record<string, string> }
): Promise<TrasladoMgta> {
  if (!isSupabaseConfigured()) {
    await removeTrasladoMgta(id);
    const updated = await createTrasladoMgta(data, displayNames);
    updated.id = id;
    updated.fecha = new Date().toISOString();
    updated.items.forEach(itm => itm.traslado_id = id);
    const index = mockTraslados.findIndex(t => t.id === updated.id);
    if(index > -1) mockTraslados[index] = updated;
    return updated;
  }

  // 1. Fetch current items to revert stock
  const { data: oldItems, error: fetchError } = await supabase
    .from('traslado_mgta_items')
    .select('*')
    .eq('traslado_id', id);

  if (fetchError) throw fetchError;

  // 2. Revert old stock
  for (const item of (oldItems || [])) {
    const { error: rpcError } = await supabase.rpc('registrar_movimiento_almacen', {
      p_materia_prima_id: item.materia_prima_id,
      p_almacen_id: item.almacen_origen_id,
      p_tipo: 'entrada',
      p_cantidad: item.cantidad,
      p_bundle_id: id,
      p_unidad_medida: item.unidad_medida,
      p_comentario: `Reversión por edición de Traslado MGTA ref: ${id}`,
      p_imagen_url: null
    });
    if (rpcError) throw rpcError;
  }

  // 3. Delete old items
  await supabase.from('traslado_mgta_items').delete().eq('traslado_id', id);

  // 4. Update Traslado Mgta Main info
  const dbItemsData = data.items.filter(item => !item.is_manual);
  const manualItemsData = data.items.filter(item => item.is_manual);

  const manualItemsMapped: TrasladoMgtaItem[] = manualItemsData.map((item, index) => {
    const costo_euro = item.costo_euro || 0;
    const calculated = (data.tasa_dolar && data.tasa_dolar > 0) ? ((data.tasa_euro || 1.0) / data.tasa_dolar) * costo_euro * item.cantidad : 0;
    return {
      id: `manual-item-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 5)}`,
      traslado_id: id,
      materia_prima_id: '__manual__',
      almacen_origen_id: item.almacen_origen_id || 'default',
      cantidad: item.cantidad,
      unidad_medida: item.unidad_medida || 'unidades',
      materia_prima_nombre: item.manual_nombre || 'Producto Manual',
      almacen_origen_nombre: displayNames.warehouses[item.almacen_origen_id] || 'Almacén',
      costo_euro,
      costo_calculado: calculated,
    };
  });

  const serializedComment = serializeTrasladoComentario(
    data.comentario || '',
    data.tasa_dolar || 1.0,
    data.tasa_euro || 1.0,
    data.items.map(item => item.costo_euro || 0),
    manualItemsMapped
  );

  const { error: updateError } = await supabase
    .from('traslado_mgta')
    .update({
      comentario: serializedComment,
      tasa_dolar: data.tasa_dolar || 1.0,
      tasa_euro: data.tasa_euro || 1.0
    })
    .eq('id', id);

  if (updateError) throw updateError;

  // 5. Insert new items and deduct stock
  for (const item of dbItemsData) {
    const { error: detailError } = await supabase
      .from('traslado_mgta_items')
      .insert({
        traslado_id: id,
        materia_prima_id: item.materia_prima_id,
        almacen_origen_id: item.almacen_origen_id,
        cantidad: item.cantidad,
        unidad_medida: item.unidad_medida
      });

    if (detailError) throw detailError;

    const { error: rpcError } = await supabase.rpc('registrar_movimiento_almacen', {
      p_materia_prima_id: item.materia_prima_id,
      p_almacen_id: item.almacen_origen_id,
      p_tipo: 'salida',
      p_cantidad: item.cantidad,
      p_bundle_id: id,
      p_unidad_medida: item.unidad_medida,
      p_comentario: `Traslado MGTA ref: ${id}. ${data.comentario || ''}`,
      p_imagen_url: null
    });

    if (rpcError) throw rpcError;
  }

  const fetched = await getTrasladosMgta();
  return fetched.find(t => t.id === id) as TrasladoMgta;
}
