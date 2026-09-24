-- consent-kit Protokoll: eine Zeile pro Entscheidung.
-- Es werden KEINE IP-Adressen und KEINE User-Agents gespeichert.
CREATE TABLE IF NOT EXISTS consent_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consent_id TEXT NOT NULL,          -- anonyme UUID aus dem Cookie des Besuchers
  received_at TEXT NOT NULL,         -- Serverzeit (ISO 8601)
  client_timestamp TEXT NOT NULL,    -- Zeitpunkt der Entscheidung laut Browser
  config_version TEXT NOT NULL,      -- Version der consent.config.ts
  action TEXT NOT NULL,              -- accept-all | reject-all | custom | service
  categories TEXT NOT NULL,          -- JSON, z. B. {"necessary":true,"statistics":false}
  services TEXT NOT NULL,            -- JSON, einzelne Dienst-Entscheidungen
  gpc INTEGER NOT NULL DEFAULT 0,    -- Global Privacy Control aktiv (0/1)
  domain TEXT NOT NULL               -- Domain der Website
);
CREATE INDEX IF NOT EXISTS idx_consent_log_consent_id ON consent_log (consent_id);
CREATE INDEX IF NOT EXISTS idx_consent_log_received_at ON consent_log (received_at);
