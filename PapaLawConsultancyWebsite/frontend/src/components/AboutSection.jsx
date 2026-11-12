import { ArrowRight, Landmark } from "lucide-react";

export default function AboutSection() {
  return (
    <section className="about-section" id="about">
      <div className="about-seal"><Landmark size={38} strokeWidth={1.2} /><span>TECH<br />JURE</span></div>
      <div className="about-copy"><span className="eyebrow eyebrow-light">A PERSONAL APPROACH</span><h2>Experience that<br />understands your side.</h2><p>Tech-Jure Consultancy Services was founded by <strong>Sanjay Kumar Pathak</strong> to make practical legal guidance more accessible to government contractors. Every matter deserves a thoughtful conversation and a clear, considered way forward.</p><a href="#contact" className="about-link">Get to know us <ArrowRight size={16} /></a></div>
      <div className="about-quote"><span className="quote-mark">“</span><blockquote>Good advice starts with listening carefully.</blockquote><span className="quote-rule" /><span className="quote-caption">SANJAY KUMAR PATHAK · FOUNDER</span></div>
    </section>
  );
}
