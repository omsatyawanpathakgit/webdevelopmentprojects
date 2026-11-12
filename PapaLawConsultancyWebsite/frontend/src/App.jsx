import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Handshake,
  LockKeyhole,
  X,
} from "lucide-react";
import AboutSection from "./components/AboutSection.jsx";
import ContactSection from "./components/ContactSection.jsx";
import CourtMattersSection from "./components/CourtMattersSection.jsx";
import FeesCard from "./components/FeesCard.jsx";
import HowItWorksSection from "./components/HowItWorksSection.jsx";
import { Logo } from "./components/SiteHeader.jsx";
import SiteHeader from "./components/SiteHeader.jsx";
import { navLinks } from "./components/navLinks.js";
import Modal from "./components/Modal.jsx";
import UpiPaymentPage from "./components/UpiPaymentPage.jsx";
import ServicesSection from "./components/ServicesSection.jsx";

const API_BASE_URL = "https://papa-law-consultancy-backend.vercel.app";

function App() {
  const [user, setUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [authMode, setAuthMode] = useState("");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(false);
  const [notice, setNotice] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [bookingsPage, setBookingsPage] = useState(window.location.pathname === "/bookings");
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingRefresh, setBookingRefresh] = useState(0);
  const [payment, setPayment] = useState(null);

  const navigateTo = (path) => {
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    setBookingsPage(path === "/bookings");
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/session`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not check your sign-in status.");
        const data = await response.json();
        if (data.user) setUser(data.user);
      })
      .catch(() => setNotice("The consultation service is temporarily unavailable. Please try again shortly."))
      .finally(() => setSessionReady(true));
  }, []);

  useEffect(() => {
    const handlePopState = () => setBookingsPage(window.location.pathname === "/bookings");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!sessionReady || !bookingsPage) return;
    if (!user) {
      setPendingBooking(false);
      setAuthMode("login");
      return;
    }

    let active = true;
    setBookingsLoading(true);
    fetch(`${API_BASE_URL}/api/bookings`, { credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Couldn't load your bookings.");
        if (active) setMyBookings(data.bookings);
      })
      .catch((error) => {
        if (active) setNotice(error.message);
      })
      .finally(() => {
        if (active) setBookingsLoading(false);
      });
    return () => { active = false; };
  }, [bookingsPage, bookingRefresh, sessionReady, user]);

  const openBooking = () => {
    setNotice("");
    if (user) setBookingOpen(true);
    else {
      setPendingBooking(true);
      setAuthMode("login");
    }
  };

  const handleAuth = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    try {
      const response = await fetch(`${API_BASE_URL}/api/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We couldn't complete your request.");
      setUser(data.user);
      setAuthMode("");
      setNotice(`Welcome${data.user.name ? `, ${data.user.name.split(" ")[0]}` : ""}. You're signed in.`);
      if (pendingBooking) {
        setBookingOpen(true);
        setPendingBooking(false);
      }
    } catch (error) {
      setNotice(error.message);
    }
  };

  const handleBooking = async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We couldn't request your consultation.");
      setBookingOpen(false);
      setUser((currentUser) => currentUser && ({ ...currentUser, next_consultation_fee: 2000 }));
      if (data.payment_required) {
        setPayment(data.payment);
      } else {
        setNotice("Your first consultation is booked free. We’ll be in touch to confirm the slot.");
      }
    } catch (error) {
      setNotice(error.message);
    }
  };

  const handleShowBookings = () => {
    setNotice("");
    navigateTo("/bookings");
  };

  const resumePayment = (booking) => {
    if (!booking.payment) {
      setNotice("Payment details are unavailable. Please try making a new booking.");
      return;
    }
    setPayment(booking.payment);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/logout`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Couldn't sign out. Please try again.");
      setUser(null);
      navigateTo("/");
      setNotice("You’ve been signed out.");
    } catch (error) {
      setNotice(error.message);
    }
  };

  return (
    <>
      <SiteHeader
        user={user}
        bookingsPage={bookingsPage}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        openBooking={openBooking}
        openLogin={() => setAuthMode("login")}
        handleShowBookings={handleShowBookings}
        handleLogout={handleLogout}
      />

      <main className={bookingsPage ? "account-main" : undefined}>
        {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}><X size={16} /></button></div>}
        {bookingsPage ? (
          <section className="bookings-page" aria-labelledby="bookings-title">
            <div className="bookings-page-heading">
              <div>
                <span className="eyebrow">YOUR CLIENT ACCOUNT</span>
                <h1 id="bookings-title">Your consultations</h1>
                <p>View all your complimentary and paid consultation requests.</p>
              </div>
              <button className="button button-outline" type="button" onClick={() => navigateTo("/")}><ArrowLeft size={15} /> Back to website</button>
            </div>
            {bookingsLoading ? (
              <p className="bookings-loading" role="status">Loading your consultations…</p>
            ) : myBookings.length === 0 ? (
              <div className="empty-bookings"><Handshake size={26} /><p>You haven’t requested a consultation yet.</p><button className="button button-primary" onClick={() => setBookingOpen(true)}>Book your first consultation <ArrowRight size={15} /></button></div>
            ) : (
              <div className="booking-list">
                {myBookings.map((booking) => (
                  <article className="booking-item" key={booking.id}>
                    <div><strong>{booking.matter_type}</strong><span>{booking.date} · {booking.time}</span></div>
                    <div className="booking-actions">
                      <span className="booking-status">{booking.status === "pending_payment" ? "Payment pending" : booking.status === "pending_verification" ? "Awaiting verification" : booking.status === "payment_failed" ? "Payment failed" : "Confirmed"}</span>
                      {booking.status === "pending_payment" && <button className="payment-verify-button" type="button" onClick={() => resumePayment(booking)}>Continue payment</button>}
                      {booking.status === "pending_verification" && <span className="booking-reference">UTR: {booking.payment_reference}</span>}
                    </div>
                    <strong>{booking.fee === 0 ? "Complimentary" : `₹${booking.fee.toLocaleString("en-IN")}`}</strong>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
        <section className="hero" id="home">
          <div className="hero-pattern" aria-hidden="true"><span>§</span><span>✳</span><span>§</span><span>✦</span></div>
          <div className="hero-inner">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> LEGAL CLARITY FOR ALL CONTRACTS</div>
              <h1>Good counsel.<br /><em>Stronger contracts.</em></h1>
              <p className="hero-lead">Contractual legal guidance for contractors working under contracts with government or private contracts.</p>
              <p className="hero-detail">Withheld bills, extensions of time including preparation of compensation claims or a show-cause notice? Get a clearer view of your options and your next step.</p>
              <div className="hero-actions">
                <button className="button button-primary button-large" onClick={openBooking}>Book your consultation <ArrowRight size={17} /></button>
                <a className="text-link" href="#how-it-works">See how it works <ArrowDown size={15} /></a>
              </div>
              <div className="hero-trust"><span className="trust-icon"><Check size={14} /></span> Your first consultation is on us</div>
            </div>
            <FeesCard openBooking={openBooking} />
          </div>
          <div className="hero-bottom"><span>TRUSTED ADVICE. CLEAR NEXT STEPS.</span><span className="hero-bottom-rule" /><span>INDIA · ONLINE CONSULTATIONS</span></div>
        </section>

        <ServicesSection />
        <CourtMattersSection openBooking={openBooking} />
        <HowItWorksSection openBooking={openBooking} />
        <AboutSection />
        <ContactSection openBooking={openBooking} />
          </>
        )}
      </main>

      {!bookingsPage && <footer className="site-footer">
        <div className="footer-main"><Logo /><p>Clear counsel for complex contracts.</p><div className="footer-nav">{navLinks.map(([label, href]) => <a key={label} href={href}>{label}</a>)}</div><button className="button button-primary footer-book" onClick={openBooking}>Book a consultation <ArrowUpRight size={15} /></button></div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} Tech-Jure Consultancy Services</span><span>Legal guidance tailored to your matter. Outcomes depend on the facts of each case.</span><a href="#home">Back to top <ChevronDown size={14} className="back-top-icon" /></a></div>
        </footer>}

      {authMode && (
        <Modal title={authMode === "login" ? "Welcome back." : "Let’s get started."} eyebrow={authMode === "login" ? "YOUR CLIENT ACCOUNT" : "CREATE YOUR ACCOUNT"} onClose={() => { setAuthMode(""); setPendingBooking(false); }}>
          <p className="modal-description">{authMode === "login" ? "Sign in to request a consultation or see your bookings." : "Create an account to book and manage your consultations."}</p>
          <form className="form-stack" onSubmit={handleAuth}>
            {authMode === "register" && <label>Full name<input name="name" type="text" autoComplete="name" minLength="2" placeholder="Your full name" required /></label>}
            <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
            <label>Password<input name="password" type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength="8" placeholder="At least 8 characters" required /></label>
            <button className="button button-primary form-submit" type="submit">{authMode === "login" ? "Sign in" : "Create account"} <ArrowRight size={16} /></button>
          </form>
          <p className="modal-switch">{authMode === "login" ? "New to Tech-Jure?" : "Already have an account?"} <button type="button" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>{authMode === "login" ? "Create an account" : "Sign in"}</button></p>
          <p className="modal-security"><LockKeyhole size={13} /> Your account details are stored securely.</p>
        </Modal>
      )}

      {bookingOpen && (
        <Modal title="Request a consultation." eyebrow="YOUR NEXT STEP" onClose={() => setBookingOpen(false)} wide>
          <p className="modal-description">{user?.next_consultation_fee === 0 ? "Your first consultation is free. Each consultation after this one is ₹2,000." : "Pay ₹2,000 by direct UPI transfer. Your booking is confirmed after we manually verify the transfer."}</p>
          <form className="form-stack booking-form" onSubmit={handleBooking}>
            <label>What can we help with?
              <select name="matter_type" required defaultValue="">
                <option value="" disabled>Select the closest match</option>
                <option>Contract or tender advice</option><option>Withheld bills or payment claim</option><option>Extension of time or delay claim</option><option>Show-cause or termination notice</option><option>Other contract matter</option>
              </select>
            </label>
            <div className="form-row"><label>Preferred date<input name="date" type="date" min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)} required /></label><label>Preferred time<select name="time" required defaultValue=""><option value="" disabled>Select a time</option><option>09:00</option><option>10:00</option><option>11:00</option><option>12:00</option><option>14:00</option><option>15:00</option><option>16:00</option><option>17:00</option></select></label></div>
            <label>Briefly describe your matter<textarea name="details" rows="3" maxLength="2000" placeholder="Share a few details to help us prepare…" required /></label>
            <div className="booking-price"><span><CheckCircle2 size={17} /> Consultation fee</span><strong>{user?.next_consultation_fee === 0 ? "FREE" : "₹2,000"}</strong></div>
            <button className="button button-primary form-submit" type="submit">{user?.next_consultation_fee === 0 ? "Book free consultation" : "Continue to UPI payment"} <ArrowRight size={16} /></button>
          </form>
        </Modal>
      )}

      {payment && (
        <UpiPaymentPage
          payment={payment}
          onBack={() => setPayment(null)}
          onSubmitted={() => {
            setNotice("Payment reference submitted. Your booking is pending manual verification.");
            setBookingRefresh((refresh) => refresh + 1);
          }}
        />
      )}

    </>
  );
}

export default App;
