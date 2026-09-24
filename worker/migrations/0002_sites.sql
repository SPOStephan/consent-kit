-- Websites, die über die Admin-Oberfläche verwaltet werden.
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,              -- Kennung, z. B. "meine-seite"
  settings TEXT NOT NULL,           -- JSON: Domains, Dienste, Links, Design, Texte
  version INTEGER NOT NULL DEFAULT 1, -- Konfig-Version (erhöhen = alle Besucher erneut fragen)
  consent_key TEXT NOT NULL,        -- Fingerabdruck der Dienste (Änderung → Version + 1)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Zuordnung der Protokoll-Einträge zu einer Website
ALTER TABLE consent_log ADD COLUMN site_id TEXT;
CREATE INDEX IF NOT EXISTS idx_consent_log_site ON consent_log (site_id, received_at);
