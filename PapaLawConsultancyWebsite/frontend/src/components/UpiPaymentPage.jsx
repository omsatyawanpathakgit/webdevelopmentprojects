import { useState } from "react";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Copy, Landmark, LockKeyhole } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function UpiPaymentPage({ payment, onBack, onSubmitted }) {
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const copyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(payment.upi_id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("Couldn't copy automatically. Select and copy the UPI ID shown above.");
    }
  };

  const submitReference = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/payments/${encodeURIComponent(payment.order_id)}/reference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reference: reference.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't submit your payment reference.");
      setSubmitted(true);
      onSubmitted(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="upi-payment-page">
        <header className="upi-page-header"><a className="brand" href="#home"><span className="brand-mark"><Landmark size={21} /></span><span className="brand-name">Tech-Jure <small>Consultancy Services</small></span></a></header>
        <section className="upi-payment-card upi-result-card">
          <div className="upi-result-icon"><CheckCircle2 size={30} /></div>
          <span className="eyebrow">PAYMENT REFERENCE RECEIVED</span>
          <h1>We’ll verify your transfer.</h1>
          <p>Your booking is <strong>pending verification</strong>. We’ll confirm it after we match the ₹2,000 transfer in our UPI/bank records.</p>
          <div className="upi-reference-summary"><span>Submitted UTR / transaction reference</span><strong>{reference.trim()}</strong></div>
          <button className="button button-primary" type="button" onClick={onBack}>Return to the website <ArrowLeft size={16} /></button>
        </section>
      </div>
    );
  }

  return (
    <div className="upi-payment-page">
      <header className="upi-page-header">
        <a className="brand" href="#home"><span className="brand-mark"><Landmark size={21} /></span><span className="brand-name">Tech-Jure <small>Consultancy Services</small></span></a>
        <button className="button button-outline button-small" type="button" onClick={onBack}><ArrowLeft size={15} /> Back</button>
      </header>
      <main className="upi-payment-main">
        <section className="upi-payment-card">
          <span className="eyebrow">DIRECT UPI PAYMENT</span>
          <h1>Pay for your consultation.</h1>
          <p className="upi-intro">Send exactly <strong>₹2,000</strong> to the UPI ID below using any UPI app. Then enter the UTR/transaction reference shown in your payment app.</p>
          <div className="upi-payment-layout">
            <div className="upi-qr-wrap"><QRCodeSVG value={payment.payment_uri} size={180} level="M" includeMargin /></div>
            <div className="upi-payee-details">
              <span className="upi-detail-label">PAY TO</span>
              <strong className="upi-payee-name">Tech-Jure Consultancy Services</strong>
              <span className="upi-detail-label">UPI ID</span>
              <div className="upi-id-row"><strong>{payment.upi_id}</strong><button className="upi-copy-button" type="button" onClick={copyUpiId} aria-label="Copy UPI ID"><Copy size={15} /></button></div>
              {copied && <span className="upi-copied">UPI ID copied</span>}
              <span className="upi-detail-label">AMOUNT</span>
              <strong className="upi-amount">₹2,000.00</strong>
            </div>
          </div>
          <a className="button button-primary upi-open-button" href={payment.payment_uri}>Open your UPI app <ArrowUpRight size={16} /></a>
          <div className="upi-safety-note"><LockKeyhole size={15} /><span>Complete payment in your UPI app. <strong>Never enter or share your UPI PIN on this website.</strong></span></div>
          <form className="form-stack upi-reference-form" onSubmit={submitReference}>
            <label htmlFor="upi-reference">After paying, enter the UTR / transaction reference from your UPI app
              <input id="upi-reference" name="reference" type="text" value={reference} onChange={(event) => setReference(event.target.value)} minLength="6" maxLength="40" pattern="[A-Za-z0-9/-]{6,40}" placeholder="For example, 412345678901" autoComplete="off" required />
            </label>
            {message && <p className="payment-status-message" role="alert">{message}</p>}
            <button className="button button-primary form-submit" type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit payment reference"} <ArrowUpRight size={16} /></button>
          </form>
          <p className="upi-confirmation-note">Your appointment is confirmed only after we manually verify your payment. Submitting a reference does not itself confirm payment.</p>
        </section>
        <button className="upi-cancel-link" type="button" onClick={onBack}>Leave this page — you can resume payment from My bookings</button>
      </main>
    </div>
  );
}
