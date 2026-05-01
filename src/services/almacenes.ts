import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Almacen, AlmacenFormData } from '../types';

export const getAlmacenes = async (): Promise<Almacen[]> => {
  if (!isSupabaseConfigured()) {
    return [
      { id: '1', nombre: 'Principal', descripcion: 'Almacén principal', created_at: new Date().toISOString() },
      { id: '2', nombre: 'Secundario', descripcion: 'Almacén de reserva', created_at: new Date().toISOString() },
    ];
  }
  const { data, error } = await supabase.from('almacenes').select('*').order('nombre');
  if (error) throw error;
  return data;
};

export const createAlmacen = async (data: AlmacenFormData): Promise<Almacen> => {
  if (!isSupabaseConfigured()) {
    return {
      ...data,
      id: Math.random().toString(36).substring(7),
      created_at: new Date().toISOString(),
    };
  }
  const { data: newAlmacen, error } = await supabase.from('almacenes').insert([data]).select().single();
  if (error) throw error;
  return newAlmacen;
};

export const updateAlmacen = async (id: string, data: Partial<AlmacenFormData>): Promise<Almacen> => {
  if (!isSupabaseConfigured()) {
    return {
      id,
      nombre: data.nombre || 'Almacén',
      descripcion: data.descripcion,
      created_at: new Date().toISOString(),
    };
  }
  const { data: updatedAlmacen, error } = await supabase.from('almacenes').update(data).eq('id', id).select().single();
  if (error) throw error;
  return updatedAlmacen;
};

export const deleteAlmacen = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from('almacenes').delete().eq('id', id);
  if (error) throw error;
};
