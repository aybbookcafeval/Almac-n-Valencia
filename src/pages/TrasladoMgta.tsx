import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { Truck, PlusCircle, Trash2, Eye, Calendar, X, FileText, ChevronLeft, ChevronRight, Search, Info, Printer, Download } from 'lucide-react';
import { SearchableSelect } from '../components/SearchableSelect';
import { getTrasladosMgta, createTrasladoMgta } from '../services/trasladosMgta';
import { TrasladoMgta, TrasladoMgtaItemFormData } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function TrasladoMgtaPage() {
  const { materiasPrimas, almacenes, stockAlmacen, loadData } = useAppContext();
  
  // State for historical list
  const [traslados, setTraslados] = useState<TrasladoMgta[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for form
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comentario, setComentario] = useState('');
  const [tasaDolar, setTasaDolar] = useState<number>(1.0);
  const [tasaEuro, setTasaEuro] = useState<number>(1.0);
  const [items, setItems] = useState<TrasladoMgtaItemFormData[]>([
    {
      materia_prima_id: '',
      almacen_origen_id: '',
      cantidad: 0,
      unidad_medida: 'kg',
      costo_euro: 0,
    }
  ]);

  // Preview / Confirm Modal state
  const [showConfirmPreview, setShowConfirmPreview] = useState(false);

  // Detail modal
  const [selectedTraslado, setSelectedTraslado] = useState<TrasladoMgta | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Pagination (20 items as per AGENTS.md)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await getTrasladosMgta();
      setTraslados(data);
    } catch (error: any) {
      console.error(error);
      toast.error('Error al cargar historial de traslados');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handlePrint = (traslado: TrasladoMgta) => {
    setSelectedTraslado(traslado);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const exportToPDF = (traslado: TrasladoMgta) => {
    try {
      const doc = new jsPDF('p', 'mm', 'letter');
      
      // Header Banner
      doc.setFillColor(191, 104, 73); // Primary Color (#bf6849)
      doc.rect(0, 0, 216, 12, 'F');

      // Title & Logo Area
      doc.setTextColor(191, 104, 73);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('AYB BOOKCAFE', 15, 25);

      doc.setTextColor(100, 100, 100);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('SISTEMA DE CONTROL DE INVENTARIO Y DE DESPACHOS', 15, 30);

      // Sede Destino
      doc.setTextColor(0, 0, 0);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Destino Oficial: AYB BOOKCAFE MGTA, C.A. J505320203', 15, 38);

      // Right Metadata Info Box
      doc.setFillColor(245, 245, 245);
      doc.setDrawColor(210, 210, 210);
      doc.rect(130, 18, 70, 24, 'FD');

      doc.setTextColor(191, 104, 73);
      doc.setFontSize(11);
      doc.text('TRASLADO MGTA', 135, 24);
      doc.setTextColor(0, 0, 0);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Nº: ${traslado.id}`, 135, 30);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(80, 80, 80);
      doc.text(`Fecha: ${format(new Date(traslado.fecha), 'dd/MM/yyyy HH:mm')}`, 135, 36);

      // Divider line
      doc.setDrawColor(191, 104, 73);
      doc.setLineWidth(0.5);
      doc.line(15, 44, 201, 44);

      // Grid metadata box
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(220, 220, 220);
      doc.rect(15, 48, 186, 22, 'FD');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      doc.text('ORIGEN:', 20, 54);
      doc.setTextColor(0, 0, 0);
      doc.text('AYB BOOKCAFE, C.A. J500830300 - VALENCIA', 20, 59);

      doc.setTextColor(120, 120, 120);
      doc.text('FECHA DE EXPEDICIÓN:', 120, 54);
      doc.setTextColor(0, 0, 0);
      doc.text(format(new Date(traslado.fecha), 'PPP p'), 120, 59);

      let currentY = 76;

      // Comentarios/Observaciones
      if (traslado.comentario) {
        doc.setFillColor(255, 248, 245);
        doc.setDrawColor(245, 220, 210);
        
        // Multi-line comment splitter to prevent text clipping
        const splitComment = doc.splitTextToSize(`Observaciones: ${traslado.comentario}`, 180);
        const commentHeight = (splitComment.length * 4.5) + 6;
        
        doc.rect(15, 75, 186, commentHeight, 'FD');
        doc.setTextColor(110, 60, 45);
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(9);
        doc.text(splitComment, 20, 80);
        
        currentY = 75 + commentHeight + 6;
      }

      // Products despachados title
      doc.setTextColor(80, 80, 80);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('DETALLE DE MERCANCÍA DESPACHADA', 15, currentY);

      // Table generation using autoTable
      const totalCalculated = (traslado.items || []).reduce((sum, item) => sum + (item.costo_calculado || 0), 0);

      autoTable(doc, {
        startY: currentY + 3,
        head: [['Producto', 'Almacén de Origen', 'Cantidad Remitida', 'Costo Calc. ($)', 'Verificación']],
        body: (traslado.items || []).map(item => [
          item.materia_prima_nombre || 'Desconocido',
          item.almacen_origen_nombre || 'Desconocido',
          `${item.cantidad} ${item.unidad_medida}`,
          `${(item.costo_calculado || 0).toFixed(2)}`,
          '[   ]'
        ]),
        foot: [['Total', '', '', `${totalCalculated.toFixed(2)}`, '']],
        headStyles: {
          fillColor: [191, 104, 73], // primary color #bf6849
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9.5
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [40, 40, 40]
        },
        footStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 9.5
        },
        columnStyles: {
          2: { halign: 'right', fontStyle: 'bold' },
          3: { halign: 'right', fontStyle: 'bold' },
          4: { halign: 'center' }
        },
        theme: 'grid'
      });

      // Signatures blocks near the bottom
      let signatureY = 245;
      const lastY = (doc as any).lastAutoTable.finalY || 100;
      if (lastY > 235) {
        doc.addPage();
        signatureY = 245;
      }
      
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      
      // Left line
      doc.line(20, signatureY, 90, signatureY);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text('ENTREGADO POR (DESPACHO)', 20, signatureY + 5);

      // Right line
      doc.line(120, signatureY, 190, signatureY);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text('RECIBIDO POR (SEDE MGTA)', 120, signatureY + 5);

      // Bottom disclaimer
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.text(`Documento generado electrónicamente en AYB BOOKCAFE el ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}.`, 15, 272);

      // Trigger file download
      doc.save(`Traslado_MGTA_${traslado.id}.pdf`);
      toast.success('¡PDF generado y descargado con éxito!');
    } catch (pdfErr) {
      console.error('Error generating PDF:', pdfErr);
      toast.error('Error al generar el archivo PDF offline');
    }
  };

  // Helper to get available stock of a product inside a specific warehouse
  const getAvailableStock = (materia_prima_id: string, almacen_id: string) => {
    if (!materia_prima_id || !almacen_id) return 0;
    return stockAlmacen.find(
      s => s.materia_prima_id === materia_prima_id && s.almacen_id === almacen_id
    )?.stock || 0;
  };

  const handleMateriaPrimaChange = (index: number, mpId: string) => {
    const mp = materiasPrimas.find(m => m.id === mpId);
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      materia_prima_id: mpId,
      unidad_medida: mp ? mp.unidad_medida : 'kg',
      is_manual: false,
      manual_nombre: undefined,
      // Reset quantity to avoid exceeding limits of a changing product
      cantidad: 0,
    };
    setItems(updated);
  };

  const toggleManualProduct = (index: number) => {
    const updated = [...items];
    const wasManual = !!updated[index].is_manual;
    updated[index] = {
      ...updated[index],
      is_manual: !wasManual,
      materia_prima_id: !wasManual ? '__manual__' : '',
      manual_nombre: !wasManual ? '' : undefined,
      unidad_medida: !wasManual ? 'unidades' : 'kg',
      cantidad: 0,
    };
    setItems(updated);
  };

  const handleManualNameChange = (index: number, name: string) => {
    const updated = [...items];
    updated[index].manual_nombre = name;
    setItems(updated);
  };

  const handleManualUnitChange = (index: number, unit: string) => {
    const updated = [...items];
    updated[index].unidad_medida = unit;
    setItems(updated);
  };

  const handleWarehouseChange = (index: number, warehouseId: string) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      almacen_origen_id: warehouseId,
      cantidad: 0, // Reset to ensure they don't enter stock that exceeds new warehouse limit
    };
    setItems(updated);
  };

  const handleQuantityChange = (index: number, value: number) => {
    const updated = [...items];
    updated[index].cantidad = value;
    setItems(updated);
  };

  const handleCostoEuroChange = (index: number, value: number) => {
    const updated = [...items];
    updated[index].costo_euro = value;
    setItems(updated);
  };

  const addRow = () => {
    setItems([
      ...items,
      {
        materia_prima_id: '',
        almacen_origen_id: '',
        cantidad: 0,
        unidad_medida: 'kg',
        costo_euro: 0,
      }
    ]);
  };

  const removeRow = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate rows
    if (items.some(item => 
      (!item.is_manual && !item.materia_prima_id) || 
      (item.is_manual && !item.manual_nombre?.trim()) || 
      !item.almacen_origen_id
    )) {
      toast.error('Por favor complete todos los productos y almacenes de origen');
      return;
    }

    if (items.some(item => item.cantidad <= 0)) {
      toast.error('La cantidad de traslado debe ser mayor que 0');
      return;
    }

    // Checking stock validations (skip manual non-inventory products)
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.is_manual) continue;
      
      const stock = getAvailableStock(item.materia_prima_id, item.almacen_origen_id);
      const prodName = materiasPrimas.find(m => m.id === item.materia_prima_id)?.nombre || 'un producto';
      const almName = almacenes.find(a => a.id === item.almacen_origen_id)?.nombre || 'un almacén';
      
      if (item.cantidad > stock) {
        toast.error(`Stock insuficiente para ${prodName} en ${almName} (Disponible: ${stock} ${item.unidad_medida})`);
        return;
      }
    }

    // Open confirm pre-visualization modal
    setShowConfirmPreview(true);
  };

  const handleConfirmSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      // Map structures to pass names to mock handler
      const productsMap: Record<string, string> = {};
      materiasPrimas.forEach(m => { productsMap[m.id] = m.nombre; });
      
      const warehousesMap: Record<string, string> = {};
      almacenes.forEach(a => { warehousesMap[a.id] = a.nombre; });

      await createTrasladoMgta({ 
        comentario, 
        items, 
        tasa_dolar: Number(tasaDolar) || 1.0, 
        tasa_euro: Number(tasaEuro) || 1.0 
      }, { products: productsMap, warehouses: warehousesMap });
      
      toast.success('¡Traslado MGTA registrado y descontado del inventario!');
      
      // Reset form
      setComentario('');
      setTasaDolar(1.0);
      setTasaEuro(1.0);
      setItems([
        {
          materia_prima_id: '',
          almacen_origen_id: '',
          cantidad: 0,
          unidad_medida: 'kg',
          costo_euro: 0,
        }
      ]);
      setShowConfirmPreview(false);

      // Refresh global states & history
      await loadData();
      await fetchHistory();
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar traslado');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter and Paginate history
  const filteredTraslados = traslados.filter(t => 
    t.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t.comentario && t.comentario.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredTraslados.length / itemsPerPage);
  const currentTraslados = filteredTraslados.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Title */}
      <div className="flex items-center space-x-3 border-b border-gray-150 pb-4 print:hidden">
        <div className="p-2.5 bg-black text-white rounded-lg shadow-md">
          <Truck size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Traslado MGTA</h2>
          <p className="text-sm text-gray-500">Envío de mercancía a otra sede (descargo y descuento del inventario actual)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start print:hidden">
        {/* Form panel */}
        <section className="lg:col-span-7 bg-white p-6 rounded-xl border border-gray-200 shadow-primary-subtle space-y-6">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
            <span className="w-1.5 h-6 bg-[#bf6849] rounded-r"></span>
            <h3 className="text-lg font-semibold text-gray-900">Registrar Nuevo Traslado</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tasas de Cambio Manuales (Dólar / Euro) */}
            <div className="bg-[#bf6849]/5 p-4 rounded-xl border border-[#bf6849]/20 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Tasa Dólar ($)</label>
                <input
                  type="number"
                  required
                  min="0.0001"
                  step="0.0001"
                  value={tasaDolar}
                  onChange={(e) => setTasaDolar(Math.max(0.0001, Number(e.target.value)))}
                  className="block w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#bf6849] focus:outline-none focus:ring-1 focus:ring-[#bf6849] font-mono"
                  placeholder="Ej: 1.0000"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Tasa Euro (€)</label>
                <input
                  type="number"
                  required
                  min="0.0001"
                  step="0.0001"
                  value={tasaEuro}
                  onChange={(e) => setTasaEuro(Math.max(0.0001, Number(e.target.value)))}
                  className="block w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#bf6849] focus:outline-none focus:ring-1 focus:ring-[#bf6849] font-mono"
                  placeholder="Ej: 1.0800"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">Listado de Productos a Enviar</label>
              
              {items.map((item, idx) => {
                const availableStock = getAvailableStock(item.materia_prima_id, item.almacen_origen_id);
                return (
                  <div key={idx} className="p-4 bg-gray-55/50 rounded-xl border border-gray-150 space-y-4 relative">
                    {items.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeRow(idx)}
                        className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100 transition-colors"
                        title="Eliminar producto"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    {/* Step 1: Select Product or Manual Input */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs font-semibold text-gray-500">Producto</label>
                          <button
                            type="button"
                            onClick={() => toggleManualProduct(idx)}
                            className="text-[11px] text-[#bf6849] hover:underline hover:text-[#a35235] font-bold"
                          >
                            {item.is_manual ? "← Seleccionar de la lista" : "+ Escribir manual (No en sistema)"}
                          </button>
                        </div>
                        {item.is_manual ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              required
                              value={item.manual_nombre || ''}
                              onChange={(e) => handleManualNameChange(idx, e.target.value)}
                              className="block w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#bf6849] focus:outline-none focus:ring-1 focus:ring-[#bf6849] font-semibold"
                              placeholder="Nombre del producto..."
                            />
                            <input
                              type="text"
                              required
                              value={item.unidad_medida || 'unidades'}
                              onChange={(e) => handleManualUnitChange(idx, e.target.value)}
                              className="block w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#bf6849] focus:outline-none focus:ring-1 focus:ring-[#bf6849]"
                              placeholder="Unidad de Medida (Ej: un, kg, L)"
                            />
                          </div>
                        ) : (
                          <SearchableSelect
                            value={item.materia_prima_id}
                            onChange={(val) => handleMateriaPrimaChange(idx, val)}
                            options={materiasPrimas.map(mp => ({
                              id: mp.id,
                              label: mp.nombre,
                            }))}
                            placeholder="Seleccione producto..."
                          />
                        )}
                      </div>

                      {/* Step 2: Select Origin Warehouse */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Almacén de Origen</label>
                        <select
                          required
                          value={item.almacen_origen_id}
                          onChange={(e) => handleWarehouseChange(idx, e.target.value)}
                          className="block w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                        >
                          <option value="">-- Seleccionar Almacén --</option>
                          {almacenes.map(alm => (
                            <option key={alm.id} value={alm.id}>{alm.nombre}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Step 3: Stock indicator and quantity entry */}
                    {((item.is_manual && item.almacen_origen_id) || (item.materia_prima_id && item.almacen_origen_id)) && (
                      <div className="space-y-3 pt-1">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 rounded-lg border border-gray-100 text-sm">
                          <div className="flex items-center space-x-2 text-gray-600">
                            <Info size={16} className={cn(item.is_manual ? "text-zinc-400" : "text-[#bf6849]")} />
                            {item.is_manual ? (
                              <span className="text-xs text-gray-500 italic">
                                Producto manual (sin control de inventario en almacén)
                              </span>
                            ) : (
                              <span>
                                Stock disponible: <strong className={cn(availableStock === 0 ? "text-red-600" : "text-gray-900")}>
                                  {availableStock} {item.unidad_medida}
                                </strong>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            <label className="text-xs font-semibold text-gray-500">Cantidad:</label>
                            <div className="relative rounded-md shadow-sm w-36">
                              <input
                                type="number"
                                required
                                min="0.01"
                                step="0.01"
                                max={item.is_manual ? undefined : availableStock}
                                placeholder="0.00"
                                value={item.cantidad || ''}
                                onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                                className="block w-full rounded-md border border-gray-300 pr-8 pl-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black font-mono font-bold"
                              />
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                <span className="text-xs text-gray-500 font-semibold">{item.unidad_medida}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Cost inputs row */}
                        <div className="grid grid-cols-2 gap-4 bg-white p-3 rounded-lg border border-gray-100">
                          <div>
                            <label className="block text-xs font-semibold text-gray-650 mb-1">Costo Unitario (Euros)</label>
                            <div className="relative rounded-md shadow-sm">
                              <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={item.costo_euro || ''}
                                onChange={(e) => handleCostoEuroChange(idx, Number(e.target.value))}
                                className="block w-full rounded-md border border-gray-300 pl-3 pr-10 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black font-mono"
                              />
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                <span className="text-xs text-gray-400 font-semibold font-mono">EUR</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-650 mb-1">Costo Calc. Total (USD)</label>
                            <div className="relative rounded-md shadow-sm">
                              <input
                                type="text"
                                disabled
                                readOnly
                                value={(tasaDolar > 0 ? (tasaEuro / tasaDolar) * (item.costo_euro || 0) * (item.cantidad || 0) : 0).toFixed(2)}
                                className="block w-full rounded-md border border-gray-200 bg-gray-50 pl-3 pr-10 py-1.5 text-sm text-gray-705 font-mono font-bold"
                              />
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                <span className="text-xs text-gray-400 font-semibold font-mono">USD</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addRow}
                className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-black hover:text-black hover:bg-gray-50 transition-all font-medium flex items-center justify-center space-x-1"
              >
                <PlusCircle size={16} />
                <span>Agregar Producto</span>
              </button>
            </div>

            {/* Totales Resumen del Formulario */}
            <div className="bg-gray-55 p-4 rounded-xl border border-gray-200 divide-y divide-gray-200/60 space-y-2 text-sm text-gray-700 font-semibold shadow-sm">
              <div className="flex justify-between items-center pb-2">
                <span>Total Columna Costo (€):</span>
                <span className="font-mono text-zinc-900 text-base font-bold">
                  {items.reduce((sum, item) => sum + (item.costo_euro || 0) * (item.cantidad || 0), 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span>Total Columna Costo Calc. ($):</span>
                <span className="font-mono text-[#bf6849] text-base font-extrabold">
                  {items.reduce((sum, item) => sum + (tasaDolar > 0 ? (tasaEuro / tasaDolar) * (item.costo_euro || 0) * (item.cantidad || 0) : 0), 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Comentarios / Observaciones</label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                placeholder="Opcional: Detalles del destino, persona responsable en sede, etc."
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || items.some(i => i.cantidad <= 0 || (!i.is_manual && !i.materia_prima_id) || (i.is_manual && !i.manual_nombre?.trim()) || !i.almacen_origen_id)}
              className="w-full h-11 bg-black hover:bg-zinc-900 text-white font-medium rounded-lg shadow-primary-subtle transition-all duration-150 disabled:opacity-40 flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  <span>Registrando Traslado...</span>
                </>
              ) : (
                <>
                  <Truck size={20} />
                  <span>Confirmar y Registrar Traslado MGTA</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* History panel */}
        <section className="lg:col-span-5 bg-white p-6 rounded-xl border border-gray-200 shadow-primary-subtle space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-6 bg-black rounded-r"></span>
              <h3 className="text-lg font-semibold text-gray-900">Historial de Traslados</h3>
            </div>
            <span className="text-xs bg-[#bf6849]/10 text-[#bf6849] px-2 py-1 rounded-full font-medium">
              {filteredTraslados.length} Encontrados
            </span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar por ID o Comentario..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            />
          </div>

          {loadingHistory ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400 space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#bf6849] border-t-transparent" />
              <p className="text-sm">Cargando historial...</p>
            </div>
          ) : currentTraslados.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              <Truck className="mx-auto h-8 w-8 text-gray-300 mb-2" />
              <p>No se encontraron traslados.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border border-gray-150">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="table-header text-xs">
                      <th className="p-3 font-semibold">Ref. ID</th>
                      <th className="p-3 font-semibold">Fecha</th>
                      <th className="p-3 font-semibold text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 text-sm">
                    {currentTraslados.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/50">
                        <td className="p-3 font-mono text-xs font-semibold text-gray-950 truncate max-w-[120px]" title={t.id}>
                          {t.id}
                        </td>
                        <td className="p-3 text-xs text-gray-600">
                          {format(new Date(t.fecha), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => {
                                setSelectedTraslado(t);
                                setIsDetailModalOpen(true);
                              }}
                              className="p-1 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-black rounded text-xs font-semibold transition-colors flex items-center space-x-1"
                              title="Ver detalles"
                            >
                              <Eye size={12} />
                              <span>Ver</span>
                            </button>
                            <button
                              onClick={() => handlePrint(t)}
                              className="p-1 px-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded text-xs font-semibold transition-colors flex items-center space-x-1"
                              title="Imprimir documento"
                            >
                              <Printer size={12} />
                              <span>Imprimir</span>
                            </button>
                            <button
                              onClick={() => exportToPDF(t)}
                              className="p-1 px-2 bg-[#bf6849]/10 hover:bg-[#bf6849]/25 text-[#bf6849] rounded text-xs font-semibold transition-colors flex items-center space-x-1"
                              title="Descargar PDF"
                            >
                              <Download size={12} />
                              <span>PDF</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="p-1.5 border rounded-md hover:bg-gray-50 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs text-gray-500">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="p-1.5 border rounded-md hover:bg-gray-50 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Detail modal */}
      {isDetailModalOpen && selectedTraslado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 animate-slide-up">
            {/* Modal Header */}
            <div className="table-header p-5 flex justify-between items-center">
              <div className="flex items-center space-x-2.5">
                <FileText size={22} />
                <h3 className="text-lg font-bold">Detalle Detallado Traslado MGTA</h3>
              </div>
              <button 
                onClick={() => setIsDetailModalOpen(false)} 
                className="text-white/80 hover:text-white rounded-lg hover:bg-white/10 p-1 transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <span className="text-xs font-semibold text-gray-400 block uppercase tracking-wider">Referencia ID</span>
                  <span className="font-mono text-sm font-bold text-gray-950">{selectedTraslado.id}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-400 block uppercase tracking-wider">Fecha de Creación</span>
                  <span className="text-sm font-medium text-gray-800 flex items-center space-x-1">
                    <Calendar size={14} className="text-gray-400 mr-1" />
                    {format(new Date(selectedTraslado.fecha), 'PPP p')}
                  </span>
                </div>
                {selectedTraslado.comentario && (
                  <div className="md:col-span-2 border-t border-gray-200 pt-3 mt-1">
                    <span className="text-xs font-semibold text-gray-400 block uppercase tracking-wider">Comentarios y Observaciones</span>
                    <p className="text-sm text-gray-700 italic mt-0.5">{selectedTraslado.comentario}</p>
                  </div>
                )}
                {selectedTraslado.tasa_dolar !== undefined && selectedTraslado.tasa_euro !== undefined && (
                  <div className="md:col-span-2 border-t border-gray-200 pt-3 mt-1 grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-semibold text-gray-400 block uppercase tracking-wider">Tasa Dólar ($)</span>
                      <span className="text-sm font-mono font-bold text-gray-800">{selectedTraslado.tasa_dolar.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-400 block uppercase tracking-wider">Tasa Euro (€)</span>
                      <span className="text-sm font-mono font-bold text-gray-800">{selectedTraslado.tasa_euro.toFixed(4)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Productos Despachados</span>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200 text-xs text-gray-650">
                        <th className="p-3 font-semibold">Producto</th>
                        <th className="p-3 font-semibold">Origen</th>
                        <th className="p-3 font-semibold text-right">Cantidad de Salida</th>
                        <th className="p-3 font-semibold text-right">Costo (€)</th>
                        <th className="p-3 font-semibold text-right">Costo Calc. ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 text-sm">
                      {selectedTraslado.items?.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50/20">
                          <td className="p-3 font-semibold text-gray-850">
                            {item.materia_prima_nombre}
                          </td>
                          <td className="p-3 text-xs text-gray-600">
                            {item.almacen_origen_nombre}
                          </td>
                          <td className="p-3 text-right font-semibold font-mono text-gray-950">
                            {item.cantidad} {item.unidad_medida}
                          </td>
                          <td className="p-3 text-right font-mono text-gray-700">
                            {(item.costo_euro || 0).toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-semibold font-mono text-black">
                            {(item.costo_calculado || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200 text-xs font-bold text-gray-700">
                        <td colSpan={3} className="p-3 text-right uppercase tracking-wider">Totales:</td>
                        <td className="p-3 text-right font-mono text-gray-900 border-t">
                          {(selectedTraslado.items || []).reduce((sum, item) => sum + (item.costo_euro || 0) * (item.cantidad || 0), 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono text-[#bf6849] border-t">
                          {(selectedTraslado.items || []).reduce((sum, item) => sum + (item.costo_calculado || 0), 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 p-4 px-6 flex justify-end border-t border-gray-150 print:hidden space-x-2">
              <button
                onClick={() => exportToPDF(selectedTraslado)}
                className="px-4 py-2 text-sm font-medium border border-black rounded-lg bg-black text-white hover:bg-zinc-800 transition-all shadow-sm flex items-center space-x-1.5"
              >
                <Download size={16} />
                <span>Descargar PDF</span>
              </button>
              <button
                onClick={() => handlePrint(selectedTraslado)}
                className="px-4 py-2 text-sm font-medium border border-[#bf6849] rounded-lg bg-[#bf6849] text-white hover:bg-[#a35235] transition-all shadow-sm flex items-center space-x-1.5"
              >
                <Printer size={16} />
                <span>Imprimir Documento</span>
              </button>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white text-gray-700 hover:text-black hover:bg-gray-100 transition-all shadow-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm / Preview Modal */}
      {showConfirmPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl max-w-lg w-full border border-gray-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#bf6849] p-5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Truck size={20} className="text-white" />
                <h3 className="text-lg font-bold">Confirmar Traslado MGTA</h3>
              </div>
              <button 
                onClick={() => setShowConfirmPreview(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-3 bg-[#bf6849]/5 border border-[#bf6849]/20 rounded-lg text-sm text-[#bf6849] flex items-start space-x-2">
                <Info size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Por favor verifique los datos antes de procesar.</p>
                  <p className="text-xs opacity-90 mt-0.5">
                    Al confirmar, el stock indicado será descontado del inventario de Valencia Almacén de manera irreversible.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Detalles de Entrega</p>
                <div className="p-3 bg-gray-50 rounded-lg text-sm border border-gray-150 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-gray-400 block font-medium">ORIGEN</span>
                    <span className="font-semibold text-gray-800">Almacenes Seleccionados</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-medium">DESTINO</span>
                    <span className="font-semibold text-[#bf6849]">Sede Margarita (MGTA)</span>
                  </div>
                </div>
              </div>

              {/* Items Table Preview */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Lista de Productos a Enviar ({items.length})</p>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {items.map((item, index) => {
                    const prodName = item.is_manual ? item.manual_nombre : (materiasPrimas.find(m => m.id === item.materia_prima_id)?.nombre || 'un producto');
                    const almName = almacenes.find(a => a.id === item.almacen_origen_id)?.nombre || 'un almacén';
                    return (
                      <div key={index} className="p-3 flex justify-between items-center bg-white hover:bg-gray-50/50 text-sm">
                        <div>
                          <p className="font-semibold text-gray-900">{prodName}</p>
                          <p className="text-xs text-gray-400">Origen: {almName}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-2.5 py-1 bg-black text-white text-xs font-bold rounded-full font-mono">
                            {item.cantidad} {item.unidad_medida}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {comentario && (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Observaciones</p>
                  <p className="p-2.5 bg-gray-50 text-xs italic text-gray-700 rounded-lg border border-gray-150">
                    "{comentario}"
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 p-4 px-6 flex justify-end border-t border-gray-150 space-x-2">
              <button
                type="button"
                onClick={() => setShowConfirmPreview(false)}
                className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white text-gray-700 hover:text-black hover:bg-gray-100 transition-all shadow-sm"
              >
                Volver a Editar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSubmit}
                className="px-6 py-2 text-sm font-medium border border-black rounded-lg bg-black text-white hover:bg-zinc-800 transition-all shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Registrando...' : 'Confirmar y Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Area - Document format */}
      {selectedTraslado && (
        <div className="print-only p-8 bg-white text-black min-h-screen relative">
          {/* Letterhead */}
          <div className="border-b-2 border-black pb-6 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wider text-black">AYB BOOKCAFE</h1>
              <p className="text-xs text-gray-500 font-semibold">CONTROL DE TRASLADO E INVENTARIO</p>
              <p className="text-xs text-gray-700 mt-2 font-bold">Destino: AYB BOOKCAFE MGTA, C.A. J505320203</p>
            </div>
            <div className="text-right">
              <div className="bg-black text-white px-4 py-2 rounded font-mono text-sm font-bold inline-block mb-1">
                TRASLADO MGTA
              </div>
              <p className="font-mono text-xs font-bold text-gray-800 block">Nº: {selectedTraslado.id}</p>
              <p className="text-xs text-gray-500">Fecha: {format(new Date(selectedTraslado.fecha), 'dd/MM/yyyy HH:mm')}</p>
            </div>
          </div>

          {/* Quick Details */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded border border-gray-200 mb-6 print:bg-gray-50 print:border-gray-200">
            <div>
              <span className="font-bold text-gray-400 uppercase block">Origen</span>
              <span className="font-medium text-gray-950 font-bold">AYB BOOKCAFE, C.A. J500830300 - VALENCIA</span>
            </div>
            <div>
              <span className="font-bold text-gray-400 uppercase block">Fecha de Expedición</span>
              <span className="font-medium text-gray-900">{format(new Date(selectedTraslado.fecha), 'PPP p')}</span>
            </div>
            {selectedTraslado.comentario && (
              <div className="col-span-2 border-t pt-2 mt-2 border-gray-200">
                <span className="font-bold text-gray-400 uppercase block">Observaciones / Comprobación</span>
                <p className="text-gray-700 italic mt-0.5 text-xs">{selectedTraslado.comentario}</p>
              </div>
            )}
          </div>

          {/* Table Items */}
          <div className="mb-8">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Detalle de Mercancía Despachada</span>
            <table className="w-full text-left border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-350 text-xs font-bold text-gray-700">
                  <th className="p-3 border border-gray-300">Producto</th>
                  <th className="p-3 border border-gray-300">Almacén de Origen</th>
                  <th className="p-3 border border-gray-300 text-right">Cantidad Remitida</th>
                  <th className="p-3 border border-gray-300 text-right">Costo Calculado ($)</th>
                  <th className="p-3 border border-gray-300 text-center">Verificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 text-xs">
                {selectedTraslado.items?.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 border border-gray-300 font-bold text-gray-800">
                      {item.materia_prima_nombre}
                    </td>
                    <td className="p-3 border border-gray-300 text-gray-600">
                      {item.almacen_origen_nombre}
                    </td>
                    <td className="p-3 border border-gray-300 text-right font-bold font-mono">
                      {item.cantidad} {item.unidad_medida}
                    </td>
                    <td className="p-3 border border-gray-300 text-right font-bold font-mono text-gray-850">
                      {(item.costo_calculado || 0).toFixed(2)}
                    </td>
                    <td className="p-3 border border-gray-300 text-center text-gray-350">
                      [   ]
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-300 text-xs font-bold text-gray-700">
                  <td colSpan={3} className="p-3 border border-gray-300 text-right uppercase tracking-wider">Total Costo Calculado:</td>
                  <td className="p-3 border border-gray-300 text-right font-mono font-black text-[#bf6849]">
                    {(selectedTraslado.items || []).reduce((sum, item) => sum + (item.costo_calculado || 0), 0).toFixed(2)}
                  </td>
                  <td className="p-3 border border-gray-300"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Signatures */}
          <div className="mt-32 print:absolute print:bottom-16 print:left-8 print:right-8 grid grid-cols-2 gap-12 text-center text-xs">
            <div className="border-t border-black pt-4">
              <p className="font-bold uppercase">Entregado Por (Despacho)</p>
              <div className="h-12"></div>
            </div>
            <div className="border-t border-black pt-4">
              <p className="font-bold uppercase">Recibido Por (Sede MGTA)</p>
              <div className="h-12"></div>
            </div>
          </div>

          <div className="mt-16 print:absolute print:bottom-6 print:left-8 print:right-8 text-center text-[10px] text-gray-400 border-t pt-4 border-gray-250">
            Este es un comprobante de traslado oficial de mercancía de AYB BOOKCAFE. Generado el {format(new Date(), 'dd/MM/yyyy HH:mm')}.
          </div>
        </div>
      )}
    </div>
  );
}
