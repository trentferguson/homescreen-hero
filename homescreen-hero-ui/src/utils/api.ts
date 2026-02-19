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

    // 401 = invalid/expired token, 403 = account removed or pending
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("username");
        localStorage.removeItem("role");
        localStorage.removeItem("thumb");
        window.location.href = "/login";
    }

    return response;
}
