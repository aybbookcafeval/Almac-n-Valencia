export type Profile = {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
};

export type Almacen = {
  id: string;
  nombre: string;
  descripcion?: string;
  created_at: string;
};

export type StockAlmacen = {
  materia_prima_id: string;
  almacen_id: string;
  stock: number;
};

export type MateriaPrima = {
  id: string;
  nombre: string;
  unidad_medida: string;
  min_stock: number;
  max_stock: number;
  created_at: string;
  updated_at: string;
  // Stock is now calculated or fetched per warehouse
  stock?: number; 
};

export type Movimiento = {
  id: string;
  bundle_id: string;
  materia_prima_id: string;
  almacen_id: string;
  tipo: 'entrada' | 'salida';
  cantidad: number;
  unidad_medida: string;
  fecha: string;
  imagen_url?: string;
  comentario?: string;
  created_at: string;
};

export type AlmacenFormData = Omit<Almacen, 'id' | 'created_at'>;
export type MateriaPrimaFormData = Omit<MateriaPrima, 'id' | 'created_at' | 'updated_at' | 'stock'>;
export type MovimientoFormData = Omit<Movimiento, 'id' | 'created_at' | 'fecha'>;

export type MovimientoItem = {
  materia_prima_id: string;
  cantidad: number;
  unidad_medida: string;
};

export type MovimientoBundleFormData = {
  tipo: 'entrada' | 'salida';
  items: MovimientoItem[];
  imagen_url?: string;
  comentario?: string;
};

export type TransferenciaItem = {
  materia_prima_id: string;
  cantidad: number;
  unidad_medida: string;
};

export type TransferenciaFormData = {
  almacen_origen_id: string;
  almacen_destino_id: string;
  items: TransferenciaItem[];
  comentario?: string;
};
