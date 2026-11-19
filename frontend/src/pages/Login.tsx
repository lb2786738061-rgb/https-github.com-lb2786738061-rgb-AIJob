import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { api } from "../api/client";

export default function Login() {
  const { login, loginBySms } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"sms" | "password">("sms");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [devTipCode, setDevTipCode] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [smsSending, setSmsSending] = useState(false);

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  async function handleSendSms() {
    if (!phone || phone.length !== 11) {
      toast("请输入正确的11位手机号", "error");
      return;
    }
    setSmsSending(true);
    try {
      const res = await api.sendSmsCode(phone);
      toast("验证码已发送", "success");
      setCountdown(60);
      if (res.devCode) {
        setDevTipCode(res.devCode);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "发送失败", "error");
    } finally {
      setSmsSending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "sms") {
        if (!phone || !smsCode) {
          toast("请完整填写手机号和验证码", "error");
          setLoading(false);
          return;
        }
        await loginBySms(phone, smsCode);
      } else {
        await login(email, password);
      }
      toast("登录成功", "success");
      navigate("/");
    } catch (err) {
      toast(err instanceof Error ? err.message : "登录失败", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-side-panel glass-card-dark">
        <p className="section-label !text-brand-300 mb-4">职赢AI</p>
        <h1 className="font-display text-3xl font-bold mb-4 leading-snug">
          开启你的
          <br />
          AI 求职之旅
        </h1>
        <p className="text-white/60 text-sm leading-relaxed mb-8">
          简历精修、模拟面试、复盘报告，一站式助你拿下心仪 offer。
        </p>
        <div className="space-y-3 text-sm text-white/50">
          {["✓ 多维度简历体检", "✓ 4 类 AI 面试官", "✓ 弱题强化复盘", "✓ 游客1次免登录试测"].map((t) => (
            <p key={t}>{t}</p>
          ))}
        </div>
      </div>

      <div className="auth-card-wrapper">
        <div className="auth-card">
          <h2 className="font-display text-2xl font-bold mb-1 text-ink">欢迎回来</h2>
          <p className="page-subtitle mb-6">登录你的职赢AI 账号</p>

          <div className="flex border-b border-surface-border mb-6">
            <button
              type="button"
              onClick={() => setMode("sms")}
              className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-colors ${
                mode === "sms"
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              手机验证码登录
            </button>
            <button
              type="button"
              onClick={() => setMode("password")}
              className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-colors ${
                mode === "password"
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              密码登录
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "sms" ? (
              <>
                <div>
                  <label className="form-label">手机号码</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    required
                    placeholder="请输入11位中国大陆手机号"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">短信验证码</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={smsCode}
                      onChange={(e) => setSmsCode(e.target.value.trim().slice(0, 6))}
                      required
                      placeholder="6位数字验证码"
                      className="input-field flex-1"
                    />
                    <button
                      type="button"
                      disabled={countdown > 0 || smsSending}
                      onClick={handleSendSms}
                      className="px-4 py-2 text-sm font-medium border border-brand-300 text-brand-600 rounded-lg hover:bg-brand-50 disabled:opacity-50 whitespace-nowrap"
                    >
                      {smsSending ? "发送中..." : countdown > 0 ? `${countdown}s 后重发` : "获取验证码"}
                    </button>
                  </div>
                  {devTipCode && (
                    <div className="mt-2 text-xs bg-brand-50 text-brand-700 p-2 rounded flex items-center justify-between">
                      <span>开发环境模拟验证码：<strong>{devTipCode}</strong></span>
                      <button
                        type="button"
                        onClick={() => setSmsCode(devTipCode)}
                        className="underline text-brand-600 hover:text-brand-800"
                      >
                        一键填入
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="form-label">邮箱</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">密码</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="input-field"
                  />
                </div>
              </>
            )}

            <button type="submit" disabled={loading} className="btn-primary btn-full !py-3">
              {loading ? "登录中..." : mode === "sms" ? "验证并登录/注册" : "登录"}
            </button>

            <div className="flex justify-between items-center text-sm text-ink-muted">
              <Link to="/guest" className="text-brand-600 hover:underline">
                游客免登录体验 →
              </Link>
              <p>
                没有账号？{" "}
                <Link to="/register" className="text-brand-600 font-semibold hover:text-brand-700">
                  立即注册
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
