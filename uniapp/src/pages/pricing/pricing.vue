<template>
  <view class="container">
    <text class="title">升级会员</text>
    <view v-for="item in plans" :key="item.id" class="card">
      <text class="name">{{ item.name }}</text>
      <text class="price">{{ item.priceLabel }}</text>
      <button
        size="mini"
        :loading="loading === item.id"
        @tap="buy(item.id)"
      >
        立即购买
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api, type PaymentPlan } from "@/utils/api";
import { errMessage, toast } from "@/utils/auth";

const plans = ref<PaymentPlan[]>([]);
const loading = ref<string | null>(null);

onShow(() => {
  api.getPaymentPlans().then((res) => {
    plans.value = res.plans || [];
  });
});

function buy(planId: string) {
  loading.value = planId;
  api
    .checkoutPlan(planId)
    .then((checkout) => api.confirmPayment(checkout.order.id))
    .then(() => {
      uni.showToast({ title: "购买成功", icon: "success" });
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
  margin-bottom: 30rpx;
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
.price {
  color: #2563eb;
  font-size: 36rpx;
  font-weight: bold;
  margin: 12rpx 0 20rpx;
  display: block;
}
</style>
