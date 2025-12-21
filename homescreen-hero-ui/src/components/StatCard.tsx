type Stat = { label: string; value: string; hint?: string | null };

export default function StatCard({ stat }: { stat: Stat }) {
    return (
        <div className="rounded-2xl bg-slate-800 p-4 shadow">
            <div className="text-slate-300 text-sm">{stat.label}</div>
            <div className="text-2xl font-bold mt-1">{stat.value}</div>
            {stat.hint ? <div className="text-slate-400 text-xs mt-2">{stat.hint}</div> : null}
        </div>
    );
}
