import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";

export default function Register() {
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, displayName);
      toast("注册成功", "success");
      navigate("/");
    } catch (err) {
      toast(err instanceof Error ? err.message : "注册失败", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-side-panel glass-card-dark">
        <p className="section-label !text-brand-300 mb-4">加入职赢AI</p>
        <h1 className="font-display text-3xl font-bold mb-4 leading-snug">
          免费注册
          <br />
          即刻体验
        </h1>
        <p className="text-white/60 text-sm leading-relaxed">
          注册即可使用简历诊断与模拟面试，让 AI 成为你的私人求职教练。
        </p>
      </div>

      <div className="auth-card-wrapper">
        <div className="auth-card">
          <h2 className="font-display text-2xl font-bold mb-1 text-ink">创建账号</h2>
          <p className="page-subtitle mb-8">填写信息，开始 AI 求职之旅</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="form-label">昵称</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                placeholder="你的称呼"
                className="input-field"
              />
            </div>
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
              <label className="form-label">密码（至少 6 位）</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="input-field"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary btn-full !py-3">
              {loading ? "注册中..." : "注册"}
            </button>
            <p className="text-sm text-center text-ink-muted">
              已有账号？{" "}
              <Link to="/login" className="text-brand-600 font-semibold hover:text-brand-700">
                登录
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
