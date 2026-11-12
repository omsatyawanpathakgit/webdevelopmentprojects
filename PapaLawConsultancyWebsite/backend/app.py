import os
import re
import secrets
import sqlite3
import hmac
import smtplib
import ssl
from datetime import date
from email.message import EmailMessage
from functools import wraps
from pathlib import Path
from urllib.parse import urlencode

from flask import Flask, g, jsonify, request, session
from dotenv import load_dotenv
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
DATABASE = Path(os.environ.get("TECHJURE_DATABASE", BASE_DIR / "techjure.sqlite3"))
TIME_SLOTS = {"09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"}


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("TECHJURE_SECRET_KEY") or secrets.token_hex(32),
        DATABASE=str(DATABASE),
        TECHJURE_UPI_ID=os.environ.get("TECHJURE_UPI_ID", "").strip(),
        TECHJURE_ADMIN_TOKEN=os.environ.get("TECHJURE_ADMIN_TOKEN", ""),
        TECHJURE_BOOKING_NOTIFICATION_EMAIL=os.environ.get(
            "TECHJURE_BOOKING_NOTIFICATION_EMAIL", "tech.jureconsultancy@gmail.com"
        ).strip(),
        TECHJURE_SMTP_HOST=os.environ.get("TECHJURE_SMTP_HOST", "smtp.gmail.com").strip(),
        TECHJURE_SMTP_PORT=int(os.environ.get("TECHJURE_SMTP_PORT", "587")),
        TECHJURE_SMTP_USERNAME=os.environ.get("TECHJURE_SMTP_USERNAME", "").strip(),
        TECHJURE_SMTP_PASSWORD=os.environ.get("TECHJURE_SMTP_PASSWORD", ""),
        TECHJURE_SMTP_FROM_EMAIL=os.environ.get("TECHJURE_SMTP_FROM_EMAIL", "").strip(),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        MAX_CONTENT_LENGTH=64 * 1024,
    )
    if test_config:
        app.config.update(test_config)
    app.config["TECHJURE_UPI_ID"] = app.config["TECHJURE_UPI_ID"].strip()
    if app.config["TECHJURE_UPI_ID"] and not re.fullmatch(
        r"[\w.-]{2,256}@[A-Za-z0-9.-]{2,64}", app.config["TECHJURE_UPI_ID"]
    ):
        raise ValueError("TECHJURE_UPI_ID must be a valid UPI ID.")

    def upi_payment_details(order_id):
        upi_id = app.config["TECHJURE_UPI_ID"]
        payment_uri = "upi://pay?" + urlencode(
            {
                "pa": upi_id,
                "pn": "Tech-Jure Consultancy Services",
                "am": "2000.00",
                "cu": "INR",
                "tn": f"Consultation {order_id}",
                "tr": order_id,
            }
        )
        return {
            "order_id": order_id,
            "upi_id": upi_id,
            "amount": "2000.00",
            "payment_uri": payment_uri,
        }

    def send_booking_notification(booking_id, user, booking):
        username = app.config["TECHJURE_SMTP_USERNAME"]
        password = app.config["TECHJURE_SMTP_PASSWORD"]
        if not username or not password:
            app.logger.warning("Booking email notification skipped: SMTP credentials are not configured")
            return

        message = EmailMessage()
        message["Subject"] = f"New consultation booking #{booking_id}"
        message["From"] = app.config["TECHJURE_SMTP_FROM_EMAIL"] or username
        message["To"] = app.config["TECHJURE_BOOKING_NOTIFICATION_EMAIL"]
        fee = "Complimentary" if booking["fee"] == 0 else f"INR {booking['fee']:,}"
        message.set_content(
            "A consultation booking was submitted.\n\n"
            f"Booking ID: {booking_id}\n"
            f"Client name: {user['name']}\n"
            f"Client email: {user['email']}\n"
            f"Matter type: {booking['matter_type']}\n"
            f"Preferred date: {booking['date']}\n"
            f"Preferred time: {booking['time']}\n"
            f"Consultation fee: {fee}\n"
            f"Booking status: {booking['status']}\n"
            f"Payment order ID: {booking['payment_order_id'] or 'Not applicable'}\n\n"
            "Matter details:\n"
            f"{booking['details']}\n"
        )

        try:
            with smtplib.SMTP(
                app.config["TECHJURE_SMTP_HOST"],
                app.config["TECHJURE_SMTP_PORT"],
                timeout=10,
            ) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                smtp.login(username, password)
                smtp.send_message(message)
        except (OSError, smtplib.SMTPException):
            app.logger.exception("Failed to send booking notification for booking %s", booking_id)

    def require_admin():
        expected = app.config["TECHJURE_ADMIN_TOKEN"]
        supplied = request.headers.get("X-Admin-Token", "")
        return bool(expected) and bool(supplied) and hmac.compare_digest(expected, supplied)

    def get_db():
        if "db" not in g:
            g.db = sqlite3.connect(app.config["DATABASE"], timeout=10)
            g.db.row_factory = sqlite3.Row
            g.db.execute("PRAGMA foreign_keys = ON")
        return g.db

    def init_db():
        database_path = Path(app.config["DATABASE"])
        database_path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(database_path)
        try:
            db.executescript(
                """
                PRAGMA foreign_keys = ON;
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS bookings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    matter_type TEXT NOT NULL,
                    appointment_date TEXT NOT NULL,
                    appointment_time TEXT NOT NULL,
                    details TEXT NOT NULL,
                    fee INTEGER NOT NULL CHECK (fee IN (0, 2000)),
                    status TEXT NOT NULL DEFAULT 'requested',
                    payment_order_id TEXT UNIQUE,
                    payment_txn_id TEXT,
                    payment_status TEXT NOT NULL DEFAULT 'not_required',
                    payment_reference TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_bookings_user_created
                    ON bookings(user_id, created_at DESC);
                """
            )
            booking_columns = {
                row[1] for row in db.execute("PRAGMA table_info(bookings)")
            }
            for name, definition in (
                ("payment_order_id", "TEXT"),
                ("payment_txn_id", "TEXT"),
                ("payment_status", "TEXT NOT NULL DEFAULT 'not_required'"),
                ("payment_reference", "TEXT"),
            ):
                if name not in booking_columns:
                    db.execute(f"ALTER TABLE bookings ADD COLUMN {name} {definition}")
            db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_payment_order ON bookings(payment_order_id)")
            db.execute(
                """
                UPDATE bookings
                SET status = 'payment_failed', payment_status = 'gateway_removed'
                WHERE status = 'pending_payment' AND payment_status = 'pending'
                  AND payment_order_id IS NOT NULL AND payment_reference IS NULL
                """
            )
            db.commit()
        finally:
            db.close()

    @app.teardown_appcontext
    def close_db(_error=None):
        db = g.pop("db", None)
        if db is not None:
            db.close()

    with app.app_context():
        init_db()

    def current_user():
        user_id = session.get("user_id")
        if user_id is None:
            return None
        return get_db().execute(
            "SELECT id, name, email FROM users WHERE id = ?", (user_id,)
        ).fetchone()

    def login_required(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            user = current_user()
            if user is None:
                session.clear()
                return jsonify(error="Please sign in to continue."), 401
            g.user = user
            return view(*args, **kwargs)

        return wrapped

    def json_body():
        data = request.get_json(silent=True)
        return data if isinstance(data, dict) else {}

    def public_user(user):
        previous = get_db().execute(
            """
            SELECT COUNT(*) AS total FROM bookings
            WHERE user_id = ? AND status NOT IN ('pending_payment', 'payment_failed')
            """,
            (user["id"],),
        ).fetchone()["total"]
        return {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "next_consultation_fee": 0 if previous == 0 else 2000,
        }

    def payment_details_for_booking(row):
        if row["fee"] != 2000 or row["status"] != "pending_payment":
            return None
        if not app.config["TECHJURE_UPI_ID"]:
            return None
        return upi_payment_details(row["payment_order_id"])

    @app.get("/api/health")
    def health():
        return jsonify(status="ok")

    @app.get("/api/session")
    def session_status():
        user = current_user()
        return jsonify(user=public_user(user) if user else None)

    @app.post("/api/register")
    def register():
        data = json_body()
        name = data.get("name", "").strip() if isinstance(data.get("name"), str) else ""
        email = data.get("email", "").strip().lower() if isinstance(data.get("email"), str) else ""
        password = data.get("password", "") if isinstance(data.get("password"), str) else ""
        if len(name) < 2 or len(name) > 120:
            return jsonify(error="Please enter a name between 2 and 120 characters."), 400
        if len(email) > 254 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            return jsonify(error="Please enter a valid email address."), 400
        if len(password) < 8 or len(password) > 256:
            return jsonify(error="Your password must be between 8 and 256 characters."), 400

        db = get_db()
        try:
            cursor = db.execute(
                "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                (name, email, generate_password_hash(password)),
            )
            db.commit()
        except sqlite3.IntegrityError:
            return jsonify(error="An account with this email already exists. Please sign in."), 409
        user = db.execute(
            "SELECT id, name, email FROM users WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
        session.clear()
        session["user_id"] = user["id"]
        return jsonify(user=public_user(user)), 201

    @app.post("/api/login")
    def login():
        data = json_body()
        email = data.get("email", "").strip().lower() if isinstance(data.get("email"), str) else ""
        password = data.get("password", "") if isinstance(data.get("password"), str) else ""
        user = get_db().execute(
            "SELECT id, name, email, password_hash FROM users WHERE email = ?", (email,)
        ).fetchone()
        if user is None or not check_password_hash(user["password_hash"], password):
            return jsonify(error="Email or password is incorrect."), 401
        session.clear()
        session["user_id"] = user["id"]
        return jsonify(user=public_user(user))

    @app.post("/api/logout")
    def logout():
        session.clear()
        return jsonify(status="signed_out")

    @app.route("/api/bookings", methods=["GET", "POST"])
    @login_required
    def bookings():
        db = get_db()
        if request.method == "GET":
            rows = db.execute(
                """
                SELECT id, matter_type, appointment_date, appointment_time, fee, status,
                       payment_order_id, payment_status, payment_reference
                FROM bookings WHERE user_id = ? ORDER BY appointment_date DESC, appointment_time DESC
                """,
                (g.user["id"],),
            ).fetchall()
            return jsonify(
                bookings=[
                    {
                        "id": row["id"],
                        "matter_type": row["matter_type"],
                        "date": row["appointment_date"],
                        "time": row["appointment_time"],
                        "fee": row["fee"],
                        "status": row["status"],
                        "payment_order_id": row["payment_order_id"],
                        "payment_status": row["payment_status"],
                        "payment_reference": row["payment_reference"],
                        "payment": payment_details_for_booking(row),
                    }
                    for row in rows
                ]
            )

        data = json_body()
        matter_type = data.get("matter_type", "").strip() if isinstance(data.get("matter_type"), str) else ""
        appointment_date = data.get("date", "") if isinstance(data.get("date"), str) else ""
        appointment_time = data.get("time", "") if isinstance(data.get("time"), str) else ""
        details = data.get("details", "").strip() if isinstance(data.get("details"), str) else ""
        if not matter_type or len(matter_type) > 120:
            return jsonify(error="Please choose the type of matter for your consultation."), 400
        if not details or len(details) > 2000:
            return jsonify(error="Please describe your matter in 1 to 2,000 characters."), 400
        try:
            selected_date = date.fromisoformat(appointment_date)
        except ValueError:
            return jsonify(error="Please choose a valid consultation date."), 400
        if selected_date < date.today():
            return jsonify(error="Please choose today or a future date."), 400
        if appointment_time not in TIME_SLOTS:
            return jsonify(error="Please choose one of the available consultation times."), 400

        try:
            db.execute("BEGIN IMMEDIATE")
            previous = db.execute(
                """
                SELECT COUNT(*) AS total FROM bookings
                WHERE user_id = ? AND status NOT IN ('pending_payment', 'payment_failed')
                """,
                (g.user["id"],),
            ).fetchone()["total"]
            fee = 0 if previous == 0 else 2000
            if fee and not app.config["TECHJURE_UPI_ID"]:
                db.rollback()
                return jsonify(
                    error="Direct UPI payment is not configured yet. Please contact us to arrange your consultation."
                ), 503
            order_id = f"TJ{secrets.token_hex(12).upper()}" if fee else None
            cursor = db.execute(
                """
                INSERT INTO bookings
                    (user_id, matter_type, appointment_date, appointment_time, details,
                     fee, status, payment_order_id, payment_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    g.user["id"],
                    matter_type,
                    appointment_date,
                    appointment_time,
                    details,
                    fee,
                    "pending_payment" if fee else "requested",
                    order_id,
                    "awaiting_reference" if fee else "not_required",
                ),
            )
            db.commit()
        except sqlite3.Error:
            db.rollback()
            app.logger.exception("Failed to save consultation request")
            return jsonify(error="We couldn't save your request. Please try again."), 500
        send_booking_notification(
            cursor.lastrowid,
            g.user,
            {
                "matter_type": matter_type,
                "date": appointment_date,
                "time": appointment_time,
                "details": details,
                "fee": fee,
                "status": "pending_payment" if fee else "requested",
                "payment_order_id": order_id,
            },
        )
        if fee == 0:
            return jsonify(
                booking_id=cursor.lastrowid,
                fee=fee,
                status="requested",
                payment_required=False,
            ), 201

        return jsonify(
            booking_id=cursor.lastrowid,
            fee=fee,
            status="pending_payment",
            payment_required=True,
            payment=upi_payment_details(order_id),
        ), 201

    @app.post("/api/payments/<order_id>/reference")
    @login_required
    def submit_payment_reference(order_id):
        data = json_body()
        reference = data.get("reference", "").strip() if isinstance(data.get("reference"), str) else ""
        if not re.fullmatch(r"[A-Za-z0-9/-]{6,40}", reference):
            return jsonify(error="Enter a valid UPI transaction reference (6–40 letters or numbers)."), 400

        db = get_db()
        booking = db.execute(
            """
            SELECT id, fee, status
            FROM bookings WHERE user_id = ? AND payment_order_id = ?
            """,
            (g.user["id"], order_id),
        ).fetchone()
        if booking is None:
            return jsonify(error="Payment request not found."), 404
        if booking["fee"] != 2000 or booking["status"] != "pending_payment":
            return jsonify(error="This booking is not awaiting a payment reference."), 409

        try:
            db.execute("BEGIN IMMEDIATE")
            duplicate = db.execute(
                "SELECT id FROM bookings WHERE payment_reference = ? AND id != ?",
                (reference, booking["id"]),
            ).fetchone()
            if duplicate:
                db.rollback()
                return jsonify(error="This transaction reference has already been submitted."), 409
            db.execute(
                """
                UPDATE bookings
                SET status = 'pending_verification', payment_status = 'submitted',
                    payment_reference = ?, payment_txn_id = ?
                WHERE id = ? AND user_id = ? AND status = 'pending_payment'
                """,
                (reference, reference, booking["id"], g.user["id"]),
            )
            db.commit()
        except sqlite3.Error:
            db.rollback()
            app.logger.exception("Failed to save UPI payment reference")
            return jsonify(error="We couldn't submit your payment reference. Please try again."), 500
        return jsonify(
            status="pending_verification",
            message="Payment reference received. Your booking will be confirmed after we verify the transfer.",
        ), 200

    @app.get("/api/admin/payments/pending")
    def pending_admin_payments():
        if not require_admin():
            return jsonify(error="Admin authorization required."), 401
        db = get_db()
        rows = db.execute(
            """
            SELECT bookings.id, bookings.user_id, users.name, users.email,
                   bookings.matter_type, bookings.appointment_date, bookings.appointment_time,
                   bookings.details, bookings.fee, bookings.payment_reference, bookings.created_at
            FROM bookings JOIN users ON users.id = bookings.user_id
            WHERE bookings.status = 'pending_verification'
            ORDER BY bookings.created_at ASC
            """
        ).fetchall()
        return jsonify(
            payments=[
                {
                    "booking_id": row["id"],
                    "user_id": row["user_id"],
                    "name": row["name"],
                    "email": row["email"],
                    "matter_type": row["matter_type"],
                    "date": row["appointment_date"],
                    "time": row["appointment_time"],
                    "details": row["details"],
                    "fee": row["fee"],
                    "payment_reference": row["payment_reference"],
                    "created_at": row["created_at"],
                }
                for row in rows
            ]
        )

    @app.post("/api/admin/payments/<int:booking_id>/verify")
    def verify_manual_payment(booking_id):
        if not require_admin():
            return jsonify(error="Admin authorization required."), 401
        db = get_db()
        cursor = db.execute(
            """
            UPDATE bookings SET status = 'requested', payment_status = 'verified'
            WHERE id = ? AND fee = 2000 AND status = 'pending_verification'
            """,
            (booking_id,),
        )
        if cursor.rowcount != 1:
            db.rollback()
            return jsonify(error="No pending payment verification was found for this booking."), 404
        db.commit()
        return jsonify(booking_id=booking_id, status="requested", payment_status="verified")

    @app.post("/api/admin/payments/<int:booking_id>/reject")
    def reject_manual_payment(booking_id):
        if not require_admin():
            return jsonify(error="Admin authorization required."), 401
        db = get_db()
        cursor = db.execute(
            """
            UPDATE bookings
            SET status = 'pending_payment', payment_status = 'awaiting_reference',
                payment_reference = NULL, payment_txn_id = NULL
            WHERE id = ? AND fee = 2000 AND status = 'pending_verification'
            """,
            (booking_id,),
        )
        if cursor.rowcount != 1:
            db.rollback()
            return jsonify(error="No pending payment verification was found for this booking."), 404
        db.commit()
        return jsonify(booking_id=booking_id, status="pending_payment", payment_status="awaiting_reference")

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=True)
