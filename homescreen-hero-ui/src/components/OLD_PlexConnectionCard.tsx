type Props = {
    ok?: boolean;
    error?: string | null;
};

export default function PlexConnectionCard({ ok, error }: Props) {
    const statusText = ok ? "Online" : "Offline";
    const subText = ok ? "Secure Connection" : (error || "Connection Issue");

    return (
        <div className="relative overflow-hidden rounded-2xl bg-card-dark border border-slate-800 shadow-sm p-5 h-32">
            {/* subtle inner highlight */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />

            <div className="relative h-full flex items-center justify-between">
                {/* Left text block */}
                <div className="flex flex-col justify-center">
                    <div className="text-slate-400 text-sm font-medium">Evee-Server</div>

                    <div className="mt-2 text-4xl font-extrabold tracking-tight text-white leading-none">
                        {statusText}
                    </div>

                    <div
                        className={
                            ok
                                ? "mt-3 text-emerald-400 text-lg font-semibold"
                                : "mt-3 text-amber-300 text-lg font-semibold"
                        }
                    >
                        {subText}
                    </div>
                </div>

                {/* Right icon block (narrower + tucked) */}
                <div className="relative w-14 h-14 flex items-center justify-center shrink-0 ml-4">
                    {/* Green status dot */}
                    <div className="absolute -top-1 -right-1 z-10">
                        <div
                            className={[
                                "w-4 h-4 rounded-full",
                                ok ? "bg-emerald-400" : "bg-amber-400",
                                ok
                                    ? "shadow-[0_0_16px_rgba(52,211,153,0.65)]"
                                    : "shadow-[0_0_16px_rgba(251,191,36,0.55)]",
                            ].join(" ")}
                        />
                    </div>

                    {/* Server icon */}
                    <div className="relative">
                        <div className="w-11 h-8 rounded-lg bg-slate-800/70 border border-slate-700/60" />
                        <div className="w-11 h-8 rounded-lg bg-slate-800/70 border border-slate-700/60 mt-2" />

                        <div className="absolute left-2 top-2.5 w-2 h-2 rounded-full bg-slate-700" />
                        <div className="absolute left-6 top-2.5 w-2 h-2 rounded-full bg-slate-700" />
                        <div className="absolute left-2 top-[2.85rem] w-2 h-2 rounded-full bg-slate-700" />
                        <div className="absolute left-6 top-[2.85rem] w-2 h-2 rounded-full bg-slate-700" />
                    </div>
                </div>


            </div>
        </div>
    );
}
