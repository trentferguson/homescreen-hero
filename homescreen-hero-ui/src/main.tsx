import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import "./index.css";

import AppLayout from "./layouts/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import ConfigPage from "./pages/ConfigPage";
import LogsPage from "./pages/LogsPage";
import SettingsPage from "./pages/SettingsPage";
import GroupsPage from "./pages/GroupsPage";
import GroupDetailPage from "./pages/GroupDetailPage";
import LoginPage from "./pages/LoginPage";
import { ThemeProvider } from "./utils/theme";
import { AuthProvider } from "./utils/auth";
import NotFoundPage from "./pages/NotFoundPage";
import ProtectedRoute from "./components/ProtectedRoute";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
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
      { path: "/config", element: <ConfigPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/logs", element: <LogsPage /> },
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
