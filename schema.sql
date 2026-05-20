-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create a table for public profiles
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  role text not null check (role in ('admin', 'user')) default 'user',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Table: almacenes
create table if not exists almacenes (
  id uuid not null default uuid_generate_v4() primary key,
  nombre text not null unique,
  descripcion text,
  created_at timestamp with time zone default now()
);

-- Table: materia_prima
create table if not exists materia_prima (
  id uuid not null default uuid_generate_v4() primary key,
  nombre text not null,
  unidad_medida text not null,
  min_stock numeric default 0,
  max_stock numeric default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Table: stock_almacen
create table if not exists stock_almacen (
  materia_prima_id uuid not null references materia_prima(id) on delete cascade,
  almacen_id uuid not null references almacenes(id) on delete cascade,
  stock numeric default 0 check (stock >= 0),
  primary key (materia_prima_id, almacen_id)
);

-- Table: movimientos
create table if not exists movimientos (
  id uuid not null default uuid_generate_v4() primary key,
  bundle_id text not null,
  materia_prima_id uuid references materia_prima(id) on delete cascade,
  almacen_id uuid not null references almacenes(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'salida')),
  cantidad numeric not null check (cantidad > 0),
  unidad_medida text not null,
  fecha timestamp with time zone default now(),
  imagen_url text,
  comentario text,
  created_at timestamp with time zone default now()
);

-- Table: recepciones
create table if not exists recepciones (
  id uuid not null default uuid_generate_v4() primary key,
  proveedor text,
  factura_nro text,
  almacen_destino_id uuid references almacenes(id),
  estado text not null check (estado in ('Recibido', 'Aprobado', 'MANUAL_SEARCH_REQUIRED')) default 'Recibido',
  imagen_url text,
  notas text,
  created_at timestamp with time zone default now()
);

-- Table: recepcion_items
create table if not exists recepcion_items (
  id uuid not null default uuid_generate_v4() primary key,
  recepcion_id uuid not null references recepciones(id) on delete cascade,
  producto_id uuid references materia_prima(id),
  nombre_factura text not null,
  datos_json jsonb not null,
  peso_balanza numeric not null,
  match_status text not null check (match_status in ('OK', 'MANUAL_SEARCH_REQUIRED')),
  imagen_url text
);

-- Habilitar RLS
alter table recepciones enable row level security;
alter table recepcion_items enable row level security;

-- Políticas para recepciones y recepcion_items
create policy "Authenticated users can read recepciones" on recepciones for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert recepciones" on recepciones for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update recepciones" on recepciones for update using (auth.role() = 'authenticated');

create policy "Authenticated users can read recepcion_items" on recepcion_items for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert recepcion_items" on recepcion_items for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update recepcion_items" on recepcion_items for update using (auth.role() = 'authenticated');

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to check if user is admin (avoids recursion)
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Drop old policies
drop policy if exists "Admins can view all profiles" on profiles;
drop policy if exists "Users can view their own profile" on profiles;
drop policy if exists "Admins can manage materia_prima" on materia_prima;
drop policy if exists "Authenticated users can read movimientos" on movimientos;
drop policy if exists "Authenticated users can insert movimientos" on movimientos;
drop policy if exists "Usuarios autenticados pueden ver almacenes" on almacenes;
drop policy if exists "Admins pueden gestionar almacenes" on almacenes;
drop policy if exists "Usuarios autenticados pueden ver stock" on stock_almacen;
drop policy if exists "Admins pueden gestionar stock" on stock_almacen;

-- Policies for profiles
create policy "Admins can view all profiles" on profiles for select using (public.is_admin());
create policy "Users can view their own profile" on profiles for select using (auth.uid() = id);

-- Policies for materia_prima (Assuming users need to view them, but only admins manage)
create policy "Authenticated users can view materia_prima" on materia_prima for select using (auth.role() = 'authenticated');
create policy "Admins can manage materia_prima" on materia_prima for all using (public.is_admin());

-- Policies for almacenes
create policy "Usuarios autenticados pueden ver almacenes" on almacenes for select using (auth.role() = 'authenticated');
create policy "Admins pueden gestionar almacenes" on almacenes for all using (public.is_admin());

-- Policies for stock_almacen
create policy "Usuarios autenticados pueden ver stock" on stock_almacen for select using (auth.role() = 'authenticated');
create policy "Admins pueden gestionar stock" on stock_almacen for all using (public.is_admin());

