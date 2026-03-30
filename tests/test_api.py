import unittest

from fastapi.testclient import TestClient

from app.main import app


class ApiSmokeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_root_page(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("subscriber-search", response.text)
        self.assertIn("device-search", response.text)
        self.assertIn("usageChart", response.text)

    def test_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("status"), "ok")

    def test_get_subscribers(self):
        response = self.client.get("/api/subscribers")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)
        self.assertIn("userId", data[0])
        self.assertIn("status", data[0])

    def test_get_subscriber_devices(self):
        response = self.client.get("/api/subscribers/U001/devices")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)
        self.assertIn("deviceId", data[0])
        self.assertIn("status", data[0])

    def test_unknown_subscriber_returns_404(self):
        response = self.client.get("/api/subscribers/UNKNOWN/devices")
        self.assertEqual(response.status_code, 404)

    def test_get_device_usage(self):
        response = self.client.get("/api/devices/D001/usage")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertIsInstance(data, dict)
        self.assertIn("weeklyUsageTrend", data)
        self.assertIsInstance(data["weeklyUsageTrend"], list)

    def test_unknown_device_returns_404(self):
        response = self.client.get("/api/devices/UNKNOWN/usage")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
