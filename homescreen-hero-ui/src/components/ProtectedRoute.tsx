import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { useEffect, useState } from "react";

interface ProtectedRouteProps {
    children: ReactNode;
    requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
    const { isAuthenticated, authEnabled, role, loading } = useAuth();
    const [configStatus, setConfigStatus] = useState<{
        exists: boolean;
        is_configured: boolean;
        loading: boolean;
    }>({ exists: false, is_configured: false, loading: true });

    useEffect(() => {
        // Check if config exists and is configured
        fetch("/api/admin/config/exists")
            .then((res) => res.json())
            .then((data) => {
                setConfigStatus({
                    exists: data.exists,
                    is_configured: data.is_configured,
                    loading: false,
                });
            })
            .catch(() => {
                // On error, assume config check failed, allow through
                setConfigStatus({
                    exists: false,
                    is_configured: false,
                    loading: false,
                });
            });
    }, []);

    if (loading || configStatus.loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
                <img
                    src="/logo_text.png"
                    alt="homescreen-hero"
                    className="h-12 w-auto mb-6 select-none opacity-80"
                />
                <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }

    // If config is not configured, redirect to quick start
    if (!configStatus.is_configured) {
        return <Navigate to="/quick-start" replace />;
    }

    // If auth is disabled, allow access without authentication
    if (!authEnabled) {
        return <>{children}</>;
    }

    // If auth is enabled but user is not authenticated, redirect to login
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // If admin is required but user is not admin, redirect to user landing
    if (requireAdmin && role !== "admin") {
        return <Navigate to="/user" replace />;
    }

    return <>{children}</>;
}
