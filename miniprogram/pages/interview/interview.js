const api = require("../../utils/api");

Page({
  data: {
    roles: [],
    industries: [],
    selectedRole: "",
    selectedIndustry: "",
    sessionId: null,
    messages: [],
    answer: "",
    loading: false,
    startedAt: 0,
  },
  onLoad(options) {
    api.getRoles().then((roles) => {
      const first = roles[0];
      this.setData({
        roles,
        selectedRole: first && first.id,
        selectedRoleName: (first && first.name) || "",
      });
    });
    api.getIndustries().then((industries) => this.setData({ industries }));

    if (options.sessionId) {
      const sessionId = parseInt(options.sessionId, 10);
      api.getSession(sessionId).then((data) => {
        this.setData({
          sessionId: data.session.id,
          messages: data.messages.map((m) => ({ role: m.role, content: m.content })),
          startedAt: new Date(data.session.startedAt).getTime() || Date.now(),
        });
      });
    }
  },
  onRoleChange(e) {
    const idx = Number(e.detail.value);
    const role = this.data.roles[idx];
    if (role) this.setData({ selectedRole: role.id, selectedRoleName: role.name });
  },
  onIndustryChange(e) {
    const idx = Number(e.detail.value);
    const industry = this.data.industries[idx];
    if (industry) {
      this.setData({ selectedIndustry: industry.id, selectedIndustryName: industry.name });
    }
  },
  onAnswer(e) {
    this.setData({ answer: e.detail.value });
  },
  start() {
    if (!this.data.selectedRole) return;
    this.setData({ loading: true });
    api
      .startSession({
        interviewerRole: this.data.selectedRole,
        industry: this.data.selectedIndustry || undefined,
        mode: "text",
      })
      .then((res) => {
        this.setData({
          sessionId: res.session.id,
          messages: [{ role: "assistant", content: res.openingQuestion }],
          startedAt: Date.now(),
        });
      })
      .catch((err) => wx.showToast({ title: err.message, icon: "none" }))
      .finally(() => this.setData({ loading: false }));
  },
  submit() {
    const { sessionId, answer, messages } = this.data;
    if (!sessionId || !answer.trim()) return;
    const userMsg = { role: "user", content: answer };
    this.setData({
      loading: true,
      messages: [...messages, userMsg],
      answer: "",
    });
    api
      .submitAnswer(sessionId, answer.trim())
      .then((res) => {
        const next = [...this.data.messages];
        if (res.nextQuestion) {
          next.push({ role: "assistant", content: res.nextQuestion });
        }
        this.setData({ messages: next });
        if (res.isComplete) {
          this.end();
        }
      })
      .catch((err) => wx.showToast({ title: err.message, icon: "none" }))
      .finally(() => this.setData({ loading: false }));
  },
  end() {
    const { sessionId, startedAt } = this.data;
    if (!sessionId) return;
    const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    api
      .endSession(sessionId, durationSec)
      .then(() => {
        wx.redirectTo({ url: "/pages/report/report?sessionId=" + sessionId });
      })
      .catch((err) => wx.showToast({ title: err.message, icon: "none" }));
  },
});
