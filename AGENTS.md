# AGENTS.md - Valencia Almacén

## 🎯 Objetivo del Proyecto
Desarrollar una aplicación web para la gestión de inventario de materia prima en un almacén de alimentos.

## 🏗️ Arquitectura
*   **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui.
*   **Backend**: Supabase (PostgreSQL, Auth, Storage).

## 🎨 Diseño y Estilo
*   **Paleta de colores**: Primario `#bf6849`, elementos principales en negro (`bg-black`).
*   **Componentes**: Botones negros, sombras personalizadas (`shadow-primary-subtle`), cabeceras de tabla con color primario.
*   **Responsividad**: Diseño móvil-primero con menú hamburguesa para navegación lateral en dispositivos móviles.

## 🧩 Reglas de Negocio
*   **Stock**: Actualización automática (entrada suma, salida resta).
*   **Restricciones**: No stock negativo, no movimientos sin materia prima.
*   **Bundle**: Registro de movimientos múltiples de productos en una sola operación.
*   **Paginação**: Tablas de inventario y movimientos con paginación de 20 ítems.

## 🔐 Seguridad
*   Autenticación con Supabase Auth.
*   Row Level Security (RLS) activado en todas las tablas.
