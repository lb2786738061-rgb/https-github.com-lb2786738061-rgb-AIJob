import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type EnterpriseCompany, type Resume } from "../api/client";
import { resumeOptionLabel } from "../lib/resumeLabel";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import {
  RocketIcon,
  BuildingIcon,
  EnglishIcon,
  CpuChipIcon,
  TrendUpIcon,
  SearchIcon,
  MicIcon,
  TargetIcon,
  ChartIcon,
  CompanyIcon,
} from "../components/Icons";
import type { ComponentType } from "react";

const COMPANY_ICONS: Record<string, { Icon: ComponentType<{ size?: number }>; color: string }> = {
  bytedance: { Icon: RocketIcon, color: "from-indigo-100 to-violet-100 text-indigo-700" },
  alibaba: { Icon: BuildingIcon, color: "from-orange-100 to-amber-100 text-orange-700" },
  tencent: { Icon: MicIcon, color: "from-sky-100 to-blue-100 text-sky-700" },
  huawei: { Icon: CpuChipIcon, color: "from-red-100 to-rose-100 text-red-700" },
  mckinsey: { Icon: TrendUpIcon, color: "from-slate-100 to-gray-100 text-slate-700" },
  baidu: { Icon: SearchIcon, color: "from-blue-100 to-indigo-100 text-blue-700" },
  meituan: { Icon: TargetIcon, color: "from-yellow-100 to-amber-100 text-yellow-700" },
  jd: { Icon: BuildingIcon, color: "from-red-100 to-orange-100 text-red-700" },
  xiaomi: { Icon: EnglishIcon, color: "from-orange-100 to-red-100 text-orange-700" },
  deloitte: { Icon: ChartIcon, color: "from-emerald-100 to-teal-100 text-emerald-700" },
};

export default function Enterprise() {
  const { quota } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<EnterpriseCompany[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResume, setSelectedResume] = useState<number | undefined>();
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    api.getEnterpriseCompanies().then(setCompanies).catch(() => {});
    api.getResumes().then(setResumes).catch(() => {});
  }, []);

  async function startTraining(companyId: string) {
    setLoading(companyId);
    try {
      const data = await api.startEnterpriseSession({
        companyId,
        resumeId: selectedResume,
      });
      toast(`已开启${data.company.name}名企冲刺训练`, "success");
      navigate(`/interview?sessionId=${data.session.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "启动失败", "error");
    } finally {
      setLoading(null);
    }
  }

  const credits = quota?.enterpriseCredits ?? 0;

  return (
    <div className="page-container pb-16">
      <div className="mb-10 animate-fade-up">
        <p className="section-label mb-2">名企定向</p>
        <h1 className="page-title text-3xl mb-2">名企定向冲刺包</h1>
        <p className="page-subtitle mb-4">199元/次 · 大厂真题专项突击 + AI 双重精修</p>
        <div className="inline-flex items-center gap-2 tag tag-success">
          剩余次数：{credits} 次
          {credits === 0 && (
            <Link to="/pricing" className="text-brand-700 font-semibold hover:underline ml-1">
              去购买 →
            </Link>
          )}
        </div>
      </div>

      {resumes.length > 0 && (
        <div className="glass-card p-5 mb-6 max-w-md animate-fade-up animate-fade-up-delay-1">
          <label className="form-label">关联简历（可选）</label>
          <select
            value={selectedResume ?? ""}
            onChange={(e) =>
              setSelectedResume(e.target.value ? parseInt(e.target.value) : undefined)
            }
            className="input-field"
          >
            <option value="">不关联</option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {resumeOptionLabel(r)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-5">
        {companies.map((c, i) => (
          <div
            key={c.id}
            className={`glass-card glass-card-interactive p-6 animate-fade-up animate-fade-up-delay-${Math.min(i + 1, 4)}`}
          >
            <div className="flex items-start gap-4 mb-4">
              {(() => {
                const meta = COMPANY_ICONS[c.id];
                if (meta) {
                  const Icon = meta.Icon;
                  return (
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 ${meta.color} border border-white shadow-sm`}>
                      <Icon size={22} />
                    </div>
                  );
                }
                return (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-gray-100 flex items-center justify-center shrink-0 border border-white shadow-sm">
                    <CompanyIcon size={22} className="text-slate-700" />
                  </div>
                );
              })()}
              <div>
                <h3 className="font-display font-bold text-xl text-ink">{c.name}</h3>
                <p className="text-sm text-ink-muted mt-1">{c.description}</p>
              </div>
            </div>
            <button
              onClick={() => startTraining(c.id)}
              disabled={loading === c.id || credits < 1}
              className="btn-primary btn-full !py-2.5"
            >
              {loading === c.id ? "准备中..." : "开始冲刺训练"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}