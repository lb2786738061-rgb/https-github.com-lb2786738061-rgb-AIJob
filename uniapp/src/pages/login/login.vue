<template>
  <view class="container">
    <text class="title">{{ isRegister ? "注册账号" : "登录" }}</text>
    <input class="input" placeholder="邮箱" :value="email" @input="onEmail" />
    <input
      class="input"
      password
      placeholder="密码"
      :value="password"
      @input="onPassword"
    />
    <input
      v-if="isRegister"
      class="input"
      placeholder="昵称"
      :value="displayName"
      @input="onDisplayName"
    />
    <button class="btn" :loading="loading" @tap="submit">
      {{ isRegister ? "注册" : "登录" }}
    </button>
    <text class="link" @tap="toggleMode">
      {{ isRegister ? "已有账号？去登录" : "没有账号？去注册" }}
    </text>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api } from "@/utils/api";
import { errMessage, setToken, toast } from "@/utils/auth";

const email = ref("");
const password = ref("");
const displayName = ref("");
const isRegister = ref(false);
const loading = ref(false);

function onEmail(e: { detail: { value: string } }) {
  email.value = e.detail.value;
}
function onPassword(e: { detail: { value: string } }) {
  password.value = e.detail.value;
}
function onDisplayName(e: { detail: { value: string } }) {
  displayName.value = e.detail.value;
}
function toggleMode() {
  isRegister.value = !isRegister.value;
}

function submit() {
  if (!email.value || !password.value) {
    toast("请填写邮箱和密码");
    return;
  }
  loading.value = true;
  const action = isRegister.value
    ? api.register(
        email.value,
        password.value,
        displayName.value || email.value.split("@")[0]
      )
    : api.login(email.value, password.value);
  action
    .then((res) => {
      setToken(res.token);
      uni.showToast({
        title: isRegister.value ? "注册成功" : "登录成功",
        icon: "success",
      });
      setTimeout(() => {
        uni.navigateBack({
          fail: () => uni.reLaunch({ url: "/pages/index/index" }),
        });
      }, 500);
    })
    .catch((err) => toast(errMessage(err)))
    .finally(() => {
      loading.value = false;
    });
}
</script>

<style lang="scss">
.container {
  padding: 40rpx;
}
.title {
  font-size: 40rpx;
  font-weight: bold;
  display: block;
  margin-bottom: 40rpx;
}
.input {
  border: 1px solid #ddd;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 24rpx;
}
.btn {
  background: #2563eb;
  color: #fff;
  border-radius: 12rpx;
  margin-top: 20rpx;
}
.link {
  color: #2563eb;
  font-size: 28rpx;
  margin-top: 30rpx;
  display: block;
  text-align: center;
}
</style>
