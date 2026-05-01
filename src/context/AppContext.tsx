import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MateriaPrima, Movimiento, MateriaPrimaFormData, MovimientoFormData, MovimientoBundleFormData, Almacen, StockAlmacen, AlmacenFormData, TransferenciaFormData } from '../types';
import { supabase } from '../lib/supabase';
import * as materiaPrimaService from '../services/materiaPrima';
import * as movimientosService from '../services/movimientos';
import * as almacenesService from '../services/almacenes';
import { useAuth } from './AuthContext';

interface AppContextType {
  materiasPrimas: MateriaPrima[];
  movimientos: Movimiento[];
  almacenes: Almacen[];
  stockAlmacen: StockAlmacen[];
  loading: boolean;
  error: string | null;
  loadData: () => Promise<void>;
  addMateriaPrima: (data: MateriaPrimaFormData) => Promise<void>;
  editMateriaPrima: (id: string, data: Partial<MateriaPrimaFormData>) => Promise<void>;
  removeMateriaPrima: (id: string) => Promise<void>;
  addMovimiento: (data: MovimientoBundleFormData & { almacen_id: string }, file?: File) => Promise<void>;
  transferirStock: (data: TransferenciaFormData) => Promise<void>;
  addAlmacen: (data: AlmacenFormData) => Promise<void>;
  editAlmacen: (id: string, data: Partial<AlmacenFormData>) => Promise<void>;
  removeAlmacen: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [stockAlmacen, setStockAlmacen] = useState<StockAlmacen[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const loadData = async () => {
    if (!user) {
      setMateriasPrimas([]);
      setMovimientos([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [mpData, movData, almData, stockData] = await Promise.all([
        materiaPrimaService.getMateriasPrimas(),
        movimientosService.getMovimientos(),
        supabase.from('almacenes').select('*'),
        supabase.from('stock_almacen').select('*')
      ]);

      if (almData.error) throw almData.error;
      if (stockData.error) throw stockData.error;

      setMateriasPrimas(mpData);
      setMovimientos(movData);
      setAlmacenes(almData.data || []);
      setStockAlmacen(stockData.data || []);
      setInitialLoadDone(true);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    } else if (!authLoading) {
      setMateriasPrimas([]);
      setMovimientos([]);
      setInitialLoadDone(false);
    }
  }, [user, authLoading]);

  const isAppDataLoading = (authLoading || (user && !initialLoadDone && loading));

  const addMateriaPrima = async (data: MateriaPrimaFormData) => {
    try {
      const newMp = await materiaPrimaService.createMateriaPrima(data);
      setMateriasPrimas(prev => [...prev, newMp]);
    } catch (err: any) {
      throw new Error(err.message || 'Error al crear materia prima');
    }
  };

  const editMateriaPrima = async (id: string, data: Partial<MateriaPrimaFormData>) => {
    try {
      const updatedMp = await materiaPrimaService.updateMateriaPrima(id, data);
      setMateriasPrimas(prev => prev.map(mp => mp.id === id ? updatedMp : mp));
    } catch (err: any) {
      throw new Error(err.message || 'Error al actualizar materia prima');
    }
  };

  const removeMateriaPrima = async (id: string) => {
    try {
      await materiaPrimaService.deleteMateriaPrima(id);
      setMateriasPrimas(prev => prev.filter(mp => mp.id !== id));
    } catch (err: any) {
      throw new Error(err.message || 'Error al eliminar materia prima');
    }
  };

  const addMovimiento = async (data: MovimientoBundleFormData & { almacen_id: string }, file?: File) => {
    try {
      let imagen_url = data.imagen_url;
      if (file) {
        imagen_url = await movimientosService.uploadEvidence(file);
      }
      
      const bundle_id = Math.random().toString(36).substring(7);
      
      const newMovs = await Promise.all(data.items.map(item => movimientosService.createMovimiento({ 
        bundle_id,
        materia_prima_id: item.materia_prima_id,
        almacen_id: data.almacen_id,
        tipo: data.tipo,
        cantidad: item.cantidad,
        unidad_medida: item.unidad_medida,
        imagen_url,
        comentario: data.comentario
      })));
      
      // Update local stock per warehouse
      setStockAlmacen(prev => {
        const next = [...prev];
        data.items.forEach(item => {
          const index = next.findIndex(s => s.materia_prima_id === item.materia_prima_id && s.almacen_id === data.almacen_id);
          if (index !== -1) {
            const currentStock = next[index].stock;
            next[index] = {
              ...next[index],
              stock: data.tipo === 'entrada' ? currentStock + item.cantidad : currentStock - item.cantidad
            };
          } else {
            next.push({
              materia_prima_id: item.materia_prima_id,
              almacen_id: data.almacen_id,
              stock: item.cantidad // Assuming it starts at 0 if not found
            });
          }
        });
        return next;
      });
      
      setMovimientos(prev => [...newMovs, ...prev]);
    } catch (err: any) {
      throw new Error(err.message || 'Error al registrar movimiento');
    }
  };

  const transferirStock = async (data: TransferenciaFormData) => {
    try {
      await movimientosService.realizarTransferencia(data);
      // Recargar datos para asegurar consistencia (o actualizar localmente)
      await loadData();
    } catch (err: any) {
      throw new Error(err.message || 'Error al realizar transferencia');
    }
  };

  const addAlmacen = async (data: AlmacenFormData) => {
    try {
      const newAlm = await almacenesService.createAlmacen(data);
      setAlmacenes(prev => [...prev, newAlm]);
    } catch (err: any) {
      throw new Error(err.message || 'Error al crear almacén');
    }
  };

  const editAlmacen = async (id: string, data: Partial<AlmacenFormData>) => {
    try {
      const updatedAlm = await almacenesService.updateAlmacen(id, data);
      setAlmacenes(prev => prev.map(alm => alm.id === id ? updatedAlm : alm));
    } catch (err: any) {
      throw new Error(err.message || 'Error al actualizar almacén');
    }
  };

  const removeAlmacen = async (id: string) => {
    try {
      await almacenesService.deleteAlmacen(id);
      setAlmacenes(prev => prev.filter(alm => alm.id !== id));
    } catch (err: any) {
      throw new Error(err.message || 'Error al eliminar almacén');
    }
  };

  return (
    <AppContext.Provider value={{
      materiasPrimas,
      movimientos,
      almacenes,
      stockAlmacen,
      loading: isAppDataLoading,
      error,
      loadData,
      addMateriaPrima,
      editMateriaPrima,
      removeMateriaPrima,
      addMovimiento,
      transferirStock,
      addAlmacen,
      editAlmacen,
      removeAlmacen
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
