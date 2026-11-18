const api = require("../../utils/api");

Page({
  data: {
    loggedIn: false,
    userName: "",
    features: [
      { title: "简历诊断", path: "/pages/resume/resume", desc: "上传简历 AI 分析" },
      { title: "模拟面试", path: "/pages/interview/interview", desc: "多角色全真模拟" },
      { title: "名企冲刺", path: "/pages/enterprise/enterprise", desc: "大厂真题训练" },
      { title: "升级会员", path: "/pages/pricing/pricing", desc: "月卡/季卡/冲刺包" },
    ],
  },
  onShow() {
    const token = api.getToken();
    if (!token) {
      this.setData({ loggedIn: false, userName: "" });
      return;
    }
    api
      .getMe()
      .then((res) => {
        this.setData({
          loggedIn: true,
          userName: res.user.displayName || res.user.email,
        });
      })
      .catch(() => {
        api.clearToken();
        this.setData({ loggedIn: false, userName: "" });
      });
  },
  goLogin() {
    wx.navigateTo({ url: "/pages/login/login" });
  },
  logout() {
    api.clearToken();
    this.setData({ loggedIn: false, userName: "" });
    wx.showToast({ title: "已退出", icon: "none" });
  },
  go(e) {
    if (!api.getToken()) {
      wx.showModal({
        title: "请先登录",
        content: "使用功能前需要登录账号",
        confirmText: "去登录",
        success(res) {
          if (res.confirm) wx.navigateTo({ url: "/pages/login/login" });
        },
      });
      return;
    }
    wx.navigateTo({ url: e.currentTarget.dataset.path });
  },
});
