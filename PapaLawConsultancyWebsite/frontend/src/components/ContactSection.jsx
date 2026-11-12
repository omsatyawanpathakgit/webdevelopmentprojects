import { ArrowRight, MessageCircle } from "lucide-react";

export default function ContactSection({ openBooking }) {
  return (
    <section className="contact-section section" id="contact">
      <div className="contact-panel">
        <div><span className="eyebrow eyebrow-light">LET’S TALK</span><h2>A good first<br />conversation is free.</h2><p>Tell us what you’re working through. We’ll take it from there.</p><br></br><p>Contact us at: <a href="mailto:sanjay.techjure@gmail.com">sanjay.techjure@gmail.com</a></p></div>
        <div className="contact-cta"><div className="contact-cta-icon"><MessageCircle size={21} /></div><button className="button button-light" onClick={openBooking}>Book a consultation <ArrowRight size={16} /></button><span>First consultation · Complimentary</span><span>Afterwards · ₹2,000 per consultation</span></div>
        <div className="contact-decoration" aria-hidden="true">TJ</div>
      </div>
    </section>
  );
}
