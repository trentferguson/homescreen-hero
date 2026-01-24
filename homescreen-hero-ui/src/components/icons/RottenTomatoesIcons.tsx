type IconProps = {
    className?: string;
};

const RT_ICONS = {
    fresh: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Rotten_Tomatoes.svg",
    rotten: "https://upload.wikimedia.org/wikipedia/commons/5/52/Rotten_Tomatoes_rotten.svg",
    audienceFresh: "https://upload.wikimedia.org/wikipedia/commons/d/da/Rotten_Tomatoes_positive_audience.svg",
    audienceRotten: "https://upload.wikimedia.org/wikipedia/commons/6/63/Rotten_Tomatoes_negative_audience.svg",
};

// Fresh tomato icon - used for critic scores >= 60%
export function RTFreshIcon({ className = "h-4 w-4" }: IconProps) {
    return (
        <img
            src={RT_ICONS.fresh}
            alt="Fresh"
            className={className}
        />
    );
}

// Rotten (splat) tomato icon - used for critic scores < 60%
export function RTRottenIcon({ className = "h-4 w-4" }: IconProps) {
    return (
        <img
            src={RT_ICONS.rotten}
            alt="Rotten"
            className={className}
        />
    );
}

// Upright popcorn bucket - used for audience scores >= 60%
export function RTAudienceFreshIcon({ className = "h-4 w-4" }: IconProps) {
    return (
        <img
            src={RT_ICONS.audienceFresh}
            alt="Upright"
            className={className}
        />
    );
}

// Spilled popcorn bucket - used for audience scores < 60%
export function RTAudienceRottenIcon({ className = "h-4 w-4" }: IconProps) {
    return (
        <img
            src={RT_ICONS.audienceRotten}
            alt="Spilled"
            className={className}
        />
    );
}
