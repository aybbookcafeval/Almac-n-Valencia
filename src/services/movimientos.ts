import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Movimiento, MovimientoFormData, TransferenciaFormData, TransferenciaDB } from '../types';

// Mock data for preview
let mockMovimientos: Movimiento[] = [
  { id: '101', bundle_id: 'b1', materia_prima_id: '1', almacen_id: 'default', tipo: 'entrada', cantidad: 100, unidad_medida: 'kg', fecha: new Date().toISOString(), created_at: new Date().toISOString(), comentario: 'Carga inicial' },
  { id: '102', bundle_id: 'b2', materia_prima_id: '2', almacen_id: 'default', tipo: 'salida', cantidad: 50, unidad_medida: 'kg', fecha: new Date().toISOString(), created_at: new Date().toISOString(), comentario: 'Pedido cliente A' },
];

let mockTransferencias: TransferenciaDB[] = [];

export const getTransferencias = async (): Promise<TransferenciaDB[]> => {
  if (!isSupabaseConfigured()) {
    return [...mockTransferencias].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }
  const { data, error } = await supabase
    .from('transferencias')
    .select(`
      *,
      items:transferencia_items(*)
    `)
    .order('fecha', { ascending: false });
    
  if (error) throw error;
  return data as TransferenciaDB[];
};

export const createTransferenciaEnRevision = async (data: TransferenciaFormData): Promise<TransferenciaDB> => {
  if (!isSupabaseConfigured()) {
    const newTrans: TransferenciaDB = {
      id: Math.random().toString(36).substring(7),
      almacen_origen_id: data.almacen_origen_id,
      almacen_destino_id: data.almacen_destino_id,
      estado: 'revision',
      comentario: data.comentario,
      imagen_url: data.imagen_url,
      fecha: new Date().toISOString(),
      created_at: new Date().toISOString(),
      items: data.items.map(i => ({
        id: Math.random().toString(36).substring(7),
        transferencia_id: '',
        materia_prima_id: i.materia_prima_id,
        cantidad: i.cantidad,
        unidad_medida: i.unidad_medida
      }))
    };
    newTrans.items?.forEach(i => i.transferencia_id = newTrans.id);
    mockTransferencias.push(newTrans);
    return newTrans;
  }

  // 1. Insert main record
  const { data: newTrans, error: transError } = await supabase
    .from('transferencias')
    .insert({
      almacen_origen_id: data.almacen_origen_id,
      almacen_destino_id: data.almacen_destino_id,
      estado: 'revision',
      comentario: data.comentario,
      imagen_url: data.imagen_url
    })
    .select()
    .single();

  if (transError) throw transError;

  // 2. Insert items
  const itemsToInsert = data.items.map(item => ({
    transferencia_id: newTrans.id,
    materia_prima_id: item.materia_prima_id,
    cantidad: item.cantidad,
    unidad_medida: item.unidad_medida
  }));

  const { error: itemsError } = await supabase
    .from('transferencia_items')
    .insert(itemsToInsert);

  if (itemsError) throw itemsError;

  const { data: finalRecord, error: fetchError } = await supabase
    .from('transferencias')
    .select(`*, items:transferencia_items(*)`)
    .eq('id', newTrans.id)
    .single();

  if (fetchError) throw fetchError;
  return finalRecord as TransferenciaDB;
};

export const updateTransferenciaEnRevision = async (id: string, data: TransferenciaFormData): Promise<void> => {
  if (!isSupabaseConfigured()) {
    const idx = mockTransferencias.findIndex(t => t.id === id);
    if (idx > -1) {
      mockTransferencias[idx].almacen_origen_id = data.almacen_origen_id;
      mockTransferencias[idx].almacen_destino_id = data.almacen_destino_id;
      mockTransferencias[idx].comentario = data.comentario;
      mockTransferencias[idx].imagen_url = data.imagen_url || mockTransferencias[idx].imagen_url;
      mockTransferencias[idx].items = data.items.map(i => ({
        id: Math.random().toString(36).substring(7),
        transferencia_id: id,
        materia_prima_id: i.materia_prima_id,
        cantidad: i.cantidad,
        unidad_medida: i.unidad_medida
      }));
    }
    return;
  }

  // 1. Update main record
  const { error: transError } = await supabase
    .from('transferencias')
    .update({
      almacen_origen_id: data.almacen_origen_id,
      almacen_destino_id: data.almacen_destino_id,
      comentario: data.comentario,
      imagen_url: data.imagen_url
    })
    .eq('id', id);

  if (transError) throw transError;

  // 2. Delete old items
  await supabase.from('transferencia_items').delete().eq('transferencia_id', id);

  // 3. Insert new items
  const itemsToInsert = data.items.map(item => ({
    transferencia_id: id,
    materia_prima_id: item.materia_prima_id,
    cantidad: item.cantidad,
    unidad_medida: item.unidad_medida
  }));

  const { error: itemsError } = await supabase
    .from('transferencia_items')
    .insert(itemsToInsert);

  if (itemsError) throw itemsError;
}

