import { ArrowRight } from "lucide-react";

const steps = [
  ["01", "Create your account", "Register in a moment to keep your consultation details together."],
  ["02", "Choose a time", "Tell us a little about your matter and request a convenient slot."],
  ["03", "Speak with an adviser", "We’ll confirm your meeting and help you identify practical next steps."],
];

export default function HowItWorksSection({ openBooking }) {
  return (
    <section className="section process-section" id="how-it-works">
      <div className="process-intro"><span className="eyebrow">A SIMPLE FIRST STEP</span><h2>From question<br />to clarity.</h2><p>Getting started should feel simple. Here’s what happens when you book.</p><button className="button button-primary" onClick={openBooking}>Book your first consultation <ArrowRight size={16} /></button></div>
      <div className="steps-list">
        {steps.map(([number, title, text], index) => <article className="step-card" key={number}><span className="step-number">{number}</span><div className="step-content"><h3>{title}</h3><p>{text}</p></div>{index < steps.length - 1 && <span className="step-connector" />}</article>)}
      </div>
    </section>
  );
}
