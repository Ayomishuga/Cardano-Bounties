const STORAGE_TOKEN_KEY = process.env.NEXT_PUBLIC_STORAGE_TOKEN_KEY!;

export async function authFetch(url: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_TOKEN_KEY) : null;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  return fetch(url, {
    ...options,
    headers: {
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
