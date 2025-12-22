import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import PosterBackground from "../components/PosterBackground";

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
        <PosterBackground>
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 w-full max-w-md p-8 space-y-6">
                    {/* Logo */}
                    <div className="flex flex-col items-center gap-4">
                        <img
                            src="/logo_text.png"
                            alt="HomeScreen Hero"
                            className="h-auto w-auto select-none"
                        />
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label
                                htmlFor="username"
                                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                            >
                                Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoFocus
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                placeholder="Enter your username"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                            >
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                placeholder="Enter your password"
                            />
                        </div>

                        {error && (
                            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-950"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Logging in...
                                </span>
                            ) : "Sign In"}
                        </button>
                    </form>
                </div>
            </div>
        </PosterBackground>
    );
}
