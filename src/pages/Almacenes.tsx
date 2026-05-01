import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, X, Warehouse } from 'lucide-react';
import { AlmacenFormData } from '../types';
import { cn } from '../lib/utils';

export default function Almacenes() {
  const { almacenes, addAlmacen, editAlmacen, removeAlmacen } = useAppContext();
  const { isAdmin } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<AlmacenFormData>({
    nombre: '',
    descripcion: '',
  });

  const handleOpenModal = (alm?: any) => {
    if (alm) {
      setFormData({
        nombre: alm.nombre,
        descripcion: alm.descripcion || '',
      });
      setEditingId(alm.id);
    } else {
      setFormData({
        nombre: '',
        descripcion: '',
      });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      if (editingId) {
        await editAlmacen(editingId, formData);
      } else {
        await addAlmacen(formData);
      }
      setIsModalOpen(false);
    } catch (error: any) {
      alert(error.message || 'Error al guardar almacén');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este almacén? Esta acción no se puede deshacer.')) {
      try {
        await removeAlmacen(id);
      } catch (error: any) {
        alert(error.message || 'Error al eliminar almacén');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Almacenes</h2>
        {isAdmin && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors text-sm"
          >
            <Plus size={18} className="mr-2" />
            Nuevo Almacén
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {almacenes.map((alm) => (
          <div key={alm.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-primary-subtle flex flex-col justify-between">
            <div>
              <div className="flex items-center mb-4">
                <div className="p-2 bg-primary/10 rounded-lg text-primary mr-3">
                  <Warehouse size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">{alm.nombre}</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">{alm.descripcion || 'Sin descripción'}</p>
            </div>
            
            {isAdmin && (
              <div className="flex justify-end space-x-2 border-t pt-4">
                <button
                  onClick={() => handleOpenModal(alm)}
                  className="p-2 text-gray-600 hover:text-black hover:bg-gray-100 rounded-md transition-colors"
                  title="Editar"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(alm.id)}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}
          </div>
        ))}
        {almacenes.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
            No hay almacenes registrados.
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">
                {editingId ? 'Editar Almacén' : 'Nuevo Almacén'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre del Almacén</label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                  placeholder="Ej: Almacén Norte"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Descripción</label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                  placeholder="Opcional: Ubicación o propósito..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
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
    </div>
  );
}
