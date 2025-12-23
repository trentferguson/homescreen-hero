import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../utils/auth";

interface ProtectedRouteProps {
    children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { isAuthenticated, authEnabled, loading } = useAuth();

    if (loading) {
        // Show a loading spinner while checking auth
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
