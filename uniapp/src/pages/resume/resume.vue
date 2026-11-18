<template>
  <view class="container">
    <text class="title">简历工作台</text>
    <input class="input" placeholder="目标岗位（可选）" @input="onTargetJob" />
    <textarea
      class="textarea"
      placeholder="粘贴 JD（可选，用于匹配度分析）"
      @input="onJd"
    />
    <button class="btn" :loading="loading" @tap="chooseFile">上传简历并分析</button>

    <view v-if="result" class="result">
      <text class="result-title">诊断结果</text>
      <view class="scores">
        <text>综合 {{ result.scoreOverall }}</text>
        <text>清晰 {{ result.scoreClarity }}</text>
        <text>竞争 {{ result.scoreCompetitiveness }}</text>
        <text>专业 {{ result.scoreProfessionalism }}</text>
      </view>
      <text v-if="result.scoreGrammar" class="match">
        语法排版：{{ result.scoreGrammar }}/100
      </text>
      <text v-if="result.matchPercentage" class="match">
        JD 匹配度：{{ result.matchPercentage }}%
      </text>
      <view v-if="result.grammarIssues.length" class="issues">
        <text v-for="(item, idx) in result.grammarIssues" :key="idx" class="issue">
          · {{ item }}
        </text>
      </view>
      <text class="report">{{ result.report }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api } from "@/utils/api";
import { errMessage, toast } from "@/utils/auth";
import { chooseResumeFile } from "@/utils/chooseResumeFile";

interface DiagnosisView {
  scoreOverall?: number;
  scoreClarity?: number;
  scoreCompetitiveness?: number;
  scoreProfessionalism?: number;
  scoreGrammar?: number;
  grammarIssues: string[];
  report: string;
  matchPercentage?: number;
}

const jd = ref("");
const targetJob = ref("");
const loading = ref(false);
const result = ref<DiagnosisView | null>(null);

function onJd(e: { detail: { value: string } }) {
  jd.value = e.detail.value;
}
function onTargetJob(e: { detail: { value: string } }) {
  targetJob.value = e.detail.value;
}

function chooseFile() {
  chooseResumeFile()
    .then((file) => upload(file.path, file.name))
    .catch((err) => toast(errMessage(err)));
}

function upload(filePath: string, fileName: string) {
  loading.value = true;
  result.value = null;
  api
    .uploadResume(filePath, {
      resumeTitle: fileName || "我的简历",
      targetJobTitle: targetJob.value,
      jobDescription: jd.value,
    })
    .then((res) => {
      const diagnosis = res.diagnosis || {};
      const grammar = res.grammarCheck || {};
      result.value = {
        scoreOverall: diagnosis.scoreOverall,
        scoreClarity: diagnosis.scoreClarity,
        scoreCompetitiveness: diagnosis.scoreCompetitiveness,
        scoreProfessionalism: diagnosis.scoreProfessionalism,
        scoreGrammar: grammar.scoreGrammar,
        grammarIssues: grammar.grammarIssues || [],
        report: diagnosis.diagnosisReport || "",
        matchPercentage: res.jdMatch && res.jdMatch.matchPercentage,
      };
      uni.showToast({ title: "分析完成", icon: "success" });
    })
    .catch((err) => {
      uni.showToast({ title: errMessage(err), icon: "none", duration: 3000 });
    })
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
  margin-bottom: 30rpx;
}
.input,
.textarea {
  border: 1px solid #ddd;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 24rpx;
  width: 100%;
  box-sizing: border-box;
}
.textarea {
  height: 200rpx;
}
.btn {
  background: #2563eb;
  color: #fff;
  border-radius: 12rpx;
}
.result {
  margin-top: 40rpx;
  padding: 24rpx;
  background: #f9fafb;
  border-radius: 16rpx;
}
.result-title {
  font-weight: 600;
  font-size: 32rpx;
  display: block;
  margin-bottom: 16rpx;
}
.scores {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  font-size: 26rpx;
  color: #2563eb;
  margin-bottom: 16rpx;
}
.match {
  display: block;
  font-size: 28rpx;
  margin-bottom: 16rpx;
}
.issues {
  margin-bottom: 16rpx;
}
.issue {
  display: block;
  font-size: 24rpx;
  color: #b45309;
  margin-bottom: 6rpx;
}
.report {
  font-size: 26rpx;
  color: #444;
  white-space: pre-wrap;
  display: block;
}
</style>
