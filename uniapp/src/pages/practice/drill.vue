<template>
  <view class="container">
    <text class="title">弱题复盘与专项重练</text>
    <text class="subtitle">
      低于 70 分默认进入弱题本并优先复考；重练达标后自动转为已掌握，已掌握题勾选「下次再出」后换问法再现
    </text>

    <view class="stats-bar">
      <view class="stat-item">
        <text class="stat-num weak">{{ stats.weakCount }}</text>
        <text class="stat-label">待攻克弱题</text>
      </view>
      <view class="stat-item">
        <text class="stat-num mastered">{{ stats.masteredCount }}</text>
        <text class="stat-label">已掌握</text>
      </view>
      <view class="stat-item">
        <text class="stat-num next">{{ stats.nextExamCount }}</text>
        <text class="stat-label">下次再考</text>
      </view>
    </view>

    <view class="tabs">
      <view
        v-for="tab in tabList"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: statusFilter === tab.id }"
        @tap="changeFilter(tab.id)"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <view v-if="loading" class="empty">加载中...</view>
    <view v-else-if="items.length === 0" class="empty">
      <text>当前筛选下暂无记录，去完成一场模拟面试即可自动沉淀题目。</text>
    </view>

    <view v-else class="list">
      <view
        v-for="item in items"
        :key="item.id"
        class="card"
        :class="item.status"
      >
        <view class="card-top">
          <text class="status-badge" :class="item.status">
            {{ item.status === "weak" ? `弱题 (${item.scoreOverall}分)` : `已掌握 (${item.scoreOverall}分)` }}
          </text>
          <view class="next-switch" @tap="toggleNextExam(item)">
            <text>
              {{ item.nextExamEnabled ? "☑ 下次再考已开启" : "☐ 下次再出（点击开启）" }}
            </text>
          </view>
        </view>

        <text class="question">{{ item.question }}</text>
        <text class="dims">
          逻辑 {{ item.scoreLogic }} · 专业 {{ item.scoreProfessional }} · 匹配 {{ item.scoreMatch }} · 表达 {{ item.scoreExpression }}
        </text>
        <text class="last-ans">上次回答：{{ item.lastAnswer || "（未作答）" }}</text>
        <text v-if="item.deductionNotes" class="deduction">{{ item.deductionNotes }}</text>
        <text v-if="item.modelAnswer" class="model-ans">
          示范回答：{{ item.modelAnswer }}
        </text>

        <view class="practice-box">
          <textarea
            class="practice-input"
            placeholder="对照示范答案重新作答，提交后 AI 再次评估（≥70分自动转为已掌握）..."
            :value="drafts[item.id] || ''"
            @input="(e: any) => (drafts[item.id] = e.detail.value)"
          />
          <view class="btn-row">
            <button
              size="mini"
              class="btn-submit"
              :loading="submittingId === item.id"
              @tap="submitPractice(item)"
            >
              对照重练并再次评估
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api, type WeakQuestionItem, type WeakQuestionStats } from "@/utils/api";
import { errMessage, toast } from "@/utils/auth";

const statusFilter = ref<"weak" | "all" | "mastered">("weak");
const items = ref<WeakQuestionItem[]>([]);
const stats = ref<WeakQuestionStats>({
  totalCount: 0,
  weakCount: 0,
  masteredCount: 0,
  nextExamCount: 0,
  totalPracticeCount: 0,
});
const loading = ref(false);
const submittingId = ref<number | null>(null);
const drafts = reactive<Record<number, string>>({});

const tabList: Array<{ id: "weak" | "all" | "mastered"; label: string }> = [
  { id: "weak", label: "错题 / 弱题" },
  { id: "all", label: "全部" },
  { id: "mastered", label: "已掌握" },
];

onShow(() => {
  loadData();
});

function changeFilter(id: "weak" | "all" | "mastered") {
  statusFilter.value = id;
  loadData();
}

