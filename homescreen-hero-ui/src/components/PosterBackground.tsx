import { useEffect, useState } from "react";

interface PosterBackgroundProps {
    children: React.ReactNode;
}

export default function PosterBackground({ children }: PosterBackgroundProps) {
    const [posters, setPosters] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPosters = async () => {
            try {
                const response = await fetch("/api/auth/posters");
                if (response.ok) {
                    const data = await response.json();
                    setPosters(data.posters || []);
                }
            } catch (error) {
                console.error("Failed to fetch posters:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPosters();
    }, []);

    return (
        <div className="relative min-h-screen overflow-hidden">
            {/* Animated Poster Grid Background */}
            <div className="absolute inset-0 z-0">
                {!loading && posters.length > 0 && (
                    <div className="grid grid-cols-8 gap-4 p-4 animate-slow-pan">
                        {posters.map((poster, index) => (
                            <div
                                key={index}
                                className="aspect-[2/3] rounded-lg overflow-hidden opacity-20 dark:opacity-10 blur-sm animate-fade-in"
                                style={{
                                    animationDelay: `${index * 0.1}s`,
                                }}
                            >
                                <img
                                    src={poster}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50/95 to-slate-100/95 dark:from-slate-900/95 dark:to-slate-800/95" />
            </div>

            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}
