<template>
  <view class="container">
    <view class="tab-header">
      <text
        :class="['tab-item', loginMode === 'sms' ? 'active' : '']"
        @tap="loginMode = 'sms'"
      >
        手机验证码
      </text>
      <text
        :class="['tab-item', loginMode === 'password' ? 'active' : '']"
        @tap="loginMode = 'password'"
      >
        账号密码
      </text>
    </view>

    <!-- 短信登录模式 -->
    <view v-if="loginMode === 'sms'" class="form-body">
      <input
        class="input"
        type="number"
        maxlength="11"
        placeholder="请输入11位手机号码"
        :value="phone"
        @input="onPhone"
      />
      <view class="sms-row">
        <input
          class="input sms-input"
          type="number"
          maxlength="6"
          placeholder="6位验证码"
          :value="smsCode"
          @input="onSmsCode"
        />
        <button
          class="sms-btn"
          :disabled="countdown > 0 || smsSending"
          @tap="sendSms"
        >
          {{ countdown > 0 ? countdown + 's' : '获取验证码' }}
        </button>
      </view>

      <view v-if="devCode" class="dev-tip" @tap="smsCode = devCode">
        <text>模拟验证码：{{ devCode }} (点击自动填入)</text>
      </view>

      <button class="btn" :loading="loading" @tap="submitSms">
        验证并登录/注册
      </button>
    </view>

    <!-- 密码登录模式 -->
    <view v-else class="form-body">
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
      <button class="btn" :loading="loading" @tap="submitPassword">
        {{ isRegister ? "注册" : "登录" }}
      </button>
      <text class="link" @tap="toggleMode">
        {{ isRegister ? "已有账号？去登录" : "没有账号？去注册" }}
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api } from "@/utils/api";
import { errMessage, setToken, toast } from "@/utils/auth";

const loginMode = ref<"sms" | "password">("sms");

const phone = ref("");
const smsCode = ref("");
const countdown = ref(0);
const smsSending = ref(false);
const devCode = ref("");

const email = ref("");
const password = ref("");
const displayName = ref("");
const isRegister = ref(false);
const loading = ref(false);

function onPhone(e: { detail: { value: string } }) {
  phone.value = e.detail.value;
}
function onSmsCode(e: { detail: { value: string } }) {
  smsCode.value = e.detail.value;
}
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

function sendSms() {
  if (!phone.value || phone.value.length !== 11) {
    toast("请输入正确的11位手机号");
    return;
  }
  smsSending.value = true;
  api.sendSmsCode(phone.value)
    .then((res) => {
      toast("验证码已发送");
      countdown.value = 60;
      if (res.devCode) {
        devCode.value = res.devCode;
      }
      const timer = setInterval(() => {
        countdown.value--;
        if (countdown.value <= 0) {
          clearInterval(timer);
        }
      }, 1000);
    })
    .catch((err) => toast(errMessage(err)))
    .finally(() => {
      smsSending.value = false;
    });
}

function submitSms() {
  if (!phone.value || !smsCode.value) {
    toast("请填写手机号和验证码");
    return;
  }
  loading.value = true;
  api.loginBySms(phone.value, smsCode.value)
    .then((res) => {
      setToken(res.token);
      uni.showToast({ title: "登录成功", icon: "success" });
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

function submitPassword() {
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
.tab-header {
  display: flex;
  margin-bottom: 40rpx;
  border-bottom: 1rpx solid #e2e8f0;
}
.tab-item {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  font-size: 32rpx;
  font-weight: bold;
  color: #64748b;
}
.tab-item.active {
  color: #0d9488;
  border-bottom: 4rpx solid #0d9488;
}
.form-body {
  margin-top: 20rpx;
}
.sms-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.sms-input {
  flex: 1;
}
.sms-btn {
  font-size: 26rpx;
  padding: 0 24rpx;
  height: 80rpx;
  line-height: 80rpx;
  background-color: #f0fdfa;
  color: #0d9488;
  border: 1rpx solid #ccfbf1;
  border-radius: 8rpx;
}
.dev-tip {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #0d9488;
  background-color: #f0fdfa;
  padding: 12rpx 16rpx;
  border-radius: 8rpx;
}
.input {
  display: block;
  width: 100%;
  height: 80rpx;
  padding: 0 20rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
  box-sizing: border-box;
}
.btn {
  margin-top: 32rpx;
  background-color: #0d9488;
  color: #fff;
  border-radius: 8rpx;
}
.link {
  display: block;
  margin-top: 32rpx;
  text-align: center;
  color: #0d9488;
  font-size: 28rpx;
}
</style>
