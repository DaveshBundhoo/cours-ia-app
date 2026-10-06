import { useState, useRef, useMemo, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const MATIERES = ["Maths", "Physique", "Histoire", "Anglais", "Informatique", "SVT"];

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <>
      <style>{css}</style>
      {!ready ? null : session ? <Layout session={session} /> : <Login />}
    </>
  );
}

/* ---------------- Connexion / inscription ---------------- */
function Login() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password: pwd })
        : await supabase.auth.signUp({ email, password: pwd });
    if (error) setMsg(error.message);
    else if (mode === "signup") setMsg("Compte créé ! Vérifie tes mails pour confirmer, puis connecte-toi.");
    setBusy(false);
  }

  return (
    <div className="auth-screen full-screen">
      <div className="wrap" style={{ maxWidth: 420 }}>
        <div className="logo-header">
          <span className="logo-icon">🚀</span> Espace Étudiant
        </div>
        <h1>{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
        <form className="card" onSubmit={submit}>
          <label>Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <div style={{ height: 16 }} />
          <label>Mot de passe
            <input type="password" required minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </label>
          <button className="btn full" disabled={busy} style={{ marginTop: 24 }}>
            {busy ? "…" : mode === "login" ? "Se connecter" : "S'inscrire"}
          </button>
          {msg && <p className="msg">{msg}</p>}
          <p className="muted" style={{ marginTop: 20, textAlign: "center" }}>
            {mode === "login" ? "Pas de compte ?" : "Déjà un compte ?"}{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "login" ? "signup" : "login"); setMsg(""); }}>
              {mode === "login" ? "S'inscrire" : "Se connecter"}
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Layout & Navigation ---------------- */
function Layout({ session }) {
  const [activeTab, setActiveTab] = useState("Accueil");
  const prenom = localStorage.getItem("prenom") || session.user.email.split('@')[0];

  const NAV_ITEMS = [
    { id: "Accueil", icon: "🏠" },
    { id: "Planning", icon: "📅" },
    { id: "Cours", icon: "📚" },
    { id: "Date importante", icon: "⭐" },
    { id: "Adresse mail important", icon: "✉️" },
  ];

  return (
    <div className="app-layout">
      {/* Barre latérale (Ordinateur) */}
      <aside className="sidebar desktop-only">
        <div className="logo-header">
          <span className="logo-icon">🚀</span>
          <div>
            <strong>Espace</strong><br/>
            <small>Étudiant</small>
          </div>
        </div>
        <nav className="nav-menu">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-link ${activeTab === item.id ? "active" : ""}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.id}
            </button>
          ))}
        </nav>
      </aside>

      {/* Contenu principal */}
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">{activeTab}</div>
          <div className="user-menu">
            <span className="user-name desktop-only">{prenom}</span>
            <button className="logout-btn" onClick={() => supabase.auth.signOut()} title="Déconnexion">
              ⏻
            </button>
          </div>
        </header>
        
        <div className="scroll-area">
          {activeTab === "Accueil" && <AccueilView prenom={prenom} />}
          {activeTab === "Cours" && <CoursView session={session} />}
          {["Planning", "Date importante", "Adresse mail important"].includes(activeTab) && (
            <div className="placeholder-view">
              <h2>{activeTab}</h2>
              <p className="muted">Contenu en construction...</p>
            </div>
          )}
        </div>
      </main>

      {/* Barre de navigation (Téléphone) */}
      <nav className="bottom-bar mobile-only">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`bottom-link ${activeTab === item.id ? "active" : ""}`}
            onClick={() => setActiveTab(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.id.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---------------- Vue Accueil (Dashboard) ---------------- */
function AccueilView({ prenom }) {
  return (
    <div className="accueil-view">
      <h1 className="greeting">Bonjour,<br />{prenom}</h1>
      
      <div className="dashboard-grid">
        <div className="dash-card primary-card">
          <h3>Vos tâches (1)</h3>
          <div className="task-item">
            <span className="task-number">1</span>
            <p>Numéro de CVEC requis</p>
          </div>
        </div>
        
        <div className="dash-card secondary-card">
          <div className="dash-card-header">
            <h3>Prochaine séance</h3>
            <a href="#" className="link-muted">Voir tout</a>
          </div>
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <h4>Rien à voir ici.</h4>
            <p className="muted">Vous n'avez rien de planifié pour les 7 prochains jours.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Vue Cours (Votre logique existante) ---------------- */
function CoursView({ session }) {
  const [cours, setCours] = useState([]);
  const [matiere, setMatiere] = useState(MATIERES[0]);
  const [auteur, setAuteur] = useState(localStorage.getItem("prenom") || "");
  const [fichiers, setFichiers] = useState([]);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  async function charger() {
    const { data, error } = await supabase
      .from("cours")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setMsg("Erreur : " + error.message);
    else setCours(data);
  }
  useEffect(() => { charger(); }, []);

  const parMatiere = useMemo(() => {
    const m = {};
    MATIERES.forEach((x) => (m[x] = []));
    cours.forEach((c) => (m[c.matiere] ||= []).push(c));
    return m;
  }, [cours]);

  const ajouterFichiers = (list) => {
    const ok = Array.from(list).filter((f) => /image\/|application\/pdf/.test(f.type));
    setFichiers((prev) => [...prev, ...ok]);
  };

  async function deposer(e) {
    e.preventDefault();
    if (!auteur.trim() || !fichiers.length) {
      setMsg("Ajoute ton prénom et au moins un fichier.");
      return;
    }
    setBusy(true);
    setMsg("");
    localStorage.setItem("prenom", auteur.trim());
    try {
      for (const f of fichiers) {
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${session.user.id}/${Date.now()}-${safe}`;
        const up = await supabase.storage.from("cours").upload(path, f);
        if (up.error) throw up.error;
        const ins = await supabase.from("cours").insert({ matiere, auteur: auteur.trim(), fichier: path });
        if (ins.error) throw ins.error;
      }
      setFichiers([]);
      setMsg("Cours déposé ✨");
      charger();
    } catch (err) {
      setMsg("Erreur : " + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function supprimer(c) {
    if (!confirm("Supprimer ce cours ?")) return;
    await supabase.storage.from("cours").remove([c.fichier]);
    await supabase.from("cours").delete().eq("id", c.id);
    charger();
  }

  async function genererPdf(m) {
    setMsg(`Le PDF « ${m} » sera généré ici plus tard.`);
  }

  return (
    <div className="cours-view">
      <section id="depot" className="card">
        <h2>Déposer un cours</h2>
        <form onSubmit={deposer}>
          <div className="row">
            <label>Ton prénom
              <input value={auteur} onChange={(e) => setAuteur(e.target.value)} placeholder="Ex : Léa" />
            </label>
            <label>Matière
              <select value={matiere} onChange={(e) => setMatiere(e.target.value)}>
                {MATIERES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
          </div>

          <div
            className={"drop" + (drag ? " on" : "")}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); ajouterFichiers(e.dataTransfer.files); }}
          >
            <div style={{ fontSize: 32 }}>⬆️</div>
            <strong>Glisse tes fichiers ici</strong>
            <span>ou touche pour prendre une photo / choisir un fichier</span>
            <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple hidden
              onChange={(e) => ajouterFichiers(e.target.files)} />
          </div>

          {fichiers.length > 0 && (
            <ul className="files">
              {fichiers.map((f, i) => (
                <li key={i}>
                  <span>{f.name}</span>
                  <button type="button" onClick={() => setFichiers(fichiers.filter((_, j) => j !== i))}>✕</button>
                </li>
              ))}
            </ul>
          )}

          <button className="btn full" disabled={busy}>{busy ? "Envoi…" : "Envoyer"}</button>
          {msg && <p className="msg">{msg}</p>}
        </form>
      </section>

      <section>
        <h2>Cours par matière</h2>
        <div className="grid">
          {MATIERES.map((m) => (
            <div className="card" key={m}>
              <div className="head">
                <h3>{m}</h3>
                <span className="count">{parMatiere[m].length}</span>
              </div>
              {parMatiere[m].length === 0 ? (
                <p className="muted">Aucun cours pour l'instant.</p>
              ) : (
                <ul className="list">
                  {parMatiere[m].map((c) => (
                    <li key={c.id}>
                      <div>
                        <b>{c.auteur}</b>
                        <small>{new Date(c.created_at).toLocaleDateString("fr-FR")}</small>
                      </div>
                      <div className="right">
                        <em className={c.statut === "transcrit" ? "ok" : "wait"}>{c.statut || 'En attente'}</em>
                        {c.user_id === session.user.id && (
                          <button className="x" title="Supprimer" onClick={() => supprimer(c)}>🗑</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <button className="btn ghost full" disabled={!parMatiere[m].length} onClick={() => genererPdf(m)}>
                📄 PDF de classe
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------------- Styles (CSS) ---------------- */
const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg-app: #05050A;
  --bg-sidebar: #090B14;
  --bg-card: #0F121E;
  --bg-card-blue: #0E296F;
  --txt-main: #FFFFFF;
  --txt-muted: #8B95A5;
  --border: #1E2438;
  --accent: #2563EB;
  --accent-hover: #3B82F6;
  --danger: #EF4444;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--bg-app);
  color: var(--txt-main);
  line-height: 1.5;
  overflow: hidden;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

/* -- Authentification -- */
.auth-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
}
.auth-screen h1 { margin: 24px 0; font-size: 28px; }

/* -- Layout Principal -- */
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
}

/* Sidebar Ordinateur */
.sidebar {
  width: 260px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
}
.logo-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 40px;
  padding: 0 12px;
}
.logo-icon { font-size: 24px; }
.nav-menu { display: flex; flex-direction: column; gap: 6px; }
.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  background: transparent;
  border: none;
  color: var(--txt-muted);
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  text-align: left;
  transition: all 0.2s;
}
.nav-link:hover { color: var(--txt-main); background: rgba(255,255,255,0.03); }
.nav-link.active { color: var(--txt-main); background: rgba(255,255,255,0.08); }
.nav-icon { font-size: 18px; }

/* Contenu Principal */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.topbar {
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-app);
}
.breadcrumb { font-weight: 600; color: var(--txt-muted); }
.user-menu { display: flex; align-items: center; gap: 16px; }
.logout-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--txt-muted);
  width: 36px; height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.logout-btn:hover { color: var(--danger); border-color: var(--danger); }
.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
}

/* -- Vues Spécifiques -- */
.accueil-view { max-width: 1000px; margin: 0 auto; }
.greeting { font-size: clamp(24px, 4vw, 32px); margin-bottom: 32px; line-height: 1.2; }
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

.dash-card {
  border-radius: 16px;
  padding: 24px;
  border: 1px solid var(--border);
}
.primary-card { background: var(--bg-card-blue); border-color: transparent; }
.primary-card h3 { margin-bottom: 16px; font-size: 16px; }
.task-item { background: rgba(255,255,255,0.1); padding: 16px; border-radius: 12px; display: flex; align-items: center; gap: 16px; }
.task-number { background: rgba(255,255,255,0.2); width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: bold; }

.secondary-card { background: var(--bg-card); }
.dash-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
.link-muted { color: var(--txt-muted); font-size: 14px; text-decoration: underline; }
.empty-state { text-align: center; padding: 32px 0; }
.empty-icon { font-size: 32px; margin-bottom: 16px; opacity: 0.5; }
.empty-state h4 { margin-bottom: 8px; }

.cours-view { max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 32px; }
.placeholder-view { text-align: center; padding: 64px 20px; }

/* -- Composants UI -- */
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 24px; }
.row { display: grid; gap: 16px; grid-template-columns: 1fr; }
label { display: block; font-size: 14px; font-weight: 500; color: var(--txt-muted); margin-bottom: 8px;}
input, select { width: 100%; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-app); color: var(--txt-main); font-size: 15px; margin-top: 6px;}
input:focus, select:focus { outline: none; border-color: var(--accent); }

.btn { display: inline-block; background: var(--accent); color: #fff; border: 0; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 15px; cursor: pointer; transition: 0.2s;}
.btn:hover:not(:disabled) { background: var(--accent-hover); }
.btn.ghost { background: transparent; border: 1px solid var(--border); color: var(--txt-main); }
.btn.ghost:hover:not(:disabled) { background: rgba(255,255,255,0.05); }
.btn.full { width: 100%; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.drop { margin-top: 16px; border: 2px dashed var(--border); border-radius: 12px; padding: 32px 16px; text-align: center; cursor: pointer; transition: 0.2s; background: rgba(255,255,255,0.02); }
.drop:hover, .drop.on { border-color: var(--accent); background: rgba(37, 99, 235, 0.1); }
.drop span { display: block; color: var(--txt-muted); font-size: 14px; margin-top: 8px; }

.files { list-style: none; margin-top: 16px; display: grid; gap: 8px; }
.files li { display: flex; justify-content: space-between; align-items: center; background: var(--bg-app); padding: 10px 16px; border-radius: 8px; font-size: 14px; border: 1px solid var(--border); }
.files button { background: none; border: 0; color: var(--danger); cursor: pointer; }

.grid { display: grid; gap: 20px; grid-template-columns: 1fr; }
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
.count { background: rgba(255,255,255,0.1); border-radius: 20px; padding: 2px 10px; font-size: 12px; }
.muted { color: var(--txt-muted); }
.msg { margin-top: 16px; font-size: 14px; color: var(--accent); text-align: center; }

.list { list-style: none; display: grid; gap: 12px; margin-bottom: 20px; }
.list li { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 8px; }
.list small { display: block; color: var(--txt-muted); font-size: 12px; margin-top: 4px; }
.list em { font-style: normal; font-size: 12px; padding: 4px 10px; border-radius: 20px; }
.ok { background: rgba(34,197,94,0.15); color: #4ade80; }
.wait { background: rgba(245,158,11,0.15); color: #fbbf24; }
.right { display: flex; align-items: center; gap: 12px; }
.x { background: none; border: 0; cursor: pointer; color: var(--txt-muted); }
.x:hover { color: var(--danger); }

/* -- Mobile Bottom Bar -- */
.bottom-bar {
  display: none;
  background: var(--bg-sidebar);
  border-top: 1px solid var(--border);
  height: 70px;
}
.bottom-link {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: var(--txt-muted);
  cursor: pointer;
}
.bottom-link.active { color: var(--accent); }
.bottom-link .nav-icon { font-size: 20px; }
.bottom-link .nav-label { font-size: 10px; font-weight: 500; }

/* -- Responsive Rules -- */
@media (max-width: 768px) {
  .desktop-only { display: none !important; }
  .bottom-bar.mobile-only { display: flex; }
  .topbar { padding: 0 20px; }
  .scroll-area { padding: 20px; margin-bottom: 70px; }
}
@media (min-width: 769px) {
  .mobile-only { display: none !important; }
  .dashboard-grid { grid-template-columns: 1fr 1fr; }
  .row { grid-template-columns: 1fr 1fr; }
  .grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .grid { grid-template-columns: repeat(3, 1fr); }
}
`;