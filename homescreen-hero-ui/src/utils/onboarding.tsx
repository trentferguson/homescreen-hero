import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { fetchWithAuth } from "./api";

export type OnboardingStep =
    | "add-list-source"
    | "create-group"
    | "run-rotation"
    | "customize-dashboard";

const STEPS: OnboardingStep[] = [
    "add-list-source",
    "create-group",
    "run-rotation",
    "customize-dashboard",
];

type OnboardingState = {
    dismissed: boolean;
    completed: Record<OnboardingStep, boolean>;
};

const STORAGE_KEY = "onboarding";

const defaultState: OnboardingState = {
    dismissed: false,
    completed: {
        "add-list-source": false,
        "create-group": false,
        "run-rotation": false,
        "customize-dashboard": false,
    },
};

interface OnboardingContextType {
    initialized: boolean;
    active: boolean;
    dismissed: boolean;
    completed: Record<OnboardingStep, boolean>;
    completedCount: number;
    totalSteps: number;
    completeStep: (step: OnboardingStep) => void;
    dismiss: () => void;
    isStepActive: (step: OnboardingStep) => boolean;
    recheckProgress: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

function loadState(): OnboardingState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as OnboardingState;
    } catch {
        return null;
    }
}

function saveState(state: OnboardingState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<OnboardingState>(defaultState);
    const [initialized, setInitialized] = useState(false);

    // On mount, load from localStorage or detect from API
    useEffect(() => {
        const init = async () => {
            const stored = loadState();

            if (stored) {
                setState(stored);
                setInitialized(true);
                return;
            }

            // No stored state, detect from API whether this is a new or existing user
            try {
                const [groupsRes, sourcesRes, historyRes] = await Promise.all([
                    fetchWithAuth("/api/admin/config/groups"),
                    fetchWithAuth("/api/admin/config/group-sources"),
                    fetchWithAuth("/api/history/all?limit=1"),
                ]);

                const groups = groupsRes.ok ? await groupsRes.json() : [];
                const sources = sourcesRes.ok ? await sourcesRes.json() : {};
                const history = historyRes.ok ? await historyRes.json() : [];

                const hasGroups = Array.isArray(groups) && groups.length > 0;

                // Only check third-party sources, not plex (which always has collections)
                const thirdPartyKeys = ["trakt", "letterboxd", "mdblist", "tmdb", "anilist", "mal"];
                const hasSources = thirdPartyKeys.some((key) => {
                    const arr = (sources as Record<string, unknown[]>)[key];
                    return Array.isArray(arr) && arr.length > 0;
                });

                const hasHistory = Array.isArray(history) && history.length > 0;

                // Existing user: has groups AND rotation history
                if (hasGroups && hasHistory) {
                    const dismissed: OnboardingState = { ...defaultState, dismissed: true };
                    saveState(dismissed);
                    setState(dismissed);
                    setInitialized(true);
                    return;
                }

                // New-ish user, pre-populate any completed steps
                const newState: OnboardingState = {
                    dismissed: false,
                    completed: {
                        "add-list-source": hasSources,
                        "create-group": hasGroups,
                        "run-rotation": false,
                        "customize-dashboard": false,
                    },
                };

                saveState(newState);
                setState(newState);
            } catch (err) {
                console.error("Failed to detect onboarding state:", err);
                // On error, just show onboarding for new users
                saveState(defaultState);
            }

            setInitialized(true);
        };

        init();
    }, []);

    const completeStep = useCallback((step: OnboardingStep) => {
        setState((prev) => {
            if (prev.completed[step] || prev.dismissed) return prev;
            const next: OnboardingState = {
                ...prev,
                completed: { ...prev.completed, [step]: true },
            };
            saveState(next);
            return next;
        });
    }, []);

    const dismiss = useCallback(() => {
        setState((prev) => {
            const next: OnboardingState = { ...prev, dismissed: true };
            saveState(next);
            return next;
        });
    }, []);

    const isStepActive = useCallback(
        (step: OnboardingStep) => !state.dismissed && !state.completed[step],
        [state.dismissed, state.completed]
    );

    const recheckProgress = useCallback(async () => {
        if (state.dismissed) return;

        try {
            const [groupsRes, sourcesRes] = await Promise.all([
                fetchWithAuth("/api/admin/config/groups"),
                fetchWithAuth("/api/admin/config/group-sources"),
            ]);

            const groups = groupsRes.ok ? await groupsRes.json() : [];
            const sources = sourcesRes.ok ? await sourcesRes.json() : {};

            const hasGroups = Array.isArray(groups) && groups.length > 0;
            const thirdPartyKeys = ["trakt", "letterboxd", "mdblist", "tmdb", "anilist", "mal"];
            const hasSources = thirdPartyKeys.some((key) => {
                const arr = (sources as Record<string, unknown[]>)[key];
                return Array.isArray(arr) && arr.length > 0;
            });

            setState((prev) => {
                let changed = false;
                const next = { ...prev, completed: { ...prev.completed } };

                if (hasSources && !prev.completed["add-list-source"]) {
                    next.completed["add-list-source"] = true;
                    changed = true;
                }
                if (hasGroups && !prev.completed["create-group"]) {
                    next.completed["create-group"] = true;
                    changed = true;
                }

                if (changed) {
                    saveState(next);
                    return next;
                }
                return prev;
            });
        } catch {
            // Silently ignore recheck failures
        }
    }, [state.dismissed]);

    const completedCount = STEPS.filter((s) => state.completed[s]).length;
    const allDone = completedCount === STEPS.length;
    const active = initialized && !state.dismissed && !allDone;

    const value: OnboardingContextType = {
        initialized,
        active,
        dismissed: state.dismissed,
        completed: state.completed,
        completedCount,
        totalSteps: STEPS.length,
        completeStep,
        dismiss,
        isStepActive,
        recheckProgress,
    };

    return (
        <OnboardingContext.Provider value={value}>
            {children}
        </OnboardingContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOnboarding() {
    const context = useContext(OnboardingContext);
    if (context === undefined) {
        throw new Error("useOnboarding must be used within an OnboardingProvider");
    }
    return context;
}
