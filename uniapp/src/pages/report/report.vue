<template>
  <view class="container">
    <text class="title">面试复盘报告</text>
    <view v-if="loading" class="hint">加载中...</view>
    <block v-else-if="report">
      <view class="scores">
        <text>逻辑 {{ report.scoreLogic }}</text>
        <text>专业 {{ report.scoreProfessional }}</text>
        <text>表达 {{ report.scoreExpression }}</text>
        <text>匹配 {{ report.scoreMatch }}</text>
        <text>自信 {{ report.scoreConfidence }}</text>
      </view>
      <text class="summary">{{ report.feedbackSummary }}</text>
      <view
        v-for="(item, index) in report.questionReviews || []"
        :key="index"
        class="review"
      >
        <text class="q">Q: {{ item.question }}</text>
        <text class="a">A: {{ item.answer }}</text>
        <text class="fb">{{ item.evaluation && item.evaluation.feedback }}</text>
      </view>
    </block>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api, type SessionReport } from "@/utils/api";
import { errMessage, toast } from "@/utils/auth";

const loading = ref(true);
const report = ref<SessionReport | null>(null);

function parseReport(raw: unknown): SessionReport | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as SessionReport;
    } catch {
      return null;
    }
  }
  return raw as SessionReport;
}

function loadReport(sessionId: number) {
  loading.value = true;
  api
    .getSession(sessionId)
    .then((data) => {
      const session = data.session;
      const existing = parseReport(session.reportJson);
      if (!existing && session.status !== "completed") {
        return api
          .endSession(sessionId, session.totalDurationSec || 60)
          .then((ended) => {
            report.value = ended.report;
            loading.value = false;
          });
      }
      report.value = existing;
      loading.value = false;
    })
    .catch((err) => {
      toast(errMessage(err));
      loading.value = false;
    });
}

onLoad((options) => {
  const rawId = options && options.sessionId;
  if (!rawId) {
    toast("缺少会话 ID");
    loading.value = false;
    return;
  }
  loadReport(parseInt(String(rawId), 10));
});
</script>

<style lang="scss">
.container {
  padding: 40rpx;
}
.title {
  font-size: 40rpx;
  font-weight: bold;
  margin-bottom: 24rpx;
  display: block;
}
.scores {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  color: #2563eb;
  font-size: 26rpx;
  margin-bottom: 24rpx;
}
.summary {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 32rpx;
  line-height: 1.6;
}
.review {
  background: #f9fafb;
  padding: 24rpx;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
}
.q,
.a,
.fb {
  display: block;
  font-size: 26rpx;
  margin-bottom: 8rpx;
}
.fb {
  color: #666;
}
.hint {
  color: #999;
  font-size: 28rpx;
}
</style>
