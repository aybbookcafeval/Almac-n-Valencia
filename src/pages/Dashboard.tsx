import React from 'react';
import { useAppContext } from '../context/AppContext';
import { Package, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

export default function Dashboard() {
  const { materiasPrimas, movimientos, loading } = useAppContext();

  if (loading) {
    return <div className="flex items-center justify-center h-full">Cargando...</div>;
  }

  const lowStock = materiasPrimas.filter(mp => mp.stock < mp.min_stock);
  const overStock = materiasPrimas.filter(mp => mp.stock > mp.max_stock);
  const recentMovs = movimientos.slice(0, 5);

  const chartData = materiasPrimas.map(mp => ({
    name: mp.nombre,
    stock: mp.stock,
    min: mp.min_stock,
    max: mp.max_stock
  }));

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Productos</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{materiasPrimas.length}</p>
            </div>
            <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Bajo Stock</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{lowStock.length}</p>
            </div>
            <div className="h-12 w-12 bg-red-50 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Sobrestock</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">{overStock.length}</p>
            </div>
            <div className="h-12 w-12 bg-amber-50 rounded-full flex items-center justify-center">
              <Package className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Movimientos (Hoy)</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {movimientos.filter(m => new Date(m.fecha).toDateString() === new Date().toDateString()).length}
              </p>
            </div>
            <div className="h-12 w-12 bg-green-50 rounded-full flex items-center justify-center">
              <ArrowRightLeft className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Niveles de Stock</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="stock" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Movements */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Últimos Movimientos</h3>
          <div className="space-y-4">
            {recentMovs.length === 0 ? (
              <p className="text-sm text-gray-500">No hay movimientos recientes.</p>
            ) : (
              recentMovs.map(mov => {
                const mp = materiasPrimas.find(m => m.id === mov.materia_prima_id);
                const isEntrada = mov.tipo === 'entrada';
                return (
                  <div key={mov.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${isEntrada ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {isEntrada ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{mp?.nombre || 'Desconocido'}</p>
                        <p className="text-xs text-gray-500">{format(new Date(mov.fecha), 'dd/MM/yyyy HH:mm')}</p>
                      </div>
                    </div>
                    <div className={`text-sm font-bold ${isEntrada ? 'text-green-600' : 'text-red-600'}`}>
                      {isEntrada ? '+' : '-'}{mov.cantidad} {mov.unidad_medida}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


