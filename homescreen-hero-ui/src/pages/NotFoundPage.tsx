import { Link, useRouteError } from "react-router-dom";

export default function NotFoundPage() {
    const error = useRouteError() as any;

    return (
        <div style={{ padding: "2rem" }}>
            <h1>404 – Page Not Found</h1>
            <p>The page you’re looking for doesn’t exist.</p>

            {error?.status && (
                <p style={{ opacity: 0.6 }}>Status: {error.status}</p>
            )}

            <Link to="/">← Back to Dashboard</Link>
        </div>
    );
}
