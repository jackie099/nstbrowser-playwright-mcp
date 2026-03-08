const API_KEY = process.env.NSTBROWSER_API_KEY!;
const BASE_URL =
  process.env.NSTBROWSER_API_ADDRESS || "http://localhost:8848/api/v2";

export interface NstResponse<T = any> {
  data: T;
  err: boolean;
  msg: string;
  code: number;
}

export interface CdpConnectionData {
  port: number;
  webSocketDebuggerUrl: string;
  profileId: string;
}

async function nstFetch<T = any>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    params?: Record<string, string | undefined>;
  } = {}
): Promise<NstResponse<T>> {
  const { method = "GET", body, params } = options;

  let url = `${BASE_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.set(key, value);
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return (await res.json()) as NstResponse<T>;
}

export async function connectToProfile(
  profileId: string,
  config?: Record<string, any>
): Promise<CdpConnectionData> {
  const res = await nstFetch<CdpConnectionData>(`/connect/${profileId}`, {
    params: config ? { config: JSON.stringify(config) } : undefined,
  });
  if (res.err) throw new Error(`NSTBrowser: ${res.msg}`);
  return res.data;
}

export async function connectOnce(
  config: Record<string, any>
): Promise<CdpConnectionData> {
  const res = await nstFetch<CdpConnectionData>("/connect", {
    params: { config: JSON.stringify(config) },
  });
  if (res.err) throw new Error(`NSTBrowser: ${res.msg}`);
  return res.data;
}

export async function getProfiles(
  params?: Record<string, string | undefined>
): Promise<NstResponse> {
  return nstFetch("/profiles", { params });
}

export async function getBrowsers(status?: string): Promise<NstResponse> {
  return nstFetch("/browsers", {
    params: status ? { status } : undefined,
  });
}
