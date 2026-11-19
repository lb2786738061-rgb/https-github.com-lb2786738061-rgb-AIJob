<template>
  <view class="container">
    <text class="title">简历工作台</text>
    <input
      class="input"
      placeholder="目标岗位（可选，未填可自动推断）"
      :value="targetJob"
      @input="onTargetJob"
    />
    <textarea
      class="textarea"
      placeholder="粘贴目标岗位 JD（可选，用于匹配度分析）"
      :value="jd"
      @input="onJd"
    />
    <view class="btn-row">
      <button class="btn-outline" :loading="loading" @tap="chooseFile(true)">
        仅上传解析（先查看）
      </button>
      <button class="btn" :loading="loading" @tap="chooseFile(false)">
        上传并 AI 诊断
      </button>
    </view>

    <view v-if="resumes.length" class="history-box">
      <text class="section-heading">我的简历 ({{ resumes.length }})</text>
      <view
        v-for="item in resumes"
        :key="item.id"
        class="history-item"
        :class="{ active: currentResume && currentResume.id === item.id }"
        @tap="selectResume(item)"
      >
        <text class="history-title">{{ item.resumeTitle }}</text>
        <text class="history-meta">
          {{ item.targetJobTitle || "通用岗位" }}
          {{ item.scoreOverall != null ? ` · ${item.scoreOverall}分` : "" }}
        </text>
      </view>
    </view>

    <view v-if="currentResume" class="result">
      <view class="result-header">
        <text class="result-title">{{ currentResume.resumeTitle }}</text>
        <button size="mini" class="go-interview-btn" @tap="goInterview">
          用此简历去面试
        </button>
      </view>

      <view v-if="result" class="scores">
        <text v-if="result.scoreOverall != null">综合 {{ result.scoreOverall }}</text>
        <text v-if="result.scoreClarity != null">清晰 {{ result.scoreClarity }}</text>
        <text v-if="result.scoreCompetitiveness != null">竞争 {{ result.scoreCompetitiveness }}</text>
        <text v-if="result.scoreProfessionalism != null">专业 {{ result.scoreProfessionalism }}</text>
      </view>
      <text v-if="result && result.matchPercentage != null" class="match">
        JD 匹配度：{{ result.matchPercentage }}%
      </text>

      <view class="section-card">
        <view class="result-header">
          <text class="section-heading">简历结构化模块（含个人优势/奖项）</text>
          <text class="link-btn" @tap="toggleEdit">
            {{ editing ? "保存修改" : "在线编辑" }}
          </text>
        </view>

        <view class="field-block">
          <text class="field-label">联系方式</text>
          <textarea
            v-if="editing"
            class="field-input"
            :value="editForm.contact"
            @input="(e: any) => (editForm.contact = e.detail.value)"
          />
          <text v-else class="field-text">{{ editForm.contact || "（未识别）" }}</text>
        </view>

        <view class="field-block">
          <text class="field-label">个人优势</text>
          <textarea
            v-if="editing"
            class="field-input"
            :value="editForm.advantage"
            @input="(e: any) => (editForm.advantage = e.detail.value)"
          />
          <text v-else class="field-text">{{ editForm.advantage || "（未识别）" }}</text>
        </view>

        <view class="field-block">
          <text class="field-label">工作经历（每行一条）</text>
          <textarea
            v-if="editing"
            class="field-input"
            :value="editForm.experience"
            @input="(e: any) => (editForm.experience = e.detail.value)"
          />
          <text v-else class="field-text">{{ editForm.experience || "（未识别）" }}</text>
        </view>

        <view class="field-block">
          <text class="field-label">项目经历（每行一条）</text>
          <textarea
            v-if="editing"
            class="field-input"
            :value="editForm.projects"
            @input="(e: any) => (editForm.projects = e.detail.value)"
          />
          <text v-else class="field-text">{{ editForm.projects || "（未识别）" }}</text>
        </view>

        <view class="field-block">
          <text class="field-label">专业技能（每行一条）</text>
          <textarea
            v-if="editing"
            class="field-input"
            :value="editForm.skills"
            @input="(e: any) => (editForm.skills = e.detail.value)"
          />
          <text v-else class="field-text">{{ editForm.skills || "（未识别）" }}</text>
        </view>

        <view class="field-block">
          <text class="field-label">教育背景（每行一条）</text>
          <textarea
            v-if="editing"
            class="field-input"
            :value="editForm.education"
            @input="(e: any) => (editForm.education = e.detail.value)"
          />
          <text v-else class="field-text">{{ editForm.education || "（未识别）" }}</text>
        </view>

        <view class="field-block">
          <text class="field-label">荣誉奖项 / 证书（每行一条）</text>
          <textarea
            v-if="editing"
            class="field-input"
            :value="editForm.awards"
            @input="(e: any) => (editForm.awards = e.detail.value)"
          />
          <text v-else class="field-text">{{ editForm.awards || "（未识别）" }}</text>
        </view>
      </view>

      <text v-if="result && result.report" class="report">{{ result.report }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api, type ResumeItem } from "@/utils/api";
