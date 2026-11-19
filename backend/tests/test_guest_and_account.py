import unittest
import uuid
from starlette.testclient import TestClient

from app.db.migrate import migrate
from app.main import app


class TestGuestAndAccount(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        migrate()
        cls.client = TestClient(app)

    def test_01_sms_flow_and_account(self):
        test_phone = "13800138000"
        # 1. 发送验证码
        res = self.client.post("/api/v1/auth/send-sms", json={"phone": test_phone})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        code = data.get("devCode")
        self.assertTrue(bool(code))

        # 2. 错误验证码应被拒绝
        bad_res = self.client.post("/api/v1/auth/login-sms", json={"phone": test_phone, "code": "000000"})
        self.assertEqual(bad_res.status_code, 400)

        # 3. 正确验证码登录并自动注册
        login_res = self.client.post("/api/v1/auth/login-sms", json={"phone": test_phone, "code": code})
        self.assertEqual(login_res.status_code, 200)
        login_data = login_res.json()
        token = login_data["token"]
        self.assertTrue(bool(token))
        headers = {"Authorization": f"Bearer {token}"}

        # 4. 获取用户详情
        me_res = self.client.get("/api/v1/user/me", headers=headers)
        self.assertEqual(me_res.status_code, 200)
        user_info = me_res.json()["user"]
        self.assertEqual(user_info["phone"], test_phone)

        # 5. 更新个人资料（意向岗位与隐私设置）
        update_res = self.client.put(
            "/api/v1/user/profile",
            headers=headers,
            json={
                "displayName": "高级架构师候选人",
                "targetJobTitle": "Golang后端架构师",
                "privacySettings": {"shareWeakQuestions": False},
            },
        )
        self.assertEqual(update_res.status_code, 200)

        # 验证更新
        me_res2 = self.client.get("/api/v1/user/me", headers=headers)
        user_info2 = me_res2.json()["user"]
        self.assertEqual(user_info2["displayName"], "高级架构师候选人")
        self.assertEqual(user_info2["targetJobTitle"], "Golang后端架构师")
        self.assertFalse(user_info2["privacySettings"].get("shareWeakQuestions"))

        # 6. 注销账号
        del_res = self.client.post("/api/v1/user/delete-account", headers=headers)
        self.assertEqual(del_res.status_code, 200)

    def test_02_guest_diagnose_limit(self):
        device_id = f"test-device-{uuid.uuid4().hex[:8]}"

        # 查询状态，初始应为未用
        status_res = self.client.get(f"/api/v1/resumes/guest-status?deviceId={device_id}")
        self.assertEqual(status_res.status_code, 200)
        self.assertFalse(status_res.json()["hasUsed"])
        self.assertEqual(status_res.json()["remaining"], 1)

        # 第 1 次体验：内容过短应报错
        short_res = self.client.post(
            "/api/v1/resumes/guest-diagnose",
            json={"deviceId": device_id, "resumeText": "写代码"},
        )
        self.assertEqual(short_res.status_code, 400)

        # 第 1 次体验：正常文本
        valid_res = self.client.post(
            "/api/v1/resumes/guest-diagnose",
            json={
                "deviceId": device_id,
                "resumeText": "熟练掌握 Python 与 FastAPI，主导微服务重构，优化核心链路QPS从200提升至1500，负责团队技术方案设计。",
                "targetJobTitle": "Python高级工程师",
            },
        )
        self.assertEqual(valid_res.status_code, 200)
        diag = valid_res.json()
        self.assertGreaterEqual(diag["scoreOverall"], 60)
        self.assertTrue(len(diag["highlights"]) > 0)
        self.assertTrue(len(diag["suggestions"]) > 0)
        self.assertEqual(diag["guestLimit"]["remaining"], 0)

        # 再次查询状态
        status_res2 = self.client.get(f"/api/v1/resumes/guest-status?deviceId={device_id}")
        self.assertTrue(status_res2.json()["hasUsed"])

        # 第 2 次体验：必须拦截并返回 403
        blocked_res = self.client.post(
            "/api/v1/resumes/guest-diagnose",
            json={
                "deviceId": device_id,
                "resumeText": "再来一次诊断测试，主导项目开发并完成上线部署。",
            },
        )
        self.assertEqual(blocked_res.status_code, 403)
        self.assertEqual(blocked_res.json()["code"], "GUEST_LIMIT_REACHED")

    def test_03_payment_refund_flow(self):
        # 使用 demo 账号（用户 id 1）
        from app.services.local_auth import create_local_token
        token = create_local_token(1)
        headers = {"Authorization": f"Bearer {token}"}

        # 创建订单
        checkout_res = self.client.post("/api/v1/payments/checkout", headers=headers, json={"planId": "monthly"})
        self.assertEqual(checkout_res.status_code, 200)
        order_id = checkout_res.json()["order"]["id"]

        # 支付订单
        pay_res = self.client.post(f"/api/v1/payments/confirm/{order_id}", headers=headers)
        self.assertEqual(pay_res.status_code, 200)
        self.assertEqual(pay_res.json()["order"]["status"], "paid")

        # 发起退款演示
        refund_res = self.client.post(
            f"/api/v1/payments/orders/{order_id}/refund",
            headers=headers,
            json={"reason": "测试订单退款演示功能"},
        )
        self.assertEqual(refund_res.status_code, 200)
        refund_order = refund_res.json()["order"]
        self.assertEqual(refund_order["status"], "refunded")
        self.assertEqual(refund_order["refundStatus"], "refunded")

    def test_04_interview_trend_stats(self):
        from app.services.local_auth import create_local_token
        token = create_local_token(1)
        headers = {"Authorization": f"Bearer {token}"}

        trend_res = self.client.get("/api/v1/interviews/stats/trend", headers=headers)
        self.assertEqual(trend_res.status_code, 200)
        data = trend_res.json()
        self.assertIn("trends", data)
        self.assertIn("totalCompleted", data)
