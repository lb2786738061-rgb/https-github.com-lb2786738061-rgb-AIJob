<template>
  <view class="container">
    <text class="title">职赢AI</text>
    <text class="subtitle">AI求职与模拟面试官</text>

    <view v-if="loggedIn" class="user-bar">
      <text>你好，{{ userName }}</text>
      <text class="logout" @tap="logout">退出</text>
    </view>
    <view v-else class="user-bar">
      <text>未登录</text>
      <text class="login" @tap="goLogin">登录/注册</text>
    </view>

    <view class="cards">
      <view
        v-for="item in features"
        :key="item.title"
        class="card"
        @tap="go(item.path)"
      >
        <text class="card-title">{{ item.title }}</text>
        <text class="card-desc">{{ item.desc }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "@/utils/api";
import { clearToken, getToken, requireLogin, toast } from "@/utils/auth";

const loggedIn = ref(false);
const userName = ref("");
const features = [
  { title: "免登录体检速测", path: "/pages/guest/diagnose", desc: "粘贴文本立即体验 1 次快速简历体检" },
  { title: "简历工作台", path: "/pages/resume/resume", desc: "上传解析 · 个人优势/经历编辑 · AI诊断" },
  { title: "模拟面试", path: "/pages/interview/interview", desc: "按简历与岗位出题 · 支持换一题" },
  { title: "弱题复盘", path: "/pages/practice/drill", desc: "错题对照练习 · 再次评估 · 下次再考偏好" },
  { title: "名企冲刺", path: "/pages/enterprise/enterprise", desc: "大厂真题训练" },
  { title: "升级会员", path: "/pages/pricing/pricing", desc: "月卡/季卡/冲刺包" },
];

onShow(() => {
  const token = getToken();
  if (!token) {
    loggedIn.value = false;
    userName.value = "";
    return;
  }
  api
    .getMe()
    .then((res) => {
      loggedIn.value = true;
      userName.value = res.user.displayName || res.user.email;
    })
    .catch(() => {
      clearToken();
      loggedIn.value = false;
      userName.value = "";
    });
});

function goLogin() {
  uni.navigateTo({ url: "/pages/login/login" });
}

function logout() {
  clearToken();
  loggedIn.value = false;
  userName.value = "";
  toast("已退出");
}

function go(path: string) {
  if (!requireLogin()) return;
  uni.navigateTo({ url: path });
}
</script>

<style lang="scss">
.container {
  padding: 40rpx;
}
.title {
  font-size: 48rpx;
  font-weight: bold;
  display: block;
}
.subtitle {
  color: #666;
  font-size: 28rpx;
  margin: 12rpx 0 40rpx;
  display: block;
}
.user-bar {
  display: flex;
  justify-content: space-between;
  padding: 20rpx;
  background: #f0f7ff;
  border-radius: 12rpx;
  margin-bottom: 30rpx;
  font-size: 28rpx;
}
.login,
.logout {
  color: #2563eb;
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16rpx;
  padding: 32rpx;
}
.card-title {
  font-size: 34rpx;
  font-weight: 600;
  display: block;
}
.card-desc {
  color: #666;
  font-size: 26rpx;
  margin-top: 8rpx;
  display: block;
}
</style>
