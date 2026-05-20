import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, X, Filter, FileText, Printer, Calendar, PlusCircle } from 'lucide-react';
import { MateriaPrimaFormData, MovimientoFormData } from '../types';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO, subDays } from 'date-fns';
import { cn } from '../lib/utils';
import * as movimientosService from '../services/movimientos';

export default function Inventario() {
  const { materiasPrimas, movimientos, almacenes, stockAlmacen, addMateriaPrima, editMateriaPrima, removeMateriaPrima, loadData } = useAppContext();
  const { isAdmin, profile } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReportMode, setIsReportMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Advanced Filters
  const [selectedAlmacenId, setSelectedAlmacenId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterUnidad, setFilterUnidad] = useState<string>('todos');

  const [formData, setFormData] = useState<MateriaPrimaFormData>({
    nombre: '',
    unidad_medida: 'kg',
    min_stock: 0,
    max_stock: 0,
  });

  const [stockFormData, setStockFormData] = useState<MovimientoFormData>({
    materia_prima_id: '',
    almacen_id: '',
    tipo: 'entrada',
    cantidad: 0,
    unidad_medida: 'kg',
    comentario: '',
  });

  const handleOpenModal = (mp?: any) => {
    if (mp) {
      setEditingId(mp.id);
      setFormData({
        nombre: mp.nombre,
        unidad_medida: mp.unidad_medida,
        min_stock: mp.min_stock,
        max_stock: mp.max_stock,
      });
    } else {
      setEditingId(null);
      setFormData({
        nombre: '',
        unidad_medida: 'kg',
        min_stock: 0,
        max_stock: 0,
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenStockModal = (mp: any) => {
    setStockFormData({
        materia_prima_id: mp.id,
        almacen_id: almacenes[0]?.id || '',
        tipo: 'entrada',
        cantidad: 0,
        unidad_medida: mp.unidad_medida,
        comentario: '',
    });
    setIsStockModalOpen(true);
  };

  const handleSubmitStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        setIsSubmitting(true);
        await movimientosService.createMovimiento(stockFormData);
        await loadData(); // Refresh app state
        setIsStockModalOpen(false);
    } catch (error) {
        console.error(error);
        alert('Error al agregar stock');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      if (editingId) {
        await editMateriaPrima(editingId, formData);
      } else {
        await addMateriaPrima(formData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      alert('Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar este producto?')) {
      try {
        await removeMateriaPrima(id);
      } catch (error) {
        console.error(error);
        alert('Error al eliminar');
      }
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Initialize selectedAlmacenId when almacenes load
  useEffect(() => {
    if (almacenes.length > 0 && !selectedAlmacenId) {
      setSelectedAlmacenId(almacenes[0].id);
    }
  }, [almacenes, selectedAlmacenId]);

  const inventoryReport = useMemo(() => {
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));

    return materiasPrimas.map(mp => {
      // Stock in selected warehouse or global sum
      let currentStockInAlmacen = 0;
      if (selectedAlmacenId === 'global') {
        currentStockInAlmacen = stockAlmacen
          .filter(s => s.materia_prima_id === mp.id)
          .reduce((sum, s) => sum + s.stock, 0);
      } else {
        currentStockInAlmacen = stockAlmacen.find(s => s.materia_prima_id === mp.id && s.almacen_id === selectedAlmacenId)?.stock || 0;
      }

      // Movements in range
      const movementsInRange = movimientos.filter(mov => 
        mov.materia_prima_id === mp.id && 
        (selectedAlmacenId === 'global' || mov.almacen_id === selectedAlmacenId) &&
        isWithinInterval(parseISO(mov.fecha), { start, end })
      );

      const entradasInRange = movementsInRange
        .filter(m => m.tipo === 'entrada')
        .reduce((sum, m) => sum + m.cantidad, 0);
      
      const salidasInRange = movementsInRange
        .filter(m => m.tipo === 'salida')
        .reduce((sum, m) => sum + m.cantidad, 0);

      // Movements AFTER end date
      const movementsAfterEnd = movimientos.filter(mov => 
        mov.materia_prima_id === mp.id && 
        (selectedAlmacenId === 'global' || mov.almacen_id === selectedAlmacenId) &&
        parseISO(mov.fecha) > end
      );

      const entradasAfterEnd = movementsAfterEnd
        .filter(m => m.tipo === 'entrada')
        .reduce((sum, m) => sum + m.cantidad, 0);
      
      const salidasAfterEnd = movementsAfterEnd
        .filter(m => m.tipo === 'salida')
        .reduce((sum, m) => sum + m.cantidad, 0);

      // Stock at End Date = CurrentStock - (Entradas after end) + (Salidas after end)
      const stockAtEnd = currentStockInAlmacen - entradasAfterEnd + salidasAfterEnd;
      
      // Stock at Start Date = StockAtEnd - (Entradas in range) + (Salidas in range)
      const stockAtStart = stockAtEnd - entradasInRange + salidasInRange;

      return {
        ...mp,
        stock: currentStockInAlmacen,
        stockAtStart,
        entradasInRange,
        salidasInRange,
        stockAtEnd
      };
    }).filter(mp => {
      const matchesSearch = mp.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesUnidad = filterUnidad === 'todos' || mp.unidad_medida === filterUnidad;
      
      let matchesStatus = true;
      if (filterStatus !== 'todos') {
        const isLow = mp.stockAtEnd < mp.min_stock;
        const isHigh = mp.stockAtEnd > mp.max_stock;
        const status = isLow ? 'bajo' : isHigh ? 'alto' : 'optimo';
        matchesStatus = status === filterStatus;
      }

      return matchesSearch && matchesUnidad && matchesStatus;
    });
  }, [materiasPrimas, movimientos, startDate, endDate, searchTerm, filterStatus, filterUnidad]);

  const filteredMateriasPrimas = useMemo(() => {
    return materiasPrimas.map(mp => {
      let stock = 0;
      if (selectedAlmacenId === 'global') {
        stock = stockAlmacen
          .filter(s => s.materia_prima_id === mp.id)
          .reduce((sum, s) => sum + s.stock, 0);
      } else {
        stock = stockAlmacen.find(s => s.materia_prima_id === mp.id && s.almacen_id === selectedAlmacenId)?.stock || 0;
      }
      return { ...mp, stock };
    }).filter(mp => {
      const matchesSearch = mp.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesUnidad = filterUnidad === 'todos' || mp.unidad_medida === filterUnidad;
      
      let matchesStatus = true;
      if (filterStatus !== 'todos') {
        const isLow = mp.stock < mp.min_stock;
        const isHigh = mp.stock > mp.max_stock;
        const status = isLow ? 'bajo' : isHigh ? 'alto' : 'optimo';
        matchesStatus = status === filterStatus;
      }

      return matchesSearch && matchesUnidad && matchesStatus;
    });
  }, [materiasPrimas, stockAlmacen, selectedAlmacenId, searchTerm, filterStatus, filterUnidad]);

  const paginatedMateriasPrimas = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredMateriasPrimas.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredMateriasPrimas, currentPage]);

  const totalPages = Math.ceil(filteredMateriasPrimas.length / itemsPerPage);

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  const handleExportCSV = () => {
    const data = isReportMode ? inventoryReport : filteredMateriasPrimas;
    const headers = isReportMode 
      ? ['Producto', 'Stock Inicial', 'Entradas', 'Salidas', 'Stock Final', 'Unidad']
      : ['Nombre', 'Stock Actual', 'Unidad', 'Min Stock', 'Max Stock'];
    
    const csvContent = [
      headers.join(','),
      ...data.map((mp: any) => {
        if (isReportMode) {
          return [
            `"${mp.nombre}"`,
            mp.stockAtStart,
            mp.entradasInRange,
            mp.salidasInRange,
            mp.stockAtEnd,
            mp.unidad_medida
          ].join(',');
        }
        return [
          `"${mp.nombre}"`,
          mp.stock,
          mp.unidad_medida,
          mp.min_stock,
          mp.max_stock
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <h2 className="text-2xl font-bold text-gray-900">Inventario de Materia Prima</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            <Printer size={20} className="mr-2" />
            Imprimir Inventario
          </button>
          {(isAdmin || profile?.role === 'user') && (
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
            >
              <Plus size={20} className="mr-2" />
              Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-primary-subtle flex flex-wrap gap-6 items-end print:hidden">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Almacén</label>
          <select
            value={selectedAlmacenId}
            onChange={(e) => {
              setSelectedAlmacenId(e.target.value);
              setCurrentPage(1);
            }}
            className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="global">Global</option>
            {almacenes.map(alm => (
              <option key={alm.id} value={alm.id}>{alm.nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Buscar Producto</label>
          <input
            type="text"
            placeholder="Nombre del producto..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Estado</label>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="todos">Todos los estados</option>
            <option value="bajo">Bajo Stock</option>
            <option value="optimo">Óptimo</option>
            <option value="alto">Sobre-stock</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Unidad</label>
          <select
            value={filterUnidad}
            onChange={(e) => {
              setFilterUnidad(e.target.value);
              setCurrentPage(1);
            }}
            className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="todos">Todas las unidades</option>
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="L">L</option>
            <option value="ml">ml</option>
            <option value="unidades">unidades</option>
          </select>
        </div>
        
      </div>

      {/* Report Header (Print Only) */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-3xl font-bold text-black mb-2">Valencia Almacén - Reporte de Inventario</h1>
        <p className="text-lg font-medium text-gray-700">Almacén: {selectedAlmacenId === 'global' ? 'Todos los Almacenes (Global)' : almacenes.find(a => a.id === selectedAlmacenId)?.nombre}</p>
        <p className="text-gray-600">Periodo: {format(parseISO(startDate), 'dd/MM/yyyy')} al {format(parseISO(endDate), 'dd/MM/yyyy')}</p>
        <p className="text-xs text-gray-400 mt-2">Generado el: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-primary-subtle overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className={isReportMode ? "bg-black text-white" : "table-header"}>
              {isReportMode ? (
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Producto</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Stock Inicial</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-green-100">Entradas (+)</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-red-100">Salidas (-)</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Stock Final</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Unidad</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Stock Actual</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Unidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Mín / Máx</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Estado</th>
                  {(isAdmin || profile?.role === 'user') && <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider print:hidden">Acciones</th>}
                </tr>
              )}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedMateriasPrimas.map((mp: any) => {
                if (isReportMode) {
                  return (
                    <tr key={mp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{mp.nombre}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600 font-mono">{mp.stockAtStart}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-green-600 font-mono font-bold">+{mp.entradasInRange}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-red-600 font-mono font-bold">-{mp.salidasInRange}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 font-mono font-bold">{mp.stockAtEnd}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">{mp.unidad_medida}</td>
                    </tr>
                  );
                }
                
                const isLow = mp.stock < mp.min_stock;
                const isHigh = mp.stock > mp.max_stock;
                return (
                  <tr key={mp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{mp.nombre}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">{mp.stock}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{mp.unidad_medida}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{mp.min_stock} / {mp.max_stock}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isLow ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Bajo</span>
                      ) : isHigh ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">Alto</span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Óptimo</span>
                      )}
                    </td>
                    {(isAdmin || profile?.role === 'user') && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium print:hidden">
                        <button onClick={() => handleOpenModal(mp)} className="text-blue-600 hover:text-blue-900 mr-4">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleOpenStockModal(mp)} className="text-green-600 hover:text-green-900 mr-4" title="Agregar Stock">
                          <PlusCircle size={18} />
                        </button>
                        {isAdmin && (
                          <button onClick={() => handleDelete(mp.id)} className="text-red-600 hover:text-red-900">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {paginatedMateriasPrimas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    No hay productos que coincidan con los criterios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between print:hidden">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-700">Página {currentPage} de {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingId ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Unidad de Medida</label>
                <select
                  value={formData.unidad_medida}
                  onChange={(e) => setFormData({ ...formData, unidad_medida: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                >
                  <option value="kg">Kilogramos (kg)</option>
                  <option value="g">Gramos (g)</option>
                  <option value="L">Litros (L)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="unidades">Unidades</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stock Mínimo</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stock Máximo</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.max_stock}
                    onChange={(e) => setFormData({ ...formData, max_stock: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-black border border-transparent rounded-md hover:bg-gray-800 disabled:opacity-50 flex items-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Guardando...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Modal */}
      {isStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Agregar Stock</h3>
              <button onClick={() => setIsStockModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmitStock} className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Almacén</label>
                <select
                  required
                  value={stockFormData.almacen_id}
                  onChange={(e) => setStockFormData({ ...stockFormData, almacen_id: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                >
                  {almacenes.map(alm => (
                    <option key={alm.id} value={alm.id}>{alm.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Cantidad</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.001"
                  value={stockFormData.cantidad}
                  onChange={(e) => setStockFormData({ ...stockFormData, cantidad: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Comentario</label>
                <input
                  type="text"
                  value={stockFormData.comentario}
                  onChange={(e) => setStockFormData({ ...stockFormData, comentario: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsStockModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-black border border-transparent rounded-md hover:bg-gray-800 disabled:opacity-50 flex items-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Guardando...
                    </>
                  ) : (
                    'Agregar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
