# Valencia Almacén

Sistema avanzado de gestión de inventario de materia prima multialmacén para la industria de alimentos y bebidas.

## 🎯 Objetivo

Valencia Almacén es una aplicación web robusta diseñada para controlar el stock en tiempo real en múltiples ubicaciones, registrar detalladamente las entradas (por compras o ajustes) y salidas (por mermas o producción), gestionar transferencias entre almacenes, y mantener una trazabilidad inquebrantable de los movimientos físicos y lógicos de los insumos.

## 🚀 Características Principales

- **Dashboard Analítico**: Resumen en tiempo real del estado global del inventario, alertas de bajo stock, sobrestock, y métricas consolidadas.
- **Arquitectura Multi-Almacén**: Gestión independiente de stock físico distribuido en distintos almacenes o centros de costos (e.g., General, Cocina, Barra).
- **Gestión de Stock**: Creación y edición de materias primas con soporte para stock mínimo y máximo.
- **Movimientos (Entradas y Salidas)**: Registro atómico de movimientos lógicos que actualizan automáticamente los balances de stock por almacén. Opción de adjuntar justificantes o evidencias fotográficas.
- **Transferencias Internas**: Herramienta dedicada para mover stock de un almacén origen a un almacén destino generando movimientos pareados con trazabilidad.
- **Sistema de Roles (RBAC)**: Accesos diferenciados para `admin` (gestión completa) y `user` (operaciones de inventario y registro de movimientos limitados al resguardo de seguridad).
- **Responsivo**: Interfaz optimizada ("mobile-first") para funcionar en dispositivos móviles durante la toma física de inventario.
- **Exportación de Reportes**: Vistas adaptadas para impresión de listados de stock físico.

## 🛠️ Stack Tecnológico

- **Frontend**: React (Vite), TypeScript, Tailwind CSS, shadcn/ui, Lucide React, Recharts (para visualizaciones).
- **Backend (BaaS)**: Supabase.
  - **Base de Datos**: PostgreSQL con UUIDs y Funciones Autocontenidas/Triggers.
  - **Autenticación**: Supabase Auth (Magic Links / Email & Password).
  - **Almacenamiento**: Supabase Storage para evidencia de movimientos.
  - **Seguridad**: Políticas de seguridad a nivel de filas (RLS - Row Level Security) en todas las tablas.

## 🗄️ Modelo de Datos (Esquema BD)

El diseño de la base de datos prioriza la consistencia atómica:
- `materia_prima`: Catálogo general de insumos.
- `almacenes`: Entidades de ubicación física.
- `stock_almacen`: Tabla pivote con balance actual por almacén (evita balances negativos mendiante `CHECK(stock >= 0)`).
- `movimientos`: Log inmutable asociado siempre a un `bundle_id` para transacciones compuestas, enlazado tanto a la `materia_prima` como al `almacen`.

## ⚙️ Configuración y Ejecución

Para ejecutar este proyecto localmente:

1. Clona el repositorio e instala dependencias:
   ```bash
   npm install
   ```

2. Configura las variables de entorno creando un archivo `.env`:
   ```env
   VITE_SUPABASE_URL=tu_supabase_url
   VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
   ```

3. (Opcional) Ejecuta las migraciones SQL en Supabase:
   - Aplica `schema.sql`.
   - Aplica `migration_multi_almacen.sql`.
   - Aplica `logic_transferencias_compras.sql`.

4. Inicia el servidor de desarrollo en el puerto 3000:
   ```bash
   npm run dev
   ```
