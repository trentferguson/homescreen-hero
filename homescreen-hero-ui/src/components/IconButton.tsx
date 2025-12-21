export default function IconButton({
    children,
    label,
    onClick,
}: {
    children: React.ReactNode;
    label: string;
    onClick?: () => void;
}) {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            title={label}
            className="
        text-slate-400
        hover:text-white
        transition-colors
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-emerald-500
        rounded-full
      "
        >
            {children}
        </button>
    );
}
