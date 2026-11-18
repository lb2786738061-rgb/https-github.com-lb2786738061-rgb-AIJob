<template>
  <view class="container">
    <text class="title">模拟面试</text>

    <block v-if="!sessionId">
      <picker
        mode="selector"
        :range="roles"
        range-key="name"
        @change="onRoleChange"
      >
        <view class="picker">面试官：{{ selectedRoleName || "请选择" }}</view>
      </picker>
      <picker
        v-if="industries.length"
        mode="selector"
        :range="industries"
        range-key="name"
        @change="onIndustryChange"
      >
        <view class="picker">行业：{{ selectedIndustryName || "不限" }}</view>
      </picker>
      <button class="btn" :loading="loading" @tap="start">开始面试</button>
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
      </scroll-view>
      <textarea
        class="textarea"
        placeholder="输入回答..."
        :value="answer"
        @input="onAnswer"
      />
      <view class="actions">
        <button size="mini" :loading="loading" @tap="submit">发送</button>
        <button size="mini" type="warn" @tap="end">结束</button>
      </view>
    </block>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api, type CatalogItem, type ChatMessage } from "@/utils/api";
import { errMessage, toast } from "@/utils/auth";

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
const startedAt = ref(0);

onLoad((options) => {
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
  loading.value = true;
  api
    .startSession({
      interviewerRole: selectedRole.value,
      industry: selectedIndustry.value || undefined,
      mode: "text",
    })
    .then((res) => {
      sessionId.value = res.session.id;
      messages.value = [{ role: "assistant", content: res.openingQuestion }];
      startedAt.value = Date.now();
    })
    .catch((err) => toast(errMessage(err)))
    .finally(() => {
      loading.value = false;
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
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
}
.title {
  font-size: 40rpx;
  font-weight: bold;
  margin-bottom: 24rpx;
}
.picker {
  padding: 20rpx;
  border: 1px solid #ddd;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
}
.btn {
  background: #2563eb;
  color: #fff;
  border-radius: 12rpx;
  margin-top: 20rpx;
}
.chat {
  flex: 1;
  margin: 20rpx 0;
  max-height: 60vh;
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
.textarea {
  border: 1px solid #ddd;
  border-radius: 12rpx;
  padding: 16rpx;
  height: 120rpx;
}
.actions {
  display: flex;
  gap: 20rpx;
  margin-top: 16rpx;
}
</style>
