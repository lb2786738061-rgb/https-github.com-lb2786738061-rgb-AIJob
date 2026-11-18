const TOKEN_KEY = "careerai_token";

export function errMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "请求失败";
}

export function getToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || "";
}

export function setToken(token: string): void {
  uni.setStorageSync(TOKEN_KEY, token);
}

export function clearToken(): void {
  uni.removeStorageSync(TOKEN_KEY);
}

export function requireLogin(): boolean {
  if (getToken()) return true;
  uni.showModal({
    title: "请先登录",
    content: "使用功能前需要登录账号",
    confirmText: "去登录",
    success(res) {
      if (res.confirm) uni.navigateTo({ url: "/pages/login/login" });
    },
  });
  return false;
}

export function toast(title: string): void {
  uni.showToast({ title, icon: "none" });
}
