import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app import create_app


class ConsultationApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        database = Path(self.temp_dir.name) / "test.sqlite3"
        self.app = create_app(
            {
                "TESTING": True,
                "SECRET_KEY": "test-key",
                "DATABASE": str(database),
                "TECHJURE_UPI_ID": "9904407787@ptaxis",
                "TECHJURE_ADMIN_TOKEN": "test-admin-token",
            }
        )
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def register(self, email="client@example.com"):
        return self.client.post(
            "/api/register",
            json={"name": "Test Client", "email": email, "password": "securepass123"},
        )

    def booking(self, day="2099-06-15", time="10:00"):
        return self.client.post(
            "/api/bookings",
            json={
                "matter_type": "Contract or tender advice",
                "date": day,
                "time": time,
                "details": "I would like advice about my contract.",
            },
        )

    def test_booking_requires_registration(self):
        self.assertEqual(self.booking().status_code, 401)

    def test_complimentary_and_paid_bookings_email_all_booking_details(self):
        self.register()
        self.app.config.update(
            TECHJURE_BOOKING_NOTIFICATION_EMAIL="tech.jureconsultancy@gmail.com",
            TECHJURE_SMTP_HOST="smtp.example.com",
            TECHJURE_SMTP_PORT=587,
            TECHJURE_SMTP_USERNAME="sender@example.com",
            TECHJURE_SMTP_PASSWORD="smtp-password",
        )

        with patch("smtplib.SMTP") as smtp_factory:
            smtp = smtp_factory.return_value.__enter__.return_value
            complimentary = self.booking()
            paid = self.booking(day="2099-06-16", time="11:00")

        self.assertEqual(complimentary.status_code, 201)
        self.assertEqual(paid.status_code, 201)
        self.assertEqual(smtp.send_message.call_count, 2)
        complimentary_email, paid_email = [
            call.args[0] for call in smtp.send_message.call_args_list
        ]
        self.assertEqual(complimentary_email["To"], "tech.jureconsultancy@gmail.com")
        self.assertIn("Client name: Test Client", complimentary_email.get_content())
        self.assertIn("Client email: client@example.com", complimentary_email.get_content())
        self.assertIn("Consultation fee: Complimentary", complimentary_email.get_content())
        self.assertIn("Matter details:\nI would like advice about my contract.", complimentary_email.get_content())
        self.assertIn("Consultation fee: INR 2,000", paid_email.get_content())
        self.assertIn("Booking status: pending_payment", paid_email.get_content())
        self.assertIn(paid.json["payment"]["order_id"], paid_email.get_content())

    def test_booking_is_saved_when_email_delivery_fails(self):
        self.register()
        self.app.config.update(
            TECHJURE_SMTP_USERNAME="sender@example.com",
            TECHJURE_SMTP_PASSWORD="smtp-password",
        )

        with patch("smtplib.SMTP") as smtp_factory:
            smtp = smtp_factory.return_value.__enter__.return_value
            smtp.send_message.side_effect = OSError("SMTP unavailable")
            response = self.booking()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(self.client.get("/api/bookings").json["bookings"]), 1)

    def test_first_consultation_is_free_and_later_bookings_use_direct_upi(self):
        registered = self.register()
        self.assertEqual(registered.status_code, 201)
        self.assertEqual(registered.json["user"]["next_consultation_fee"], 0)

        first = self.booking()
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.json["fee"], 0)
        self.assertFalse(first.json["payment_required"])

        second = self.booking(day="2099-06-16", time="11:00")
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.json["fee"], 2000)
        self.assertEqual(second.json["status"], "pending_payment")
        payment = second.json["payment"]
        self.assertEqual(payment["upi_id"], "9904407787@ptaxis")
        self.assertIn("am=2000.00", payment["payment_uri"])
        self.assertIn("pa=9904407787%40ptaxis", payment["payment_uri"])
        pending = self.client.get("/api/bookings").json["bookings"][0]
        self.assertEqual(pending["status"], "pending_payment")
        self.assertEqual(pending["payment"]["order_id"], payment["order_id"])

    def test_paid_booking_stays_pending_until_admin_verifies_reference(self):
        self.register()
        self.booking()
        second = self.booking(day="2099-06-16", time="11:00")
        order_id = second.json["payment"]["order_id"]

        submitted = self.client.post(
            f"/api/payments/{order_id}/reference",
            json={"reference": "412345678901"},
        )
        self.assertEqual(submitted.status_code, 200)
        self.assertEqual(submitted.json["status"], "pending_verification")

        admin_headers = {"X-Admin-Token": "test-admin-token"}
        pending = self.client.get("/api/admin/payments/pending", headers=admin_headers)
        self.assertEqual(pending.status_code, 200)
        self.assertEqual(pending.json["payments"][0]["payment_reference"], "412345678901")

        bookings = self.client.get("/api/bookings").json["bookings"]
        self.assertEqual(bookings[0]["status"], "pending_verification")
        self.assertEqual(bookings[0]["payment_reference"], "412345678901")

        verified = self.client.post(
            f"/api/admin/payments/{second.json['booking_id']}/verify",
            headers=admin_headers,
        )
        self.assertEqual(verified.status_code, 200)
        self.assertEqual(verified.json["status"], "requested")

    def test_client_cannot_access_admin_verification(self):
        response = self.client.get("/api/admin/payments/pending")
        self.assertEqual(response.status_code, 401)

    def test_admin_can_reject_reference_for_client_resubmission(self):
        self.register()
        self.booking()
        paid = self.booking(day="2099-06-16", time="11:00")
        order_id = paid.json["payment"]["order_id"]
        booking_id = paid.json["booking_id"]
        self.client.post(
            f"/api/payments/{order_id}/reference",
            json={"reference": "412345678901"},
        )

        rejected = self.client.post(
            f"/api/admin/payments/{booking_id}/reject",
            headers={"X-Admin-Token": "test-admin-token"},
        )
        self.assertEqual(rejected.status_code, 200)
        booking = self.client.get("/api/bookings").json["bookings"][0]
        self.assertEqual(booking["status"], "pending_payment")
        self.assertIsNone(booking["payment_reference"])

    def test_invalid_or_duplicate_payment_reference_is_rejected(self):
        self.register()
        self.booking()
        second = self.booking(day="2099-06-16", time="11:00")
        order_id = second.json["payment"]["order_id"]

        invalid = self.client.post(
            f"/api/payments/{order_id}/reference", json={"reference": "bad"}
        )
        self.assertEqual(invalid.status_code, 400)
        valid = self.client.post(
            f"/api/payments/{order_id}/reference",
            json={"reference": "412345678901"},
        )
        self.assertEqual(valid.status_code, 200)

        third = self.booking(day="2099-06-17", time="12:00")
        duplicate = self.client.post(
            f"/api/payments/{third.json['payment']['order_id']}/reference",
            json={"reference": "412345678901"},
        )
        self.assertEqual(duplicate.status_code, 409)

    def test_paid_booking_requires_configured_receiving_upi_id(self):
        self.register()
        self.booking()
        self.app.config["TECHJURE_UPI_ID"] = ""
        response = self.booking(day="2099-06-16", time="11:00")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(len(self.client.get("/api/bookings").json["bookings"]), 1)

    def test_duplicate_registration_and_invalid_booking_are_rejected(self):
        self.register()
        duplicate = self.register()
        self.assertEqual(duplicate.status_code, 409)
        invalid = self.booking(day="2000-01-01")
        self.assertEqual(invalid.status_code, 400)

    def test_failed_login_does_not_authenticate(self):
        self.register()
        self.client.post("/api/logout")
        response = self.client.post(
            "/api/login",
            json={"email": "client@example.com", "password": "incorrect"},
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.client.get("/api/bookings").status_code, 401)


if __name__ == "__main__":
    unittest.main()
