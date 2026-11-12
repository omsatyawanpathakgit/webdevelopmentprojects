# Tech-Jure Consultancy Services

A responsive legal consultancy website with a React + Vite frontend and a Flask backend. Visitors can explore services and pricing; clients must register or sign in before requesting or viewing consultations.

## Project layout

- `frontend/` — React interface, built and served with Vite
- `backend/` — Flask JSON API and SQLite persistence

## Run locally

### Backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
flask --app app run --debug
```

Before starting Flask, edit `backend/.env`. The receiving UPI ID is already set to `9904407787@ptaxis`; add a long random `TECHJURE_SECRET_KEY` and `TECHJURE_ADMIN_TOKEN`. Configure `TECHJURE_SMTP_USERNAME` and `TECHJURE_SMTP_PASSWORD` with the Gmail account's address and an app password to email each booking to `sanjay.techjure@gmail.com`. Optional settings are `TECHJURE_SMTP_HOST`, `TECHJURE_SMTP_PORT`, `TECHJURE_SMTP_FROM_EMAIL`, and `TECHJURE_BOOKING_NOTIFICATION_EMAIL`. This file is excluded from Git. The API is available at `http://127.0.0.1:5000`. SQLite creates `backend/techjure.sqlite3` on first run. Set `TECHJURE_DATABASE` to use another database path.

### Frontend

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. Its development server proxies `/api` requests to the Flask server.

## Booking and fees

Consultations require a signed-in account. Each user's first consultation is complimentary; each subsequent consultation is ₹2,000. The API calculates the fee when it creates a booking request.

For second and later consultations, the site displays a QR code and UPI payment link to transfer ₹2,000 directly to the configured UPI ID. The client submits the UTR/transaction reference after paying. Direct UPI transfers cannot be securely verified by the website, so these bookings stay pending until you check the transfer in your bank/UPI records and manually confirm it. The site does not collect UPI PINs, passwords, or other banking credentials.

Configure the backend `.env` values:

```dotenv
TECHJURE_UPI_ID=9904407787@ptaxis
TECHJURE_SECRET_KEY=your-long-random-secret
TECHJURE_ADMIN_TOKEN=your-long-random-admin-token
TECHJURE_SMTP_USERNAME=sanjay.techjure@gmail.com
TECHJURE_SMTP_PASSWORD=your-gmail-app-password
```

Generate a long random admin token locally, for example with `py -c "import secrets; print(secrets.token_urlsafe(32))"`, then place the output in `.env`. Do not share or commit it.

To review references waiting for verification, set the token in your PowerShell session and call the admin endpoint:

```powershell
$headers = @{ "X-Admin-Token" = "your-long-random-admin-token" }
Invoke-RestMethod -Headers $headers http://127.0.0.1:5000/api/admin/payments/pending
```

After confirming the amount and UTR in your own UPI/bank records, confirm the matching booking using its `booking_id`:

```powershell
Invoke-RestMethod -Method Post -Headers $headers "http://127.0.0.1:5000/api/admin/payments/BOOKING_ID/verify"
```

If the UTR does not match a received transfer, reject it so the client can reopen the UPI page and submit a corrected reference:

```powershell
Invoke-RestMethod -Method Post -Headers $headers "http://127.0.0.1:5000/api/admin/payments/BOOKING_ID/reject"
```

Without a configured receiving UPI ID, the site rejects paid booking requests; free first consultations remain available.

For production, set a persistent strong `TECHJURE_SECRET_KEY`, configure HTTPS and appropriate session-cookie settings, and deploy the frontend and API behind a same-origin HTTPS host. The default generated key is suitable only for local development and changes when the server restarts.
