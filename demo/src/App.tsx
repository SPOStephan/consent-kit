import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { CookieSettingsLink, usePageViews } from 'consent-kit/react';
import { Home } from './pages/Home';
import { Products } from './pages/Products';
import { Video } from './pages/Video';
import { Contact } from './pages/Contact';
import { Imprint } from './pages/Imprint';
import { Privacy } from './pages/Privacy';
import { StatusPanel } from './StatusPanel';

/** Meldet Routenwechsel an consent-kit (PageViews für GTM, Meta, TikTok). */
function RouteTracking() {
  const location = useLocation();
  usePageViews(location);
  return null;
}

export function App() {
  return (
    <>
      <RouteTracking />
      <header className="site-header">
        <a className="logo" href="/">
          consent-kit <span>Demo</span>
        </a>
        <nav aria-label="Hauptnavigation">
          <NavLink to="/" end>
            Start
          </NavLink>
          <NavLink to="/produkte">Produkte</NavLink>
          <NavLink to="/video">Video</NavLink>
          <NavLink to="/kontakt">Kontakt</NavLink>
        </nav>
      </header>
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/produkte" element={<Products />} />
          <Route path="/video" element={<Video />} />
          <Route path="/kontakt" element={<Contact />} />
          <Route path="/impressum" element={<Imprint />} />
          <Route path="/datenschutz" element={<Privacy />} />
        </Routes>
        <StatusPanel />
      </main>
      <footer className="site-footer">
        <NavLink to="/impressum">Impressum</NavLink>
        <NavLink to="/datenschutz">Datenschutz</NavLink>
        <CookieSettingsLink>Cookie-Einstellungen</CookieSettingsLink>
      </footer>
    </>
  );
}
