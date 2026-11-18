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
  { title: "简历诊断", path: "/pages/resume/resume", desc: "上传简历 AI 分析" },
  { title: "模拟面试", path: "/pages/interview/interview", desc: "多角色全真模拟" },
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