-- Policies for movimientos
create policy "Authenticated users can read movimientos" on movimientos for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert movimientos" on movimientos for insert with check (auth.role() = 'authenticated');

-- 1. Función para realizar transferencias entre almacenes
CREATE OR REPLACE FUNCTION realizar_transferencia(
  p_materia_prima_id UUID,
  p_almacen_origen_id UUID,
  p_almacen_destino_id UUID,
  p_cantidad NUMERIC,
  p_bundle_id TEXT,
  p_comentario TEXT DEFAULT NULL,
  p_imagen_url TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_unidad_medida TEXT;
BEGIN
  -- Obtener la unidad de medida de la materia prima
  SELECT unidad_medida INTO v_unidad_medida 
  FROM materia_prima 
  WHERE id = p_materia_prima_id;

  -- 1. Restar stock del origen
  UPDATE stock_almacen
  SET stock = stock - p_cantidad
  WHERE materia_prima_id = p_materia_prima_id AND almacen_id = p_almacen_origen_id;

  -- 2. Sumar stock en el destino (con ON CONFLICT por si no existe el registro)
  INSERT INTO stock_almacen (materia_prima_id, almacen_id, stock)
  VALUES (p_materia_prima_id, p_almacen_destino_id, p_cantidad)
  ON CONFLICT (materia_prima_id, almacen_id)
  DO UPDATE SET stock = stock_almacen.stock + p_cantidad;

  -- 3. Registrar movimiento de SALIDA en el origen
  INSERT INTO movimientos (
    bundle_id, materia_prima_id, almacen_id, tipo, cantidad, unidad_medida, comentario, imagen_url, fecha
  ) VALUES (
    p_bundle_id, p_materia_prima_id, p_almacen_origen_id, 'salida', p_cantidad, v_unidad_medida, 
    COALESCE(p_comentario, '') || ' (Transferencia a ' || (SELECT nombre FROM almacenes WHERE id = p_almacen_destino_id) || ')',
    p_imagen_url,
    NOW()
  );

  -- 4. Registrar movimiento de ENTRADA en el destino
  INSERT INTO movimientos (
    bundle_id, materia_prima_id, almacen_id, tipo, cantidad, unidad_medida, comentario, imagen_url, fecha
  ) VALUES (
    p_bundle_id, p_materia_prima_id, p_almacen_destino_id, 'entrada', p_cantidad, v_unidad_medida, 
    COALESCE(p_comentario, '') || ' (Transferencia desde ' || (SELECT nombre FROM almacenes WHERE id = p_almacen_origen_id) || ')',
    p_imagen_url,
    NOW()
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Ajuste de registrar_movimiento_almacen para soportar ON CONFLICT (Compras)
CREATE OR REPLACE FUNCTION registrar_movimiento_almacen(
  p_materia_prima_id UUID,
  p_almacen_id UUID,
  p_tipo TEXT,
  p_cantidad NUMERIC,
  p_bundle_id TEXT,
  p_unidad_medida TEXT,
  p_comentario TEXT DEFAULT NULL,
  p_imagen_url TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- 1. Actualizar o Insertar Stock
  IF p_tipo = 'entrada' THEN
    INSERT INTO stock_almacen (materia_prima_id, almacen_id, stock)
    VALUES (p_materia_prima_id, p_almacen_id, p_cantidad)
    ON CONFLICT (materia_prima_id, almacen_id)
    DO UPDATE SET stock = stock_almacen.stock + p_cantidad;
  ELSE
    -- Para salidas, el registro DEBE existir y tener stock suficiente
    UPDATE stock_almacen
    SET stock = stock - p_cantidad
    WHERE materia_prima_id = p_materia_prima_id AND almacen_id = p_almacen_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe registro de stock para este producto en el almacén seleccionado.';
    END IF;
  END IF;

  -- 2. Insertar el movimiento
  INSERT INTO movimientos (
    bundle_id, materia_prima_id, almacen_id, tipo, cantidad, unidad_medida, comentario, imagen_url, fecha
  ) VALUES (
    p_bundle_id, p_materia_prima_id, p_almacen_id, p_tipo, p_cantidad, p_unidad_medida, p_comentario, p_imagen_url, NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
