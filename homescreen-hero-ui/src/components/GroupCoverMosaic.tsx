import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";

interface GroupCoverMosaicProps {
    collections: string[];
}

export default function GroupCoverMosaic({ collections }: GroupCoverMosaicProps) {
    const [posters, setPosters] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPosters = async () => {
            if (!collections || collections.length === 0) {
                setLoading(false);
                return;
            }

            try {
                const collectionNames = collections.join(',');
                const response = await fetchWithAuth(`/api/collections/group-posters?collection_names=${encodeURIComponent(collectionNames)}`);
                if (response.ok) {
                    const data = await response.json();
                    setPosters(data.posters || []);
                }
            } catch (error) {
                console.error("Failed to fetch group posters:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPosters();
    }, [collections]);

    if (loading || !posters || posters.length === 0) {
        // Return null to let the parent show the gradient fallback
        return null;
    }

    return (
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
            {/* Poster Grid - 1 row */}
            <div className="flex gap-1 h-full">
                {posters.slice(0, 6).map((poster, index) => (
                    <div
                        key={index}
                        className="flex-1 overflow-hidden opacity-40 animate-fade-in rounded-lg"
                        style={{
                            animationDelay: `${index * 0.1}s`,
                        }}
                    >
                        <img
                            src={poster}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    </div>
                ))}
            </div>

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-slate-900/70 to-slate-950/90 rounded-2xl" />
        </div>
    );
}
