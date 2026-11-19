import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";

export default function Profile() {
  const { user, refreshMe, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [targetJobTitle, setTargetJobTitle] = useState(user?.targetJobTitle || "");
  const [allowWeakAnalysis, setAllowWeakAnalysis] = useState(
    user?.privacySettings?.allowWeakAnalysis !== false
  );
  const [recordTranscript, setRecordTranscript] = useState(
    user?.privacySettings?.recordTranscript !== false
  );

  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setTargetJobTitle(user.targetJobTitle || "");
      if (user.privacySettings) {
        setAllowWeakAnalysis(user.privacySettings.allowWeakAnalysis !== false);
        setRecordTranscript(user.privacySettings.recordTranscript !== false);
      }
    }
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile({
        displayName,
        targetJobTitle,
        privacySettings: {
          allowWeakAnalysis,
          recordTranscript,
        },
      });
      await refreshMe();
      toast("个人资料已更新", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await api.deleteAccount();
      toast("账号已安全注销", "success");
      logout();
      navigate("/");
    } catch (err) {
      toast(err instanceof Error ? err.message : "注销失败", "error");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-display text-ink">个人中心与偏好设置</h1>
        <p className="text-ink-muted text-sm mt-1">
          管理您的账户资料、求职意向岗位与隐私保护选项。
        </p>
      </div>

      {/* 账号概况 */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <h2 className="text-base font-bold text-ink">账号基础信息</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-surface-ground rounded-xl">
            <span className="text-ink-muted text-xs block mb-0.5">绑定邮箱</span>
            <span className="font-medium text-ink">{user?.email || "未绑定"}</span>
          </div>
          <div className="p-3 bg-surface-ground rounded-xl">
            <span className="text-ink-muted text-xs block mb-0.5">绑定手机</span>
            <span className="font-medium text-ink">{user?.phone || "未绑定"}</span>
          </div>
          <div className="p-3 bg-surface-ground rounded-xl">
            <span className="text-ink-muted text-xs block mb-0.5">会员方案</span>
            <span className="font-medium text-brand-600">
              {user?.planTier === "membership_pass" ? "通关会员（无限制）" : "基础免费版"}
            </span>
          </div>
          <div className="p-3 bg-surface-ground rounded-xl">
            <span className="text-ink-muted text-xs block mb-0.5">用户编号</span>
            <span className="font-medium text-ink">UID #{user?.id}</span>
          </div>
        </div>
      </div>

      {/* 偏好设置表单 */}
      <form onSubmit={handleSave} className="glass-card p-6 rounded-2xl space-y-6">
        <h2 className="text-base font-bold text-ink">求职偏好设定</h2>

        <div className="space-y-4">
          <div>
            <label className="form-label">用户昵称</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-field"
              placeholder="请输入您的昵称"
            />
          </div>

          <div>
            <label className="form-label">意向目标岗位</label>
            <input
              type="text"
              value={targetJobTitle}
              onChange={(e) => setTargetJobTitle(e.target.value)}
              className="input-field"
              placeholder="例如：高级前端开发工程师 / 算法专家 / 数据分析师"
            />
            <p className="text-xs text-ink-muted mt-1">
              设定后，系统在简历解析、模拟面试出题时将优先以此岗位为考量标准。
            </p>
          </div>
        </div>

        <div className="border-t border-surface-border pt-5 space-y-4">
          <h3 className="text-sm font-bold text-ink">隐私与算法授权</h3>

          <label className="flex items-center justify-between p-3 bg-surface-ground rounded-xl cursor-pointer">
            <div className="space-y-0.5">
              <span className="text-sm font-medium text-ink block">弱题复盘自适应推荐</span>
              <span className="text-xs text-ink-muted block">
                允许 AI 在后续模拟面试中根据历史掌握薄弱的问题进行有针对性复测出题
              </span>
            </div>
            <input
              type="checkbox"
              checked={allowWeakAnalysis}
              onChange={(e) => setAllowWeakAnalysis(e.target.checked)}
              className="w-5 h-5 accent-brand-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-surface-ground rounded-xl cursor-pointer">
            <div className="space-y-0.5">
              <span className="text-sm font-medium text-ink block">逐字稿与口语表达分析</span>
              <span className="text-xs text-ink-muted block">
                在模拟面试结束时生成语气助词（如“呃/啊”）统计和详细复盘逐字记录
              </span>
            </div>
            <input
              type="checkbox"
              checked={recordTranscript}
              onChange={(e) => setRecordTranscript(e.target.checked)}
              className="w-5 h-5 accent-brand-600 rounded"
            />
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="btn-primary !px-6 !py-2.5">
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </form>

      {/* 危险操作区：注销账号 */}
      <div className="p-6 border border-rose-200 bg-rose-50/50 rounded-2xl space-y-4">
        <div>
          <h2 className="text-base font-bold text-rose-800">账号安全危险区</h2>
          <p className="text-xs text-rose-600 mt-1">
            注销后，您的个人资料将被匿名化，所有生成的简历诊断历史、面试记录将不可恢复。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2 border border-rose-300 text-rose-700 bg-white hover:bg-rose-100 rounded-lg text-sm font-medium"
        >
          注销当前账号
        </button>
      </div>

      {/* 注销确认弹窗 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-rose-600">确定注销账号吗？</h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              此操作不可逆。一旦确认注销：
              <br />• 您的手机号与邮箱将即刻解绑与脱敏；
              <br />• 正在生效的会员权益将即刻终止且不自动退款；
              <br />• 您将无法再次以该账号登录查看历史复盘报告。
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary !py-2 !px-4 text-sm"
              >
                取消
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteAccount}
                className="bg-rose-600 hover:bg-rose-700 text-white font-medium px-4 py-2 rounded-xl text-sm"
              >
                {deleting ? "注销中..." : "确认永久注销"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
