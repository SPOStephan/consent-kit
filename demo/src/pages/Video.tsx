import { ConsentGate } from 'consent-kit/react';

export function Video() {
  return (
    <article>
      <h1>Video</h1>
      <p>Das Video wird erst geladen, wenn Sie auf „Inhalt laden“ klicken oder Marketing erlaubt haben.</p>
      <ConsentGate service="youtube" aspectRatio="16 / 9">
        <iframe
          className="embed"
          title="Beispielvideo"
          src="https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </ConsentGate>
    </article>
  );
}