import { errMessage, toast } from "@/utils/auth";
import { chooseResumeFile } from "@/utils/chooseResumeFile";

interface DiagnosisView {
  scoreOverall?: number | null;
  scoreClarity?: number | null;
  scoreCompetitiveness?: number | null;
  scoreProfessionalism?: number | null;
  scoreGrammar?: number;
  grammarIssues: string[];
  report: string;
  matchPercentage?: number | null;
}

const jd = ref("");
const targetJob = ref("");
const loading = ref(false);
const resumes = ref<ResumeItem[]>([]);
const currentResume = ref<ResumeItem | null>(null);
const result = ref<DiagnosisView | null>(null);
const editing = ref(false);
const rawParsedObj = ref<Record<string, any>>({});

const editForm = reactive({
  contact: "",
  advantage: "",
  experience: "",
  projects: "",
  skills: "",
  education: "",
  awards: "",
});

onShow(() => {
  loadResumes();
});

function loadResumes() {
  api
    .getResumes()
    .then((list) => {
      resumes.value = list;
      if (!currentResume.value && list.length > 0) {
        selectResume(list[0]);
      }
    })
    .catch(() => {});
}

function selectResume(item: ResumeItem) {
  currentResume.value = item;
  targetJob.value = item.targetJobTitle || "";
  jd.value = item.jobDescription || "";
  result.value = {
    scoreOverall: item.scoreOverall,
    scoreClarity: item.scoreClarity,
    scoreCompetitiveness: item.scoreCompetitiveness,
    scoreProfessionalism: item.scoreProfessionalism,
    grammarIssues: [],
    report: item.diagnosisReport || "",
    matchPercentage: item.matchPercentage,
  };
  try {
    const parsed = item.parsedJson ? JSON.parse(item.parsedJson) : {};
    rawParsedObj.value = parsed;
    const sec = parsed.sections || {};
    editForm.contact = sec.contact || "";
    editForm.advantage = sec.advantage || sec.summary || "";
    editForm.experience = (sec.experience || []).join("\n");
    editForm.projects = (sec.projects || sec.project || []).join("\n");
    editForm.skills = (sec.skills || sec.skill || []).join("\n");
    editForm.education = (sec.education || []).join("\n");
    editForm.awards = (sec.awards || sec.award || []).join("\n");
  } catch {
    rawParsedObj.value = {};
  }
}

function toggleEdit() {
  if (!editing.value) {
    editing.value = true;
    return;
  }
  if (!currentResume.value) return;
  const splitLines = (t: string) =>
    t
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  const nextParsed = {
    ...rawParsedObj.value,
    layout: undefined,
    sections: {
      ...(rawParsedObj.value.sections || {}),
      contact: editForm.contact,
      summary: editForm.advantage,
      advantage: editForm.advantage,
      experience: splitLines(editForm.experience),
      projects: splitLines(editForm.projects),
      project: splitLines(editForm.projects),
      skills: splitLines(editForm.skills),
      skill: splitLines(editForm.skills),
      education: splitLines(editForm.education),
      awards: splitLines(editForm.awards),
      award: splitLines(editForm.awards),
    },
  };
  loading.value = true;
  api
    .patchResume(currentResume.value.id, {
      parsedJson: nextParsed,
      targetJobTitle: targetJob.value,
    })
    .then((updated) => {
      editing.value = false;
      selectResume(updated);
      loadResumes();
      toast("简历已保存");
    })
    .catch((err) => toast(errMessage(err)))
    .finally(() => {
      loading.value = false;
    });
}

