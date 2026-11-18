const api = require("../../utils/api");

Page({
  data: {
    email: "",
    password: "",
    displayName: "",
    isRegister: false,
    loading: false,
  },
  onEmail(e) {
    this.setData({ email: e.detail.value });
  },
  onPassword(e) {
    this.setData({ password: e.detail.value });
  },
  onDisplayName(e) {
    this.setData({ displayName: e.detail.value });
  },
  toggleMode() {
    this.setData({ isRegister: !this.data.isRegister });
  },
  submit() {
    const { email, password, displayName, isRegister } = this.data;
    if (!email || !password) {
      wx.showToast({ title: "请填写邮箱和密码", icon: "none" });
      return;
    }
    this.setData({ loading: true });
    const action = isRegister
      ? api.register(email, password, displayName || email.split("@")[0])
      : api.login(email, password);
    action
      .then((res) => {
        api.setToken(res.token);
        wx.showToast({ title: isRegister ? "注册成功" : "登录成功", icon: "success" });
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch((err) => {
        wx.showToast({ title: err.message, icon: "none" });
      })
      .finally(() => this.setData({ loading: false }));
  },
});
