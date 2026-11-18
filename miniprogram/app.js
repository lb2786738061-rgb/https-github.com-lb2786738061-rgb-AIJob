App({
  globalData: {
    apiBase: "http://localhost:3002/api/v1",
    token: "",
  },
  onLaunch() {
    const token = wx.getStorageSync("careerai_token");
    if (token) this.globalData.token = token;
  },
});
