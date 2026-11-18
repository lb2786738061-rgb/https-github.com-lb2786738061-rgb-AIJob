import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { api, type Plan, type PaymentOrder } from "../api/client";
import {
  platformMembershipTiers,
  platformRedeem,
  type MembershipTier,
} from "../api/platformClient";

export default function Pricing() {
  const { user, refreshMe } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [platformTiers, setPlatformTiers] = useState<MembershipTier[]>([]);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [redeemCode, setRedeemCode] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    api.getPaymentPlans().then((data) => setPlans(data.plans)).catch(() => {});
    if (user) {
      api.getPaymentOrders().then((data) => setOrders(data.orders)).catch(() => {});
    }
    const token = localStorage.getItem("careerai_token");
    if (token) {
      platformMembershipTiers(token)
        .then((data) => setPlatformTiers(data.tiers ?? []))
        .catch(() => {});
    }
  }, [user]);

  async function handlePurchase(planId: string) {
    if (!user) {
      toast("请先登录", "error");
      return;
    }
    setLoading(planId);
    try {
      const checkout = await api.checkoutPlan(planId);
      await api.confirmPayment(checkout.order.id);
      await refreshMe();
      const updated = await api.getPaymentOrders();
      setOrders(updated.orders);
      toast(checkout.plan.name + " 购买成功，权益已开通！", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "购买失败", "error");
    } finally {
      setLoading(null);
    }
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast("请先登录", "error");
      return;
    }
    const token = localStorage.getItem("careerai_token");
    if (!token) return;
    setLoading("redeem");
    try {
      await platformRedeem(token, redeemCode.trim());
      await refreshMe();
      setRedeemCode("");
      toast("兑换成功，权益已开通！", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "兑换失败", "error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="page-container-narrow pb-16">
      <div className="text-center mb-12 animate-fade-up">
        <p className="section-label mb-2">会员权益</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-ink mb-3">升级会员</h1>
        <p className="page-subtitle">
          选择套餐即时开通（开发环境模拟支付），或使用兑换码激活权益。
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mb-10">
        {plans.map((plan, i) => (
          <div
            key={plan.id}
            className={`glass-card p-7 animate-fade-up ${i > 0 ? "animate-fade-up-delay-1" : ""}`}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-display font-bold text-xl text-ink">{plan.name}</h2>
              {plan.recommended && <span className="tag tag-success">推荐</span>}
            </div>
            <p className="font-display text-4xl font-bold text-brand-700 my-4">
              {plan.priceLabel}
            </p>
            <ul className="space-y-2.5 mb-5 text-sm text-ink-muted">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-brand-500">✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handlePurchase(plan.id)}
              disabled={loading === plan.id}
              className="btn-primary btn-full !py-3"
            >
              {loading === plan.id ? "处理中..." : "立即购买"}
            </button>
          </div>
        ))}
      </div>

      {orders.length > 0 && (
        <div className="glass-card p-6 mb-10 animate-fade-up">
          <h2 className="font-display font-bold text-lg mb-4">我的订单</h2>
          <div className="space-y-2 text-sm">
            {orders.slice(0, 5).map((order) => (
              <div
                key={order.id}
                className="flex justify-between items-center py-2 border-b border-border last:border-0"
              >
                <span>
                  {order.planType} · ¥{(order.amountCents / 100).toFixed(0)}
                </span>
                <span className={order.status === "paid" ? "text-brand-600" : "text-ink-muted"}>
                  {order.status === "paid" ? "已支付" : "待支付"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {platformTiers.length > 0 && (
        <div className="glass-card p-6 mb-10 animate-fade-up">
          <h2 className="font-display font-bold text-lg mb-2">平台会员档位</h2>
          <p className="text-sm text-ink-muted mb-4">由统一平台管理的会员档位参考</p>
          <div className="grid md:grid-cols-2 gap-4">
            {platformTiers.map((tier) => (
              <div key={tier.code} className="p-4 rounded-xl bg-brand-50/50 border border-brand-100">
                <p className="font-semibold">{tier.name}</p>
                <p className="text-brand-700 font-bold mt-1">
                  ¥{tier.priceAmount.toFixed(0)}/{tier.durationDays}天
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card p-7 max-w-md mx-auto animate-fade-up animate-fade-up-delay-2">
        <h2 className="font-display font-bold text-lg mb-1">兑换码开通</h2>
        <p className="text-sm text-ink-muted mb-5">输入运营发放的兑换码，即时开通权益</p>
        <form onSubmit={handleRedeem} className="space-y-4">
          <input
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value)}
            placeholder="输入兑换码，如 CAREER-ENT-0001"
            className="input-field"
            required
          />
          <button
            type="submit"
            disabled={loading === "redeem"}
            className="btn-primary btn-full !py-3"
          >
            {loading === "redeem" ? "兑换中..." : "立即兑换"}
          </button>
        </form>
      </div>
    </div>
  );
}
