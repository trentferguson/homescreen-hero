import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import PosterBackground from "../components/PosterBackground";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [plexLoading, setPlexLoading] = useState(
        () => !!sessionStorage.getItem("plex_pin_id")
    );
    const [pendingApproval, setPendingApproval] = useState(false);
    const navigate = useNavigate();
    const { login, authEnabled, authMethod, loading: authLoading } = useAuth();

    // If auth is disabled, redirect to dashboard
    useEffect(() => {
        if (!authLoading && !authEnabled) {
            navigate("/");
        }
    }, [authEnabled, authLoading, navigate]);

    // Complete Plex login by polling the callback endpoint
    const completePlexLogin = useCallback(async (pinId: number) => {
        setPlexLoading(true);
        setError("");

        for (let i = 0; i < 15; i++) {
            try {
                const resp = await fetch("/api/auth/plex/callback", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pin_id: pinId }),
                });

                if (resp.ok) {
                    const data = await resp.json();
                    // PIN not yet claimed, poll again
                    if (data.status === "pending") {
                        await new Promise((r) => setTimeout(r, 2000));
                        continue;
                    }
                    // User is pending admin approval
                    if (data.status === "pending_approval") {
                        setPendingApproval(true);
                        setPlexLoading(false);
                        return;
                    }
                    login(data.access_token, data.username, data.role, data.thumb);
                    navigate("/");
                    return;
                }

                // Error (403, 502, etc.)
                const errData = await resp.json().catch(() => ({ detail: "Plex login failed" }));
                setError(errData.detail || "Plex login failed");
                setPlexLoading(false);
                return;
            } catch {
                setError("Failed to complete Plex login");
                setPlexLoading(false);
                return;
            }
        }

        setError("Plex login timed out. Please try again.");
        setPlexLoading(false);
    }, [login, navigate]);

    // On mount, check for a pending Plex PIN (returning from Plex OAuth redirect)
    useEffect(() => {
        const pinId = sessionStorage.getItem("plex_pin_id");
        if (pinId) {
            sessionStorage.removeItem("plex_pin_id");
            completePlexLogin(parseInt(pinId, 10));
        }
    }, [completePlexLogin]);

    const handlePasswordSubmit = async (e: FormEvent) => {
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
            login(data.access_token, data.username, data.role, data.thumb);
            navigate("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setLoading(false);
        }
    };

    const handlePlexLogin = async () => {
        setPlexLoading(true);
        setError("");

        try {
            const resp = await fetch("/api/auth/plex/pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    forward_url: `${window.location.origin}/login`,
                }),
            });

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({ detail: "Failed to start Plex login" }));
                throw new Error(errData.detail);
            }

            const data = await resp.json();
            sessionStorage.setItem("plex_pin_id", String(data.pin_id));
            window.location.href = data.oauth_url;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to start Plex login");
            setPlexLoading(false);
        }
    };

    const showPasswordForm = authMethod === "password" || authMethod === "both";
    const showPlexButton = authMethod === "plex" || authMethod === "both";

    // Returning from Plex OAuth - show a clean "completing login" state
    const returningFromPlex = plexLoading && !error && !pendingApproval;

    return (
        <PosterBackground>
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 w-full max-w-md p-8 space-y-6">
                    {/* Logo */}
                    <div className="flex flex-col items-center gap-4">
                        <img
                            src="/logo_text.png"
                            alt="homescreen-hero"
                            className="h-auto w-auto select-none"
                        />
                    </div>

                    {/* Completing Plex login - simplified view */}
                    {returningFromPlex && (
                        <div className="flex flex-col items-center gap-4 py-4">
                            <svg className="animate-spin h-8 w-8 text-[#e5a00d]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Completing Plex sign-in...
                            </p>
                        </div>
                    )}

                    {/* Pending approval message */}
                    {pendingApproval && (
                        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
                            <p className="font-medium">Account pending approval</p>
                            <p className="mt-1">Your sign-in was successful, but an admin needs to approve your account before you can access the app. Please check back later.</p>
                        </div>
                    )}

                    {/* Error message */}
                    {error && !pendingApproval && (
                        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Plex Login Button - hidden when returning from OAuth */}
                    {showPlexButton && !returningFromPlex && (
                        <button
                            type="button"
                            onClick={handlePlexLogin}
                            disabled={plexLoading}
                            className="w-full py-3 px-4 bg-[#e5a00d] hover:bg-[#cc8e0b] text-black font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            {plexLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing in with Plex...
                                </span>
                            ) : (
                                <>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M11.643 0H4.68l7.679 12L4.68 24h6.963l7.677-12z"/>
                                    </svg>
                                    Sign in with Plex
                                </>
                            )}
                        </button>
                    )}

                    {/* Separator */}
                    {showPasswordForm && showPlexButton && !returningFromPlex && (
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-300 dark:border-slate-700"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-3 bg-white/85 dark:bg-slate-900/85 text-slate-500 dark:text-slate-400">
                                    or
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Password Login Form */}
                    {showPasswordForm && !returningFromPlex && (
                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
                                    autoFocus={!showPlexButton}
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

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-950"
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
                    )}
                </div>
            </div>
        </PosterBackground>
    );
}