export const anularTransferencia = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    const t = mockTransferencias.find(t => t.id === id);
    if (t) t.estado = 'anulado';
    return;
  }
  const { error } = await supabase.from('transferencias').update({ estado: 'anulado' }).eq('id', id);
  if (error) throw error;
}

export const aprobarTransferencia = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    const t = mockTransferencias.find(tx => tx.id === id);
    if (t && t.estado === 'revision') {
      await realizarTransferencia({
        almacen_origen_id: t.almacen_origen_id,
        almacen_destino_id: t.almacen_destino_id,
        comentario: t.comentario,
        imagen_url: t.imagen_url,
        items: t.items || []
      });
      t.estado = 'aprobado';
    }
    return;
  }

  const { data, error } = await supabase.from('transferencias').select('*, items:transferencia_items(*)').eq('id', id).single();
  if (error) throw error;
  const t = data as TransferenciaDB;

  if (t.estado !== 'revision') throw new Error("La transferencia ya fue procesada");

  // Call realizar_transferencia for actual stock movements
  await realizarTransferencia({
    almacen_origen_id: t.almacen_origen_id,
    almacen_destino_id: t.almacen_destino_id,
    comentario: t.comentario || '',
    imagen_url: t.imagen_url,
    items: t.items || []
  });

  // Mark as approved
  const { error: updateError } = await supabase.from('transferencias').update({ estado: 'aprobado' }).eq('id', id);
  if (updateError) throw updateError;
}

export const getMovimientos = async (): Promise<Movimiento[]> => {
  if (!isSupabaseConfigured()) {
    return [...mockMovimientos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }
  const { data, error } = await supabase.from('movimientos').select('*').order('fecha', { ascending: false });
  if (error) throw error;
  return data;
};

export const createMovimiento = async (data: MovimientoFormData): Promise<Movimiento> => {
  if (!isSupabaseConfigured()) {
    const newMov: Movimiento = {
      ...data,
      id: Math.random().toString(36).substring(7),
      bundle_id: data.bundle_id || Math.random().toString(36).substring(7),
      fecha: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    mockMovimientos.push(newMov);
    return newMov;
  }
  
  // Use the RPC function for atomic operations
  const { error } = await supabase.rpc('registrar_movimiento_almacen', {
    p_materia_prima_id: data.materia_prima_id,
    p_almacen_id: data.almacen_id,
    p_tipo: data.tipo,
    p_cantidad: data.cantidad,
    p_bundle_id: data.bundle_id || Math.random().toString(36).substring(7),
    p_unidad_medida: data.unidad_medida,
    p_comentario: data.comentario || null,
    p_imagen_url: data.imagen_url || null
  });

  if (error) throw error;

  // Fetch the newly created movement to return it (RPC doesn't return the record in this case)
  const { data: newMov, error: fetchError } = await supabase
    .from('movimientos')
    .select('*')
    .eq('materia_prima_id', data.materia_prima_id)
    .eq('almacen_id', data.almacen_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchError) throw fetchError;
  return newMov;
};

export const anularMovimiento = async (bundle_id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    mockMovimientos = mockMovimientos.filter(m => m.bundle_id !== bundle_id);
    return;
  }
  
  const { error } = await supabase.rpc('anular_movimiento_bundle', {
    p_bundle_id: bundle_id
  });

  if (error) throw error;
};

export const realizarTransferencia = async (data: TransferenciaFormData): Promise<void> => {
  if (!isSupabaseConfigured()) {
    const bundle_id = Math.random().toString(36).substring(7);
    for (const item of data.items) {
      mockMovimientos.push({
        id: Math.random().toString(36).substring(7),
        bundle_id,
        materia_prima_id: item.materia_prima_id,
        almacen_id: data.almacen_origen_id,
        tipo: 'salida',
        cantidad: item.cantidad,
        unidad_medida: item.unidad_medida,
        fecha: new Date().toISOString(),
        created_at: new Date().toISOString(),
        comentario: data.comentario
      });
      mockMovimientos.push({
        id: Math.random().toString(36).substring(7),
        bundle_id,
        materia_prima_id: item.materia_prima_id,
        almacen_id: data.almacen_destino_id,
        tipo: 'entrada',
        cantidad: item.cantidad,
        unidad_medida: item.unidad_medida,
        fecha: new Date().toISOString(),
        created_at: new Date().toISOString(),
        comentario: data.comentario
      });
    }
    return;
  }

  const bundle_id = Math.random().toString(36).substring(7);
  for (const item of data.items) {
    const { error } = await supabase.rpc('realizar_transferencia', {
      p_materia_prima_id: item.materia_prima_id,
      p_almacen_origen_id: data.almacen_origen_id,
      p_almacen_destino_id: data.almacen_destino_id,
      p_cantidad: item.cantidad,
      p_bundle_id: bundle_id,
      p_comentario: data.comentario,
      p_imagen_url: data.imagen_url
    });

    if (error) throw error;
  }
};

export const uploadEvidence = async (file: File): Promise<string> => {
  if (!isSupabaseConfigured()) {
    return URL.createObjectURL(file); // Mock URL
  }
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage.from('transfer-evidence').upload(filePath, file);
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('transfer-evidence').getPublicUrl(filePath);
  return data.publicUrl;
};
