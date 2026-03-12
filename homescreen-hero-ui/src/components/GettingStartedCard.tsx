import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, List, Layers, Play, SlidersHorizontal, X, Rocket } from "lucide-react";
import { useOnboarding, type OnboardingStep } from "../utils/onboarding";

type StepDef = {
    id: OnboardingStep;
    title: string;
    description: string;
    ctaLabel: string;
    action: "navigate" | "run-rotation" | "edit-mode";
    route?: string;
};

const steps: StepDef[] = [
    {
        id: "add-list-source",
        title: "Add a list source",
        description: "Connect Trakt, MDBList, TMDb, or Letterboxd to sync external lists.",
        ctaLabel: "Browse Lists",
        action: "navigate",
        route: "/lists",
    },
    {
        id: "create-group",
        title: "Create a collection group",
        description: "Organize collections into rotation groups for your homescreen.",
        ctaLabel: "Create Group",
        action: "navigate",
        route: "/groups",
    },
    {
        id: "run-rotation",
        title: "Run your first rotation",
        description: "See your Plex homescreen update in action.",
        ctaLabel: "Run Rotation",
        action: "run-rotation",
    },
    {
        id: "customize-dashboard",
        title: "Customize your dashboard",
        description: "Drag, reorder, and toggle widgets to make it yours.",
        ctaLabel: "Try Edit Mode",
        action: "edit-mode",
    },
];

const stepIcons: Record<OnboardingStep, typeof List> = {
    "add-list-source": List,
    "create-group": Layers,
    "run-rotation": Play,
    "customize-dashboard": SlidersHorizontal,
};

type Props = {
    onRunRotation: () => void;
    onToggleEditMode: () => void;
};

export default function GettingStartedCard({ onRunRotation, onToggleEditMode }: Props) {
    const { active, completed, completedCount, totalSteps, dismiss, recheckProgress } = useOnboarding();
    const navigate = useNavigate();

    // Re-check list sources and groups each time the dashboard mounts
    useEffect(() => {
        recheckProgress();
    }, [recheckProgress]);

    if (!active) return null;

    const handleAction = (step: StepDef) => {
        if (step.action === "navigate" && step.route) {
            navigate(step.route);
        } else if (step.action === "run-rotation") {
            onRunRotation();
        } else if (step.action === "edit-mode") {
            onToggleEditMode();
        }
    };

    const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

    return (
        <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-slate-900/50 to-slate-900/50 shadow-lg shadow-primary/5">
            {/* Dismiss button */}
            <button
                onClick={dismiss}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors z-10"
                title="Dismiss getting started"
            >
                <X size={16} />
            </button>

            <div className="p-5 pb-4">
                {/* Header */}
                <div className="flex items-center gap-2.5 mb-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                        <Rocket size={18} className="text-primary" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white">Getting Started</h3>
                        <p className="text-xs text-slate-400">{completedCount} of {totalSteps} complete</p>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-slate-800 mb-5 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Steps */}
                <div className="space-y-2">
                    {steps.map((step) => {
                        const done = completed[step.id];
                        const Icon = stepIcons[step.id];

                        return (
                            <div
                                key={step.id}
                                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                                    done
                                        ? "bg-slate-800/30"
                                        : "bg-slate-800/50 hover:bg-slate-800/70"
                                }`}
                            >
                                {/* Checkbox */}
                                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                                    done
                                        ? "bg-primary text-white"
                                        : "border-2 border-slate-600 text-transparent"
                                }`}>
                                    {done && <Check size={14} strokeWidth={3} />}
                                </div>

                                {/* Icon */}
                                <Icon size={16} className={done ? "text-slate-500" : "text-slate-400"} />

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${done ? "text-slate-500 line-through" : "text-slate-200"}`}>
                                        {step.title}
                                    </p>
                                    {!done && (
                                        <p className="text-xs text-slate-400 mt-0.5">{step.description}</p>
                                    )}
                                </div>

                                {/* CTA */}
                                {!done && (
                                    <button
                                        onClick={() => handleAction(step)}
                                        className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors"
                                    >
                                        {step.ctaLabel}
                                        <ChevronRight size={14} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
