import { ConsentGate } from 'consent-kit/react';

export function Contact() {
  return (
    <article>
      <h1>Kontakt</h1>
      <p>Musterstraße 1, 12345 Musterstadt</p>
      <ConsentGate service="google-maps" aspectRatio="4 / 3">
        <iframe
          className="embed"
          title="Karte"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2427.0!2d13.4!3d52.52!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1"
          loading="lazy"
        />
      </ConsentGate>
    </article>
  );
}
