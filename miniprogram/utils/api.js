function getAppSafe() {
  return getApp();
}

function getToken() {
  const app = getAppSafe();
  return app.globalData.token || wx.getStorageSync("careerai_token") || "";
}

function setToken(token) {
  const app = getAppSafe();
  app.globalData.token = token;
  wx.setStorageSync("careerai_token", token);
}

function clearToken() {
  const app = getAppSafe();
  app.globalData.token = "";
  wx.removeStorageSync("careerai_token");
}

function getBaseUrl() {
  const app = getAppSafe();
  return app.globalData.apiBase || "http://localhost:3002/api/v1";
}

function request(path, options = {}) {
  const { method = "GET", data, header = {} } = options;
  const token = getToken();
  if (token) header.Authorization = "Bearer " + token;

  return new Promise((resolve, reject) => {
    wx.request({
      url: getBaseUrl() + path,
      method,
      data,
      header: {
        "Content-Type": "application/json",
        ...header,
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const err = (res.data && res.data.error) || "请求失败";
          reject(new Error(err));
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || "网络错误"));
      },
    });
  });
}

function uploadResume(filePath, formData) {
  const token = getToken();
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: getBaseUrl() + "/resumes/upload",
      filePath,
      name: "file",
      formData: formData || {},
      header: token ? { Authorization: "Bearer " + token } : {},
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(res.data));
          } catch (e) {
            reject(new Error("响应解析失败"));
          }
        } else {
          try {
            const body = JSON.parse(res.data);
            reject(new Error(body.error || "上传失败"));
          } catch (e) {
            reject(new Error("上传失败"));
          }
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || "上传失败"));
      },
    });
  });
}

module.exports = {
  getToken,
  setToken,
  clearToken,
  request,
  uploadResume,
  login: (email, password) =>
    request("/auth/login", { method: "POST", data: { email, password } }),
  register: (email, password, displayName) =>
    request("/auth/register", {
      method: "POST",
      data: { email, password, displayName },
    }),
  getMe: () => request("/user/me"),
  getRoles: () => request("/interviews/roles"),
  getIndustries: () => request("/interviews/industries"),
  getEnterpriseCompanies: () => request("/interviews/enterprise/companies"),
  startEnterpriseSession: (payload) =>
    request("/interviews/enterprise/sessions", { method: "POST", data: payload }),
  getSession: (sessionId) => request("/interviews/sessions/" + sessionId),
  startSession: (payload) =>
    request("/interviews/sessions", { method: "POST", data: payload }),
  submitAnswer: (sessionId, answer) =>
    request("/interviews/sessions/" + sessionId + "/answer", {
      method: "POST",
      data: { answer, messageType: "text" },
    }),
  endSession: (sessionId, durationSec) =>
    request("/interviews/sessions/" + sessionId + "/end", {
      method: "POST",
      data: { durationSec },
    }),
  getPaymentPlans: () => request("/payments/plans"),
  checkoutPlan: (planId) =>
    request("/payments/checkout", { method: "POST", data: { planId } }),
  confirmPayment: (orderId) =>
    request("/payments/confirm/" + orderId, { method: "POST" }),
};
