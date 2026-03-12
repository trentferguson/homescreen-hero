import { useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { useOnboarding, type OnboardingStep } from "../utils/onboarding";

type Props = {
    step: OnboardingStep;
    children: React.ReactNode;
};

export default function OnboardingHint({ step, children }: Props) {
    const { isStepActive } = useOnboarding();
    const [hidden, setHidden] = useState(false);

    if (hidden || !isStepActive(step)) return null;

    return (
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <Lightbulb size={16} className="flex-shrink-0 mt-0.5 text-primary" />
            <div className="flex-1 text-slate-300">{children}</div>
            <button
                onClick={() => setHidden(true)}
                className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-slate-200 transition-colors"
                title="Hide hint"
            >
                <X size={14} />
            </button>
        </div>
    );
}
