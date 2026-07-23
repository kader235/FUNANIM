// FUNANIM API v1 — Fastify + Neon PostgreSQL
// Comptes (JWT) + sauvegarde des projets (JSONB)
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const {
  DATABASE_URL,
  JWT_SECRET = 'change-moi-en-production',
  ADMIN_EMAIL = 'camankaderr@gmail.com',
  PORT = 3000
} = process.env;

if (!DATABASE_URL) {
  console.error('DATABASE_URL manquant (chaîne de connexion Neon "pooled").');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5
});

const app = Fastify({ logger: true, bodyLimit: 15 * 1024 * 1024 }); // 15 Mo : projets avec audios/images
await app.register(cors, { origin: true });
await app.register(jwt, { secret: JWT_SECRET });

// ---------- helpers ----------
const publicUser = (u) => ({ id: u.id, email: u.email, est_admin: u.est_admin });

app.decorate('authentifier', async (req, rep) => {
  try { await req.jwtVerify(); }
  catch { return rep.code(401).send({ erreur: 'Connexion requise.' }); }
});

// ---------- santé ----------
app.get('/', async () => ({ service: 'FUNANIM API', statut: 'ok' }));

// ---------- auth ----------
app.post('/auth/inscription', async (req, rep) => {
  const { email, mdp } = req.body || {};
  if (!email || !/.+@.+\..+/.test(email)) return rep.code(400).send({ erreur: 'Email invalide.' });
  if (!mdp || mdp.length < 6) return rep.code(400).send({ erreur: 'Mot de passe : 6 caractères minimum.' });
  const hash = await bcrypt.hash(mdp, 10);
  const estAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  try {
    const { rows } = await pool.query(
      `INSERT INTO utilisateurs (email, mdp_hash, est_admin)
       VALUES ($1, $2, $3) RETURNING id, email, est_admin`,
      [email.toLowerCase(), hash, estAdmin]
    );
    const user = rows[0];
    const token = app.jwt.sign({ id: user.id, email: user.email, est_admin: user.est_admin }, { expiresIn: '30d' });
    return { token, utilisateur: publicUser(user) };
  } catch (e) {
    if (e.code === '23505') return rep.code(409).send({ erreur: 'Un compte existe déjà avec cet email.' });
    throw e;
  }
});

app.post('/auth/connexion', async (req, rep) => {
  const { email, mdp } = req.body || {};
  const { rows } = await pool.query(
    'SELECT * FROM utilisateurs WHERE email = $1', [(email || '').toLowerCase()]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(mdp || '', user.mdp_hash)))
    return rep.code(401).send({ erreur: 'Email ou mot de passe incorrect.' });
  // promotion admin si l'email admin a été configuré après coup
  if (!user.est_admin && user.email === ADMIN_EMAIL.toLowerCase()) {
    await pool.query('UPDATE utilisateurs SET est_admin = TRUE WHERE id = $1', [user.id]);
    user.est_admin = true;
  }
  const token = app.jwt.sign({ id: user.id, email: user.email, est_admin: user.est_admin }, { expiresIn: '30d' });
  return { token, utilisateur: publicUser(user) };
});

app.get('/moi', { preHandler: [app.authentifier] }, async (req) => ({ utilisateur: req.user }));

// ---------- projets ----------
app.get('/projets', { preHandler: [app.authentifier] }, async (req) => {
  const { rows } = await pool.query(
    `SELECT id, titre, maj_le FROM projets
     WHERE utilisateur_id = $1 ORDER BY maj_le DESC`, [req.user.id]
  );
  return { projets: rows };
});

app.get('/projets/:id', { preHandler: [app.authentifier] }, async (req, rep) => {
  const { rows } = await pool.query(
    'SELECT id, titre, data, maj_le FROM projets WHERE id = $1 AND utilisateur_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return rep.code(404).send({ erreur: 'Projet introuvable.' });
  return { projet: rows[0] };
});

app.post('/projets', { preHandler: [app.authentifier] }, async (req, rep) => {
  const { titre, data } = req.body || {};
  if (!data || !data.scenes) return rep.code(400).send({ erreur: 'Données de projet invalides.' });
  const { rows } = await pool.query(
    `INSERT INTO projets (utilisateur_id, titre, data)
     VALUES ($1, $2, $3) RETURNING id, titre, maj_le`,
    [req.user.id, titre || 'Sans titre', data]
  );
  return { projet: rows[0] };
});

app.put('/projets/:id', { preHandler: [app.authentifier] }, async (req, rep) => {
  const { titre, data } = req.body || {};
  if (!data || !data.scenes) return rep.code(400).send({ erreur: 'Données de projet invalides.' });
  const { rows } = await pool.query(
    `UPDATE projets SET titre = $1, data = $2, maj_le = now()
     WHERE id = $3 AND utilisateur_id = $4 RETURNING id, titre, maj_le`,
    [titre || 'Sans titre', data, req.params.id, req.user.id]
  );
  if (!rows[0]) return rep.code(404).send({ erreur: 'Projet introuvable.' });
  return { projet: rows[0] };
});

app.delete('/projets/:id', { preHandler: [app.authentifier] }, async (req, rep) => {
  const { rowCount } = await pool.query(
    'DELETE FROM projets WHERE id = $1 AND utilisateur_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rowCount) return rep.code(404).send({ erreur: 'Projet introuvable.' });
  return { supprime: true };
});

// ---------- démarrage ----------
app.listen({ port: Number(PORT), host: '0.0.0.0' })
  .then(() => console.log('FUNANIM API démarrée sur le port ' + PORT))
  .catch((e) => { console.error(e); process.exit(1); });
