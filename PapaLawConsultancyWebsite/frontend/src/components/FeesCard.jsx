import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";

export default function FeesCard({ openBooking }) {
  return (
    <aside className="fee-card" id="fees">
      <div className="fee-card-top"><div><span className="eyebrow">STRAIGHTFORWARD PRICING</span><h2>Fees that feel fair.</h2></div><span className="fee-icon"><Sparkles size={20} /></span></div>
      <div className="fee-feature">
        <span className="free-pill">COMPLIMENTARY</span>
        <div className="fee-row"><span>First consultation · up to 30 min</span><strong>FREE</strong></div>
        <p>Start with a conversation. No fee for your first consultation.</p>
      </div>
      <div className="fee-row paid-row"><span>Each consultation after the first</span><strong>₹2,000</strong></div>
      <div className="fee-row"><span>Drafting & representation</span><strong>Quoted after review</strong></div>
      <button className="button button-primary fee-button" onClick={openBooking}>Find a time that works <ArrowRight size={16} /></button>
      <p className="fee-footnote"><LockKeyhole size={13} /> Sign in to request and manage your booking.</p>
    </aside>
  );
}
