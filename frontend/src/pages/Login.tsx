import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
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
          {["✓ 多维度简历体检", "✓ 4 类 AI 面试官", "✓ 深度复盘报告"].map((t) => (
            <p key={t}>{t}</p>
          ))}
        </div>
      </div>

      <div className="auth-card-wrapper">
        <div className="auth-card">
          <h2 className="font-display text-2xl font-bold mb-1 text-ink">欢迎回来</h2>
          <p className="page-subtitle mb-8">登录你的职赢AI 账号</p>

          <form onSubmit={handleSubmit} className="space-y-5">
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
            <button type="submit" disabled={loading} className="btn-primary btn-full !py-3">
              {loading ? "登录中..." : "登录"}
            </button>
            <p className="text-sm text-center text-ink-muted">
              没有账号？{" "}
              <Link to="/register" className="text-brand-600 font-semibold hover:text-brand-700">
                立即注册
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
