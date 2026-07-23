-- FUNANIM — schéma v1 (à exécuter dans l'éditeur SQL de Neon)
CREATE TABLE IF NOT EXISTS utilisateurs (
  id         SERIAL PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  mdp_hash   TEXT NOT NULL,
  est_admin  BOOLEAN NOT NULL DEFAULT FALSE,
  cree_le    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projets (
  id              SERIAL PRIMARY KEY,
  utilisateur_id  INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  titre           TEXT NOT NULL DEFAULT 'Sans titre',
  data            JSONB NOT NULL,
  maj_le          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projets_utilisateur ON projets(utilisateur_id);
