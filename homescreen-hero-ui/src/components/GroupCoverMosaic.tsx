import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/api";

interface GroupCoverMosaicProps {
    collections: string[];
}

export default function GroupCoverMosaic({ collections }: GroupCoverMosaicProps) {
    const [posters, setPosters] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [imagesLoaded, setImagesLoaded] = useState(false);
    const [isFirstLoad, setIsFirstLoad] = useState(false);

    useEffect(() => {
        const fetchPosters = async () => {
            if (!collections || collections.length === 0) {
                setLoading(false);
                return;
            }

            const collectionNames = collections.join(',');
            const cacheKey = `group-posters-${collectionNames}`;

            // Check sessionStorage for cached posters
            const cachedData = sessionStorage.getItem(cacheKey);
            if (cachedData) {
                try {
                    const cached = JSON.parse(cachedData);
                    const posterUrls = cached.posters || [];

                    // Preload images before showing them
                    const allLoaded = await preloadImages(posterUrls);

                    if (allLoaded) {
                        setPosters(posterUrls);
                        setIsFirstLoad(false);
                        setImagesLoaded(true);
                        setLoading(false);
                        return;
                    }
                    // If images failed to load (expired backend cache), clear cache and re-fetch
                    sessionStorage.removeItem(cacheKey);
                } catch (error) {
                    console.error("Failed to parse cached posters:", error);
                    sessionStorage.removeItem(cacheKey);
                }
            }

            // If no cache, fetch from API
            try {
                const response = await fetchWithAuth(`/api/collections/group-posters?collection_names=${encodeURIComponent(collectionNames)}`);
                if (response.ok) {
                    const data = await response.json();
                    const posterUrls = data.posters || [];

                    // Cache the result
                    sessionStorage.setItem(cacheKey, JSON.stringify(data));

                    // Preload images before showing them
                    await preloadImages(posterUrls);

                    setPosters(posterUrls);
                    setIsFirstLoad(true);
                    setImagesLoaded(true);
                }
            } catch (error) {
                console.error("Failed to fetch group posters:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPosters();
    }, [collections]);

    // Preload all images before rendering
    // Returns true if all images loaded successfully, false if any failed (expired cache)
    const preloadImages = (imageUrls: string[]): Promise<boolean> => {
        return new Promise((resolve) => {
            if (!imageUrls || imageUrls.length === 0) {
                resolve(true);
                return;
            }

            let hasError = false;
            const imagePromises = imageUrls.slice(0, 6).map((url) => {
                return new Promise<void>((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve();
                    img.onerror = () => {
                        hasError = true;
                        resolve();
                    };
                    img.src = url;
                });
            });

            Promise.all(imagePromises).then(() => resolve(!hasError));
        });
    };

    if (loading || !imagesLoaded || !posters || posters.length === 0) {
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
                        className={`flex-1 overflow-hidden opacity-40 rounded-lg ${isFirstLoad ? 'animate-fade-in' : ''}`}
                        style={isFirstLoad ? {
                            animationDelay: `${index * 0.1}s`,
                        } : undefined}
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
