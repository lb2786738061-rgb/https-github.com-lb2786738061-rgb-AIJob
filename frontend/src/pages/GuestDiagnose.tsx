import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem("careerai_guest_device_id");
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("careerai_guest_device_id", id);
  }
  return id;
}

export default function GuestDiagnose() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [deviceId] = useState<string>(() => getOrCreateDeviceId());
  const [hasUsed, setHasUsed] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [resumeText, setResumeText] = useState("");
  const [targetJobTitle, setTargetJobTitle] = useState("后端开发工程师");
  const [diagnosing, setDiagnosing] = useState(false);

  const [result, setResult] = useState<{
    scoreOverall: number;
    targetJobTitle: string;
    highlights: string[];
    suggestions: string[];
    dimensionScores: { clarity: number; competitiveness: number; match: number; professionalism: number };
    message: string;
  } | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await api.getGuestStatus(deviceId);
        setHasUsed(res.hasUsed);
      } catch {
        // 忽略检查网络异常
      } finally {
        setLoadingStatus(false);
      }
    }
    checkStatus();
  }, [deviceId]);

  async function handleDiagnose() {
    if (resumeText.trim().length < 20) {
      toast("请至少粘贴一段 20 字以上的项目或工作经历", "error");
      return;
    }
    setDiagnosing(true);
    try {
      const data = await api.guestDiagnose({
        deviceId,
        resumeText,
        targetJobTitle,
      });
      setResult(data);
      setHasUsed(true);
      toast("体验诊断完成", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "诊断失败", "error");
    } finally {
      setDiagnosing(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* 顶部标题区 */}
      <div className="text-center space-y-2">
        <span className="badge badge-brand">免登录试测</span>
        <h1 className="text-3xl font-bold font-display text-ink">AI 简历轻量速测诊断</h1>
        <p className="text-ink-muted text-sm max-w-lg mx-auto">
          无需注册，粘贴您的简历段落或核心经历，即可体验 1 次快速 AI 竞争力体检与短板雷达透视。
        </p>
      </div>

      {/* 限制提示 */}
      {hasUsed && !result && (
        <div className="glass-card p-6 border-amber-300 bg-amber-50/50 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-amber-900">当前设备 1 次免费体验已用完</h3>
            <p className="text-sm text-amber-700">
              您已使用过本设备的免费体验机会。注册登录后即可享受附件上传、无限次深度精修与全真 AI 模拟面试！
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/login" className="btn-primary !py-2.5 !px-5 whitespace-nowrap">
              立即登录
            </Link>
            <Link to="/register" className="btn-secondary !py-2.5 !px-5 whitespace-nowrap">
              免费注册
            </Link>
          </div>
        </div>
      )}

      {/* 诊断输入表单 */}
      {!result && !hasUsed && (
        <div className="glass-card p-6 space-y-5 rounded-2xl">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <label className="font-semibold text-ink text-sm">
              意向求职岗位：
              <input
                type="text"
                value={targetJobTitle}
                onChange={(e) => setTargetJobTitle(e.target.value)}
                placeholder="例如：前端开发 / Java 后端 / 产品经理"
                className="input-field mt-1.5 font-normal"
              />
            </label>
            <span className="text-xs text-brand-600 bg-brand-50 px-3 py-1.5 rounded-full font-medium">
              本设备剩余可用次数: 1/1
            </span>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="font-semibold text-ink text-sm">粘贴简历文本内容或经历片段：</label>
              <button
                type="button"
                onClick={() =>
                  setResumeText(
                    "3年Java后端研发经验，主导微服务订单中心设计。通过 Redis 缓存优化与 SQL 索引调优，使下单核心接口 QPS 从 400 提升至 2200，P99 耗时降低 65%。熟练使用 SpringBoot、Docker、Kafka。"
                  )
                }
                className="text-xs text-brand-600 hover:underline"
              >
                填入示范样例
              </button>
            </div>
            <textarea
              rows={7}
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="请在此粘贴您的教育背景、工作经历、核心项目或个人优势技能...（字数不少于20字）"
              className="input-field text-sm leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={diagnosing || !resumeText.trim()}
              onClick={handleDiagnose}
              className="btn-primary !py-3 !px-8 flex items-center gap-2"
            >
              {diagnosing ? "AI 分析中..." : "🚀 开始免费 1 次诊断"}
            </button>
          </div>
        </div>
      )}

      {/* 诊断结果呈现 */}
      {result && (
        <div className="space-y-6 animate-fadeIn">
          <div className="glass-card p-6 rounded-2xl border-brand-200 bg-white/90 shadow-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between border-b border-surface-border pb-5 gap-4">
              <div>
                <span className="badge badge-brand mb-1">针对岗位: {result.targetJobTitle}</span>
                <h2 className="text-2xl font-bold text-ink">轻量诊断体检报告</h2>
              </div>
              <div className="text-center bg-brand-50 px-6 py-3 rounded-2xl border border-brand-200">
                <span className="text-xs text-brand-700 font-semibold uppercase tracking-wider block">综合竞争力预估</span>
                <span className="text-4xl font-extrabold text-brand-600 font-display">{result.scoreOverall}</span>
                <span className="text-xs text-ink-muted"> / 100</span>
              </div>
            </div>

            {/* 四维雷达条 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-surface-border">
              {[
                { label: "表达条理", val: result.dimensionScores.clarity },
                { label: "核心竞争力", val: result.dimensionScores.competitiveness },
                { label: "岗位匹配度", val: result.dimensionScores.match },
                { label: "专业技术度", val: result.dimensionScores.professionalism },
              ].map((dim) => (
                <div key={dim.label} className="bg-surface-ground p-3 rounded-xl text-center">
                  <span className="text-xs text-ink-muted block mb-1">{dim.label}</span>
                  <span className="text-xl font-bold text-ink">{dim.val}</span>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-brand-600 h-full rounded-full" style={{ width: `${dim.val}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* 亮点与短板 */}
            <div className="grid sm:grid-cols-2 gap-6 pt-5">
              <div className="space-y-2">
                <h4 className="font-bold text-emerald-800 flex items-center gap-1.5 text-sm">
                  <span>✨</span> 当前突出优势
                </h4>
                <ul className="space-y-2 text-sm text-ink-muted">
                  {result.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-amber-800 flex items-center gap-1.5 text-sm">
                  <span>💡</span> 关键改进建议
                </h4>
                <ul className="space-y-2 text-sm text-ink-muted">
                  {result.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 引导注册横幅 */}
          <div className="p-6 bg-gradient-to-r from-brand-600 to-indigo-700 text-white rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="space-y-1">
              <h3 className="text-xl font-bold">满意本次诊断体验？立即解锁完整功能！</h3>
              <p className="text-sm text-white/80">
                注册登录后即可上传完整 PDF/Word 原件、启用 STAR 智能重写、多角色模拟面试与错题复盘。
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/register" className="bg-white text-brand-700 font-bold px-6 py-2.5 rounded-xl hover:bg-white/90 whitespace-nowrap">
                免费注册并保存
              </Link>
              <Link to="/login" className="bg-brand-500/50 border border-white/30 text-white font-medium px-5 py-2.5 rounded-xl hover:bg-brand-500/70 whitespace-nowrap">
                已有账号登录
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
