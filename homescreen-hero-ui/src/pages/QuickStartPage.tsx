import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Wizard, useWizard } from "react-use-wizard";
import { ArrowRight, ArrowLeft, Check, ExternalLink, Shield, Server, Database, Sparkles, Clock, ChevronDown, List, BarChart2, Film } from "lucide-react";
import { Switch, Listbox } from "@headlessui/react";
import PosterBackground from "../components/PosterBackground";
import { getShuffledStaticPosters } from "../utils/staticPosters";

type EnvVars = {
    plex_token_from_env: boolean;
    plex_url_from_env: boolean;
    auth_password_from_env: boolean;
    auth_secret_from_env: boolean;
    trakt_client_id_from_env: boolean;
    mdblist_api_key_from_env: boolean;
    tautulli_api_key_from_env: boolean;
    tautulli_url_from_env: boolean;
    seerr_api_key_from_env: boolean;
    seerr_url_from_env: boolean;
};

type Library = {
    title: string;
    type: string;
};

type WizardData = {
    authEnabled: boolean;
    authUsername: string;
    authPassword: string;
    plexUrl: string;
    plexToken: string;
    selectedLibraries: string[];
    traktEnabled: boolean;
    traktClientId: string;
    traktBaseUrl: string;
    mdblistEnabled: boolean;
    mdblistApiKey: string;
    mdblistBaseUrl: string;
    tautulliEnabled: boolean;
    tautulliApiKey: string;
    tautulliBaseUrl: string;
    seerrEnabled: boolean;
    seerrApiKey: string;
    seerrBaseUrl: string;
    rotationEnabled: boolean;
    rotationIntervalHours: number;
    rotationMaxCollections: number;
    rotationStrategy: string;
    rotationAllowRepeats: boolean;
};

export default function QuickStartPage() {
    const [wizardData, setWizardData] = useState<WizardData>({
        authEnabled: true,
        authUsername: "admin",
        authPassword: "",
        plexUrl: "",
        plexToken: "",
        selectedLibraries: [],
        traktEnabled: false,
        traktClientId: "",
        traktBaseUrl: "https://api.trakt.tv",
        mdblistEnabled: false,
        mdblistApiKey: "",
        mdblistBaseUrl: "https://api.mdblist.com",
        tautulliEnabled: false,
        tautulliApiKey: "",
        tautulliBaseUrl: "http://localhost:8181",
        seerrEnabled: false,
        seerrApiKey: "",
        seerrBaseUrl: "http://localhost:5055",
        rotationEnabled: false,
        rotationIntervalHours: 12,
        rotationMaxCollections: 5,
        rotationStrategy: "random",
        rotationAllowRepeats: false,
    });

    const [envVars, setEnvVars] = useState<EnvVars>({
        plex_token_from_env: false,
        plex_url_from_env: false,
        auth_password_from_env: false,
        auth_secret_from_env: false,
        trakt_client_id_from_env: false,
        mdblist_api_key_from_env: false,
        tautulli_api_key_from_env: false,
        tautulli_url_from_env: false,
        seerr_api_key_from_env: false,
        seerr_url_from_env: false,
    });

    useEffect(() => {
        // Fetch environment variable status
        fetch("/api/admin/config/env-vars")
            .then((res) => res.json())
            .then((data) => setEnvVars(data))
            .catch(() => {
                // If fetch fails, assume no env vars
            });
    }, []);

    // Memoize static posters so they don't reshuffle on every render
    const staticPosters = useMemo(() => getShuffledStaticPosters(), []);

    return (
        <PosterBackground staticPosters={staticPosters}>
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 w-full max-w-2xl p-8">
                    <Wizard>
                        <WelcomeStep />
                        <AuthStep wizardData={wizardData} setWizardData={setWizardData} envVars={envVars} />
                        <PlexStep wizardData={wizardData} setWizardData={setWizardData} envVars={envVars} />
                        <TraktStep wizardData={wizardData} setWizardData={setWizardData} envVars={envVars} />
                        <MDBListStep wizardData={wizardData} setWizardData={setWizardData} envVars={envVars} />
                        <TautulliStep wizardData={wizardData} setWizardData={setWizardData} envVars={envVars} />
                        <SeerrStep wizardData={wizardData} setWizardData={setWizardData} envVars={envVars} />
                        <RotationStep wizardData={wizardData} setWizardData={setWizardData} />
                        <CompleteStep wizardData={wizardData} />
                    </Wizard>
                </div>
            </div>
        </PosterBackground>
    );
}

function WelcomeStep() {
    const { nextStep } = useWizard();

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            <div className="flex flex-col items-center gap-3">
                <img
                    src="/logo_text.png"
                    alt="HomeScreen Hero"
                    className="h-auto w-auto select-none scale-90"
                />
                <Sparkles className="h-10 w-10 text-primary" />
            </div>

            <div className="text-center space-y-3">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Welcome to HomeScreen Hero
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Let's get you set up in just a few quick steps. We'll configure your Plex connection, select your libraries, and optionally set up authentication, Trakt, and MDBList integrations.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <Shield className="h-5 w-5 text-primary mb-1.5" />
                    <h3 className="font-semibold text-xs text-slate-900 dark:text-white mb-0.5">Secure</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Optional password protection for your dashboard</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <Server className="h-5 w-5 text-primary mb-1.5" />
                    <h3 className="font-semibold text-xs text-slate-900 dark:text-white mb-0.5">Simple</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Easy Plex integration with just your URL and token</p>
                </div>
            </div>

            <button
                onClick={() => nextStep()}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
                Get Started
                <ArrowRight className="h-5 w-5" />
            </button>
        </div>
    );
}

