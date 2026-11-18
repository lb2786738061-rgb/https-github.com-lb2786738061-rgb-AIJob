const PLATFORM_API_URL =
  import.meta.env.VITE_PLATFORM_API_URL ?? "http://localhost:3001";
const PLATFORM_APP_ID =
  import.meta.env.VITE_PLATFORM_APP_ID ?? "f8a2c91e3d7b4a6f9e0c1d2b3a4f5e6d";

export type PlatformUser = {
  id: string;
  appId?: string;
  username: string;
  displayName?: string | null;
  userType?: string;
  status?: string;
};

export type MembershipTier = {
  code: string;
  name: string;
  level: number;
  priceAmount: number;
  currency: string;
  durationDays: number;
};

async function platformRequest<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-App-Id": PLATFORM_APP_ID,
    ...(options.headers as Record<string, string>),
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${PLATFORM_API_URL}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ message: res.statusText }))) as {
      message?: string;
      error?: string;
    };
    throw new Error(err.message ?? err.error ?? "Platform request failed");
  }
  return res.json() as Promise<T>;
}

export async function platformLogin(username: string, password: string) {
  return platformRequest<{ token: string; user: PlatformUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function platformRegister(
  username: string,
  password: string,
  displayName: string,
  email?: string
) {
  return platformRequest<{ token: string; user: PlatformUser }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password, displayName, email }),
  });
}

export async function platformMe(token: string) {
  return platformRequest<{
    user: PlatformUser;
    wallets: { walletType: string; balance: number }[];
    entitlements: {
      entitlementCode: string;
      status: string;
      endsAt?: string | null;
    }[];
  }>(`/apps/${PLATFORM_APP_ID}/me`, { token });
}

export async function platformMembershipTiers(token: string) {
  return platformRequest<{ tiers: MembershipTier[] }>(
    `/apps/${PLATFORM_APP_ID}/membership-tiers`,
    { token }
  );
}

export async function platformRedeem(token: string, code: string) {
  return platformRequest<{ ok?: boolean; message?: string }>(
    `/apps/${PLATFORM_APP_ID}/redeem`,
    {
      method: "POST",
      token,
      body: JSON.stringify({ code }),
    }
  );
}

export { PLATFORM_API_URL, PLATFORM_APP_ID };
