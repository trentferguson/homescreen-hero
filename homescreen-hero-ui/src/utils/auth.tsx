import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type AuthMethod = "password" | "plex" | "both" | null;

interface AuthContextType {
    isAuthenticated: boolean;
    authEnabled: boolean;
    authMethod: AuthMethod;
    token: string | null;
    username: string | null;
    role: string | null;
    thumb: string | null;
    login: (token: string, username: string, role?: string, thumb?: string) => void;
    logout: () => void;
    refreshAuthConfig: () => Promise<void>;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [thumb, setThumb] = useState<string | null>(null);
    const [authEnabled, setAuthEnabled] = useState<boolean>(true);
    const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
    const [loading, setLoading] = useState(true);

    // Re-fetch auth config from the backend (public endpoint)
    const refreshAuthConfig = async () => {
        try {
            const resp = await fetch("/api/auth/config");
            if (resp.ok) {
                const data = await resp.json();
                setAuthEnabled(data.auth_enabled);
                setAuthMethod(data.method || null);
            }
        } catch (error) {
            console.error("Failed to refresh auth config:", error);
        }
    };

    // Check backend auth status and load token from localStorage on mount
    useEffect(() => {
        const checkAuthStatus = async () => {
            try {
                const storedToken = localStorage.getItem("auth_token");
                const storedUsername = localStorage.getItem("username");
                const storedRole = localStorage.getItem("role");
                const storedThumb = localStorage.getItem("thumb");

                // Fetch auth config (public endpoint)
                await refreshAuthConfig();

                // Try to validate stored token via /api/auth/me
                const headers: HeadersInit = {};
                if (storedToken) {
                    headers["Authorization"] = `Bearer ${storedToken}`;
                }

                const response = await fetch("/api/auth/me", { headers });

                if (response.ok) {
                    const data = await response.json();
                    setAuthEnabled(data.auth_enabled);
                    setAuthMethod(data.method || null);

                    if (data.auth_enabled && storedToken && storedUsername) {
                        setToken(storedToken);
                        setUsername(data.username);
                        setRole(data.role || storedRole || "admin");
                        setThumb(data.thumb || storedThumb || null);
                    } else if (!data.auth_enabled) {
                        setUsername(data.username || "anonymous");
                        setRole("admin");
                    }
                } else {
                    setAuthEnabled(true);
                }
            } catch (error) {
                console.error("Failed to check auth status:", error);
                setAuthEnabled(true);
            } finally {
                setLoading(false);
            }
        };

        checkAuthStatus();
    }, []);

    const login = (newToken: string, newUsername: string, newRole?: string, newThumb?: string) => {
        localStorage.setItem("auth_token", newToken);
        localStorage.setItem("username", newUsername);
        if (newRole) localStorage.setItem("role", newRole);
        if (newThumb) localStorage.setItem("thumb", newThumb);
        setToken(newToken);
        setUsername(newUsername);
        setRole(newRole || "admin");
        setThumb(newThumb || null);
    };

    const logout = () => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("username");
        localStorage.removeItem("role");
        localStorage.removeItem("thumb");
        setToken(null);
        setUsername(null);
        setRole(null);
        setThumb(null);
        // Re-fetch config so login page reflects current auth method
        refreshAuthConfig();
    };

    const value: AuthContextType = {
        isAuthenticated: !authEnabled || !!token,
        authEnabled,
        authMethod,
        token,
        username,
        role,
        thumb,
        login,
        logout,
        refreshAuthConfig,
        loading,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