function AuthStep({ wizardData, setWizardData, envVars }: { wizardData: WizardData; setWizardData: (data: WizardData) => void; envVars: EnvVars }) {
    const { nextStep, previousStep } = useWizard();
    const [localUsername, setLocalUsername] = useState(wizardData.authUsername);
    const [localPassword, setLocalPassword] = useState(wizardData.authPassword);

    const handleNext = () => {
        setWizardData({
            ...wizardData,
            authEnabled: true,
            authUsername: localUsername,
            authPassword: localPassword,
        });
        nextStep();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
                <Shield className="h-12 w-12 text-primary mx-auto" />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Authentication</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Set up password protection for your dashboard
                </p>
            </div>

            <div className="space-y-4">
                <div>
                    <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Username
                    </label>
                    <input
                        id="username"
                        type="text"
                        value={localUsername}
                        onChange={(e) => setLocalUsername(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Password
                    </label>
                    {envVars.auth_password_from_env ? (
                        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-700 dark:text-blue-400">
                                ✓ Password configured via environment variable (HSH_AUTH_PASSWORD)
                            </p>
                        </div>
                    ) : (
                        <input
                            id="password"
                            type="password"
                            value={localPassword}
                            onChange={(e) => setLocalPassword(e.target.value)}
                            required
                            placeholder="Enter a secure password"
                            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        />
                    )}
                </div>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={() => previousStep()}
                    className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                    <ArrowLeft className="h-5 w-5" />
                    Back
                </button>
                <button
                    onClick={handleNext}
                    disabled={!localUsername || (!localPassword && !envVars.auth_password_from_env)}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    Next
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

function PlexStep({ wizardData, setWizardData, envVars }: { wizardData: WizardData; setWizardData: (data: WizardData) => void; envVars: EnvVars }) {
    const { nextStep, previousStep } = useWizard();
    const [plexUrl, setPlexUrl] = useState(wizardData.plexUrl);
    const [plexToken, setPlexToken] = useState(wizardData.plexToken);
    const [availableLibraries, setAvailableLibraries] = useState<Library[]>([]);
    const [selectedLibraries, setSelectedLibraries] = useState<string[]>(wizardData.selectedLibraries);
    const [testingPlex, setTestingPlex] = useState(false);
    const [plexTestSuccess, setPlexTestSuccess] = useState(false);
    const [fetchingLibraries, setFetchingLibraries] = useState(false);
    const [error, setError] = useState("");

    const handleTestPlex = async () => {
        if ((!plexUrl && !envVars.plex_url_from_env) || (!plexToken && !envVars.plex_token_from_env)) {
            setError("Please enter both Plex URL and token before testing");
            return;
        }

        try {
            setTestingPlex(true);
            setError("");
            setPlexTestSuccess(false);

            const response = await fetch("/api/admin/config/quick-start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plex_url: plexUrl,
                    plex_token: plexToken,
                    trakt_enabled: false,
                    libraries: ["dummy"],
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || "Failed to connect to Plex");
            }

            await fetchLibraries();
            setPlexTestSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Plex connection test failed");
            setPlexTestSuccess(false);
        } finally {
            setTestingPlex(false);
        }
    };

    const fetchLibraries = async () => {
        try {
            setFetchingLibraries(true);
            const response = await fetch("/api/collections/libraries");
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch libraries: ${errorText}`);
            }
            const data = await response.json();
            setAvailableLibraries(data.libraries || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch libraries");
        } finally {
            setFetchingLibraries(false);
        }
    };

    const toggleLibrary = (libraryName: string) => {
        setSelectedLibraries((prev) =>
            prev.includes(libraryName)
                ? prev.filter((name) => name !== libraryName)
                : [...prev, libraryName]
        );
    };

    const handleNext = () => {
        if (selectedLibraries.length === 0) {
            setError("Please select at least one library to continue");
            return;
        }
        setWizardData({
            ...wizardData,
            plexUrl,
            plexToken,
            selectedLibraries,
        });
        nextStep();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
                <Server className="h-12 w-12 text-primary mx-auto" />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Plex Connection</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Connect to your Plex Media Server
                </p>
            </div>

            <div className="space-y-4">
                <div>
                    <label htmlFor="plexUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Server URL
                    </label>
                    {envVars.plex_url_from_env ? (
                        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-700 dark:text-blue-400">
                                ✓ Plex URL configured via environment variable (HSH_PLEX_URL)
                            </p>
                        </div>
                    ) : (
                        <input
                            id="plexUrl"
                            type="text"
                            value={plexUrl}
                            onChange={(e) => setPlexUrl(e.target.value)}
                            required
                            placeholder="http://192.168.1.100:32400"
                            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        />
                    )}
                </div>

                <div>
                    <label htmlFor="plexToken" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        X-Plex-Token
                    </label>
                    {envVars.plex_token_from_env ? (
                        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-700 dark:text-blue-400">
                                ✓ Plex token configured via environment variable (HSH_PLEX_TOKEN)
                            </p>
                        </div>
                    ) : (
                        <>
                            <input
                                id="plexToken"
                                type="password"
                                value={plexToken}
                                onChange={(e) => setPlexToken(e.target.value)}
                                required
                                placeholder="••••••••••••••••••••"
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <a
                                    href="https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline inline-flex items-center gap-1"
                                >
                                    How to find your token
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </p>
                        </>
                    )}
                </div>

                <button
                    type="button"
                    onClick={handleTestPlex}
                    disabled={testingPlex || (!plexUrl && !envVars.plex_url_from_env) || (!plexToken && !envVars.plex_token_from_env)}
                    className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {testingPlex ? (
                        <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Testing connection...
                        </>
                    ) : plexTestSuccess ? (
                        <>
                            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                            Connection successful!
                        </>
                    ) : (
                        "Test Plex Connection"
                    )}
                </button>

                {plexTestSuccess && (
                    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700 animate-in fade-in duration-300">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                <Database className="h-4 w-4 text-primary" />
                                Select Libraries
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                Choose which Plex libraries to use with HomeScreen Hero
                            </p>
                        </div>

                        {fetchingLibraries ? (
                            <div className="text-center py-4">
                                <svg className="animate-spin h-5 w-5 mx-auto text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Loading libraries...</p>
                            </div>
                        ) : availableLibraries.length > 0 ? (
                            <div className="space-y-2">
                                {availableLibraries.map((lib) => (
                                    <div
                                        key={lib.title}
                                        className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 hover:border-primary/50 transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            id={`lib-${lib.title}`}
                                            checked={selectedLibraries.includes(lib.title)}
                                            onChange={() => toggleLibrary(lib.title)}
                                            className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-2 focus:ring-primary"
                                        />
                                        <label htmlFor={`lib-${lib.title}`} className="flex-1 cursor-pointer">
                                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                                                {lib.title}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                {lib.type}
                                            </div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-sm text-slate-500 dark:text-slate-400">
                                No libraries found
                            </div>
                        )}

                        {selectedLibraries.length > 0 && (
                            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                                <p className="text-xs text-green-700 dark:text-green-400">
                                    {selectedLibraries.length} {selectedLibraries.length === 1 ? 'library' : 'libraries'} selected
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}
            </div>

            <div className="flex gap-3">
                <button
                    onClick={() => previousStep()}
                    className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                    <ArrowLeft className="h-5 w-5" />
                    Back
                </button>
                <button
                    onClick={handleNext}
                    disabled={(!plexUrl && !envVars.plex_url_from_env) || (!plexToken && !envVars.plex_token_from_env) || !plexTestSuccess || selectedLibraries.length === 0}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    Next
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

function TraktStep({ wizardData, setWizardData, envVars }: { wizardData: WizardData; setWizardData: (data: WizardData) => void; envVars: EnvVars }) {
    const { nextStep, previousStep } = useWizard();
    const [localTraktEnabled, setLocalTraktEnabled] = useState(wizardData.traktEnabled);
    const [localTraktClientId, setLocalTraktClientId] = useState(wizardData.traktClientId);
    const [localTraktBaseUrl, setLocalTraktBaseUrl] = useState(wizardData.traktBaseUrl);
    const [testingTrakt, setTestingTrakt] = useState(false);
    const [traktTestSuccess, setTraktTestSuccess] = useState(false);
    const [error, setError] = useState("");

    const handleTestTrakt = async () => {
        if ((!localTraktClientId && !envVars.trakt_client_id_from_env) || !localTraktBaseUrl) {
            setError("Please enter both Trakt Client ID and Base URL before testing");
            return;
        }

        try {
            setTestingTrakt(true);
            setError("");
            setTraktTestSuccess(false);

            // Test Trakt connection with provided credentials
            const response = await fetch("/api/admin/config/test-trakt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    client_id: localTraktClientId,
                    base_url: localTraktBaseUrl,
                }),
            });
            if (!response.ok) {
                throw new Error("Trakt connection test failed");
            }

            const result = await response.json();
            if (!result.ok) {
                throw new Error(result.error || "Trakt connection test failed");
            }

            setTraktTestSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Trakt connection test failed");
            setTraktTestSuccess(false);
        } finally {
            setTestingTrakt(false);
        }
    };

    const handleNext = () => {
        setWizardData({
            ...wizardData,
            traktEnabled: localTraktEnabled,
            traktClientId: localTraktClientId,
            traktBaseUrl: localTraktBaseUrl,
        });
        nextStep();
    };

    const handleSkip = () => {
        setWizardData({
            ...wizardData,
            traktEnabled: false,
            traktClientId: "",
            traktBaseUrl: "https://api.trakt.tv",
        });
        nextStep();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <span className="text-2xl">🎬</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Trakt Integration</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Optionally sync Trakt lists with your Plex collections
                </p>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <input
                        id="traktEnabled"
                        type="checkbox"
                        checked={localTraktEnabled}
                        onChange={(e) => setLocalTraktEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-2 focus:ring-primary"
                    />
                    <label htmlFor="traktEnabled" className="flex-1 cursor-pointer">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            Enable Trakt integration
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            Sync Trakt lists to create Plex collections automatically
                        </div>
                    </label>
                </div>

                {localTraktEnabled && (
                    <div className="space-y-4 pl-4 border-l-2 border-primary">
                        <div>
                            <label htmlFor="traktClientId" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Trakt Client ID
                            </label>
                            {envVars.trakt_client_id_from_env ? (
                                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                    <p className="text-sm text-blue-700 dark:text-blue-400">
                                        ✓ Trakt Client ID configured via environment variable (HSH_TRAKT_CLIENT_ID)
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <input
                                        id="traktClientId"
                                        type="text"
                                        value={localTraktClientId}
                                        onChange={(e) => setLocalTraktClientId(e.target.value)}
                                        required={localTraktEnabled}
                                        placeholder="Your Trakt application client ID"
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    />
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        <a
                                            href="https://trakt.tv/oauth/applications"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline inline-flex items-center gap-1"
                                        >
                                            Get your client ID from Trakt
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </p>
                                </>
                            )}
                        </div>

                        <div>
                            <label htmlFor="traktBaseUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Trakt API Base URL
                            </label>
                            <input
                                id="traktBaseUrl"
                                type="text"
                                value={localTraktBaseUrl}
                                onChange={(e) => setLocalTraktBaseUrl(e.target.value)}
                                required={localTraktEnabled}
                                placeholder="https://api.trakt.tv"
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Default is fine for most users. Only change if using a custom Trakt instance.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleTestTrakt}
                            disabled={testingTrakt || (!localTraktClientId && !envVars.trakt_client_id_from_env) || !localTraktBaseUrl}
                            className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {testingTrakt ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Testing connection...
                                </>
                            ) : traktTestSuccess ? (
                                <>
                                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    Connection successful!
                                </>
                            ) : (
                                "Test Trakt Connection"
                            )}
                        </button>
                    </div>
                )}

                {error && (
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}
            </div>

            <div className="flex gap-3">
                <button
                    onClick={() => previousStep()}
                    className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                    <ArrowLeft className="h-5 w-5" />
                    Back
                </button>
                {!localTraktEnabled && (
                    <button
                        onClick={handleSkip}
                        className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                    >
                        Skip
                        <ArrowRight className="h-5 w-5" />
                    </button>
                )}
                <button
                    onClick={handleNext}
                    disabled={localTraktEnabled && !localTraktClientId && !envVars.trakt_client_id_from_env}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    Next
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

function MDBListStep({ wizardData, setWizardData, envVars }: { wizardData: WizardData; setWizardData: (data: WizardData) => void; envVars: EnvVars }) {
    const { nextStep, previousStep } = useWizard();
    const [localMDBListEnabled, setLocalMDBListEnabled] = useState(wizardData.mdblistEnabled);
    const [localMDBListApiKey, setLocalMDBListApiKey] = useState(wizardData.mdblistApiKey);
    const [localMDBListBaseUrl, setLocalMDBListBaseUrl] = useState(wizardData.mdblistBaseUrl);
    const [testingMDBList, setTestingMDBList] = useState(false);
    const [mdblistTestSuccess, setMDBListTestSuccess] = useState(false);
    const [error, setError] = useState("");

    const handleTestMDBList = async () => {
        if ((!localMDBListApiKey && !envVars.mdblist_api_key_from_env) || !localMDBListBaseUrl) {
            setError("Please enter both MDBList API Key and Base URL before testing");
            return;
        }

        try {
            setTestingMDBList(true);
            setError("");
            setMDBListTestSuccess(false);

            // Test MDBList connection with provided credentials
            const response = await fetch("/api/admin/config/test-mdblist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: localMDBListApiKey,
                    base_url: localMDBListBaseUrl,
                }),
            });
            if (!response.ok) {
                throw new Error("MDBList connection test failed");
            }

            const result = await response.json();
            if (!result.ok) {
                throw new Error(result.error || "MDBList connection test failed");
            }

            setMDBListTestSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "MDBList connection test failed");
            setMDBListTestSuccess(false);
        } finally {
            setTestingMDBList(false);
        }
    };

    const handleNext = () => {
        setWizardData({
            ...wizardData,
            mdblistEnabled: localMDBListEnabled,
            mdblistApiKey: localMDBListApiKey,
            mdblistBaseUrl: localMDBListBaseUrl,
        });
        nextStep();
    };

    const handleSkip = () => {
        setWizardData({
            ...wizardData,
            mdblistEnabled: false,
            mdblistApiKey: "",
            mdblistBaseUrl: "https://api.mdblist.com",
        });
        nextStep();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
                <List className="h-12 w-12 text-primary mx-auto" />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">MDBList Integration</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Optionally sync MDBList collections with your Plex libraries
                </p>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <input
                        id="mdblistEnabled"
                        type="checkbox"
                        checked={localMDBListEnabled}
                        onChange={(e) => setLocalMDBListEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-2 focus:ring-primary"
                    />
                    <label htmlFor="mdblistEnabled" className="flex-1 cursor-pointer">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            Enable MDBList integration
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            Sync MDBList collections to create Plex collections automatically
                        </div>
                    </label>
                </div>

                {localMDBListEnabled && (
                    <div className="space-y-4 pl-4 border-l-2 border-primary">
                        <div>
                            <label htmlFor="mdblistApiKey" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                MDBList API Key
                            </label>
                            {envVars.mdblist_api_key_from_env ? (
                                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                    <p className="text-sm text-blue-700 dark:text-blue-400">
                                        ✓ MDBList API Key configured via environment variable (HSH_MDBLIST_API_KEY)
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <input
                                        id="mdblistApiKey"
                                        type="password"
                                        value={localMDBListApiKey}
                                        onChange={(e) => setLocalMDBListApiKey(e.target.value)}
                                        required={localMDBListEnabled}
                                        placeholder="Your MDBList API key"
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    />
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        <a
                                            href="https://mdblist.com/preferences/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline inline-flex items-center gap-1"
                                        >
                                            Get your API key from MDBList
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </p>
                                </>
                            )}
                        </div>

                        <div>
                            <label htmlFor="mdblistBaseUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                MDBList API Base URL
                            </label>
                            <input
                                id="mdblistBaseUrl"
                                type="text"
                                value={localMDBListBaseUrl}
                                onChange={(e) => setLocalMDBListBaseUrl(e.target.value)}
                                required={localMDBListEnabled}
                                placeholder="https://api.mdblist.com"
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Default is fine for most users. Only change if using a custom MDBList instance.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleTestMDBList}
                            disabled={testingMDBList || (!localMDBListApiKey && !envVars.mdblist_api_key_from_env) || !localMDBListBaseUrl}
                            className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {testingMDBList ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Testing connection...
                                </>
                            ) : mdblistTestSuccess ? (
                                <>
                                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    Connection successful!
                                </>
                            ) : (
                                "Test MDBList Connection"
                            )}
                        </button>
                    </div>
                )}

                {error && (
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}
            </div>

            <div className="flex gap-3">
                <button
                    onClick={() => previousStep()}
                    className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                    <ArrowLeft className="h-5 w-5" />
                    Back
                </button>
                {!localMDBListEnabled && (
                    <button
                        onClick={handleSkip}
                        className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                    >
                        Skip
                        <ArrowRight className="h-5 w-5" />
                    </button>
                )}
                <button
                    onClick={handleNext}
                    disabled={localMDBListEnabled && !localMDBListApiKey && !envVars.mdblist_api_key_from_env}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    Next
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

function TautulliStep({ wizardData, setWizardData, envVars }: { wizardData: WizardData; setWizardData: (data: WizardData) => void; envVars: EnvVars }) {
    const { nextStep, previousStep } = useWizard();
    const [localTautulliEnabled, setLocalTautulliEnabled] = useState(wizardData.tautulliEnabled);
    const [localTautulliApiKey, setLocalTautulliApiKey] = useState(wizardData.tautulliApiKey);
    const [localTautulliBaseUrl, setLocalTautulliBaseUrl] = useState(wizardData.tautulliBaseUrl);
    const [testingTautulli, setTestingTautulli] = useState(false);
    const [tautulliTestSuccess, setTautulliTestSuccess] = useState(false);
    const [error, setError] = useState("");

    const handleTestTautulli = async () => {
        if ((!localTautulliApiKey && !envVars.tautulli_api_key_from_env) || (!localTautulliBaseUrl && !envVars.tautulli_url_from_env)) {
            setError("Please enter both Tautulli API Key and URL before testing");
            return;
        }

        try {
            setTestingTautulli(true);
            setError("");
            setTautulliTestSuccess(false);

            // Test Tautulli connection with provided credentials
            // Send empty strings for values configured via env vars so backend uses env var values
            const response = await fetch("/api/admin/config/test-tautulli", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: envVars.tautulli_api_key_from_env ? "" : localTautulliApiKey,
                    base_url: envVars.tautulli_url_from_env ? "" : localTautulliBaseUrl,
                }),
            });
            if (!response.ok) {
                throw new Error("Tautulli connection test failed");
            }

            const result = await response.json();
            if (!result.ok) {
                throw new Error(result.error || "Tautulli connection test failed");
            }

            setTautulliTestSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Tautulli connection test failed");
            setTautulliTestSuccess(false);
        } finally {
            setTestingTautulli(false);
        }
    };

    const handleNext = () => {
        setWizardData({
            ...wizardData,
            tautulliEnabled: localTautulliEnabled,
            tautulliApiKey: localTautulliApiKey,
            tautulliBaseUrl: localTautulliBaseUrl,
        });
        nextStep();
    };

    const handleSkip = () => {
        setWizardData({
            ...wizardData,
            tautulliEnabled: false,
            tautulliApiKey: "",
            tautulliBaseUrl: "http://localhost:8181",
        });
        nextStep();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
                <BarChart2 className="h-12 w-12 text-primary mx-auto" />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Tautulli Integration</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Optionally connect Tautulli for streaming analytics
                </p>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <input
                        id="tautulliEnabled"
                        type="checkbox"
                        checked={localTautulliEnabled}
                        onChange={(e) => setLocalTautulliEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-2 focus:ring-primary"
                    />
                    <label htmlFor="tautulliEnabled" className="flex-1 cursor-pointer">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            Enable Tautulli integration
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            Collect streaming analytics and track collection performance
                        </div>
                    </label>
                </div>

                {localTautulliEnabled && (
                    <div className="space-y-4 pl-4 border-l-2 border-primary">
                        <div>
                            <label htmlFor="tautulliApiKey" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Tautulli API Key
                            </label>
                            {envVars.tautulli_api_key_from_env ? (
                                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                    <p className="text-sm text-blue-700 dark:text-blue-400">
                                        ✓ Tautulli API Key configured via environment variable (HSH_TAUTULLI_API_KEY)
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <input
                                        id="tautulliApiKey"
                                        type="password"
                                        value={localTautulliApiKey}
                                        onChange={(e) => setLocalTautulliApiKey(e.target.value)}
                                        required={localTautulliEnabled}
                                        placeholder="Your Tautulli API key"
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    />
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Found in Tautulli under Settings → Web Interface → API Key
                                    </p>
                                </>
                            )}
                        </div>

                        <div>
                            <label htmlFor="tautulliBaseUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Tautulli URL
                            </label>
                            {envVars.tautulli_url_from_env ? (
                                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                    <p className="text-sm text-blue-700 dark:text-blue-400">
                                        ✓ Tautulli URL configured via environment variable (HSH_TAUTULLI_BASE_URL)
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <input
                                        id="tautulliBaseUrl"
                                        type="text"
                                        value={localTautulliBaseUrl}
                                        onChange={(e) => setLocalTautulliBaseUrl(e.target.value)}
                                        required={localTautulliEnabled}
                                        placeholder="http://localhost:8181"
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    />
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        The URL where your Tautulli instance is running
                                    </p>
                                </>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleTestTautulli}
                            disabled={testingTautulli || (!localTautulliApiKey && !envVars.tautulli_api_key_from_env) || (!localTautulliBaseUrl && !envVars.tautulli_url_from_env)}
                            className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {testingTautulli ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Testing connection...
                                </>
                            ) : tautulliTestSuccess ? (
                                <>
                                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    Connection successful!
                                </>
                            ) : (
                                "Test Tautulli Connection"
                            )}
                        </button>
                    </div>
                )}

                {error && (
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}
            </div>

            <div className="flex gap-3">
                <button
                    onClick={() => previousStep()}
                    className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                    <ArrowLeft className="h-5 w-5" />
                    Back
                </button>
                {!localTautulliEnabled && (
                    <button
                        onClick={handleSkip}
                        className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                    >
                        Skip
                        <ArrowRight className="h-5 w-5" />
                    </button>
                )}
                <button
                    onClick={handleNext}
                    disabled={localTautulliEnabled && !localTautulliApiKey && !envVars.tautulli_api_key_from_env}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    Next
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

function SeerrStep({ wizardData, setWizardData, envVars }: { wizardData: WizardData; setWizardData: (data: WizardData) => void; envVars: EnvVars }) {
    const { nextStep, previousStep } = useWizard();
    const [localSeerrEnabled, setLocalSeerrEnabled] = useState(wizardData.seerrEnabled);
    const [localSeerrApiKey, setLocalSeerrApiKey] = useState(wizardData.seerrApiKey);
    const [localSeerrBaseUrl, setLocalSeerrBaseUrl] = useState(wizardData.seerrBaseUrl);
    const [testingSeerr, setTestingSeerr] = useState(false);
    const [seerrTestSuccess, setSeerrTestSuccess] = useState(false);
    const [error, setError] = useState("");

    const handleTestSeerr = async () => {
        if ((!localSeerrApiKey && !envVars.seerr_api_key_from_env) || (!localSeerrBaseUrl && !envVars.seerr_url_from_env)) {
            setError("Please enter both Seerr API Key and URL before testing");
            return;
        }

        try {
            setTestingSeerr(true);
            setError("");
            setSeerrTestSuccess(false);

            // Test Seerr connection with provided credentials
            // Send empty strings for values configured via env vars so backend uses env var values
            const response = await fetch("/api/admin/config/test-seerr", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: envVars.seerr_api_key_from_env ? "" : localSeerrApiKey,
                    base_url: envVars.seerr_url_from_env ? "" : localSeerrBaseUrl,
                }),
            });
            if (!response.ok) {
                throw new Error("Seerr connection test failed");
            }

            const result = await response.json();
            if (!result.ok) {
                throw new Error(result.error || "Seerr connection test failed");
            }

            setSeerrTestSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Seerr connection test failed");
            setSeerrTestSuccess(false);
        } finally {
            setTestingSeerr(false);
        }
    };

    const handleNext = () => {
        setWizardData({
            ...wizardData,
            seerrEnabled: localSeerrEnabled,
            seerrApiKey: localSeerrApiKey,
            seerrBaseUrl: localSeerrBaseUrl,
        });
        nextStep();
    };

    const handleSkip = () => {
        setWizardData({
            ...wizardData,
            seerrEnabled: false,
            seerrApiKey: "",
            seerrBaseUrl: "http://localhost:5055",
        });
        nextStep();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
                <Film className="h-12 w-12 text-primary mx-auto" />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Seerr Integration</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Optionally connect Overseerr/Jellyseerr for media requests
                </p>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <input
                        id="seerrEnabled"
                        type="checkbox"
                        checked={localSeerrEnabled}
                        onChange={(e) => setLocalSeerrEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-2 focus:ring-primary"
                    />
                    <label htmlFor="seerrEnabled" className="flex-1 cursor-pointer">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            Enable Seerr integration
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            View and manage media requests from your dashboard
                        </div>
                    </label>
                </div>

                {localSeerrEnabled && (
                    <div className="space-y-4 pl-4 border-l-2 border-primary">
                        <div>
                            <label htmlFor="seerrApiKey" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Seerr API Key
                            </label>
                            {envVars.seerr_api_key_from_env ? (
                                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                    <p className="text-sm text-blue-700 dark:text-blue-400">
                                        ✓ Seerr API Key configured via environment variable (HSH_SEERR_API_KEY)
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <input
                                        id="seerrApiKey"
                                        type="password"
                                        value={localSeerrApiKey}
                                        onChange={(e) => setLocalSeerrApiKey(e.target.value)}
                                        required={localSeerrEnabled}
                                        placeholder="Your Seerr API key"
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    />
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Found in Overseerr/Jellyseerr under Settings → General → API Key
                                    </p>
                                </>
                            )}
                        </div>

                        <div>
                            <label htmlFor="seerrBaseUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Seerr URL
                            </label>
                            {envVars.seerr_url_from_env ? (
                                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                    <p className="text-sm text-blue-700 dark:text-blue-400">
                                        ✓ Seerr URL configured via environment variable (HSH_SEERR_BASE_URL)
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <input
                                        id="seerrBaseUrl"
                                        type="text"
                                        value={localSeerrBaseUrl}
                                        onChange={(e) => setLocalSeerrBaseUrl(e.target.value)}
                                        required={localSeerrEnabled}
                                        placeholder="http://localhost:5055"
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    />
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        The URL where your Overseerr/Jellyseerr instance is running
                                    </p>
                                </>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleTestSeerr}
                            disabled={testingSeerr || (!localSeerrApiKey && !envVars.seerr_api_key_from_env) || (!localSeerrBaseUrl && !envVars.seerr_url_from_env)}
                            className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {testingSeerr ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Testing connection...
                                </>
                            ) : seerrTestSuccess ? (
                                <>
                                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    Connection successful!
                                </>
                            ) : (
                                "Test Seerr Connection"
                            )}
                        </button>
                    </div>
                )}

                {error && (
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}
            </div>

            <div className="flex gap-3">
                <button
                    onClick={() => previousStep()}
                    className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                    <ArrowLeft className="h-5 w-5" />
                    Back
                </button>
                {!localSeerrEnabled && (
                    <button
                        onClick={handleSkip}
                        className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                    >
                        Skip
                        <ArrowRight className="h-5 w-5" />
                    </button>
                )}
                <button
                    onClick={handleNext}
                    disabled={localSeerrEnabled && !localSeerrApiKey && !envVars.seerr_api_key_from_env}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    Next
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

function RotationStep({ wizardData, setWizardData }: { wizardData: WizardData; setWizardData: (data: WizardData) => void }) {
    const { nextStep, previousStep } = useWizard();
    const [localRotationEnabled, setLocalRotationEnabled] = useState(wizardData.rotationEnabled);
    const [localIntervalHours, setLocalIntervalHours] = useState(wizardData.rotationIntervalHours);
    const [localMaxCollections, setLocalMaxCollections] = useState(wizardData.rotationMaxCollections);
    const [localAllowRepeats, setLocalAllowRepeats] = useState(wizardData.rotationAllowRepeats);

    const handleNext = () => {
        setWizardData({
            ...wizardData,
            rotationEnabled: localRotationEnabled,
            rotationIntervalHours: localIntervalHours,
            rotationMaxCollections: localMaxCollections,
            rotationStrategy: "random",
            rotationAllowRepeats: localAllowRepeats,
        });
        nextStep();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
                <Clock className="h-12 w-12 text-primary mx-auto" />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Rotation Schedule</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Configure automatic collection rotations (optional)
                </p>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <Switch
                        checked={localRotationEnabled}
                        onChange={setLocalRotationEnabled}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition data-[checked]:bg-primary bg-slate-600"
                    >
                        <span className="inline-block h-5 w-5 transform rounded-full bg-white transition data-[checked]:translate-x-5 translate-x-1" />
                    </Switch>
                    <label className="flex-1 cursor-pointer" onClick={() => setLocalRotationEnabled(!localRotationEnabled)}>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            Enable automatic rotations
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            Automatically rotate featured collections on a schedule
                        </div>
                    </label>
                </div>

                {localRotationEnabled && (
                    <div className="space-y-4 pl-4 border-l-2 border-primary">
                        <div>
                            <label htmlFor="intervalHours" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Interval (hours)
                            </label>
                            <input
                                id="intervalHours"
                                type="number"
                                min={1}
                                value={localIntervalHours}
                                onChange={(e) => setLocalIntervalHours(parseInt(e.target.value) || 12)}
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                How often to rotate featured collections
                            </p>
                        </div>

                        <div>
                            <label htmlFor="maxCollections" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Max collections
                            </label>
                            <input
                                id="maxCollections"
                                type="number"
                                min={1}
                                value={localMaxCollections}
                                onChange={(e) => setLocalMaxCollections(parseInt(e.target.value) || 5)}
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Maximum number of collections to feature at once
                            </p>
                        </div>

                        <div>
                            <label htmlFor="strategy" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Strategy
                            </label>
                            <Listbox
                                value={wizardData.rotationStrategy}
                                onChange={(val) =>
                                    setWizardData({
                                        ...wizardData,
                                        rotationStrategy: val,
                                    })
                                }
                            >
                                <div className="relative">
                                    <Listbox.Button className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/70 text-left flex items-center justify-between">
                                        <span>
                                            {wizardData.rotationStrategy === "weighted" ? "Weighted" :
                                             wizardData.rotationStrategy === "lru" ? "Least Recently Used" :
                                             "Random"}
                                        </span>
                                        <ChevronDown size={16} className="text-slate-400" />
                                    </Listbox.Button>

                                    <Listbox.Options className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden focus:outline-none">
                                        <Listbox.Option
                                            value="random"
                                            className="px-4 py-3 cursor-pointer transition-colors data-[focus]:bg-slate-100 dark:data-[focus]:bg-slate-800"
                                        >
                                            <div className="flex items-center justify-between text-slate-900 dark:text-white text-sm">
                                                <span className="data-[selected]:font-medium">Random</span>
                                                <Check size={14} className="text-primary invisible data-[selected]:visible" />
                                            </div>
                                        </Listbox.Option>
                                        <Listbox.Option
                                            value="weighted"
                                            className="px-4 py-3 cursor-pointer transition-colors data-[focus]:bg-slate-100 dark:data-[focus]:bg-slate-800"
                                        >
                                            <div className="flex items-center justify-between text-slate-900 dark:text-white text-sm">
                                                <span className="data-[selected]:font-medium">Weighted</span>
                                                <Check size={14} className="text-primary invisible data-[selected]:visible" />
                                            </div>
                                        </Listbox.Option>
                                        <Listbox.Option
                                            value="lru"
                                            className="px-4 py-3 cursor-pointer transition-colors data-[focus]:bg-slate-100 dark:data-[focus]:bg-slate-800"
                                        >
                                            <div className="flex items-center justify-between text-slate-900 dark:text-white text-sm">
                                                <span className="data-[selected]:font-medium">Least Recently Used</span>
                                                <Check size={14} className="text-primary invisible data-[selected]:visible" />
                                            </div>
                                        </Listbox.Option>
                                    </Listbox.Options>
                                </div>
                            </Listbox>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Choose how groups are prioritized during rotation
                            </p>
                        </div>

                        <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                            <Switch
                                checked={localAllowRepeats}
                                onChange={setLocalAllowRepeats}
                                className="relative inline-flex h-6 w-11 items-center rounded-full transition data-[checked]:bg-primary bg-slate-600"
                            >
                                <span className="inline-block h-5 w-5 transform rounded-full bg-white transition data-[checked]:translate-x-5 translate-x-1" />
                            </Switch>
                            <label className="flex-1 cursor-pointer" onClick={() => setLocalAllowRepeats(!localAllowRepeats)}>
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                    Allow repeats
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    Permit the same collection to appear in consecutive rotations
                                </div>
                            </label>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex gap-3">
                <button
                    onClick={() => previousStep()}
                    className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                    <ArrowLeft className="h-5 w-5" />
                    Back
                </button>
                <button
                    onClick={handleNext}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                    Next
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

function CompleteStep({ wizardData }: { wizardData: WizardData }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleComplete = async () => {
        setError("");
        setLoading(true);

        try {
            const response = await fetch("/api/admin/config/quick-start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plex_url: wizardData.plexUrl,
                    plex_token: wizardData.plexToken,
                    trakt_enabled: wizardData.traktEnabled,
                    trakt_client_id: wizardData.traktEnabled ? wizardData.traktClientId : null,
                    trakt_base_url: wizardData.traktBaseUrl,
                    mdblist_enabled: wizardData.mdblistEnabled,
                    mdblist_api_key: wizardData.mdblistEnabled ? wizardData.mdblistApiKey : null,
                    mdblist_base_url: wizardData.mdblistBaseUrl,
                    tautulli_enabled: wizardData.tautulliEnabled,
                    tautulli_api_key: wizardData.tautulliEnabled ? wizardData.tautulliApiKey : null,
                    tautulli_base_url: wizardData.tautulliBaseUrl,
                    seerr_enabled: wizardData.seerrEnabled,
                    seerr_api_key: wizardData.seerrEnabled ? wizardData.seerrApiKey : null,
                    seerr_base_url: wizardData.seerrBaseUrl,
                    libraries: wizardData.selectedLibraries,
                    auth_enabled: wizardData.authEnabled,
                    auth_username: wizardData.authUsername,
                    auth_password: wizardData.authPassword,
                    rotation_enabled: wizardData.rotationEnabled,
                    rotation_interval_hours: wizardData.rotationIntervalHours,
                    rotation_max_collections: wizardData.rotationMaxCollections,
                    rotation_strategy: wizardData.rotationStrategy,
                    rotation_allow_repeats: wizardData.rotationAllowRepeats,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || "Setup failed");
            }

            navigate("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Setup failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto">
                    <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ready to Go!</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Review your configuration and complete setup
                </p>
            </div>

            <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Authentication</span>
                    <span className="text-sm text-slate-900 dark:text-white">
                        {wizardData.authEnabled ? `Enabled (${wizardData.authUsername})` : "Disabled"}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Plex Server</span>
                    <span className="text-sm text-slate-900 dark:text-white truncate max-w-xs">{wizardData.plexUrl}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Libraries</span>
                    <span className="text-sm text-slate-900 dark:text-white">{wizardData.selectedLibraries.length} selected</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Trakt</span>
                    <span className="text-sm text-slate-900 dark:text-white">
                        {wizardData.traktEnabled ? "Enabled" : "Disabled"}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">MDBList</span>
                    <span className="text-sm text-slate-900 dark:text-white">
                        {wizardData.mdblistEnabled ? "Enabled" : "Disabled"}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tautulli</span>
                    <span className="text-sm text-slate-900 dark:text-white">
                        {wizardData.tautulliEnabled ? "Enabled" : "Disabled"}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Seerr</span>
                    <span className="text-sm text-slate-900 dark:text-white">
                        {wizardData.seerrEnabled ? "Enabled" : "Disabled"}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Automatic Rotations</span>
                    <span className="text-sm text-slate-900 dark:text-white">
                        {wizardData.rotationEnabled ? `Every ${wizardData.rotationIntervalHours}h` : "Disabled"}
                    </span>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            <button
                onClick={handleComplete}
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving configuration...
                    </>
                ) : (
                    <>
                        Complete Setup
                        <Sparkles className="h-5 w-5" />
                    </>
                )}
            </button>

            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                You'll be redirected to the dashboard once setup is complete
            </p>
        </div>
    );
}
