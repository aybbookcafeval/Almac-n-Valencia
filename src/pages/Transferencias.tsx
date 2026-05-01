import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { ArrowRightLeft, AlertCircle, X } from 'lucide-react';
import { TransferenciaFormData } from '../types';
import { SearchableSelect } from '../components/SearchableSelect';

export default function Transferencias() {
  const { materiasPrimas, almacenes, stockAlmacen, transferirStock } = useAppContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<TransferenciaFormData>({
    almacen_origen_id: '',
    almacen_destino_id: '',
    items: [{
      materia_prima_id: '',
      cantidad: 0,
      unidad_medida: 'kg',
    }],
    comentario: ''
  });

  const getAvailableStock = (materia_prima_id: string, almacen_id: string) => {
    return stockAlmacen.find(
      s => s.materia_prima_id === materia_prima_id && s.almacen_id === almacen_id
    )?.stock || 0;
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
        materia_prima_id: '',
        cantidad: 0,
        unidad_medida: 'kg',
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
    if (!formData.almacen_origen_id || !formData.almacen_destino_id) {
      toast.error('Por favor complete todos los campos obligatorios');
      return;
    }
    if (formData.almacen_origen_id === formData.almacen_destino_id) {
      toast.error('El almacén de origen y destino no pueden ser el mismo');
      return;
    }
    if (formData.items.some(item => !item.materia_prima_id || item.cantidad <= 0)) {
      toast.error('Todos los productos deben tener un producto seleccionado y una cantidad mayor a 0');
      return;
    }
    if (formData.items.some(item => item.cantidad > getAvailableStock(item.materia_prima_id, formData.almacen_origen_id))) {
      toast.error('No hay suficiente stock en el almacén de origen para uno o más productos');
      return;
    }

    try {
      setIsSubmitting(true);
      await transferirStock(formData);
      toast.success('Transferencia realizada con éxito');
      setFormData({
        almacen_origen_id: '',
        almacen_destino_id: '',
        items: [{
          materia_prima_id: '',
          cantidad: 0,
          unidad_medida: 'kg',
        }],
        comentario: ''
      });
    } catch (error: any) {
      toast.error(error.message || 'Error al realizar la transferencia');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-3 mb-2">
        <div className="p-2 bg-black text-white rounded-lg">
          <ArrowRightLeft size={24} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Transferencia entre Almacenes</h2>
      </div>

      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-primary-subtle">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Almacén de Origen</label>
                <select
                  required
                  value={formData.almacen_origen_id}
                  onChange={(e) => setFormData({ ...formData, almacen_origen_id: e.target.value })}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                >
                  <option value="" disabled>Seleccione origen</option>
                  {almacenes.map(alm => (
                    <option key={alm.id} value={alm.id}>{alm.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Almacén de Destino</label>
                <select
                  required
                  value={formData.almacen_destino_id}
                  onChange={(e) => setFormData({ ...formData, almacen_destino_id: e.target.value })}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                >
                  <option value="" disabled>Seleccione destino</option>
                  {almacenes.map(alm => (
                    <option key={alm.id} value={alm.id}>{alm.nombre}</option>
                  ))}
                </select>
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
                          const stockInAlmacen = getAvailableStock(mp.id, formData.almacen_origen_id);
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
                        max={getAvailableStock(item.materia_prima_id, formData.almacen_origen_id)}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Comentario / Motivo</label>
              <textarea
                value={formData.comentario}
                onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                placeholder="Opcional: Motivo de la transferencia..."
                rows={3}
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting || formData.items.some(item => item.cantidad <= 0 || item.cantidad > getAvailableStock(item.materia_prima_id, formData.almacen_origen_id))}
              className="w-full flex items-center justify-center px-6 py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 font-medium"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Procesando Transferencia...
                </>
              ) : (
                <>
                  <ArrowRightLeft size={20} className="mr-2" />
                  Realizar Transferencia
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
