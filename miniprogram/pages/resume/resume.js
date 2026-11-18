const api = require("../../utils/api");

Page({
  data: {
    jd: "",
    targetJob: "",
    loading: false,
    result: null,
  },
  onJd(e) {
    this.setData({ jd: e.detail.value });
  },
  onTargetJob(e) {
    this.setData({ targetJob: e.detail.value });
  },
  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: "file",
      extension: ["pdf", "doc", "docx", "txt"],
      success: (res) => {
        const file = res.tempFiles[0];
        this.upload(file.path, file.name);
      },
      fail: () => {
        wx.showToast({ title: "请选择 PDF/Word/TXT 文件", icon: "none" });
      },
    });
  },
  upload(filePath, fileName) {
    this.setData({ loading: true, result: null });
    api
      .uploadResume(filePath, {
        resumeTitle: fileName || "我的简历",
        targetJobTitle: this.data.targetJob,
        jobDescription: this.data.jd,
      })
      .then((res) => {
        const diagnosis = res.diagnosis || {};
        const grammar = res.grammarCheck || {};
        this.setData({
          result: {
            scoreOverall: diagnosis.scoreOverall,
            scoreClarity: diagnosis.scoreClarity,
            scoreCompetitiveness: diagnosis.scoreCompetitiveness,
            scoreProfessionalism: diagnosis.scoreProfessionalism,
            scoreGrammar: grammar.scoreGrammar,
            grammarIssues: grammar.grammarIssues || [],
            report: diagnosis.diagnosisReport || "",
            matchPercentage: res.jdMatch && res.jdMatch.matchPercentage,
          },
        });
        wx.showToast({ title: "分析完成", icon: "success" });
      })
      .catch((err) => {
        wx.showToast({ title: err.message, icon: "none", duration: 3000 });
      })
      .finally(() => this.setData({ loading: false }));
  },
});
