const api = require("../../utils/api");

Page({
  data: {
    sessionId: null,
    report: null,
    session: null,
    loading: true,
  },
  onLoad(options) {
    const sessionId = options.sessionId;
    if (!sessionId) {
      wx.showToast({ title: "缺少会话 ID", icon: "none" });
      return;
    }
    this.setData({ sessionId });
    this.loadReport(sessionId);
  },
  loadReport(sessionId) {
    this.setData({ loading: true });
    api
      .getSession(sessionId)
      .then((data) => {
        const session = data.session;
        let report = null;
        if (session.reportJson) {
          try {
            report = typeof session.reportJson === "string"
              ? JSON.parse(session.reportJson)
              : session.reportJson;
          } catch (e) {
            report = null;
          }
        }
        if (!report && session.status !== "completed") {
          return api.endSession(sessionId, session.totalDurationSec || 60).then((ended) => {
            this.setData({
              session: ended.session,
              report: ended.report,
              loading: false,
            });
          });
        }
        this.setData({ session, report, loading: false });
      })
      .catch((err) => {
        wx.showToast({ title: err.message, icon: "none" });
        this.setData({ loading: false });
      });
  },
});
