import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Login failed");
            }

            const data = await response.json();

            // Use the auth context to store the token
            login(data.access_token, data.username);

            // Redirect to dashboard
            navigate("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}>
            <div style={{
                background: "white",
                padding: "2rem",
                borderRadius: "8px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                width: "100%",
                maxWidth: "400px",
            }}>
                <h1 style={{ marginBottom: "1.5rem", textAlign: "center", color: "#333" }}>
                    HomeScreen Hero
                </h1>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: "1rem" }}>
                        <label htmlFor="username" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                            Username
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoFocus
                            style={{
                                width: "100%",
                                padding: "0.5rem",
                                border: "1px solid #ddd",
                                borderRadius: "4px",
                                fontSize: "1rem",
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: "1.5rem" }}>
                        <label htmlFor="password" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{
                                width: "100%",
                                padding: "0.5rem",
                                border: "1px solid #ddd",
                                borderRadius: "4px",
                                fontSize: "1rem",
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: "0.75rem",
                            marginBottom: "1rem",
                            background: "#fee",
                            color: "#c33",
                            borderRadius: "4px",
                            fontSize: "0.9rem",
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: "100%",
                            padding: "0.75rem",
                            background: loading ? "#999" : "#667eea",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "1rem",
                            fontWeight: "500",
                            cursor: loading ? "not-allowed" : "pointer",
                        }}
                    >
                        {loading ? "Logging in..." : "Log In"}
                    </button>
                </form>
            </div>
        </div>
    );
}
