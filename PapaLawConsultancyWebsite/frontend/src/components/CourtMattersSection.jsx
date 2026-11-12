import { ArrowRight, ArrowUpRight, Check, Clock3 } from "lucide-react";

const matters = [
  "Unpaid or withheld running bills",
  "Extension of time & delay claims",
  "Liquidated damages & compensation",
  "Show-cause and termination notices",
  "Tender review & contract interpretation",
];

export default function CourtMattersSection({ openBooking }) {
  return (
    <section className="matters-section" id="matters">
      <div className="matters-inner">
        <div className="matters-copy"><span className="eyebrow eyebrow-light">BUILT AROUND YOUR WORK</span><h2>When the paperwork<br />gets complicated.</h2><p>We help you make sense of the contract, the correspondence and what to do next—so you can focus on the work you do best.</p><button className="button button-light" onClick={openBooking}>Talk through your matter <ArrowRight size={16} /></button></div>
        <div className="matters-list">
          {matters.map((item) => <div className="matter-item" key={item}><span><Check size={14} /></span>{item}<ArrowUpRight size={15} /></div>)}
          <div className="matter-note"><Clock3 size={16} /> Not sure where your matter fits? Start with a conversation.</div>
        </div>
      </div>
      <div className="matters-watermark" aria-hidden="true">§</div>
    </section>
  );
}