function loadData() {
  loading.value = true;
  api
    .getWeakQuestions(statusFilter.value)
    .then((res) => {
      items.value = res.items;
      stats.value = res.stats;
    })
    .catch((err) => toast(errMessage(err)))
    .finally(() => {
      loading.value = false;
    });
}

function toggleNextExam(item: WeakQuestionItem) {
  const nextVal = !item.nextExamEnabled;
  api
    .updateWeakQuestion(item.id, { nextExamEnabled: nextVal })
    .then(() => {
      item.nextExamEnabled = nextVal;
      toast(nextVal ? "已开启下次面试再考" : "已关闭下次再考");
      loadData();
    })
    .catch((err) => toast(errMessage(err)));
}

function submitPractice(item: WeakQuestionItem) {
  const text = (drafts[item.id] || "").trim();
  if (!text) {
    toast("请先输入重练回答");
    return;
  }
  submittingId.value = item.id;
  api
    .practiceWeakQuestion(item.id, text)
    .then((res) => {
      if (res.masteredNow) {
        toast(`评估 ${res.newScore} 分，已达标转为已掌握！`);
      } else {
        toast(`评估 ${res.newScore} 分，继续加油！`);
      }
      loadData();
    })
    .catch((err) => toast(errMessage(err)))
    .finally(() => {
      submittingId.value = null;
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
}
.subtitle {
  font-size: 24rpx;
  color: #64748b;
  margin: 10rpx 0 24rpx;
  display: block;
}
.stats-bar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.stat-item {
  flex: 1;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12rpx;
  padding: 16rpx;
  text-align: center;
}
.stat-num {
  font-size: 36rpx;
  font-weight: bold;
  display: block;
}
.stat-num.weak {
  color: #e11d48;
}
.stat-num.mastered {
  color: #059669;
}
.stat-num.next {
  color: #2563eb;
}
.stat-label {
  font-size: 22rpx;
  color: #64748b;
}
.tabs {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.tab-btn {
  padding: 12rpx 24rpx;
  border-radius: 12rpx;
  background: #f1f5f9;
  font-size: 26rpx;
  color: #475569;
}
.tab-btn.active {
  background: #2563eb;
  color: #fff;
  font-weight: 600;
}
.empty {
  padding: 60rpx 20rpx;
  text-align: center;
  color: #64748b;
  font-size: 28rpx;
}
.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-left: 8rpx solid #e11d48;
  border-radius: 14rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.card.mastered {
  border-left-color: #059669;
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.status-badge {
  font-size: 24rpx;
  font-weight: bold;
  color: #e11d48;
}
.status-badge.mastered {
  color: #059669;
}
.next-switch {
  font-size: 24rpx;
  color: #2563eb;
  font-weight: 600;
}
.question {
  font-size: 30rpx;
  font-weight: bold;
  color: #0f172a;
  display: block;
  margin-bottom: 10rpx;
}
.dims {
  font-size: 24rpx;
  color: #475569;
  display: block;
  margin-bottom: 10rpx;
}
.last-ans {
  font-size: 26rpx;
  color: #334155;
  background: #f8fafc;
  padding: 14rpx;
  border-radius: 10rpx;
  display: block;
  margin-bottom: 10rpx;
}
.deduction {
  font-size: 24rpx;
  color: #be123c;
  display: block;
  margin-bottom: 10rpx;
}
.model-ans {
  font-size: 25rpx;
  color: #0f766e;
  background: #f0fdfa;
  padding: 14rpx;
  border-radius: 10rpx;
  display: block;
  margin-bottom: 14rpx;
}
.practice-box {
  margin-top: 12rpx;
}
.practice-input {
  width: 100%;
  height: 140rpx;
  border: 1px solid #cbd5e1;
  border-radius: 10rpx;
  padding: 12rpx;
  font-size: 26rpx;
  box-sizing: border-box;
  margin-bottom: 12rpx;
}
.btn-submit {
  background: #2563eb;
  color: #fff;
}
</style>
