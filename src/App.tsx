/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Inventario from './pages/Inventario';
import Movimientos from './pages/Movimientos';
import Almacenes from './pages/Almacenes';
import Transferencias from './pages/Transferencias';
import Recepcion from './pages/Recepcion';
import LoginPage from './pages/LoginPage';

import { useAppContext } from './context/AppContext';

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
    <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
    <p className="text-gray-600 font-medium">Cargando Valencia Almacén...</p>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { loading: appLoading } = useAppContext();
  
  if (authLoading || appLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Toaster position="top-right" />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="inventario" element={<Inventario />} />
              <Route path="movimientos" element={<Movimientos />} />
              <Route path="almacenes" element={<Almacenes />} />
              <Route path="transferencias" element={<Transferencias />} />
              <Route path="recepcion" element={<Recepcion />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
