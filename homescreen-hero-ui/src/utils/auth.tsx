import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface AuthContextType {
    isAuthenticated: boolean;
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
    const [loading, setLoading] = useState(true);

    // Load token from localStorage on mount
    useEffect(() => {
        const storedToken = localStorage.getItem("auth_token");
        const storedUsername = localStorage.getItem("username");

        if (storedToken && storedUsername) {
            setToken(storedToken);
            setUsername(storedUsername);
        }

        setLoading(false);
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
        isAuthenticated: !!token,
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
