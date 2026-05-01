import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MateriaPrima, MateriaPrimaFormData } from '../types';

// Mock data for preview when Supabase is not configured
let mockMateriasPrimas: MateriaPrima[] = [
  { id: '1', nombre: 'Harina de Trigo', unidad_medida: 'kg', stock: 500, min_stock: 100, max_stock: 1000, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', nombre: 'Azúcar Refinada', unidad_medida: 'kg', stock: 200, min_stock: 50, max_stock: 500, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '3', nombre: 'Aceite Vegetal', unidad_medida: 'L', stock: 40, min_stock: 50, max_stock: 200, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const getMateriasPrimas = async (): Promise<MateriaPrima[]> => {
  if (!isSupabaseConfigured()) {
    return [...mockMateriasPrimas];
  }
  const { data, error } = await supabase.from('materia_prima').select('*').order('nombre');
  if (error) {
    console.error('Supabase error in getMateriasPrimas:', error);
    throw error;
  }
  
  // Filter duplicates by name
  const seenNames = new Set();
  return (data || []).filter(mp => {
    const normalizedName = mp.nombre.trim().toLowerCase();
    if (seenNames.has(normalizedName)) return false;
    seenNames.add(normalizedName);
    return true;
  });
};

export const createMateriaPrima = async (data: MateriaPrimaFormData): Promise<MateriaPrima> => {
  if (!isSupabaseConfigured()) {
    const newMp: MateriaPrima = {
      ...data,
      id: Math.random().toString(36).substring(7),
      stock: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockMateriasPrimas.push(newMp);
    return newMp;
  }
  const { data: newMp, error } = await supabase.from('materia_prima').insert([{ ...data }]).select().single();
  if (error) throw error;
  return newMp;
};

export const updateMateriaPrima = async (id: string, data: Partial<MateriaPrimaFormData>): Promise<MateriaPrima> => {
  if (!isSupabaseConfigured()) {
    const index = mockMateriasPrimas.findIndex(mp => mp.id === id);
    if (index === -1) throw new Error('Not found');
    mockMateriasPrimas[index] = { ...mockMateriasPrimas[index], ...data, updated_at: new Date().toISOString() };
    return mockMateriasPrimas[index];
  }
  const { data: updatedMp, error } = await supabase.from('materia_prima').update(data).eq('id', id).select().single();
  if (error) throw error;
  return updatedMp;
};

export const deleteMateriaPrima = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    mockMateriasPrimas = mockMateriasPrimas.filter(mp => mp.id !== id);
    return;
  }
  const { error } = await supabase.from('materia_prima').delete().eq('id', id);
  if (error) throw error;
};
