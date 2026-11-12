import { ArrowUpRight, FileCheck2, Gavel, Landmark, ShieldCheck } from "lucide-react";

const services = [
  {
    icon: FileCheck2,
    title: "Contract & tender advice",
    text: "Understand tender conditions, contract clauses and your obligations before you commit.",
  },
  {
    icon: Landmark,
    title: "Government department matters",
    text: "Practical guidance for work involving MES, CPWD, Railways, DRDO, NBCC, DDA and more.",
  },
  {
    icon: ShieldCheck,
    title: "Claims & withheld bills",
    text: "Get clear next steps for delayed payments, extensions of time and compensation claims.",
  },
  {
    icon: Gavel,
    title: "Notices & representation",
    text: "Respond thoughtfully to show-cause notices and other contract-related correspondence.",
  },
];

export default function ServicesSection() {
  return (
    <section className="section services-section" id="services">
      <div className="section-heading">
        <div><span className="eyebrow">HOW WE CAN HELP</span><h2>Advice for the moments<br />that matter.</h2></div>
        <p>Government contracts have their own rules, timelines and pressures. Get grounded guidance shaped around your situation.</p>
      </div>
      <div className="service-grid">
        {services.map(({ icon: Icon, title, text }, index) => (
          <article className="service-card" key={title}>
            <div className="service-card-head"><span className="service-icon"><Icon size={20} strokeWidth={1.7} /></span><span className="service-number">0{index + 1}</span></div>
            <h3>{title}</h3><p>{text}</p>
            <a className="card-link" href="#contact">Explore this service <ArrowUpRight size={15} /></a>
          </article>
        ))}
      </div>
    </section>
  );
}
