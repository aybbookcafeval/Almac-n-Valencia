import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MateriaPrima, Movimiento, MateriaPrimaFormData, MovimientoFormData, MovimientoBundleFormData, Almacen, StockAlmacen, AlmacenFormData, TransferenciaFormData, Recepcion, TransferenciaDB } from '../types';
import { supabase } from '../lib/supabase';
import * as materiaPrimaService from '../services/materiaPrima';
import * as movimientosService from '../services/movimientos';
import * as almacenesService from '../services/almacenes';
import { listarRecepciones } from '../services/recepcionService';
import { useAuth } from './AuthContext';

interface AppContextType {
  materiasPrimas: MateriaPrima[];
  movimientos: Movimiento[];
  almacenes: Almacen[];
  stockAlmacen: StockAlmacen[];
  recepciones: Recepcion[];
  transferencias: TransferenciaDB[];
  loading: boolean;
  error: string | null;
  loadData: () => Promise<void>;
  addMateriaPrima: (data: MateriaPrimaFormData) => Promise<void>;
  editMateriaPrima: (id: string, data: Partial<MateriaPrimaFormData>) => Promise<void>;
  removeMateriaPrima: (id: string) => Promise<void>;
  addMovimiento: (data: MovimientoBundleFormData & { almacen_id: string }, file?: File) => Promise<void>;
  anularMovimiento: (bundle_id: string) => Promise<void>;
  transferirStock: (data: TransferenciaFormData, file?: File) => Promise<void>;
  aprobarTransferencia: (id: string) => Promise<void>;
  anularTransferencia: (id: string) => Promise<void>;
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
  const [recepciones, setRecepciones] = useState<Recepcion[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const loadDataPromiseRef = React.useRef<Promise<void> | null>(null);

  const loadData = async () => {
    if (!user?.id) {
      setMateriasPrimas([]);
      setMovimientos([]);
      setRecepciones([]);
      setTransferencias([]);
      return;
    }

    if (loadDataPromiseRef.current) {
      return loadDataPromiseRef.current;
    }

    setLoading(true);
    setError(null);
    
    const promise = (async () => {
      try {
        const [mpData, movData, almData, stockData, recData, transData] = await Promise.all([
          materiaPrimaService.getMateriasPrimas(),
          movimientosService.getMovimientos(),
          supabase.from('almacenes').select('*'),
          supabase.from('stock_almacen').select('*'),
          listarRecepciones(),
          movimientosService.getTransferencias()
        ]);

        if (almData.error) throw almData.error;
        if (stockData.error) throw stockData.error;

        setMateriasPrimas(mpData);
        setMovimientos(movData);
        setAlmacenes(almData.data || []);
        setStockAlmacen(stockData.data || []);
        setRecepciones(recData);
        setTransferencias(transData);
        setInitialLoadDone(true);
      } catch (err: any) {
        console.error('Error loading data:', err);
        setError(err.message || 'Error al cargar los datos');
      } finally {
        setLoading(false);
        loadDataPromiseRef.current = null;
      }
    })();

    loadDataPromiseRef.current = promise;
    return promise;
  };

  useEffect(() => {
    if (user?.id) {
      loadData();
    } else if (!authLoading) {
      setMateriasPrimas([]);
      setMovimientos([]);
      setInitialLoadDone(false);
    }
  }, [user?.id, authLoading]);

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

  const anularMovimiento = async (bundle_id: string) => {
    try {
      await movimientosService.anularMovimiento(bundle_id);
      // Manually update state for instant feedback
      setMovimientos(prev => prev.filter(m => m.bundle_id !== bundle_id));
      await loadData();
    } catch (err: any) {
      throw new Error(err.message || 'Error al anular movimiento');
    }
  };

  const transferirStock = async (data: TransferenciaFormData, file?: File) => {
    try {
      let imagen_url = data.imagen_url;
      if (file) {
        imagen_url = await movimientosService.uploadEvidence(file);
      }
      
      const newTrans = await movimientosService.createTransferenciaEnRevision({ ...data, imagen_url });
      setTransferencias(prev => [newTrans, ...prev]);
    } catch (err: any) {
      throw new Error(err.message || 'Error al solicitar transferencia');
    }
  };

  const aprobarTransferencia = async (id: string) => {
    try {
      await movimientosService.aprobarTransferencia(id);
      await loadData();
    } catch (err: any) {
      throw new Error(err.message || 'Error al aprobar transferencia');
    }
  };

  const anularTransferencia = async (id: string) => {
    try {
      await movimientosService.anularTransferencia(id);
      await loadData();
    } catch (err: any) {
      throw new Error(err.message || 'Error al anular transferencia');
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
      recepciones,
      transferencias,
      loading: isAppDataLoading,
      error,
      loadData,
      addMateriaPrima,
      editMateriaPrima,
      removeMateriaPrima,
      addMovimiento,
      anularMovimiento,
      transferirStock,
      aprobarTransferencia,
      anularTransferencia,
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
