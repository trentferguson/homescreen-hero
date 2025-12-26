import { useEffect } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

type ToastProps = {
    message: string;
    type: "success" | "error";
    onClose: () => void;
    duration?: number;
};

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
            <div
                className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${type === "success"
                        ? "bg-green-600 text-white"
                        : "bg-red-600 text-white"
                    }`}
            >
                {type === "success" ? (
                    <CheckCircle size={20} />
                ) : (
                    <XCircle size={20} />
                )}
                <span className="font-medium">{message}</span>
                <button
                    onClick={onClose}
                    className="ml-2 hover:opacity-70 transition-opacity"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
}