function goInterview() {
  if (!currentResume.value) return;
  uni.navigateTo({
    url: "/pages/interview/interview?resumeId=" + currentResume.value.id,
  });
}

function onJd(e: { detail: { value: string } }) {
  jd.value = e.detail.value;
}
function onTargetJob(e: { detail: { value: string } }) {
  targetJob.value = e.detail.value;
}

function chooseFile(parseOnly = false) {
  chooseResumeFile()
    .then((file) => upload(file.path, file.name, parseOnly))
    .catch((err) => toast(errMessage(err)));
}

function upload(filePath: string, fileName: string, parseOnly = false) {
  if (fileName && fileName.toLowerCase().endsWith(".doc")) {
    toast("暂不支持旧版 .doc 格式，请另存为 .docx 或 PDF 后上传");
    return;
  }
  loading.value = true;
  api
    .uploadResume(filePath, {
      resumeTitle: fileName || "我的简历",
      targetJobTitle: targetJob.value,
      jobDescription: jd.value,
      parseOnly: parseOnly ? "true" : "false",
    })
    .then((res) => {
      if (res.resume) {
        selectResume(res.resume);
      }
      loadResumes();
      uni.showToast({
        title: parseOnly ? "已解析入库" : "分析完成",
        icon: "success",
      });
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
  padding: 32rpx;
}
.title {
  font-size: 40rpx;
  font-weight: bold;
  display: block;
  margin-bottom: 24rpx;
}
.input,
.textarea {
  border: 1px solid #ddd;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
  width: 100%;
  box-sizing: border-box;
}
.textarea {
  height: 160rpx;
}
.btn-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.btn {
  flex: 1;
  background: #2563eb;
  color: #fff;
  border-radius: 12rpx;
  font-size: 28rpx;
}
.btn-outline {
  flex: 1;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  border-radius: 12rpx;
  font-size: 28rpx;
}
.history-box {
  margin-top: 20rpx;
  padding: 20rpx;
  background: #f8fafc;
  border-radius: 14rpx;
}
.history-item {
  padding: 16rpx;
  border-radius: 10rpx;
  margin-top: 10rpx;
  background: #fff;
  border: 1px solid #e2e8f0;
}
.history-item.active {
  border-color: #2563eb;
  background: #eff6ff;
}
.history-title {
  font-size: 28rpx;
  font-weight: 600;
  display: block;
}
.history-meta {
  font-size: 24rpx;
  color: #64748b;
}
.result {
  margin-top: 28rpx;
  padding: 24rpx;
  background: #f9fafb;
  border-radius: 16rpx;
}
.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.result-title {
  font-weight: 600;
  font-size: 32rpx;
}
.go-interview-btn {
  background: #059669;
  color: #fff;
}
.section-heading {
  font-size: 28rpx;
  font-weight: 600;
  color: #1e293b;
}
.link-btn {
  font-size: 26rpx;
  color: #2563eb;
  font-weight: 600;
}
.section-card {
  background: #fff;
  border-radius: 14rpx;
  padding: 20rpx;
  margin: 20rpx 0;
  border: 1px solid #e5e7eb;
}
.field-block {
  margin-bottom: 18rpx;
}
.field-label {
  font-size: 24rpx;
  font-weight: 600;
  color: #475569;
  display: block;
  margin-bottom: 6rpx;
}
.field-text {
  font-size: 26rpx;
  color: #1e293b;
  white-space: pre-wrap;
  display: block;
}
.field-input {
  border: 1px solid #cbd5e1;
  border-radius: 10rpx;
  padding: 12rpx;
  width: 100%;
  min-height: 110rpx;
  font-size: 26rpx;
  box-sizing: border-box;
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
.report {
  font-size: 26rpx;
  color: #444;
  white-space: pre-wrap;
  display: block;
}
</style>
