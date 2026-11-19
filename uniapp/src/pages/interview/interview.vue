<template>
  <view class="container">
    <text class="title">全真模拟面试</text>

    <block v-if="!sessionId">
      <view v-if="resumes.length === 0" class="warn-box">
        <text class="warn-text">创建模拟面试必须关联一份简历，请先上传简历。</text>
        <button size="mini" class="btn-go" @tap="goResume">去上传简历</button>
      </view>

      <picker
        v-if="resumes.length"
        mode="selector"
        :range="resumes"
        range-key="resumeTitle"
        @change="onResumeChange"
      >
        <view class="picker">
          关联简历（必填）：{{ selectedResumeTitle || "请选择简历" }}
        </view>
      </picker>

      <picker
        mode="selector"
        :range="roles"
        range-key="name"
        @change="onRoleChange"
      >
        <view class="picker">面试官角色：{{ selectedRoleName || "请选择" }}</view>
      </picker>

      <input
        class="input"
        placeholder="目标岗位（如：前端开发工程师）"
        :value="targetJobTitle"
        @input="(e: any) => (targetJobTitle = e.detail.value)"
      />

      <picker
        v-if="industries.length"
        mode="selector"
        :range="industries"
        range-key="name"
        @change="onIndustryChange"
      >
        <view class="picker">方向 / 行业：{{ selectedIndustryName || "不限" }}</view>
      </picker>

      <picker
        mode="selector"
        :range="yearOptions"
        @change="(e: any) => (experienceYears = yearOptions[Number(e.detail.value)])"
      >
        <view class="picker">工作年限：{{ experienceYears }}</view>
      </picker>

      <picker
        mode="selector"
        :range="durationOptions"
        @change="(e: any) => (durationMinutes = durationOptions[Number(e.detail.value)])"
      >
        <view class="picker">面试时长：{{ durationMinutes }} 分钟</view>
      </picker>

      <button
        class="btn"
        :disabled="resumes.length === 0 || !selectedResumeId"
        :loading="loading"
        @tap="start"
      >
        开始模拟面试
      </button>
    </block>

    <block v-else>
      <scroll-view scroll-y class="chat">
        <view
          v-for="(item, index) in messages"
          :key="index"
          class="msg"
          :class="item.role"
        >
          <text>{{ item.content }}</text>
        </view>

        <view v-if="lastEval" class="eval-card">
          <text class="eval-title">
            上一题评分：逻辑 {{ lastEval.scoreLogic }} · 专业 {{ lastEval.scoreProfessional }} · 匹配 {{ lastEval.scoreMatch }} · 表达 {{ lastEval.scoreExpression }}
          </text>
          <text v-if="lastWeakMeta" class="eval-tag">
            {{
              lastWeakMeta.status === "weak"
                ? `综合 ${lastWeakMeta.overallScore}分 · 已入弱题复盘本（默认下次再考）`
                : `综合 ${lastWeakMeta.overallScore}分 · 本题已掌握`
            }}
          </text>
          <text class="eval-feedback">点评：{{ lastEval.feedback }}</text>
          <text v-if="lastEval.modelAnswer" class="eval-model">
            示范回答：{{ lastEval.modelAnswer }}
          </text>
        </view>
      </scroll-view>

      <textarea
        class="textarea"
        placeholder="输入你的回答（建议结合 STAR 背景、行动与量化结果）..."
        :value="answer"
        @input="onAnswer"
      />
      <view class="actions">
        <button size="mini" :loading="loading" @tap="submit">发送回答</button>
        <button
          size="mini"
          :disabled="!canSwap || swapping"
          @tap="swapCurrentQuestion"
        >
          {{ swapping ? "换题中..." : "换一题" }}
        </button>
        <button size="mini" type="warn" @tap="end">结束并看报告</button>
      </view>
    </block>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import {
  api,
  type CatalogItem,
  type ChatMessage,
  type QuestionEvaluation,
  type ResumeItem,
  type WeakQuestionRecordMeta,
} from "@/utils/api";
import { errMessage, toast } from "@/utils/auth";

