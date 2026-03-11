import { useState, useEffect, useMemo, useRef, createContext } from "react";
import { useNavigate } from "react-router-dom";
import { Wizard, useWizard } from "react-use-wizard";
import { ArrowRight, ArrowLeft, Check, Shield, Server, Sparkles, Plug, KeyRound, RefreshCw, Layers, Info, Film, Tv, Video, Swords, BookOpen, Users, Home, Star, Clock, Hand, Shuffle, Scale, RotateCcw, Palette, type LucideIcon } from "lucide-react";
import { Transition } from "@headlessui/react";
import PosterBackground from "../components/PosterBackground";
import { Slider } from "../components/ui/slider";

import { getShuffledStaticPosters } from "../utils/staticPosters";
import { useAuth } from "../utils/auth";
import { useTheme, type ThemeAccent } from "../utils/theme";

type EnvVars = {
    plex_token_from_env: boolean;
    plex_url_from_env: boolean;
    plex_url_value: string | null;
    auth_password_from_env: boolean;
    auth_secret_from_env: boolean;
};

type Library = {
    title: string;
    type: string;
};

type AuthMethod = "password" | "plex" | "both";

type RotationMode = "groups" | "auto_rotate";

type WizardData = {
    authEnabled: boolean;
    authMethod: AuthMethod;
    authUsername: string;
    authPassword: string;
    plexUrl: string;
    plexToken: string;
    selectedLibraries: string[];
    rotationMode: RotationMode;
    rotationEnabled: boolean;
    rotationIntervalHours: number;
    rotationMaxCollections: number;
    rotationStrategy: string;
    rotationAllowRepeats: boolean;
    visibilityHome: boolean;
    visibilityShared: boolean;
    visibilityRecommended: boolean;
};

const STEP_COUNT = 6; // Theme, Plex, Auth, Rotation Mode, Rotation Settings, Complete

type SlideDirection = "forward" | "back";
const SlideDirectionContext = createContext<SlideDirection>("forward");

function StepProgress({ step, label }: { step: number; label: string }) {
    const pct = Math.round((step / STEP_COUNT) * 100);
    return (
        <div className="space-y-2 mb-6">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                    Step {step} of {STEP_COUNT}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{pct}% Complete</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                    className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{label}</h2>
        </div>
    );
}

