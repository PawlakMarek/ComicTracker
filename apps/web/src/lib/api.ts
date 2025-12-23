const baseUrl = import.meta.env.VITE_API_URL || "";

const buildUrl = (path: string) => {
  if (path.startsWith("http")) return path;
  if (!baseUrl) return path;
  return `${baseUrl}${path}`;
};

export const apiFetch = async <T>(path: string, options: RequestInit = {}) => {
  const response = await fetch(buildUrl(path), {
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(errorData.error || "Request failed");
  }

  return (await response.json()) as T;
};

export const apiUpload = async <T>(path: string, formData: FormData) => {
  return apiFetch<T>(path, {
    method: "POST",
    body: formData
  });
};