const resumes = ref<ResumeItem[]>([]);
const selectedResumeId = ref<number | null>(null);
const selectedResumeTitle = ref("");
const targetJobTitle = ref("");
const experienceYears = ref("1-3年");
const yearOptions = ["应届/校招", "1-3年", "3-5年", "5年以上"];
const durationMinutes = ref(15);
const durationOptions = [5, 15, 30];

const roles = ref<CatalogItem[]>([]);
const industries = ref<CatalogItem[]>([]);
const selectedRole = ref("");
const selectedRoleName = ref("");
const selectedIndustry = ref("");
const selectedIndustryName = ref("");
const sessionId = ref<number | null>(null);
const messages = ref<ChatMessage[]>([]);
const answer = ref("");
const loading = ref(false);
const swapping = ref(false);
const startedAt = ref(0);
const lastEval = ref<QuestionEvaluation | null>(null);
const lastWeakMeta = ref<WeakQuestionRecordMeta | null>(null);

const canSwap = computed(() => {
  if (!messages.value.length || loading.value) return false;
  return messages.value[messages.value.length - 1].role === "assistant";
});

onLoad((options) => {
  const optResumeId = options && options.resumeId ? parseInt(String(options.resumeId), 10) : null;
  api.getResumes().then((list) => {
    resumes.value = list;
    const matched = optResumeId ? list.find((r) => r.id === optResumeId) : list[0];
    if (matched) {
      selectedResumeId.value = matched.id;
      selectedResumeTitle.value = matched.resumeTitle;
      targetJobTitle.value = matched.targetJobTitle || "";
    }
  });

  api.getRoles().then((list) => {
    roles.value = list;
    const first = list[0];
    if (first) {
      selectedRole.value = first.id;
      selectedRoleName.value = first.name;
    }
  });
  api.getIndustries().then((list) => {
    industries.value = list;
  });

  const rawId = options && options.sessionId;
  if (rawId) {
    const id = parseInt(String(rawId), 10);
    api.getSession(id).then((data) => {
      sessionId.value = data.session.id;
      messages.value = data.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      startedAt.value = data.session.startedAt
        ? new Date(data.session.startedAt).getTime()
        : Date.now();
    });
  }
});

function goResume() {
  uni.navigateTo({ url: "/pages/resume/resume" });
}

function onResumeChange(e: { detail: { value: string } }) {
  const item = resumes.value[Number(e.detail.value)];
  if (item) {
    selectedResumeId.value = item.id;
    selectedResumeTitle.value = item.resumeTitle;
    if (item.targetJobTitle) {
      targetJobTitle.value = item.targetJobTitle;
    }
  }
}

function onRoleChange(e: { detail: { value: string } }) {
  const role = roles.value[Number(e.detail.value)];
  if (role) {
    selectedRole.value = role.id;
    selectedRoleName.value = role.name;
  }
}

function onIndustryChange(e: { detail: { value: string } }) {
  const industry = industries.value[Number(e.detail.value)];
  if (industry) {
    selectedIndustry.value = industry.id;
    selectedIndustryName.value = industry.name;
  }
}

function onAnswer(e: { detail: { value: string } }) {
  answer.value = e.detail.value;
}

function start() {
  if (!selectedRole.value) return;
  if (!selectedResumeId.value) {
    toast("请先选择一份关联简历");
    return;
  }
  loading.value = true;
  api
    .startSession({
      resumeId: selectedResumeId.value,
      interviewerRole: selectedRole.value,
      industry: selectedIndustry.value || undefined,
      targetJobTitle: targetJobTitle.value || undefined,
      experienceYears: experienceYears.value,
      durationMinutes: durationMinutes.value,
      mode: "text",
    })
    .then((res) => {
      sessionId.value = res.session.id;
      messages.value = [{ role: "assistant", content: res.openingQuestion }];
      startedAt.value = Date.now();
      lastEval.value = null;
      lastWeakMeta.value = null;
    })
    .catch((err) => toast(errMessage(err)))
    .finally(() => {
      loading.value = false;
    });
}

