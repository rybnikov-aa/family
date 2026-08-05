const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

export interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
  environment: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  return res.json() as Promise<HealthResponse>;
}

export interface VpsServiceStatus {
  name: string;
  type: string;
  address: string;
  online: boolean;
  latencyMs: number | null;
  error: string | null;
}

export interface VpsStatus {
  country: string;
  name: string;
  ip: string;
  panel: string;
  services: VpsServiceStatus[];
  online: boolean;
  latencyMs: number | null;
  error: string | null;
  checkedAt: string;
}

export async function fetchVps(): Promise<VpsStatus[]> {
  const res = await fetch(`${API_BASE}/vps`);
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  return res.json() as Promise<VpsStatus[]>;
}
