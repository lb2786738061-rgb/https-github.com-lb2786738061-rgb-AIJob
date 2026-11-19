<template>
  <view class="container">
    <view class="header">
      <text class="title">AI 简历免登录试测</text>
      <text class="subtitle">每台设备可免费体验 1 次快速简历体检</text>
    </view>

    <!-- 结果卡片 -->
    <view v-if="result" class="result-card">
      <view class="score-row">
        <text class="score-label">综合竞争力得分</text>
        <text class="score-val">{{ result.scoreOverall }} 分</text>
      </view>

      <view class="dim-grid">
        <view class="dim-item">
          <text class="dim-name">逻辑表达</text>
          <text class="dim-score">{{ result.dimensionScores.clarity }}</text>
        </view>
        <view class="dim-item">
          <text class="dim-name">核心竞争</text>
          <text class="dim-score">{{ result.dimensionScores.competitiveness }}</text>
        </view>
        <view class="dim-item">
          <text class="dim-name">岗位匹配</text>
          <text class="dim-score">{{ result.dimensionScores.match }}</text>
        </view>
        <view class="dim-item">
          <text class="dim-name">专业技术</text>
          <text class="dim-score">{{ result.dimensionScores.professionalism }}</text>
        </view>
      </view>

      <view class="section">
        <text class="section-title">✨ 当前突出优势</text>
        <view v-for="(h, i) in result.highlights" :key="i" class="point-item green">
          <text>{{ h }}</text>
        </view>
      </view>

      <view class="section">
        <text class="section-title">💡 关键改进建议</text>
        <view v-for="(s, i) in result.suggestions" :key="i" class="point-item amber">
          <text>{{ s }}</text>
        </view>
      </view>

      <button class="btn" @tap="goLogin">
        注册/登录解锁完整功能
      </button>
    </view>

    <!-- 已体验提示 -->
    <view v-else-if="hasUsed" class="used-box">
      <text class="used-title">本设备 1 次体验已用完</text>
      <text class="used-desc">注册登录即可无限制体验完整诊断、STAR改写与AI模拟面试。</text>
      <button class="btn" @tap="goLogin">立即登录 / 注册</button>
    </view>

    <!-- 输入表单 -->
    <view v-else class="form-box">
      <text class="form-label">意向求职岗位：</text>
      <input
        class="input"
        placeholder="例如：Java开发 / 前端工程师"
        :value="targetJobTitle"
        @input="onJobInput"
      />

      <view class="label-row">
        <text class="form-label">粘贴简历或经历文本：</text>
        <text class="sample-btn" @tap="fillSample">填入样例</text>
      </view>
      <textarea
        class="textarea"
        placeholder="请在此粘贴 20 字以上的项目经历或个人技能..."
        :value="resumeText"
        @input="onTextInput"
      />

      <button class="btn" :loading="loading" @tap="startDiagnose">
        🚀 开始免登录体验诊断
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "@/utils/api";
import { errMessage, toast } from "@/utils/auth";

function getDeviceId(): string {
  let id = uni.getStorageSync("careerai_guest_device_id");
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    uni.setStorageSync("careerai_guest_device_id", id);
  }
  return id;
}

const deviceId = ref("");
const hasUsed = ref(false);
const targetJobTitle = ref("软件开发工程师");
const resumeText = ref("");
const loading = ref(false);
const result = ref<any>(null);

onMounted(() => {
  deviceId.value = getDeviceId();
  api.getGuestStatus(deviceId.value)
    .then((res) => {
      hasUsed.value = res.hasUsed;
    })
    .catch(() => {});
});

function onJobInput(e: { detail: { value: string } }) {
  targetJobTitle.value = e.detail.value;
}
function onTextInput(e: { detail: { value: string } }) {
  resumeText.value = e.detail.value;
}

function fillSample() {
  resumeText.value =
    "3年开发经验，主导微服务重构，优化核心链路QPS从200提升至1500，负责团队技术方案设计。熟练掌握主流开发框架与分布式缓存调优。";
}

function startDiagnose() {
  if (resumeText.value.trim().length < 20) {
    toast("请至少粘贴 20 字以上的经历内容");
    return;
  }
  loading.value = true;
  api.guestDiagnose({
    deviceId: deviceId.value,
    resumeText: resumeText.value,
    targetJobTitle: targetJobTitle.value,
  })
    .then((res) => {
      result.value = res;
      hasUsed.value = true;
      toast("诊断完成");
    })
    .catch((err) => toast(errMessage(err)))
    .finally(() => {
      loading.value = false;
    });
}

function goLogin() {
  uni.navigateTo({ url: "/pages/login/login" });
}
</script>

<style lang="scss">
.container {
  padding: 30rpx;
}
.header {
  margin-bottom: 30rpx;
}
.title {
  font-size: 36rpx;
  font-weight: bold;
  display: block;
}
.subtitle {
  font-size: 26rpx;
  color: #64748b;
  margin-top: 8rpx;
  display: block;
}
.form-box {
  background-color: #fff;
  padding: 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid #e2e8f0;
}
.form-label {
  font-size: 28rpx;
  font-weight: bold;
  color: #1e293b;
  margin-bottom: 12rpx;
  display: block;
}
.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20rpx;
  margin-bottom: 12rpx;
}
.sample-btn {
  font-size: 24rpx;
  color: #0d9488;
}
.input {
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
  height: 80rpx;
  padding: 0 16rpx;
  width: 100%;
  box-sizing: border-box;
}
.textarea {
  border: 1rpx solid #e2e8f0;
  border-radius: 8rpx;
  height: 240rpx;
  padding: 16rpx;
  width: 100%;
  box-sizing: border-box;
  font-size: 28rpx;
}
.btn {
  background-color: #0d9488;
  color: #fff;
  border-radius: 12rpx;
  margin-top: 30rpx;
}
.used-box {
  background-color: #fef3c7;
  padding: 30rpx;
  border-radius: 16rpx;
  border: 1rpx solid #fde68a;
}
.used-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #92400e;
  display: block;
}
.used-desc {
  font-size: 26rpx;
  color: #b45309;
  margin-top: 12rpx;
  display: block;
}
.result-card {
  background-color: #fff;
  padding: 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid #e2e8f0;
}
.score-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1rpx solid #e2e8f0;
  padding-bottom: 20rpx;
}
.score-label {
  font-size: 28rpx;
  color: #64748b;
}
.score-val {
  font-size: 40rpx;
  font-weight: bold;
  color: #0d9488;
}
.dim-grid {
  display: flex;
  gap: 12rpx;
  margin: 24rpx 0;
}
.dim-item {
  flex: 1;
  background-color: #f8fafc;
  padding: 16rpx 8rpx;
  border-radius: 12rpx;
  text-align: center;
}
.dim-name {
  font-size: 22rpx;
  color: #64748b;
  display: block;
}
.dim-score {
  font-size: 30rpx;
  font-weight: bold;
  color: #0f172a;
  margin-top: 4rpx;
  display: block;
}
.section {
  margin-top: 24rpx;
}
.section-title {
  font-size: 28rpx;
  font-weight: bold;
  margin-bottom: 12rpx;
  display: block;
}
.point-item {
  font-size: 26rpx;
  padding: 12rpx 16rpx;
  border-radius: 8rpx;
  margin-bottom: 10rpx;
}
.point-item.green {
  background-color: #ecfdf5;
  color: #065f46;
}
.point-item.amber {
  background-color: #fffbeb;
  color: #92400e;
}
</style>