function swapCurrentQuestion() {
  const currentId = sessionId.value;
  if (!currentId || !canSwap.value) return;
  swapping.value = true;
  const excluded = messages.value
    .filter((m) => m.role === "assistant")
    .map((m) => m.content);
  api
    .swapQuestion(currentId, excluded)
    .then((res) => {
      const next = [...messages.value];
      next[next.length - 1] = { role: "assistant", content: res.question };
      messages.value = next;
      toast("已为您更换新角度题目");
    })
    .catch((err) => toast(errMessage(err)))
    .finally(() => {
      swapping.value = false;
    });
}

function submit() {
  const currentId = sessionId.value;
  const text = answer.value.trim();
  if (!currentId || !text) return;
  const elapsedSec = Math.max(1, Math.round((Date.now() - startedAt.value) / 1000));
  messages.value = [...messages.value, { role: "user", content: text }];
  answer.value = "";
  loading.value = true;
  api
    .submitAnswer(currentId, text, elapsedSec)
    .then((res) => {
      if (res.evaluation) {
        lastEval.value = res.evaluation;
      }
      if (res.weakQuestionRecord !== undefined) {
        lastWeakMeta.value = res.weakQuestionRecord || null;
      }
      if (res.nextQuestion) {
        messages.value = [
          ...messages.value,
          { role: "assistant", content: res.nextQuestion },
        ];
      }
      if (res.isComplete) end();
    })
    .catch((err) => toast(errMessage(err)))
    .finally(() => {
      loading.value = false;
    });
}

function end() {
  const currentId = sessionId.value;
  if (!currentId) return;
  const durationSec = Math.max(1, Math.round((Date.now() - startedAt.value) / 1000));
  api
    .endSession(currentId, durationSec)
    .then(() => {
      uni.redirectTo({ url: "/pages/report/report?sessionId=" + currentId });
    })
    .catch((err) => toast(errMessage(err)));
}
</script>

<style lang="scss">
.container {
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
}
.title {
  font-size: 40rpx;
  font-weight: bold;
  margin-bottom: 20rpx;
}
.warn-box {
  background: #fffbeb;
  border: 1px solid #fde68a;
  padding: 20rpx;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
}
.warn-text {
  font-size: 26rpx;
  color: #92400e;
  display: block;
  margin-bottom: 12rpx;
}
.btn-go {
  background: #d97706;
  color: #fff;
}
.picker,
.input {
  padding: 20rpx;
  border: 1px solid #ddd;
  border-radius: 12rpx;
  margin-bottom: 18rpx;
  font-size: 28rpx;
}
.btn {
  background: #2563eb;
  color: #fff;
  border-radius: 12rpx;
  margin-top: 16rpx;
}
.chat {
  flex: 1;
  margin: 16rpx 0;
  max-height: 58vh;
}
.msg {
  padding: 20rpx;
  margin-bottom: 16rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
}
.msg.assistant {
  background: #f0f7ff;
}
.msg.user {
  background: #2563eb;
  color: #fff;
  margin-left: 60rpx;
}
.eval-card {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 12rpx;
  padding: 18rpx;
  margin-bottom: 16rpx;
}
.eval-title {
  font-size: 24rpx;
  font-weight: 600;
  color: #1e3a8a;
  display: block;
}
.eval-tag {
  font-size: 24rpx;
  color: #be123c;
  font-weight: 600;
  display: block;
  margin-top: 6rpx;
}
.eval-feedback {
  font-size: 25rpx;
  color: #334155;
  display: block;
  margin-top: 8rpx;
}
.eval-model {
  font-size: 24rpx;
  color: #0f766e;
  display: block;
  margin-top: 8rpx;
}
.textarea {
  border: 1px solid #ddd;
  border-radius: 12rpx;
  padding: 16rpx;
  height: 120rpx;
  width: 100%;
  box-sizing: border-box;
}
.actions {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}
</style>
