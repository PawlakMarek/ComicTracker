const baseUrl = "https://comicvine.gamespot.com/api";

const buildUrl = (path: string, params: Record<string, string>) => {
  const url = new URL(`${baseUrl}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
};

export const searchComicVine = async (apiKey: string, query: string, resource: string) => {
  const url = buildUrl("/search/", {
    api_key: apiKey,
    format: "json",
    query,
    resources: resource,
    limit: "20"
  });

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ComicTracker/1.0",
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`ComicVine search failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.error && data.error !== "OK") {
    throw new Error(`ComicVine error: ${data.error}`);
  }

  const results = data.results || [];
  if (resource === "publisher" && results.length === 0) {
    const fallbackUrl = buildUrl("/publishers/", {
      api_key: apiKey,
      format: "json",
      filter: `name:${query}`,
      limit: "20",
      field_list: "id,name,api_detail_url,deck,description"
    });
    const fallbackResponse = await fetch(fallbackUrl, {
      headers: {
        "User-Agent": "ComicTracker/1.0",
        Accept: "application/json"
      }
    });
    if (!fallbackResponse.ok) {
      throw new Error(`ComicVine publisher search failed: ${fallbackResponse.status}`);
    }
    const fallbackData = await fallbackResponse.json();
    if (fallbackData.error && fallbackData.error !== "OK") {
      throw new Error(`ComicVine error: ${fallbackData.error}`);
    }
    return fallbackData.results || [];
  }

  return results;
};

export const fetchComicVineDetail = async (apiKey: string, detailUrl: string) => {
  const url = new URL(detailUrl);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "ComicTracker/1.0",
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`ComicVine detail failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.error && data.error !== "OK") {
    throw new Error(`ComicVine error: ${data.error}`);
  }

  return data.results;
};

export const fetchComicVineIssuesForVolume = async (
  apiKey: string,
  volumeId: number,
  maxIssues = 200
) => {
  const limit = 100;
  let offset = 0;
  const urls: string[] = [];

  while (urls.length < maxIssues) {
    const url = buildUrl("/issues/", {
      api_key: apiKey,
      format: "json",
      filter: `volume:${volumeId}`,
      limit: String(limit),
      offset: String(offset),
      field_list: "id,api_detail_url"
    });

    const response = await fetch(url, {
      headers: {
        "User-Agent": "ComicTracker/1.0",
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`ComicVine issues fetch failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.error && data.error !== "OK") {
      throw new Error(`ComicVine error: ${data.error}`);
    }

    const results = data.results || [];
    results.forEach((item: any) => {
      if (item.api_detail_url) urls.push(item.api_detail_url);
    });

    offset += results.length;
    const total = Number(data.number_of_total_results || 0);
    if (!results.length || offset >= total) {
      break;
    }
  }

  return urls.slice(0, maxIssues);
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
