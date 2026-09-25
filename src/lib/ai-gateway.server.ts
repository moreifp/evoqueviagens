const RUN_ID = "X-Lovable-AIG-Run-ID";

export function gatewayFetch(initial?: string) {
  let runId = initial?.trim() || undefined;
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set(RUN_ID, runId);
      const response = await fetch(input, { ...init, headers });
      runId ??= response.headers.get(RUN_ID)?.trim() || undefined;
      return response;
    },
  };
}
