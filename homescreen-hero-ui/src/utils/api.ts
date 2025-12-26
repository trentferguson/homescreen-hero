// Helper function to make authenticated API calls
export async function fetchWithAuth(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    const token = localStorage.getItem("auth_token");

    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
    };

    // Add Authorization header if token exists
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("username");
        window.location.href = "/login";
    }

    return response;
}
