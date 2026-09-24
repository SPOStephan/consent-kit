import * as react from 'react';

interface ConsentBannerProps {
    position: 'bottom' | 'center';
    onOpenSettings(): void;
}
/** Erste Ebene: "Alle ablehnen" und "Alle akzeptieren" gleichwertig nebeneinander. */
declare function ConsentBanner({ position, onOpenSettings }: ConsentBannerProps): react.JSX.Element;
interface ConsentSettingsProps {
    onClose(): void;
    /** Betreiber der Website (für den eigenen Einwilligungs-Cookie), optional. */
    owner?: string;
}
/** Zweite Ebene: Kategorien mit Schaltern und aufklappbaren Dienst-Details. */
declare function ConsentSettings({ onClose, owner }: ConsentSettingsProps): react.JSX.Element;
interface ConsentUIProps {
    /** Betreiber der Website (wird beim eigenen Einwilligungs-Cookie als Anbieter angezeigt). */
    owner?: string;
}
/**
 * Fertige Oberfläche: Banner (wenn noch nicht entschieden) und Einstellungsdialog
 * (über openSettings() bzw. den Footer-Link). Muss innerhalb von <ConsentProvider> stehen.
 * CSS einbinden: import 'consent-kit/ui.css'
 */
declare function ConsentUI({ owner }?: ConsentUIProps): react.ReactPortal | null;

export { ConsentBanner, type ConsentBannerProps, ConsentSettings, type ConsentSettingsProps, ConsentUI, type ConsentUIProps };
