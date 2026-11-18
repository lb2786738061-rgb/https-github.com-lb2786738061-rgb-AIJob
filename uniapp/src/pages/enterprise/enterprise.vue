<template>
  <view class="container">
    <text class="title">名企冲刺包</text>
    <text class="desc">199元/次 · 大厂真题专项训练</text>
    <view v-for="item in companies" :key="item.id" class="card">
      <text class="name">{{ item.name }}</text>
      <text class="info">{{ item.description }}</text>
      <button
        size="mini"
        :loading="loading === item.id"
        @tap="start(item.id)"
      >
        开始训练
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api, type CatalogItem } from "@/utils/api";
import { errMessage, toast } from "@/utils/auth";

const companies = ref<CatalogItem[]>([]);
const loading = ref<string | null>(null);

onShow(() => {
  api.getEnterpriseCompanies().then((list) => {
    companies.value = list;
  });
});

function start(companyId: string) {
  loading.value = companyId;
  api
    .startEnterpriseSession({ companyId })
    .then((res) => {
      uni.navigateTo({
        url: "/pages/interview/interview?sessionId=" + res.session.id,
      });
    })
    .catch((err) => toast(errMessage(err)))
    .finally(() => {
      loading.value = null;
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
}
.desc {
  color: #666;
  font-size: 26rpx;
  margin: 12rpx 0 30rpx;
  display: block;
}
.card {
  border: 1px solid #e5e7eb;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
}
.name {
  font-size: 32rpx;
  font-weight: 600;
  display: block;
}
.info {
  color: #666;
  font-size: 26rpx;
  margin: 8rpx 0 16rpx;
  display: block;
}
</style>
