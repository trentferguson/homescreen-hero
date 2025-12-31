import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import "./index.css";

import AppLayout from "./layouts/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import ConfigPage from "./pages/ConfigPage";
import SettingsPage from "./pages/SettingsPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import GroupsPage from "./pages/GroupsPage";
import GroupDetailPage from "./pages/GroupDetailPage";
import LoginPage from "./pages/LoginPage";
import QuickStartPage from "./pages/QuickStartPage";
import { ThemeProvider } from "./utils/theme";
import { AuthProvider } from "./utils/auth";
import NotFoundPage from "./pages/NotFoundPage";
import ProtectedRoute from "./components/ProtectedRoute";
import CollectionDetailPage from "./pages/CollectionDetailPage";
import CollectionsPage from "./pages/CollectionsPage";


const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/quick-start",
    element: <QuickStartPage />,
  },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    errorElement: <NotFoundPage />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/dashboard", element: <Navigate to="/" replace /> },
      { path: "/groups", element: <GroupsPage /> },
      { path: "/groups/:groupId", element: <GroupDetailPage /> },
      { path: "/collections", element: <CollectionsPage /> },
      { path: "/collections/:library/:collectionTitle", element: <CollectionDetailPage /> },
      { path: "/integrations", element: <IntegrationsPage /> },
      { path: "/config", element: <ConfigPage /> },
      { path: "/settings", element: <SettingsPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
