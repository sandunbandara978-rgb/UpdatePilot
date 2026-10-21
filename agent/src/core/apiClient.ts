export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PairResponseData {
  deviceId: string;
  token: string;
  pollingIntervalSec: number;
}

export interface PollJobResponseData {
  job: {
    id: string;
    type: 'SCAN' | 'UPDATE';
    payload: {
      applicationId?: string;
      packageId?: string;
      currentVersion?: string;
      targetVersion?: string;
    };
  } | null;
}

export class AgentApiClient {
  private serverUrl: string;
  private token: string | null = null;

  constructor(serverUrl: string, token?: string) {
    this.serverUrl = serverUrl.replace(/\/+$/, '');
    this.token = token || null;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.serverUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errMsg = `HTTP Error ${res.status}: ${res.statusText}`;
      try {
        const body = (await res.json()) as ApiResponse;
        if (body.error?.message) {
          errMsg = body.error.message;
        }
      } catch {
        // Fallback to text status
      }
      throw new Error(errMsg);
    }

    const json = (await res.json()) as ApiResponse<T>;
    if (!json.success && json.error) {
      throw new Error(json.error.message);
    }

    return (json.data !== undefined ? json.data : (json as unknown as T)) as T;
  }

  async pair(
    pairingCode: string,
    deviceName: string,
    osVersion: string,
    agentVersion: string
  ): Promise<PairResponseData> {
    return this.request<PairResponseData>('/api/v1/devices/pair', {
      method: 'POST',
      body: JSON.stringify({
        pairingCode,
        deviceName,
        osVersion,
        agentVersion,
      }),
    });
  }

  async sendHeartbeat(osVersion?: string, agentVersion?: string): Promise<{ acknowledged: boolean }> {
    return this.request<{ acknowledged: boolean }>('/api/v1/agent/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        osVersion,
        agentVersion,
        status: 'ONLINE',
      }),
    });
  }

  async pollJobs(): Promise<PollJobResponseData> {
    return this.request<PollJobResponseData>('/api/v1/agent/jobs/poll', {
      method: 'GET',
    });
  }

  async claimJob(jobId: string): Promise<{ claimed: boolean }> {
    return this.request<{ claimed: boolean }>(`/api/v1/agent/jobs/${jobId}/claim`, {
      method: 'POST',
    });
  }

  async reportJob(
    jobId: string,
    report: {
      status: 'RUNNING' | 'VERIFYING' | 'COMPLETED' | 'FAILED' | 'RESTART_REQUIRED';
      exitCode?: number;
      logs?: string;
      verifiedVersion?: string;
      errorDetails?: string;
    }
  ): Promise<{ acknowledged: boolean }> {
    return this.request<{ acknowledged: boolean }>(`/api/v1/agent/jobs/${jobId}/report`, {
      method: 'POST',
      body: JSON.stringify(report),
    });
  }

  async submitScan(
    scanJobId: string,
    applications: Array<{
      name: string;
      packageId?: string;
      publisher?: string;
      installedVersion: string;
      availableVersion?: string;
      source?: string;
    }>
  ): Promise<{ acknowledged: boolean; appsSaved: number }> {
    return this.request<{ acknowledged: boolean; appsSaved: number }>('/api/v1/agent/scans/submit', {
      method: 'POST',
      body: JSON.stringify({
        scanJobId,
        applications,
      }),
    });
  }
}
