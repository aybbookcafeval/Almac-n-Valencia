import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Movimiento, MovimientoFormData, TransferenciaFormData } from '../types';

// Mock data for preview
let mockMovimientos: Movimiento[] = [
  { id: '101', bundle_id: 'b1', materia_prima_id: '1', almacen_id: 'default', tipo: 'entrada', cantidad: 100, unidad_medida: 'kg', fecha: new Date().toISOString(), created_at: new Date().toISOString(), comentario: 'Carga inicial' },
  { id: '102', bundle_id: 'b2', materia_prima_id: '2', almacen_id: 'default', tipo: 'salida', cantidad: 50, unidad_medida: 'kg', fecha: new Date().toISOString(), created_at: new Date().toISOString(), comentario: 'Pedido cliente A' },
];

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
      p_comentario: data.comentario
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

  const { error: uploadError } = await supabase.storage.from('movimientos').upload(filePath, file);
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('movimientos').getPublicUrl(filePath);
  return data.publicUrl;
};