export default function QuickStartPage() {
    const [wizardData, setWizardData] = useState<WizardData>({
        authEnabled: true,
        authMethod: "password",
        authUsername: "admin",
        authPassword: "",
        plexUrl: "",
        plexToken: "",
        selectedLibraries: [],
        rotationMode: "groups",
        rotationEnabled: true,
        rotationIntervalHours: 12,
        rotationMaxCollections: 5,
        rotationStrategy: "random",
        rotationAllowRepeats: false,
        visibilityHome: true,
        visibilityShared: false,
        visibilityRecommended: false,
    });

    const [envVars, setEnvVars] = useState<EnvVars>({
        plex_token_from_env: false,
        plex_url_from_env: false,
        plex_url_value: null,
        auth_password_from_env: false,
        auth_secret_from_env: false,
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

    const prevStepRef = useRef(0);
    const [slideDirection, setSlideDirection] = useState<SlideDirection>("forward");
    const [stepKey, setStepKey] = useState(0);

    const handleStepChange = (newStep: number) => {
        setSlideDirection(newStep > prevStepRef.current ? "forward" : "back");
        prevStepRef.current = newStep;
        setStepKey((k) => k + 1);
    };

    return (
        <PosterBackground staticPosters={staticPosters}>
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 w-full max-w-3xl p-8 overflow-hidden">
                    <SlideDirectionContext.Provider value={slideDirection}>
                    <Wizard onStepChange={handleStepChange}
                        wrapper={<div key={stepKey} className={`wizard-slide ${slideDirection === "forward" ? "wizard-slide-in-right" : "wizard-slide-in-left"}`} />}
                    >
                        <WelcomeStep />
                        <ThemeStep />
                        <PlexStep wizardData={wizardData} setWizardData={setWizardData} envVars={envVars} />
                        <AuthStep wizardData={wizardData} setWizardData={setWizardData} envVars={envVars} />
                        <RotationModeStep wizardData={wizardData} setWizardData={setWizardData} />
                        <RotationSettingsStep wizardData={wizardData} setWizardData={setWizardData} />
                        <CompleteStep wizardData={wizardData} envVars={envVars} />
                    </Wizard>
                    </SlideDirectionContext.Provider>
                </div>
            </div>
        </PosterBackground>
    );
}

function WelcomeStep() {
    const { nextStep } = useWizard();

    const steps = [
        { icon: Sparkles, label: "Pick a theme" },
        { icon: Server, label: "Connect to Plex" },
        { icon: Shield, label: "Set up auth" },
        { icon: RefreshCw, label: "Configure rotation" },
    ];

    return (
        <div className="space-y-8 ">
            <div className="flex flex-col items-center gap-4">
                <img
                    src="/logo_text.png"
                    alt="homescreen-hero"
                    className="h-auto w-auto select-none"
                />
                <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
                    Your Plex companion for automated homescreen collections.
                </p>
            </div>

            <div className="flex items-center justify-center gap-3">
                {steps.map((step, i) => (
                    <div key={step.label} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                            <step.icon className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{step.label}</span>
                        </div>
                        {i < steps.length - 1 && (
                            <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                        )}
                    </div>
                ))}
            </div>

            <button
                onClick={() => nextStep()}
                className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
                Get Started
                <ArrowRight className="h-5 w-5" />
            </button>
        </div>
    );
}

function ThemeStep() {
    const { nextStep, previousStep } = useWizard();
    const { accent, setAccent } = useTheme();

    const accentChoices: { value: ThemeAccent; label: string; description: string; swatch: string }[] = [
        { value: "default", label: "Default Blue", description: "Clean and modern", swatch: "bg-[rgb(25,93,230)]" },
        { value: "plex-orange", label: "Plex Orange", description: "Warm and familiar", swatch: "bg-[rgb(229,160,13)]" },
    ];

    return (
        <div className="space-y-6 ">
            <StepProgress step={1} label="Appearance" />
            <p className="text-sm text-slate-600 dark:text-slate-400 -mt-4">
                Pick a look that feels right. You can always change this later in settings.
            </p>

            {/* Accent color */}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Accent color
                </label>
                <div className="grid grid-cols-2 gap-3">
                    {accentChoices.map((choice) => (
                        <button
                            key={choice.value}
                            type="button"
                            onClick={() => setAccent(choice.value)}
                            className={`text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                                accent === choice.value
                                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`h-8 w-8 rounded-full ${choice.swatch} flex-shrink-0 shadow-sm`} />
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{choice.label}</span>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{choice.description}</p>
                                </div>
                                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                    accent === choice.value
                                        ? "border-primary"
                                        : "border-slate-400 dark:border-slate-500"
                                }`}>
                                    {accent === choice.value && (
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex gap-3 pt-2">
                <button
                    onClick={() => previousStep()}
                    className="px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </button>
                <button
                    onClick={() => nextStep()}
                    className="flex-1 py-3 px-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                    Next
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

function AuthStep({ wizardData, setWizardData, envVars }: { wizardData: WizardData; setWizardData: (data: WizardData) => void; envVars: EnvVars }) {
    const { nextStep, previousStep } = useWizard();
    const [localMethod, setLocalMethod] = useState<AuthMethod>(wizardData.authMethod);
    const [localUsername, setLocalUsername] = useState(wizardData.authUsername);
    const [localPassword, setLocalPassword] = useState(wizardData.authPassword);

    const needsPassword = localMethod === "password" || localMethod === "both";

    const canProceed = needsPassword
        ? localUsername && (localPassword || envVars.auth_password_from_env)
        : true;

    const handleNext = () => {
        setWizardData({
            ...wizardData,
            authEnabled: true,
            authMethod: localMethod,
            authUsername: needsPassword ? localUsername : "admin",
            authPassword: needsPassword ? localPassword : "",
        });
        nextStep();
    };

    const methods: { value: AuthMethod; label: string; description: string; icon: typeof KeyRound }[] = [
        {
            value: "password",
            label: "Password",
            description: "Sign in with a username and password. Less secure, but simple.",
            icon: KeyRound,
        },
        {
            value: "plex",
            label: "Plex",
            description: "Sign in with your Plex account with Plex OAuth instead of a separate password.",
            icon: Server,
        },
        {
            value: "both",
            label: "Password + Plex",
            description: "Use either local auth (password) or your Plex account to sign in.",
            icon: Layers,
        },
    ];

    return (
        <div className="space-y-6 ">
            <StepProgress step={3} label="Authentication" />
            <p className="text-sm text-slate-600 dark:text-slate-400 -mt-4">
                Choose how you'll sign in to your dashboard
            </p>

            <div className="space-y-3">
                {methods.map((m) => (
                    <button
                        key={m.value}
                        type="button"
                        onClick={() => setLocalMethod(m.value)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                            localMethod === m.value
                                ? "border-primary bg-primary/5 dark:bg-primary/10"
                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                localMethod === m.value
                                    ? "bg-primary/10 dark:bg-primary/20"
                                    : "bg-slate-100 dark:bg-slate-800"
                            }`}>
                                <m.icon className={`h-4.5 w-4.5 ${
                                    localMethod === m.value
                                        ? "text-primary"
                                        : "text-slate-500 dark:text-slate-400"
                                }`} />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">{m.label}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{m.description}</div>
                            </div>
                            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                localMethod === m.value
                                    ? "border-primary"
                                    : "border-slate-400 dark:border-slate-500"
                            }`}>
                                {localMethod === m.value && (
                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            <Transition
                show={needsPassword}
                enter="transition-all duration-300 ease-out overflow-hidden"
                enterFrom="opacity-0 max-h-0 -translate-y-2"
                enterTo="opacity-100 max-h-60 translate-y-0"
                leave="transition-all duration-250 ease-in overflow-hidden"
                leaveFrom="opacity-100 max-h-60 translate-y-0"
                leaveTo="opacity-0 max-h-0 -translate-y-2"
            >
                <div className="grid grid-cols-2 gap-4">
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
                            placeholder="e.g. admin"
                            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Password
                            {envVars.auth_password_from_env && (
                                <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                                    <Check className="h-3 w-3" />
                                    Set via env variable
                                </span>
                            )}
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={envVars.auth_password_from_env ? "••••••••••••" : localPassword}
                            onChange={(e) => setLocalPassword(e.target.value)}
                            required={!envVars.auth_password_from_env}
                            disabled={envVars.auth_password_from_env}
                            placeholder="Enter a secure password"
                            className={`w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${envVars.auth_password_from_env ? "opacity-50 cursor-not-allowed" : ""}`}
                        />
                    </div>
                </div>
            </Transition>

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
                    disabled={!canProceed}
                    className="flex-1 py-3 px-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
    const [error, setError] = useState("");

    // Reset success state when inputs change
    useEffect(() => {
        setPlexTestSuccess(false);
    }, [plexUrl, plexToken]);

    const handleTestPlex = async () => {
        if ((!plexUrl && !envVars.plex_url_from_env) || (!plexToken && !envVars.plex_token_from_env)) {
            setError("Please enter both Plex URL and token before testing");
            return;
        }

        try {
            setTestingPlex(true);
            setError("");
            setPlexTestSuccess(false);

            const minDelay = new Promise((r) => setTimeout(r, 1200));

            const response = await fetch("/api/admin/config/quick-start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plex_url: plexUrl,
                    plex_token: plexToken,
                    libraries: ["dummy"],
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || "Failed to connect to Plex");
            }

            // Fetch libraries but don't show them yet
            const libResponse = await fetch("/api/collections/libraries");
            if (!libResponse.ok) {
                const errorText = await libResponse.text();
                throw new Error(`Failed to fetch libraries: ${errorText}`);
            }
            const libData = await libResponse.json();
            const libs: Library[] = (libData.libraries || []).filter(
                (lib: Library) => lib.type === "movie" || lib.type === "show" || lib.type === "other"
            );

            // Wait for the animation to finish, then reveal everything at once
            await minDelay;
            setAvailableLibraries(libs);
            setPlexTestSuccess(true);
        } catch (err) {
            await new Promise((r) => setTimeout(r, 800));
            setError(err instanceof Error ? err.message : "Plex connection test failed");
            setPlexTestSuccess(false);
        } finally {
            setTestingPlex(false);
        }
    };

    const toggleLibrary = (libraryName: string) => {
        setSelectedLibraries((prev) =>
            prev.includes(libraryName)
                ? prev.filter((name) => name !== libraryName)
                : [...prev, libraryName]
        );
    };

    const toggleAll = () => {
        if (selectedLibraries.length === availableLibraries.length) {
            setSelectedLibraries([]);
        } else {
            setSelectedLibraries(availableLibraries.map((lib) => lib.title));
        }
    };

    const libraryMeta = (type: string, title: string): { label: string; icon: LucideIcon } => {
        const t = title.toLowerCase();

        // Fuzzy-match title first for sub-genres
        if (/anime|anim[eé]/i.test(t)) return { label: "Anime Library", icon: Swords };
        if (/document/i.test(t)) return { label: "Documentary Library", icon: BookOpen };

        // Fall back to Plex library type
        const typeMap: Record<string, { label: string; icon: LucideIcon }> = {
            movie: { label: "Movie Library", icon: Film },
            show: { label: "TV Library", icon: Tv },
            other: { label: "Other Videos", icon: Video },
        };

        return typeMap[type] || { label: `${type.charAt(0).toUpperCase()}${type.slice(1)} Library`, icon: Film };
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
        <div className="space-y-6 ">
            <StepProgress step={2} label="Connection & Libraries" />
            <p className="text-sm text-slate-600 dark:text-slate-400 -mt-4">
                Connect to your Plex Media Server and select your libraries
            </p>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="plexUrl" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Plex Server URL
                        {envVars.plex_url_from_env && (
                            <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                                <Check className="h-3 w-3" />
                                Set via env variable
                            </span>
                        )}
                    </label>
                    <input
                        id="plexUrl"
                        type="text"
                        value={envVars.plex_url_value ?? plexUrl}
                        onChange={(e) => setPlexUrl(e.target.value)}
                        disabled={envVars.plex_url_from_env}
                        placeholder="http://localhost:32400"
                        className={`w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${envVars.plex_url_from_env ? "opacity-50 cursor-not-allowed" : ""}`}
                    />
                </div>

                <div>
                    <label htmlFor="plexToken" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        X-Plex-Token
                        {envVars.plex_token_from_env && (
                            <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                                <Check className="h-3 w-3" />
                                Set via env variable
                            </span>
                        )}
                    </label>
                    <input
                        id="plexToken"
                        type="password"
                        value={envVars.plex_token_from_env ? "••••••••••••••••••••••••" : plexToken}
                        onChange={(e) => setPlexToken(e.target.value)}
                        disabled={envVars.plex_token_from_env}
                        placeholder="Your Plex token"
                        className={`w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${envVars.plex_token_from_env ? "opacity-50 cursor-not-allowed" : ""}`}
                    />
                    <a
                        href="https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline"
                    >
                        How to find your token
                    </a>
                </div>
            </div>

            <button
                onClick={handleTestPlex}
                disabled={testingPlex || plexTestSuccess}
                className={`w-full py-3 px-4 font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                    plexTestSuccess
                        ? "bg-green-500 dark:bg-green-600 text-white shadow-lg cursor-default"
                        : "bg-primary hover:bg-primary-hover text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
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
                        <Check className="h-5 w-5" />
                        Connected to Plex
                    </>
                ) : (
                    "Test Connection & Fetch Libraries"
                )}
            </button>

            {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {availableLibraries.length > 0 && (
                <div className="space-y-3 animate-slide-expand overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                Select Libraries
                            </h3>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                {availableLibraries.length} found
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={toggleAll}
                            className="text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                        >
                            {selectedLibraries.length === availableLibraries.length ? "Deselect All" : "Select All"}
                        </button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {availableLibraries.map((lib) => {
                            const selected = selectedLibraries.includes(lib.title);
                            const meta = libraryMeta(lib.type, lib.title);
                            const LibIcon = meta.icon;
                            return (
                                <button
                                    key={lib.title}
                                    type="button"
                                    onClick={() => toggleLibrary(lib.title)}
                                    className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-200 ${
                                        selected
                                            ? "border-primary bg-primary/5 dark:bg-primary/10"
                                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                            selected
                                                ? "bg-primary/10 dark:bg-primary/20"
                                                : "bg-slate-100 dark:bg-slate-800"
                                        }`}>
                                            <LibIcon className={`h-4.5 w-4.5 ${
                                                selected
                                                    ? "text-primary"
                                                    : "text-slate-500 dark:text-slate-400"
                                            }`} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-slate-900 dark:text-white">{lib.title}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{meta.label}</div>
                                        </div>
                                        {selected && (
                                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

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
                    disabled={selectedLibraries.length === 0}
                    className="flex-1 py-3 px-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    Next
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

function RotationModeStep({ wizardData, setWizardData }: { wizardData: WizardData; setWizardData: (data: WizardData) => void }) {
    const { nextStep, previousStep } = useWizard();
    const [localMode, setLocalMode] = useState<RotationMode>(wizardData.rotationMode);

    const handleNext = () => {
        setWizardData({ ...wizardData, rotationMode: localMode });
        nextStep();
    };

    const modes: { value: RotationMode; label: string; description: string; bullets: string[]; icon: LucideIcon; recommended?: boolean }[] = [
        {
            value: "groups",
            label: "Collection Groups",
            description: "Organize collections into named groups with individual rules for full control over what appears on your homescreen.",
            bullets: [
                "Create groups like \"Holiday\", \"Action\", \"New Releases\"",
                "Set pick counts, weights, and schedules per group",
                "Seasonal date ranges and smart filters",
            ],
            icon: Layers,
            recommended: true,
        },
        {
            value: "auto_rotate",
            label: "Auto-Rotate",
            description: "The simplest option. Randomly rotates collections from all your libraries on a schedule with no additional setup.",
            bullets: [
                "Picks from every collection in your libraries",
                "No manual setup required",
                "Good if you just want variety",
            ],
            icon: RefreshCw,
        },
    ];

    return (
        <div className="space-y-6 ">
            <StepProgress step={4} label="Rotation Mode" />
            <p className="text-sm text-slate-600 dark:text-slate-400 -mt-4">
                Choose how collections are selected for your homescreen
            </p>

            <div className="space-y-3">
                {modes.map((m) => (
                    <button
                        key={m.value}
                        type="button"
                        onClick={() => setLocalMode(m.value)}
                        className={`w-full text-left p-5 rounded-lg border-2 transition-all duration-200 ${
                            localMode === m.value
                                ? "border-primary bg-primary/5 dark:bg-primary/10"
                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                    >
                        <div className="flex items-start gap-4">
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                localMode === m.value
                                    ? "bg-primary/10 dark:bg-primary/20"
                                    : "bg-slate-100 dark:bg-slate-800"
                            }`}>
                                <m.icon className={`h-5 w-5 ${
                                    localMode === m.value
                                        ? "text-primary"
                                        : "text-slate-500 dark:text-slate-400"
                                }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{m.label}</span>
                                    {m.recommended && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wide">Recommended</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{m.description}</p>
                                <ul className="mt-2.5 space-y-1">
                                    {m.bullets.map((b) => (
                                        <li key={b} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                                            <Check className={`h-3 w-3 mt-0.5 flex-shrink-0 ${
                                                localMode === m.value ? "text-primary" : "text-slate-400 dark:text-slate-500"
                                            }`} />
                                            {b}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                                localMode === m.value
                                    ? "border-primary"
                                    : "border-slate-400 dark:border-slate-500"
                            }`}>
                                {localMode === m.value && (
                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            <div className="flex items-start gap-3 px-4 py-2.5 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/20">
                <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    You can switch between modes or create groups at any time from the Groups page.
                </p>
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
                    className="flex-1 py-3 px-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                    Next
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

function RotationSettingsStep({ wizardData, setWizardData }: { wizardData: WizardData; setWizardData: (data: WizardData) => void }) {
    const { nextStep, previousStep } = useWizard();
    const [localRotationEnabled, setLocalRotationEnabled] = useState(wizardData.rotationEnabled);
    const [localIntervalHours, setLocalIntervalHours] = useState(wizardData.rotationIntervalHours);
    const [localMaxCollections, setLocalMaxCollections] = useState(wizardData.rotationMaxCollections);
    const [localStrategy, setLocalStrategy] = useState(wizardData.rotationStrategy);
    const [localVisHome, setLocalVisHome] = useState(wizardData.visibilityHome);
    const [localVisShared, setLocalVisShared] = useState(wizardData.visibilityShared);
    const [localVisRecommended, setLocalVisRecommended] = useState(wizardData.visibilityRecommended);

    const intervalPresets = [6, 12, 24];
    const [customInterval, setCustomInterval] = useState(!intervalPresets.includes(wizardData.rotationIntervalHours));

    const strategyChoices: { value: string; label: string; description: string; icon: LucideIcon }[] = [
        { value: "random", label: "Random", description: "Pick collections at random each rotation", icon: Shuffle },
        { value: "weighted", label: "Weighted", description: "Pick collections using group weights from Groups settings.", icon: Scale },
        { value: "lru", label: "Least Recently Used", description: "Prioritize collections that haven't been shown recently", icon: RotateCcw },
    ];

    const handleNext = () => {
        setWizardData({
            ...wizardData,
            rotationEnabled: localRotationEnabled,
            rotationIntervalHours: localIntervalHours,
            rotationMaxCollections: localMaxCollections,
            rotationStrategy: localStrategy,
            rotationAllowRepeats: false,
            visibilityHome: localVisHome,
            visibilityShared: localVisShared,
            visibilityRecommended: localVisRecommended,
        });
        nextStep();
    };

    const visibilityOptions = [
        { label: "Your Home", description: "Show on server admin's Home page", icon: Home, checked: localVisHome, onChange: setLocalVisHome },
        { label: "Shared Users", description: "Show on shared users' Home pages", icon: Users, checked: localVisShared, onChange: setLocalVisShared },
        { label: "Recommended", description: "Show in Library Recommended section", icon: Star, checked: localVisRecommended, onChange: setLocalVisRecommended },
    ];

    const scheduleChoices: { value: boolean; label: string; description: string; icon: LucideIcon; recommended?: boolean }[] = [
        {
            value: true,
            label: "Schedule Rotations",
            description: "Automatically rotate collections on a timer",
            icon: Clock,
            recommended: true,
        },
        {
            value: false,
            label: "Rotate Manually",
            description: "Only rotate when you trigger it yourself",
            icon: Hand,
        },
    ];

    return (
        <div className="space-y-6 ">
            <StepProgress step={5} label="Rotation Schedule" />
            <p className="text-sm text-slate-600 dark:text-slate-400 -mt-4">
                {wizardData.rotationMode === "auto_rotate"
                    ? "Choose how and when your collections rotate on the homescreen"
                    : "Choose how and when your collection groups rotate on the homescreen"}
            </p>

            <div className="grid grid-cols-2 gap-3">
                {scheduleChoices.map((choice) => (
                    <button
                        key={String(choice.value)}
                        type="button"
                        onClick={() => setLocalRotationEnabled(choice.value)}
                        className={`text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                            localRotationEnabled === choice.value
                                ? "border-primary bg-primary/5 dark:bg-primary/10"
                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                localRotationEnabled === choice.value
                                    ? "bg-primary/10 dark:bg-primary/20"
                                    : "bg-slate-100 dark:bg-slate-800"
                            }`}>
                                <choice.icon className={`h-4.5 w-4.5 ${
                                    localRotationEnabled === choice.value
                                        ? "text-primary"
                                        : "text-slate-500 dark:text-slate-400"
                                }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{choice.label}</span>
                                    {choice.recommended && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wide">Recommended</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{choice.description}</p>
                            </div>
                            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                localRotationEnabled === choice.value
                                    ? "border-primary"
                                    : "border-slate-400 dark:border-slate-500"
                            }`}>
                                {localRotationEnabled === choice.value && (
                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            <div className="space-y-5">
                {/* Interval (collapses when rotation disabled) */}
                <Transition
                    show={localRotationEnabled}
                    enter="transition-all duration-300 ease-out overflow-hidden"
                    enterFrom="opacity-0 max-h-0 -translate-y-2"
                    enterTo="opacity-100 max-h-40 translate-y-0"
                    leave="transition-all duration-250 ease-in overflow-hidden"
                    leaveFrom="opacity-100 max-h-40 translate-y-0"
                    leaveTo="opacity-0 max-h-0 -translate-y-2"
                >
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Rotation interval
                        </label>
                        <div className="flex gap-1.5">
                            {intervalPresets.map((hours) => (
                                <button
                                    key={hours}
                                    type="button"
                                    onClick={() => { setLocalIntervalHours(hours); setCustomInterval(false); }}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-all duration-200 ${
                                        !customInterval && localIntervalHours === hours
                                            ? "border-primary bg-primary/5 dark:bg-primary/10 text-primary"
                                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                                    }`}
                                >
                                    {hours}h
                                </button>
                            ))}
                            {customInterval ? (
                                <div className="flex-1 relative">
                                    <input
                                        type="number"
                                        min={1}
                                        autoFocus
                                        value={localIntervalHours}
                                        onChange={(e) => setLocalIntervalHours(Math.max(1, parseInt(e.target.value) || 1))}
                                        onBlur={() => { if (intervalPresets.includes(localIntervalHours)) setCustomInterval(false); }}
                                        className="w-full py-2.5 px-3 pr-8 rounded-lg text-sm font-medium border-2 border-primary bg-primary/5 dark:bg-primary/10 text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary/60 pointer-events-none">hours</span>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setCustomInterval(true)}
                                    className="flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-all duration-200 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                                >
                                    Custom
                                </button>
                            )}
                            </div>
                    </div>
                </Transition>

                {/* Max collections */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Max collections
                        </label>
                        <span className="text-sm font-semibold text-primary tabular-nums">
                            {localMaxCollections}
                        </span>
                    </div>
                    <Slider
                        min={1}
                        max={20}
                        step={1}
                        value={[localMaxCollections]}
                        onValueChange={([val]) => setLocalMaxCollections(val)}
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-600 mt-1.5">
                        <span>1</span>
                        <span>5</span>
                        <span>10</span>
                        <span>15</span>
                        <span>20</span>
                    </div>
                </div>

                {/* Strategy */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Selection strategy
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {strategyChoices.map((choice) => (
                            <button
                                key={choice.value}
                                type="button"
                                onClick={() => setLocalStrategy(choice.value)}
                                className={`text-left p-3 rounded-lg border-2 transition-all duration-200 ${
                                    localStrategy === choice.value
                                        ? "border-primary bg-primary/5 dark:bg-primary/10"
                                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    <choice.icon className={`h-4 w-4 ${
                                        localStrategy === choice.value ? "text-primary" : "text-slate-400 dark:text-slate-500"
                                    }`} />
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{choice.label}</span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{choice.description}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Info banner */}
                <Transition
                    show={localRotationEnabled}
                    enter="transition-all duration-300 ease-out overflow-hidden"
                    enterFrom="opacity-0 max-h-0 -translate-y-2"
                    enterTo="opacity-100 max-h-20 translate-y-0"
                    leave="transition-all duration-250 ease-in overflow-hidden"
                    leaveFrom="opacity-100 max-h-20 translate-y-0"
                    leaveTo="opacity-0 max-h-0 -translate-y-2"
                >
                    <div className="flex items-start gap-3 px-4 py-2.5 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/20">
                        <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Your homescreen will rotate up to <span className="font-semibold text-primary">{localMaxCollections} collection{localMaxCollections !== 1 ? "s" : ""}</span> every <span className="font-semibold text-primary">{localIntervalHours} hour{localIntervalHours !== 1 ? "s" : ""}</span> ({Math.floor(24 / localIntervalHours)}x per day).
                        </p>
                    </div>
                </Transition>
            </div>

            {wizardData.rotationMode === "auto_rotate" && (
                <div>
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Where should collections appear?
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        {visibilityOptions.map((opt) => (
                            <button
                                key={opt.label}
                                type="button"
                                onClick={() => opt.onChange(!opt.checked)}
                                className={`p-3 rounded-lg border-2 transition-all duration-200 text-center ${
                                    opt.checked
                                        ? "border-primary bg-primary/5 dark:bg-primary/10"
                                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                }`}
                            >
                                <opt.icon className={`h-4 w-4 mx-auto mb-1.5 ${
                                    opt.checked ? "text-primary" : "text-slate-400 dark:text-slate-500"
                                }`} />
                                <div className="text-xs font-medium text-slate-900 dark:text-white">{opt.label}</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{opt.description}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

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
                    className="flex-1 py-3 px-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                    Next
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

function CompleteStep({ wizardData, envVars }: { wizardData: WizardData; envVars: EnvVars }) {
    const navigate = useNavigate();
    const { refreshAuthConfig } = useAuth();
    const { accent } = useTheme();
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
                    libraries: wizardData.selectedLibraries,
                    auth_enabled: wizardData.authEnabled,
                    auth_method: wizardData.authMethod,
                    auth_username: wizardData.authUsername,
                    auth_password: wizardData.authPassword,
                    rotation_enabled: wizardData.rotationEnabled,
                    rotation_interval_hours: wizardData.rotationIntervalHours,
                    rotation_max_collections: wizardData.rotationMaxCollections,
                    rotation_strategy: wizardData.rotationStrategy,
                    rotation_allow_repeats: wizardData.rotationAllowRepeats,
                    rotation_mode: wizardData.rotationMode,
                    visibility_home: wizardData.visibilityHome,
                    visibility_shared: wizardData.visibilityShared,
                    visibility_recommended: wizardData.visibilityRecommended,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || "Setup failed");
            }

            await refreshAuthConfig();
            navigate("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Setup failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 ">
            <StepProgress step={6} label="Review & Complete" />
            <div className="text-center space-y-2 -mt-4">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto">
                    <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">You're all set!</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Review your configuration and complete setup
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {/* Theme */}
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 mb-1.5">
                        <Palette className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Theme</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {accent === "plex-orange" ? "Plex Orange" : "Default Blue"}
                    </p>
                </div>
                {/* Plex Server */}
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 mb-1.5">
                        <Server className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Plex Server</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {wizardData.plexUrl || envVars.plex_url_value || "Via environment"}
                    </p>
                </div>
                {/* Libraries */}
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 mb-1.5">
                        <Layers className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Libraries</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {wizardData.selectedLibraries.length} selected
                    </p>
                </div>
                {/* Authentication */}
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 mb-1.5">
                        <Shield className="h-4 w-4 text-green-500" />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Authentication</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {wizardData.authMethod === "password" ? `Password (${wizardData.authUsername})` :
                         wizardData.authMethod === "plex" ? "Plex SSO" :
                         "Password + Plex"}
                    </p>
                </div>
                {/* Rotation Mode */}
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 mb-1.5">
                        <RefreshCw className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Rotation Mode</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {wizardData.rotationMode === "auto_rotate" ? "Auto-Rotate" : "Collection Groups"}
                    </p>
                </div>
                {/* Schedule & Strategy */}
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 mb-1.5">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Schedule</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {wizardData.rotationEnabled
                            ? `Every ${wizardData.rotationIntervalHours}h, ${wizardData.rotationStrategy === "lru" ? "LRU" : wizardData.rotationStrategy.charAt(0).toUpperCase() + wizardData.rotationStrategy.slice(1)}`
                            : "Manual only"}
                    </p>
                </div>

            </div>

            <div className="p-4 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/20">
                <div className="flex gap-3">
                    <Plug className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-primary">
                            Connect integrations after setup
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Trakt, MDBList, TMDb, Letterboxd, Tautulli, Seerr, and more can be configured from the Lists and Settings pages.
                        </p>
                    </div>
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
                className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
