import React, { useState } from 'react';
import { Camera, AlertCircle, Check } from 'lucide-react';
import { analizarFactura, guardarRecepcion, listarRecepciones, obtenerDetalleRecepcion, aprobarRecepcion } from '../services/recepcionService';
import { cn } from '../lib/utils';
import { useAppContext } from '../context/AppContext';

export default function Recepcion() {
  const { almacenes, loadData, materiasPrimas } = useAppContext();
  const [file, setFile] = useState<File | null>(null);
  const [recepciones, setRecepciones] = useState<any[]>([]);
  const [recepcion, setRecepcion] = useState<any>(null);
  const [editableItems, setEditableItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editingRecepcion, setEditingRecepcion] = useState<any>(null);
  const [adminNotas, setAdminNotas] = useState('');
  const [selectedAlmacen, setSelectedAlmacen] = useState<string>('');

  // Initialize editableItems when recepcion changes
  React.useEffect(() => {
    if (recepcion && recepcion.items) {
        setEditableItems(recepcion.items.map((item: any) => ({
            ...item,
            cantidad_manual: item.datos_json.cantidad || '',
            producto_id: item.producto_id || '',
            foto_item: null // Store blob or preview URL
        })));
    }
  }, [recepcion]);

  React.useEffect(() => {
    listarRecepciones().then(setRecepciones).catch(console.error);
  }, []);

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    try {
        const result = await analizarFactura(file, materiasPrimas);
        setRecepcion(result);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const addItem = () => {
    setEditableItems([...editableItems, {
        nombre_factura: '',
        datos_json: { nombre: '', cantidad: '' },
        verificacion: { match_status: 'MANUAL_SEARCH_REQUIRED', peso_balanza: '0' },
        producto_id: null,
        cantidad_manual: '',
        foto_item: null,
        isManual: true
    }]);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const newItems = [...editableItems];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setEditableItems(newItems);
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
        // Update recepcion data with editableItems
        const updatedRecepcion = {
            ...recepcion,
            factura_file: file, // Include the file object
            items: editableItems.map(item => ({
                ...item,
                datos_json: { ...item.datos_json, cantidad: item.cantidad_manual }
            }))
        };
        await guardarRecepcion(updatedRecepcion);
        alert('Recepción guardada correctamente');
        setRecepcion(null);
        setFile(null);
        setEditableItems([]);
        const updatedList = await listarRecepciones();
        setRecepciones(updatedList);
    } catch(e) { console.error(e); }
    setConfirming(false);
  };

  const handleApprove = async (id: string) => {
    if (!selectedAlmacen) {
        alert('Por favor selecciona un almacén en el que ingresar los productos.');
        return;
    }
    try {
        console.log('Aprobando recepción', id, 'con notas:', adminNotas, 'almacen', selectedAlmacen);
        await aprobarRecepcion(id, 'Aprobado', adminNotas, selectedAlmacen, editingRecepcion.recepcion_items);
        alert('Recepción aprobada y productos cargados al almacén seleccionado.');
        setEditingRecepcion(null);
        setAdminNotas(''); // Clear notes
        setSelectedAlmacen(''); // Clear selection
        const updatedList = await listarRecepciones();
        setRecepciones(updatedList);
        await loadData(); // Update inventory stock
        console.log('Lista actualizada');
    } catch(e) { 
        console.error('Error al aprobar recepción:', e);
        alert('Error al aprobar la recepción. Revisa la consola.');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Recepción de Mercancía</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Historial de Recepciones</h2>
        <div className="bg-white rounded-lg shadow-sm">
            {recepciones.map(r => (
                <div key={r.id} onClick={async () => { 
                    const det = await obtenerDetalleRecepcion(r.id);
                    setEditingRecepcion(det);
                }} className="p-4 border-b last:border-b-0 flex justify-between cursor-pointer hover:bg-gray-50">
                    <span>Factura: {r.factura_nro} - {r.proveedor}</span>
                    <span className={cn("font-bold", r.estado === 'Aprobado' ? 'text-green-600' : 'text-gray-900')}>{r.estado}</span>
                </div>
            ))}
        </div>
      </div>
      
      {editingRecepcion && (
          <div className="fixed inset-0 bg-black/50 p-6 overflow-y-auto">
              <div className="bg-white p-6 rounded-lg max-w-4xl mx-auto">
                  <h2 className="text-xl font-bold mb-4">Inspeccionar Recepción: {editingRecepcion.factura_nro}</h2>
                  
                  {editingRecepcion.imagen_url && (
                      <div className="mb-6">
                        <p className="font-semibold mb-2">Imagen de Factura</p>
                        <img src={editingRecepcion.imagen_url} alt="Factura" className="w-full rounded-lg shadow-md" />
                      </div>
                  )}

                  <div className="space-y-4 mb-6">
                      <p className="font-semibold">Ítems Detallados:</p>
                      {editingRecepcion.recepcion_items.map((item: any, idx: number) => (
                          <div key={idx} className="border p-4 rounded-lg flex items-start gap-4">
                              {item.imagen_url && (
                                  <img src={item.imagen_url} alt="Item" className="w-24 h-24 rounded object-cover" />
                              )}
                              <div className="flex-1">
                                  <p className="font-semibold">{item.nombre_factura}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                      <span className="text-sm">Cantidad:</span>
                                      <input 
                                          type="text" 
                                          value={item.datos_json?.cantidad || ''} 
                                          onChange={(e) => {
                                              if (editingRecepcion.estado !== 'Recibido') return;
                                              const newItems = [...editingRecepcion.recepcion_items];
                                              newItems[idx] = { 
                                                  ...newItems[idx], 
                                                  datos_json: { ...newItems[idx].datos_json, cantidad: e.target.value } 
                                              };
                                              setEditingRecepcion({ ...editingRecepcion, recepcion_items: newItems });
                                          }}
                                          disabled={editingRecepcion.estado !== 'Recibido'}
                                          className="border rounded p-1 w-24 text-sm disabled:bg-gray-100 disabled:text-gray-600"
                                          placeholder="Ej: 200g"
                                      />
                                  </div>
                                  <select
                                      value={item.producto_id || ''}
                                      onChange={(e) => {
                                          if (editingRecepcion.estado !== 'Recibido') return;
                                          const newItems = [...editingRecepcion.recepcion_items];
                                          newItems[idx] = { ...newItems[idx], producto_id: e.target.value };
                                          setEditingRecepcion({ ...editingRecepcion, recepcion_items: newItems });
                                      }}
                                      disabled={editingRecepcion.estado !== 'Recibido'}
                                      className="border rounded p-1 w-full text-sm mt-2 focus:ring-1 focus:ring-black disabled:bg-gray-100 disabled:text-gray-600"
                                  >
                                      <option value="">-- Vincular Producto en Inventario --</option>
                                      {materiasPrimas.map(mp => (
                                          <option key={mp.id} value={mp.id}>{mp.nombre} (Stock: {mp.stock} {mp.unidad_medida})</option>
                                      ))}
                                  </select>
                                  <p className={cn("text-sm font-medium mt-1", item.match_status === 'OK' ? "text-green-600" : "text-orange-600")}>{item.match_status}</p>
                              </div>
                          </div>
                      ))}
                  </div>
                  
                  {editingRecepcion.estado === 'Recibido' ? (
                      <>
                        <textarea className="w-full border p-2 mb-4 rounded" placeholder="Notas del inspector" value={adminNotas} onChange={e => setAdminNotas(e.target.value)} />
                        
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2">Almacén de Ingreso (Obligatorio para aprobar)</label>
                            <select 
                                value={selectedAlmacen}
                                onChange={e => setSelectedAlmacen(e.target.value)}
                                className="w-full border p-2 rounded focus:ring-1 focus:ring-black"
                            >
                                <option value="">-- Selecciona el Almacén --</option>
                                {almacenes.map(a => (
                                    <option key={a.id} value={a.id}>{a.nombre}</option>
                                ))}
                            </select>
                        </div>
                      </>
                  ) : (
                      editingRecepcion.notas && (
                          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                              <p className="text-sm font-medium text-gray-500 mb-1">Notas del inspector:</p>
                              <p className="text-gray-900">{editingRecepcion.notas}</p>
                          </div>
                      )
                  )}

                  <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingRecepcion(null)} className="bg-gray-400 text-white px-4 py-2 rounded">Cerrar</button>
                      {editingRecepcion.estado === 'Recibido' && (
                        <button onClick={() => handleApprove(editingRecepcion.id)} className="bg-green-600 text-white px-4 py-2 rounded">Aprobar</button>
                      )}
                  </div>
              </div>
          </div>
      )}

      {!recepcion ? (
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <label className="block mb-4">
                <span className="text-gray-700">Subir Factura</span>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark" />
            </label>
            <button onClick={handleProcess} disabled={loading} className="bg-black text-white px-4 py-2 rounded-md disabled:bg-gray-400">
                {loading ? 'Procesando...' : 'Procesar Factura'}
            </button>
        </div>
      ) : (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
                <h2 className="text-xl font-semibold mb-2">Factura: {recepcion.factura_nro}</h2>
                <p>Proveedor: {recepcion.proveedor}</p>
                <p>Estado: {recepcion.estado}</p>
                {recepcion.imagen_url && (
                    <img src={recepcion.imagen_url} alt="Factura" className="mt-4 max-w-xs rounded-md shadow-sm" />
                )}
            </div>
            
            <div className="grid gap-4">
                { editableItems.map((item: any, idx: number) => (
                    <div key={idx} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                {item.isManual ? (
                                    <input 
                                        type="text" 
                                        value={item.nombre_factura}
                                        onChange={(e) => updateItem(idx, 'nombre_factura', e.target.value)}
                                        className="font-semibold border rounded p-1 w-full"
                                        placeholder="Nombre del producto"
                                    />
                                ) : (
                                    <p className="font-semibold">{item.nombre_factura}</p>
                                )}
                                <div className="flex flex-col gap-2 mt-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">Cantidad:</span>
                                        <input 
                                            type="text" 
                                            value={item.cantidad_manual} 
                                            onChange={(e) => updateItem(idx, 'cantidad_manual', e.target.value)}
                                            className="border rounded p-1 w-24 text-sm"
                                            placeholder="Ej: 200g"
                                        />
                                    </div>
                                    <select
                                        value={item.producto_id || ''}
                                        onChange={(e) => updateItem(idx, 'producto_id', e.target.value)}
                                        className="border rounded p-1 w-full text-sm mt-1 focus:ring-1 focus:ring-black"
                                    >
                                        <option value="">-- Vincular Producto en Inventario --</option>
                                        {materiasPrimas.map(mp => (
                                            <option key={mp.id} value={mp.id}>{mp.nombre} (Stock: {mp.stock} {mp.unidad_medida})</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-sm font-medium text-orange-600 mt-1">{item.verificacion.match_status}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                                {item.foto_item && (
                                    <img src={URL.createObjectURL(item.foto_item)} alt="Item" className="w-12 h-12 rounded object-cover" />
                                )}
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    id={`item-photo-${idx}`} 
                                    onChange={(e) => {
                                        if(e.target.files && e.target.files[0]) {
                                            updateItem(idx, 'foto_item', e.target.files[0]);
                                        }
                                    }}
                                />
                                <label htmlFor={`item-photo-${idx}`} className="cursor-pointer bg-gray-100 p-2 rounded-full hover:bg-gray-200">
                                    <Camera size={20} />
                                </label>
                            </div>
                        </div>
                    </div>
                ))}
                
                <button onClick={addItem} className="border-2 border-dashed border-gray-300 p-4 rounded-lg text-gray-500 hover:border-gray-400">
                    + Agregar Ítem Manualmente
                </button>
            </div>
            
            <button onClick={handleConfirm} disabled={confirming} className="bg-green-600 text-white px-6 py-3 rounded-md font-bold disabled:bg-gray-400">
                {confirming ? 'Guardando...' : 'Confirmar y Guardar Recepción'}
            </button>
        </div>
      )}
    </div>
  );
}
