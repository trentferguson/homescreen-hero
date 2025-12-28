import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { useEffect, useState } from "react";

interface ProtectedRouteProps {
    children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { isAuthenticated, authEnabled, loading } = useAuth();
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
        // Show a loading spinner while checking auth and config
        return (
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
            }}>
                <div>Loading...</div>
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

    return <>{children}</>;
}
