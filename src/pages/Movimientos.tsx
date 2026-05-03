import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { Plus, ArrowDownToLine, ArrowUpFromLine, X, Image as ImageIcon, Camera, Calendar, Printer, FileText } from 'lucide-react';
import { Movimiento, MovimientoBundleFormData } from '../types';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO, subDays } from 'date-fns';
import { CameraCapture } from '../components/CameraCapture';
import { SearchableSelect } from '../components/SearchableSelect';
import { cn } from '../lib/utils';

export default function Movimientos() {
  const { movimientos, materiasPrimas, almacenes, stockAlmacen, addMovimiento } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [filterProducto, setFilterProducto] = useState<string>('todos');
  const [filterAlmacen, setFilterAlmacen] = useState<string>('todos');
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  const [formData, setFormData] = useState<MovimientoBundleFormData & { almacen_id: string }>({
    tipo: 'entrada',
    almacen_id: '',
    items: [{
      materia_prima_id: '',
      cantidad: 0,
      unidad_medida: 'kg',
    }],
    comentario: ''
  });
  const [file, setFile] = useState<File | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<Movimiento[] | null>(null);

  const filteredMovimientos = useMemo(() => {
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));

    return movimientos.filter(mov => {
      if (filterTipo !== 'todos') {
        if (filterTipo === 'transferencia') {
          // Check if it's part of a transfer bundle
          const bundle = movimientos.filter(m => m.bundle_id === mov.bundle_id);
          const isTransfer = bundle.length >= 2 && bundle.some(m => m.tipo === 'entrada') && bundle.some(m => m.tipo === 'salida');
          if (!isTransfer) return false;
        } else if (mov.tipo !== filterTipo) {
          return false;
        }
      }
      if (filterProducto !== 'todos' && mov.materia_prima_id !== filterProducto) return false;
      if (filterAlmacen !== 'todos' && mov.almacen_id !== filterAlmacen) return false;
      
      const movDate = parseISO(mov.fecha);
      if (!isWithinInterval(movDate, { start, end })) return false;
      
      return true;
    });
  }, [movimientos, filterTipo, filterProducto, filterAlmacen, startDate, endDate]);

  const handleOpenModal = () => {
    setFormData({
      tipo: 'entrada',
      almacen_id: almacenes.length > 0 ? almacenes[0].id : '',
      items: [{
        materia_prima_id: materiasPrimas.length > 0 ? materiasPrimas[0].id : '',
        cantidad: 0,
        unidad_medida: materiasPrimas.length > 0 ? materiasPrimas[0].unidad_medida : 'kg',
      }],
      comentario: ''
    });
    setFile(null);
    setIsModalOpen(true);
  };

  const handleMateriaPrimaChange = (index: number, id: string) => {
    const mp = materiasPrimas.find(m => m.id === id);
    const newItems = [...formData.items];
    newItems[index] = {
      ...newItems[index],
      materia_prima_id: id,
      unidad_medida: mp ? mp.unidad_medida : newItems[index].unidad_medida,
    };
    setFormData({ ...formData, items: newItems });
  };

  const addRow = () => {
    setFormData({
      ...formData,
      items: [...formData.items, {
        materia_prima_id: materiasPrimas.length > 0 ? materiasPrimas[0].id : '',
        cantidad: 0,
        unidad_medida: materiasPrimas.length > 0 ? materiasPrimas[0].unidad_medida : 'kg',
      }]
    });
  };

  const removeRow = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.almacen_id) {
      toast.error('Debe seleccionar un almacén');
      return;
    }
    const isPrincipalLaVela = almacenes.find(a => a.id === formData.almacen_id)?.nombre === 'Principal La Vela';
    if (isPrincipalLaVela && formData.tipo === 'salida') {
      toast.error('No se pueden registrar salidas en el almacén Principal La Vela');
      return;
    }
    if (formData.items.some(d => !d.materia_prima_id || d.cantidad <= 0)) {
      toast.error('Todos los productos deben tener un producto seleccionado y una cantidad mayor a 0');
      return;
    }
    
    setIsConfirmModalOpen(true);
  };

  const confirmSubmit = async () => {
    try {
      setIsSubmitting(true);
      await addMovimiento(formData, file || undefined);
      toast.success('Movimiento registrado correctamente');
      setIsConfirmModalOpen(false);
      setIsModalOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error al registrar movimiento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const groupedMovimientos = useMemo(() => {
    const groups: { [key: string]: Movimiento[] } = {};
    filteredMovimientos.forEach(mov => {
      if (!groups[mov.bundle_id]) {
        groups[mov.bundle_id] = [];
      }
      groups[mov.bundle_id].push(mov);
    });
    return Object.values(groups).sort((a, b) => new Date(b[0].fecha).getTime() - new Date(a[0].fecha).getTime());
  }, [filteredMovimientos]);

  const paginatedMovimientos = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return groupedMovimientos.slice(startIndex, startIndex + itemsPerPage);
  }, [groupedMovimientos, currentPage]);

  const totalPages = Math.ceil(groupedMovimientos.length / itemsPerPage);

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Fecha', 'Almacén', 'Tipo', 'Productos'];
    const csvContent = [
      headers.join(','),
      ...groupedMovimientos.map((group) => {
        const firstMov = group[0];
        const date = format(new Date(firstMov.fecha), 'yyyy-MM-dd HH:mm');
        const almacen = almacenes.find(a => a.id === firstMov.almacen_id)?.nombre || 'Desconocido';
        const tipo = firstMov.tipo;
        const products = group.map(mov => {
          const mp = materiasPrimas.find(m => m.id === mov.materia_prima_id);
          return `${mp?.nombre || 'Desconocido'}: ${mov.cantidad} ${mov.unidad_medida}`;
        }).join(' | ');
        
        return [
          date,
          `"${almacen}"`,
          tipo,
          `"${products}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `movimientos_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <h2 className="text-2xl font-bold text-gray-900">Historial de Movimientos</h2>
        <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
          >
            <FileText size={18} className="mr-2" />
            <span className="hidden xs:inline">Exportar</span> CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
          >
            <Printer size={18} className="mr-2" />
            Imprimir
          </button>
          <button
            onClick={handleOpenModal}
            className="col-span-2 sm:col-auto flex items-center justify-center px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors text-sm"
          >
            <Plus size={18} className="mr-2" />
            Registrar Movimiento
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-primary-subtle grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-4 items-end print:hidden">
        <div className="w-full lg:w-40">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Almacén</label>
          <select
            value={filterAlmacen}
            onChange={(e) => {
              setFilterAlmacen(e.target.value);
              setCurrentPage(1);
            }}
            className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="todos">Todos</option>
            {almacenes.map(alm => (
              <option key={alm.id} value={alm.id}>{alm.nombre}</option>
            ))}
          </select>
        </div>
        <div className="w-full lg:w-40">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Tipo</label>
          <select
            value={filterTipo}
            onChange={(e) => {
              setFilterTipo(e.target.value);
              setCurrentPage(1);
            }}
            className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="todos">Todos</option>
            <option value="entrada">Entradas</option>
            <option value="salida">Salidas</option>
            <option value="transferencia">Transferencias</option>
          </select>
        </div>
        <div className="w-full lg:w-64">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Producto</label>
          <select
            value={filterProducto}
            onChange={(e) => {
              setFilterProducto(e.target.value);
              setCurrentPage(1);
            }}
            className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="todos">Todos los productos</option>
            {materiasPrimas.map(mp => (
              <option key={mp.id} value={mp.id}>{mp.nombre}</option>
            ))}
          </select>
        </div>
        <div className="w-full lg:w-auto lg:flex-1">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Desde</label>
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="block w-full rounded-md border border-gray-300 pl-10 pr-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        </div>
        <div className="w-full lg:w-auto lg:flex-1">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Hasta</label>
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="block w-full rounded-md border border-gray-300 pl-10 pr-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        </div>
      </div>

      {/* Report Header (Print Only) */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-3xl font-bold text-black mb-2">Valencia Almacén - Historial de Movimientos</h1>
        <p className="text-gray-600">Periodo: {format(parseISO(startDate), 'dd/MM/yyyy')} al {format(parseISO(endDate), 'dd/MM/yyyy')}</p>
        <div className="mt-2 flex justify-center gap-4 text-sm text-gray-500">
          <span>Almacén: {filterAlmacen === 'todos' ? 'Todos' : almacenes.find(a => a.id === filterAlmacen)?.nombre}</span>
          <span>Tipo: {filterTipo === 'todos' ? 'Todos' : filterTipo === 'entrada' ? 'Entradas' : 'Salidas'}</span>
          <span>Producto: {filterProducto === 'todos' ? 'Todos' : materiasPrimas.find(m => m.id === filterProducto)?.nombre}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-primary-subtle overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="table-header">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Almacén</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Productos</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider print:hidden">Evidencia</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedMovimientos.map((group) => {
                const isTransfer = group.length >= 2 && group.some(m => m.tipo === 'entrada') && group.some(m => m.tipo === 'salida');
                const salida = group.find(m => m.tipo === 'salida');
                const entrada = group.find(m => m.tipo === 'entrada');
                const firstMov = group[0];
                const isEntrada = firstMov.tipo === 'entrada';
                
                const almacenOrigen = almacenes.find(a => a.id === salida?.almacen_id)?.nombre || 'Desconocido';
                const almacenDestino = almacenes.find(a => a.id === entrada?.almacen_id)?.nombre || 'Desconocido';

                return (
                  <tr key={firstMov.bundle_id} onClick={() => setSelectedBundle(group)} className="hover:bg-gray-50 cursor-pointer print:break-inside-avoid">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(firstMov.fecha), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {isTransfer ? `${almacenOrigen} ➔ ${almacenDestino}` : (almacenes.find(a => a.id === firstMov.almacen_id)?.nombre || 'Desconocido')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isTransfer ? 'bg-purple-100 text-purple-800' : isEntrada ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {isTransfer ? 'TRANSFERENCIA' : isEntrada ? 'Entrada' : 'Salida'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {isTransfer ? (
                        <>
                          {group.filter(m => m.tipo === 'salida').slice(0, 10).map(mov => {
                            const mp = materiasPrimas.find(m => m.id === mov.materia_prima_id);
                            return <div key={mov.id}>{mp?.nombre || 'Desconocido'}: {mov.cantidad} {mov.unidad_medida}</div>
                          })}
                          {group.filter(m => m.tipo === 'salida').length > 10 && <div>...</div>}
                        </>
                      ) : (
                        <>
                          {group.slice(0, 10).map(mov => {
                            const mp = materiasPrimas.find(m => m.id === mov.materia_prima_id);
                            return <div key={mov.id}>{mp?.nombre || 'Desconocido'}: {mov.cantidad} {mov.unidad_medida}</div>
                          })}
                          {group.length > 10 && <div>...</div>}
                        </>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 print:hidden">
                      {firstMov.imagen_url ? (
                        <a href={firstMov.imagen_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-900 flex items-center">
                          <ImageIcon size={16} className="mr-1" /> Ver
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {paginatedMovimientos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    No hay movimientos que coincidan con los filtros.
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

      {/* Bundle Details Modal */}
      {selectedBundle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-medium text-gray-900">Detalle del Movimiento</h3>
              <button onClick={() => setSelectedBundle(null)} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4 p-6 overflow-y-auto flex-1">
              <p className="text-sm text-gray-600">Fecha: {format(new Date(selectedBundle[0].fecha), 'dd/MM/yyyy HH:mm')}</p>
              {(() => {
                const isTransfer = selectedBundle.length >= 2 && selectedBundle.some(m => m.tipo === 'entrada') && selectedBundle.some(m => m.tipo === 'salida');
                const salida = selectedBundle.find(m => m.tipo === 'salida');
                const entrada = selectedBundle.find(m => m.tipo === 'entrada');
                const almacenOrigen = almacenes.find(a => a.id === salida?.almacen_id)?.nombre || 'Desconocido';
                const almacenDestino = almacenes.find(a => a.id === entrada?.almacen_id)?.nombre || 'Desconocido';

                if (isTransfer) {
                  return (
                    <>
                      <p className="text-sm text-gray-600">Almacén Origen: {almacenOrigen}</p>
                      <p className="text-sm text-gray-600">Almacén Destino: {almacenDestino}</p>
                      <p className="text-sm text-gray-600">Tipo: Transferencia</p>
                    </>
                  );
                } else {
                  return (
                    <>
                      <p className="text-sm text-gray-600">Almacén: {almacenes.find(a => a.id === selectedBundle[0].almacen_id)?.nombre || 'Desconocido'}</p>
                      <p className="text-sm text-gray-600">Tipo: {selectedBundle[0].tipo === 'entrada' ? 'Entrada' : 'Salida'}</p>
                    </>
                  );
                }
              })()}
              {selectedBundle[0].comentario && (
                <p className="text-sm text-gray-600"><span className="font-medium">Comentario:</span> {selectedBundle[0].comentario}</p>
              )}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-2">Productos:</h4>
                {(() => {
                  const isTransfer = selectedBundle.length >= 2 && selectedBundle.some(m => m.tipo === 'entrada') && selectedBundle.some(m => m.tipo === 'salida');
                  const grouped = selectedBundle.reduce<{ [key: string]: Movimiento }>((acc, mov: Movimiento) => {
                    if (mov.tipo === 'salida' || !isTransfer) {
                      if (!acc[mov.materia_prima_id]) {
                        acc[mov.materia_prima_id] = { ...mov, cantidad: 0 };
                      }
                      acc[mov.materia_prima_id].cantidad += mov.cantidad;
                    }
                    return acc;
                  }, {});
                  
                  return Object.values(grouped).map((mov: Movimiento) => {
                    const mp = materiasPrimas.find(m => m.id === mov.materia_prima_id);
                    return <div key={mov.materia_prima_id} className="text-sm text-gray-700">{mp?.nombre || 'Desconocido'}: {mov.cantidad} {mov.unidad_medida}</div>
                  });
                })()}
              </div>
              {selectedBundle[0].imagen_url && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Evidencia:</h4>
                  <img src={selectedBundle[0].imagen_url} alt="Evidencia" className="w-full rounded-lg" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Confirmar Movimiento</h3>
            <p className="text-sm text-gray-600">
              ¿Estás seguro de registrar este movimiento de <strong>{formData.tipo}</strong> en el almacén <strong>{almacenes.find(a => a.id === formData.almacen_id)?.nombre}</strong>?
            </p>
            <div className="text-sm text-gray-700">
              <p>Productos:</p>
              <ul className="list-disc list-inside">
                {formData.items.map((item, index) => {
                  const mp = materiasPrimas.find(m => m.id === item.materia_prima_id);
                  return <li key={index}>{mp?.nombre}: {item.cantidad} {item.unidad_medida}</li>;
                })}
              </ul>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button 
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-800 disabled:opacity-50 flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  'Confirmar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-medium text-gray-900">Registrar Movimiento</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Almacén</label>
                  <select
                    required
                    value={formData.almacen_id}
                    onChange={(e) => {
                      const newAlmacenId = e.target.value;
                      const isNewPrincipal = almacenes.find(a => a.id === newAlmacenId)?.nombre === 'Principal La Vela';
                      setFormData({
                        ...formData,
                        almacen_id: newAlmacenId,
                        tipo: isNewPrincipal ? 'entrada' : formData.tipo
                      });
                    }}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                  >
                    <option value="" disabled>Seleccione un almacén</option>
                    {almacenes.map(alm => (
                      <option key={alm.id} value={alm.id}>{alm.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Tipo de Movimiento</label>
                  <div className="mt-2 flex space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        className="form-radio text-black"
                        name="tipo"
                        value="entrada"
                        checked={formData.tipo === 'entrada'}
                        onChange={() => setFormData({ ...formData, tipo: 'entrada' })}
                      />
                      <span className="ml-2 text-sm text-gray-700">Entrada</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        className="form-radio text-black"
                        name="tipo"
                        value="salida"
                        disabled={almacenes.find(a => a.id === formData.almacen_id)?.nombre === 'Principal La Vela'}
                        checked={formData.tipo === 'salida'}
                        onChange={() => setFormData({ ...formData, tipo: 'salida' })}
                      />
                      <span className={cn("ml-2 text-sm", almacenes.find(a => a.id === formData.almacen_id)?.nombre === 'Principal La Vela' ? "text-gray-400" : "text-gray-700")}>Salida</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">Productos</label>
                  {formData.items.map((item, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg space-y-3 relative border border-gray-100">
                      {formData.items.length > 1 && (
                        <button type="button" onClick={() => removeRow(index)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                          <X size={16} />
                        </button>
                      )}
                      
                      <div>
                          <SearchableSelect
                            options={materiasPrimas.map(mp => {
                              const stockInAlmacen = stockAlmacen.find(s => s.materia_prima_id === mp.id && s.almacen_id === formData.almacen_id)?.stock || 0;
                              return {
                                id: mp.id,
                                label: mp.nombre,
                                subLabel: `Stock: ${stockInAlmacen} ${mp.unidad_medida}`
                              };
                            })}
                            value={item.materia_prima_id}
                            onChange={(val) => handleMateriaPrimaChange(index, val)}
                            placeholder="Seleccione un producto"
                          />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <input
                            type="number"
                            required
                            min="0.01"
                            step="0.01"
                            placeholder="Cantidad"
                            value={item.cantidad || ''}
                            onChange={(e) => {
                              const newItems = [...formData.items];
                              newItems[index].cantidad = Number(e.target.value);
                              setFormData({ ...formData, items: newItems });
                            }}
                            className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            disabled
                            value={item.unidad_medida}
                            className="block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-500 shadow-sm sm:text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addRow}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:border-black hover:text-black transition-colors"
                  >
                    + Agregar Producto
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Evidencia</label>
                  <div className="mt-1 flex items-center space-x-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-black hover:file:bg-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="p-2 bg-gray-100 rounded-md hover:bg-gray-200 text-black"
                    >
                      <Camera size={20} />
                    </button>
                  </div>
                  {file && <p className="text-xs text-gray-500 mt-1">Archivo seleccionado: {file.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Comentario</label>
                  <textarea
                    value={formData.comentario}
                    onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                    placeholder="Opcional: Agregue una nota o comentario..."
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                    rows={3}
                  />
                </div>
              </form>
            </div>

            <div className="p-6 border-t flex justify-end space-x-3">
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
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-black border border-transparent rounded-md hover:bg-gray-800 disabled:opacity-50 flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  'Registrar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {isCameraOpen && (
        <CameraCapture
          onCapture={(capturedFile) => {
            setFile(capturedFile);
            setIsCameraOpen(false);
          }}
          onClose={() => setIsCameraOpen(false)}
        />
      )}
    </div>
  );
}
