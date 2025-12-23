import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface AuthContextType {
    isAuthenticated: boolean;
    authEnabled: boolean;
    token: string | null;
    username: string | null;
    login: (token: string, username: string) => void;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [authEnabled, setAuthEnabled] = useState<boolean>(true);
    const [loading, setLoading] = useState(true);

    // Check backend auth status and load token from localStorage on mount
    useEffect(() => {
        const checkAuthStatus = async () => {
            try {
                // First, check if we have a stored token
                const storedToken = localStorage.getItem("auth_token");
                const storedUsername = localStorage.getItem("username");

                // Try to call /api/auth/me to check if auth is enabled
                const headers: HeadersInit = {};
                if (storedToken) {
                    headers["Authorization"] = `Bearer ${storedToken}`;
                }

                const response = await fetch("/api/auth/me", { headers });

                if (response.ok) {
                    const data = await response.json();
                    setAuthEnabled(data.auth_enabled);

                    // If auth is enabled and we got a valid response, we're authenticated
                    if (data.auth_enabled && storedToken && storedUsername) {
                        setToken(storedToken);
                        setUsername(data.username);
                    } else if (!data.auth_enabled) {
                        // If auth is disabled, set anonymous user
                        setUsername(data.username || "anonymous");
                    }
                } else {
                    // If the request fails, assume auth is enabled and we're not authenticated
                    setAuthEnabled(true);
                }
            } catch (error) {
                // On error, assume auth is enabled (safer default)
                console.error("Failed to check auth status:", error);
                setAuthEnabled(true);
            } finally {
                setLoading(false);
            }
        };

        checkAuthStatus();
    }, []);

    const login = (newToken: string, newUsername: string) => {
        localStorage.setItem("auth_token", newToken);
        localStorage.setItem("username", newUsername);
        setToken(newToken);
        setUsername(newUsername);
    };

    const logout = () => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("username");
        setToken(null);
        setUsername(null);
    };

    const value = {
        isAuthenticated: !authEnabled || !!token,
        authEnabled,
        token,
        username,
        login,
        logout,
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
