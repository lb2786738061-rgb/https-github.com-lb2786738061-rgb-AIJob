const api = require("../../utils/api");

Page({
  data: { plans: [], loading: null },
  onShow() {
    api.getPaymentPlans().then((res) => this.setData({ plans: res.plans || [] }));
  },
  buy(e) {
    const planId = e.currentTarget.dataset.id;
    this.setData({ loading: planId });
    api
      .checkoutPlan(planId)
      .then((checkout) => api.confirmPayment(checkout.order.id))
      .then(() => {
        wx.showToast({ title: "购买成功", icon: "success" });
      })
      .catch((err) => wx.showToast({ title: err.message, icon: "none" }))
      .finally(() => this.setData({ loading: null }));
  },
});
