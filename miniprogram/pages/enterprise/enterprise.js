const api = require("../../utils/api");

Page({
  data: { companies: [], loading: null },
  onShow() {
    api.getEnterpriseCompanies().then((list) => this.setData({ companies: list }));
  },
  start(e) {
    const companyId = e.currentTarget.dataset.id;
    this.setData({ loading: companyId });
    api
      .startEnterpriseSession({ companyId })
      .then((res) => {
        wx.navigateTo({
          url: "/pages/interview/interview?sessionId=" + res.session.id,
        });
      })
      .catch((err) => wx.showToast({ title: err.message, icon: "none" }))
      .finally(() => this.setData({ loading: null }));
  },
});
