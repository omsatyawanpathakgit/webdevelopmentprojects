import { ArrowUpRight, Landmark, Menu, X } from "lucide-react";
import { navLinks } from "./navLinks.js";

function Logo({ homeHref = "#home" }) {
  return (
    <a className="brand" href={homeHref} aria-label="Tech-Jure Consultancy Services home">
      <span className="brand-mark"><Landmark size={21} strokeWidth={1.7} /></span>
      <span className="brand-name">Tech-Jure <small>Consultancy Services</small></span>
    </a>
  );
}

export default function SiteHeader({
  user,
  bookingsPage,
  mobileMenuOpen,
  setMobileMenuOpen,
  openBooking,
  openLogin,
  handleShowBookings,
  handleLogout,
}) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo homeHref={bookingsPage ? "/" : "#home"} />
        <button className="icon-button menu-toggle" type="button" aria-label="Toggle navigation" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className={`main-nav${mobileMenuOpen ? " nav-open" : ""}`} aria-label="Main navigation">
          {navLinks.map(([label, href]) => (
            <a key={label} href={bookingsPage ? `/${href}` : href} onClick={() => setMobileMenuOpen(false)}>{label}</a>
          ))}
          {user && <button className="nav-link" aria-current={bookingsPage ? "page" : undefined} onClick={handleShowBookings}>My bookings</button>}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <span className="user-greeting">Hello, {user.name.split(" ")[0]}</span>
              <button className="button button-outline button-small" onClick={handleLogout}>Sign out</button>
            </>
          ) : (
            <button className="button button-text button-small" onClick={openLogin}>Sign in</button>
          )}
          <button className="button button-primary header-book" onClick={openBooking}>Book a consultation <ArrowUpRight size={16} /></button>
        </div>
      </div>
    </header>
  );
}

export { Logo };
