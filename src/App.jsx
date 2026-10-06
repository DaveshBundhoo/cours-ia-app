import { useState, useRef, useMemo, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
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
  const [prenom, setPrenom] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    
    let error;
    if (mode === "login") {
      const res = await supabase.auth.signInWithPassword({ email, password: pwd });
      error = res.error;
    } else {
      const res = await supabase.auth.signUp({ 
        email, 
        password: pwd,
        options: { data: { prenom: prenom.trim() } }
      });
      error = res.error;
    }

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
          {mode === "signup" && (
            <>
              <label>Prénom
                <input type="text" required value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Ex: Léa" />
              </label>
              <div style={{ height: 16 }} />
            </>
          )}
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

/* ---------------- Calendrier (lecture de l'agenda) ---------------- */
function useCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let cache = null;
    try { cache = localStorage.getItem("edt-cache"); } catch (e) {}
    if (cache) {
      try { setEvents(parseICS(cache)); setLoading(false); } catch (e) {}
    }

    fetch("/api/edt")
      .then(async (r) => {
        if (r.status === 404) {
          throw new Error("La fonction /api/edt est introuvable (404) : le dossier « api » (avec edt.js dedans) doit être à la racine du dépôt GitHub, à côté de package.json.");
        }
        if (!r.ok) {
          let d = "";
          try { d = (await r.json()).error; } catch (e) {}
          throw new Error("TimeEdit ne répond pas depuis le serveur : " + (d || "erreur " + r.status));
        }
        const txt = await r.text();
        if (!txt.includes("BEGIN:VCALENDAR")) {
          throw new Error("/api/edt ne renvoie pas un agenda. Ouvre /api/edt?debug=1 pour voir ce qu'il renvoie.");
        }
        return txt;
      })
      .then((txt) => {
        setEvents(parseICS(txt));
        setErreur("");
        try { localStorage.setItem("edt-cache", txt); } catch (e) {}
      })
      .catch((err) => {
        setErreur(err instanceof TypeError ? "Impossible de joindre /api/edt (réseau ou site non déployé)." : err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return { events, loading, erreur };
}

/* ---------------- Icônes ---------------- */
const ICON_PATHS = {
  home: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  cal: "M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  book: "M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  mail: "M3 6h18v12H3zM3 7l9 7 9-7",
  power: "M12 3v9M6.3 6.8a8 8 0 1 0 11.4 0",
};
function Icon({ n, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[n]} />
    </svg>
  );
}

/* ---------------- Layout & Navigation ---------------- */
function Layout({ session }) {
  const [activeTab, setActiveTab] = useState("Accueil");

  const meta = session?.user?.user_metadata || {};
  const prenom = meta.prenom || session.user.email.split('@')[0];
  const isAdmin = prenom.trim().toLowerCase() === "davesh";

  const NAV_ITEMS = [
    { id: "Accueil", icon: "home" },
    { id: "Planning", icon: "cal" },
    { id: "Cours", icon: "book" },
    { id: "Date importante", icon: "star" },
    { id: "Adresse mail important", icon: "mail" },
  ];

  return (
    <div className="app-layout">
      <aside className="sidebar desktop-only">
        <div className="logo-header">
          <span className="logo-icon">🚀</span>
          <div>
            <strong>Espace</strong><br />
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
              <Icon n={item.icon} size={18} />
              {item.id}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">{activeTab === "Profil" ? "Mon profil" : activeTab}</div>
          <div className="user-menu">
            <button className="user-name desktop-only name-btn" onClick={() => setActiveTab("Profil")}>
              {prenom} {isAdmin && "👑"}
            </button>
            <button className="logout-btn mobile-only" onClick={() => setActiveTab("Profil")} title="Profil">👤</button>
            <button className="logout-btn" onClick={() => supabase.auth.signOut()} title="Déconnexion">
              <Icon n="power" size={16} />
            </button>
          </div>
        </header>

        <div className="scroll-area">
          {activeTab === "Accueil" && <AccueilView prenom={prenom} isAdmin={isAdmin} setActiveTab={setActiveTab} />}
          {activeTab === "Profil" && <ProfilView prenomActuel={prenom} />}
          {activeTab === "Cours" && <CoursView session={session} prenom={prenom} isAdmin={isAdmin} />}
          {activeTab === "Adresse mail important" && <AnnuaireView isAdmin={isAdmin} />}
          {activeTab === "Planning" && <PlanningView />}
          {activeTab === "Date importante" && <AdminPlaceholderView title={activeTab} isAdmin={isAdmin} />}
        </div>
      </main>

      <nav className="bottom-bar mobile-only">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`bottom-link ${activeTab === item.id ? "active" : ""}`}
            onClick={() => setActiveTab(item.id)}
          >
            <Icon n={item.icon} size={21} />
            <span className="nav-label">{item.id.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---------------- Vue Accueil ---------------- */
function AccueilView({ prenom, isAdmin, setActiveTab }) {
  const { events, loading } = useCalendar();
  const now = new Date();
  const prochaines = events.filter((e) => (e.fin || e.debut) > now).slice(0, 3);

  return (
    <div className="accueil-view">
      <h1 className="greeting">Bonjour,<br />{prenom} {isAdmin && <span title="Admin">👑</span>}</h1>
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
            <h3>Prochaines séances</h3>
            <button onClick={() => setActiveTab("Planning")} className="link-btn link-muted">Voir tout</button>
          </div>
          {loading && prochaines.length === 0 && <p className="muted">Chargement…</p>}
          {!loading && prochaines.length === 0 && (
            <div className="empty-state" style={{ padding: "16px 0" }}>
              <div className="empty-icon">⏳</div>
              <p style={{ fontWeight: 600 }}>Rien à voir ici.</p>
              <p className="muted" style={{ fontSize: 14 }}>Aucune séance planifiée pour le moment.</p>
            </div>
          )}
          {prochaines.map((e, i) => (
            <div className="next-item" key={i}>
              <div className="next-date">
                <span>{e.debut.toLocaleDateString("fr-FR", { weekday: "short" })}</span>
                <b>{e.debut.getDate()}</b>
              </div>
              <div>
                <div className="next-title">{e.matiere || "Cours"}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {hhmm(e.debut)}{e.fin ? ` – ${hhmm(e.fin)}` : ""}{e.salle ? ` · ${e.salle}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Vues Profil & Admin Placeholder ---------------- */
function ProfilView({ prenomActuel }) {
  const [nvPrenom, setNvPrenom] = useState(prenomActuel);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function updateProfil(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ data: { prenom: nvPrenom.trim() } });
    if (error) setMsg("Erreur: " + error.message);
    else setMsg("Profil mis à jour ! 👑 (Rechargez la page si besoin)");
    setBusy(false);
  }

  return (
    <div className="card" style={{ maxWidth: 500, margin: "0 auto" }}>
      <h2>Mon Profil</h2>
      <form onSubmit={updateProfil}>
        <div className="row">
          <label>Prénom affiché
            <input required value={nvPrenom} onChange={e => setNvPrenom(e.target.value)} />
          </label>
        </div>
        <button className="btn full" disabled={busy || !nvPrenom} style={{ marginTop: 20 }}>
          {busy ? "Mise à jour..." : "Enregistrer"}
        </button>
        {msg && <p className="msg">{msg}</p>}
      </form>
    </div>
  );
}

function AdminPlaceholderView({ title, isAdmin }) {
  return (
    <div className="placeholder-view">
      <h2>{title}</h2>
      {isAdmin ? (
        <div className="admin-panel card" style={{ maxWidth: 600, margin: "24px auto", textAlign: "left" }}>
          <h3 style={{ color: "var(--accent)", marginBottom: 12 }}>👑 Espace Administrateur</h3>
          <p>Vous êtes connecté en tant que Davesh. Vous pourrez bientôt modifier cette section.</p>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 20 }}>Rien à afficher pour le moment.</p>
      )}
    </div>
  );
}

/* ---------------- Vue PLANNING (grille de la semaine) ---------------- */
const PX_HEURE = 60;
const COULEURS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#ef4444"];
const hhmm = (d) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const memeJour = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const maj = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function lundiDe(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function couleurDe(titre = "") {
  let h = 0;
  for (const c of titre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COULEURS[h % COULEURS.length];
}
function useMedia(q) {
  const [ok, setOk] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const h = () => setOk(m.matches);
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, [q]);
  return ok;
}

// place les cours d'un jour dans des colonnes (gère les cours qui se chevauchent)
function placerCours(evts, debutH) {
  const liste = [...evts].sort((a, b) => a.debut - b.debut);
  const out = [];
  let groupe = [], colonnes = [], finGroupe = 0;
  const fermer = () => { groupe.forEach((g) => (g.cols = colonnes.length)); out.push(...groupe); groupe = []; colonnes = []; };

  for (const e of liste) {
    const s = e.debut.getHours() * 60 + e.debut.getMinutes();
    const f = e.fin ? e.fin.getHours() * 60 + e.fin.getMinutes() : s + 60;
    const fin = Math.max(f, s + 30);
    if (groupe.length && s >= finGroupe) fermer();
    let c = colonnes.findIndex((x) => x <= s);
    if (c === -1) { c = colonnes.length; colonnes.push(fin); } else colonnes[c] = fin;
    finGroupe = Math.max(finGroupe, fin);
    groupe.push({
      e, col: c, cols: 1,
      top: ((s - debutH * 60) / 60) * PX_HEURE,
      height: Math.max(((fin - s) / 60) * PX_HEURE, 26),
    });
  }
  fermer();
  return out;
}

function PlanningView() {
  const { events, loading, erreur } = useCalendar();
  const mobile = useMedia("(max-width: 768px)");
  const [debut, setDebut] = useState(lundiDe(new Date()));
  const [choisi, setChoisi] = useState(null);       // cours ouvert (fenêtre)
  const [jourMobile, setJourMobile] = useState(() => (new Date().getDay() + 6) % 7);
  const [maintenant, setMaintenant] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const jours = useMemo(() => {
    const tous = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(debut); d.setDate(d.getDate() + i);
      tous.push({ d, evts: events.filter((e) => memeJour(e.debut, d)) });
    }
    return tous.filter((j, i) => i < 6 || j.evts.length > 0);   // dimanche seulement s'il y a cours
  }, [events, debut]);

  const affiches = mobile ? [jours[Math.min(jourMobile, jours.length - 1)]] : jours;

  const heures = useMemo(() => {
    let min = 8, max = 19;
    affiches.forEach((j) => j.evts.forEach((e) => {
      min = Math.min(min, e.debut.getHours());
      const f = e.fin || e.debut;
      max = Math.max(max, f.getHours() + (f.getMinutes() > 0 ? 1 : 0));
    }));
    return { min, max };
  }, [affiches]);

  const nbH = heures.max - heures.min;
  const titre = (() => {
    const mid = new Date(debut); mid.setDate(mid.getDate() + 3);
    return maj(mid.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));
  })();
  const decale = (n) => setDebut(new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + n * 7));
  const aujourdhui = () => { setDebut(lundiDe(new Date())); setJourMobile((new Date().getDay() + 6) % 7); };
  const semaineVide = jours.every((j) => j.evts.length === 0);
  const cols = `repeat(${affiches.length}, minmax(0, 1fr))`;

  return (
    <div className="planning-view">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button className="pill-btn" onClick={aujourdhui}>Aujourd'hui</button>
          <button className="round-btn" onClick={() => decale(-1)} aria-label="Semaine précédente">‹</button>
          <button className="round-btn" onClick={() => decale(1)} aria-label="Semaine suivante">›</button>
        </div>
        <h2 className="cal-title">{titre}</h2>
        <span className={"sync " + (erreur ? "bad" : "ok")}>
          <i /> {loading && !events.length ? "Chargement" : erreur ? "Non synchronisé" : "Synchronisé"}
        </span>
      </div>

      {erreur && <p className="cal-error">{erreur}</p>}

      <div className="cal-box">
        {/* en-tête des jours */}
        <div className="cal-head">
          <div className="cal-gutter" />
          {mobile ? (
            <div className="cal-chips">
              {jours.map((j, i) => (
                <button key={i} className={"chip" + (i === jourMobile ? " sel" : "") + (memeJour(j.d, maintenant) ? " today" : "")} onClick={() => setJourMobile(i)}>
                  <span>{j.d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}</span>
                  <b>{j.d.getDate()}</b>
                </button>
              ))}
            </div>
          ) : (
            <div className="cal-days" style={{ gridTemplateColumns: cols }}>
              {affiches.map((j, i) => (
                <div key={i} className="cal-dayhead">
                  {maj(j.d.toLocaleDateString("fr-FR", { weekday: "long" }))}
                  <span className={"num" + (memeJour(j.d, maintenant) ? " today" : "")}>{j.d.getDate()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* grille horaire */}
        <div className="cal-body" style={{ height: nbH * PX_HEURE }}>
          <div className="cal-gutter">
            {Array.from({ length: nbH }, (_, i) => (
              <div key={i} className="cal-hour" style={{ top: i * PX_HEURE }}>{String(heures.min + i).padStart(2, "0")}</div>
            ))}
          </div>
          <div className="cal-cols" style={{ gridTemplateColumns: cols, backgroundSize: `100% ${PX_HEURE}px` }}>
            {affiches.map((j, i) => {
              const estAuj = memeJour(j.d, maintenant);
              const minutes = maintenant.getHours() * 60 + maintenant.getMinutes();
              const yNow = ((minutes - heures.min * 60) / 60) * PX_HEURE;
              return (
                <div key={i} className={"cal-col" + (estAuj ? " today" : "")}>
                  {placerCours(j.evts, heures.min).map((p, k) => {
                    const c = couleurDe(p.e.matiere);
                    return (
                      <button
                        key={k}
                        className="cal-event"
                        onClick={() => setChoisi(p.e)}
                        style={{
                          top: p.top, height: p.height,
                          left: `calc(${(p.col / p.cols) * 100}% + 3px)`,
                          width: `calc(${100 / p.cols}% - 6px)`,
                          background: c + "30", borderLeftColor: c,
                        }}
                      >
                        <b>{p.e.matiere || "Cours"}</b>
                        <span>{hhmm(p.e.debut)}{p.e.fin ? ` – ${hhmm(p.e.fin)}` : ""}</span>
                        {p.e.salle && p.height > 58 && <span>📍 {p.e.salle}</span>}
                      </button>
                    );
                  })}
                  {estAuj && yNow >= 0 && yNow <= nbH * PX_HEURE && <div className="cal-now" style={{ top: yNow }} />}
                </div>
              );
            })}
          </div>
          {semaineVide && !loading && !erreur && <div className="cal-empty">Rien de planifié cette semaine</div>}
          {loading && !events.length && <div className="cal-empty">⏳ Synchronisation…</div>}
        </div>
      </div>

      {choisi && (
        <div className="modal" onClick={() => setChoisi(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-bar" style={{ background: couleurDe(choisi.matiere) }} />
            <h3>{choisi.matiere || "Cours"}</h3>
            <p className="muted">
              {maj(choisi.debut.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))}
              <br />{hhmm(choisi.debut)}{choisi.fin ? ` – ${hhmm(choisi.fin)}` : ""}
            </p>
            {choisi.salle && <p className="modal-room">📍 {choisi.salle}</p>}
            {choisi.description && <p className="muted" style={{ fontSize: 13, marginTop: 10, whiteSpace: "pre-wrap" }}>{choisi.description}</p>}
            <button className="btn full" style={{ marginTop: 18 }} onClick={() => setChoisi(null)}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Fonction utilitaire pour décoder le format ICS (iCalendar)
function unescapeICS(t = "") {
  return t.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\;/g, ";").replace(/\\\\/g, "\\").trim();
}

function parseICS(icsText) {
  if (!icsText) return [];
  const unfolded = icsText.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r\n|\n|\r/);
  const events = [];
  let currentEvent = null;

  lines.forEach((line) => {
    if (line === "BEGIN:VEVENT") {
      currentEvent = {};
    } else if (line === "END:VEVENT") {
      if (currentEvent && currentEvent.debut) events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent) {
      const i = line.indexOf(":");
      if (i < 0) return;
      const key = line.slice(0, i).split(";")[0].toUpperCase();
      const value = line.slice(i + 1);
      if (key === "SUMMARY") currentEvent.matiere = unescapeICS(value);
      if (key === "LOCATION") currentEvent.salle = unescapeICS(value);
      if (key === "DESCRIPTION") currentEvent.description = unescapeICS(value);
      if (key === "DTSTART") currentEvent.debut = parseICSDate(value);
      if (key === "DTEND") currentEvent.fin = parseICSDate(value);
    }
  });
  return events.sort((a, b) => a.debut - b.debut);
}

// Transforme la date ICS (ex: 20241007T083000Z ou 20241007) en objet Date Javascript
function parseICSDate(str) {
  const m = str.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h = 0, mi = 0, sec = 0, z] = m;
  const n = [y, mo - 1, d, h, mi, sec].map(Number);
  return z ? new Date(Date.UTC(...n)) : new Date(...n);
}

/* ---------------- Vue Annuaire ---------------- */
function AnnuaireView({ isAdmin }) {
  const [contacts, setContacts] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function chargerAnnuaire() {
    const { data } = await supabase.from("annuaire").select("*").order("nom", { ascending: true });
    if (data) setContacts(data);
  }

  useEffect(() => { chargerAnnuaire(); }, []);

  async function ajouterContact(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const { error } = await supabase.from("annuaire").insert({ nom: nom.trim(), role: role.trim(), email: email.trim() });
    if (error) setMsg("Erreur : " + error.message);
    else { setMsg("Contact ajouté !"); setNom(""); setRole(""); setEmail(""); chargerAnnuaire(); }
    setBusy(false);
  }

  async function supprimerContact(id) {
    if (!confirm("Admin: Supprimer ce contact ?")) return;
    await supabase.from("annuaire").delete().eq("id", id);
    chargerAnnuaire();
  }

  const contactsFiltres = contacts.filter(c => 
    c.nom.toLowerCase().includes(recherche.toLowerCase()) || (c.role && c.role.toLowerCase().includes(recherche.toLowerCase()))
  );

  return (
    <div className="annuaire-view" style={{ maxWidth: 800, margin: "0 auto" }}>
      {isAdmin && (
        <section className="card admin-panel-highlight" style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 16 }}>👑 Ajouter un contact</h2>
          <form onSubmit={ajouterContact}>
            <div className="row">
              <label>Nom complet <input required value={nom} onChange={(e) => setNom(e.target.value)} /></label>
              <label>Rôle <input value={role} onChange={(e) => setRole(e.target.value)} /></label>
              <label>Email <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            </div>
            <button className="btn full" disabled={busy} style={{ marginTop: 16 }}>{busy ? "Ajout..." : "Ajouter à l'annuaire"}</button>
            {msg && <p className="msg">{msg}</p>}
          </form>
        </section>
      )}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
          <h2 style={{ margin: 0 }}>Annuaire de l'école</h2>
          <input type="text" placeholder="🔍 Rechercher..." value={recherche} onChange={(e) => setRecherche(e.target.value)} style={{ maxWidth: 300, margin: 0 }} />
        </div>
        {contacts.length === 0 ? (
          <div className="card empty-state"><p className="muted">L'annuaire est vide pour le moment.</p></div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {contactsFiltres.map(c => (
              <div className="card" key={c.id} style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ fontSize: 18, marginBottom: 4 }}>{c.nom}</h3>
                    <span className="muted" style={{ fontSize: 14 }}>{c.role || "Non précisé"}</span>
                  </div>
                  {isAdmin && <button className="action-btn x" onClick={() => supprimerContact(c.id)}>🗑</button>}
                </div>
                <div style={{ marginTop: 16 }}>
                  <a href={`mailto:${c.email}`} className="btn ghost" style={{ padding: "8px 16px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8 }}>✉️ Envoyer un mail</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- Vue Cours (Dépôt et liste) ---------------- */
function CoursView({ session, prenom, isAdmin }) {
  const [cours, setCours] = useState([]);
  const [nomCours, setNomCours] = useState("");
  const [fichiers, setFichiers] = useState([]);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  async function charger() {
    const { data } = await supabase.from("cours").select("*").order("created_at", { ascending: false });
    if (data) setCours(data);
  }
  
  useEffect(() => { charger(); }, []);

  const matieresExistantes = useMemo(() => [...new Set(cours.map(c => c.matiere))], [cours]);
  const parMatiere = useMemo(() => {
    const m = {};
    matieresExistantes.forEach((x) => (m[x] = []));
    cours.forEach((c) => (m[c.matiere] ||= []).push(c));
    return m;
  }, [cours, matieresExistantes]);

  const ajouterFichiers = (list) => {
    const ok = Array.from(list).filter((f) => /image\/|application\/pdf/.test(f.type));
    setFichiers((prev) => [...prev, ...ok]);
  };

  async function deposer(e) {
    e.preventDefault();
    if (!nomCours.trim() || !fichiers.length) return setMsg("Ajoute un nom de cours et un fichier.");
    setBusy(true); setMsg("");
    try {
      for (const f of fichiers) {
        const path = `${session.user.id}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const up = await supabase.storage.from("cours").upload(path, f);
        if (up.error) throw up.error;
        const ins = await supabase.from("cours").insert({ matiere: nomCours.trim(), auteur: prenom, fichier: path });
        if (ins.error) throw ins.error;
      }
      setFichiers([]); setNomCours(""); setMsg("Cours déposé ✨"); charger();
    } catch (err) { setMsg("Erreur : " + err.message); } finally { setBusy(false); }
  }

  async function supprimer(c) {
    if (!confirm("Admin: Supprimer ce fichier ?")) return;
    await supabase.storage.from("cours").remove([c.fichier]);
    await supabase.from("cours").delete().eq("id", c.id);
    charger();
  }

  async function editerNomMatiere(c) {
    const nvNom = prompt("Admin: Entrez le nouveau nom", c.matiere);
    if (nvNom && nvNom.trim() !== "" && nvNom !== c.matiere) {
      await supabase.from("cours").update({ matiere: nvNom.trim() }).eq("id", c.id);
      charger();
    }
  }

  return (
    <div className="cours-view" style={{ maxWidth: 1000, margin: "0 auto" }}>
      {isAdmin && (
        <section id="depot" className="card admin-panel-highlight" style={{ marginBottom: 32 }}>
          <h2>👑 Ajouter un cours</h2>
          <form onSubmit={deposer}>
            <div className="row" style={{ marginTop: 16 }}>
              <label>Matière <input value={nomCours} onChange={(e) => setNomCours(e.target.value)} /></label>
            </div>
            <div className={"drop" + (drag ? " on" : "")} onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); ajouterFichiers(e.dataTransfer.files); }}>
              <div style={{ fontSize: 32 }}>⬆️</div>
              <strong>Glisse tes fichiers ici</strong><span>ou touche pour choisir</span>
              <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => ajouterFichiers(e.target.files)} />
            </div>
            {fichiers.length > 0 && (
              <ul className="files">
                {fichiers.map((f, i) => (
                  <li key={i}><span>{f.name}</span><button type="button" onClick={() => setFichiers(fichiers.filter((_, j) => j !== i))}>✕</button></li>
                ))}
              </ul>
            )}
            <button className="btn full" disabled={busy} style={{ marginTop: 16 }}>{busy ? "Envoi…" : "Créer le cours"}</button>
            {msg && <p className="msg">{msg}</p>}
          </form>
        </section>
      )}

      <section>
        <h2 style={{ marginBottom: 24 }}>Cours disponibles</h2>
        {matieresExistantes.length === 0 ? (
          <div className="card empty-state"><p className="muted">Aucun cours n'a été publié.</p></div>
        ) : (
          <div className="grid">
            {matieresExistantes.map((m) => (
              <div className="card" key={m}>
                <div className="head">
                  <h3 style={{ wordBreak: 'break-word' }}>{m}</h3><span className="count">{parMatiere[m].length}</span>
                </div>
                <ul className="list">
                  {parMatiere[m].map((c) => (
                    <li key={c.id}>
                      <div><b>{c.auteur}</b><small>{new Date(c.created_at).toLocaleDateString("fr-FR")}</small></div>
                      <div className="right">
                        {isAdmin && (<><button className="action-btn" onClick={() => editerNomMatiere(c)}>✏️</button><button className="action-btn x" onClick={() => supprimer(c)}>🗑</button></>)}
                        <em className={c.statut === "transcrit" ? "ok" : "wait"}>{c.statut || 'En ligne'}</em>
                      </div>
                    </li>
                  ))}
                </ul>
                <button className="btn ghost full" onClick={() => alert(`Téléchargement ou génération de : ${m}`)}>📄 Télécharger</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- Styles CSS ---------------- */
const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --bg-app: #030a1a; --bg-sidebar: #040c1f; --bg-card: #071229; --bg-card-blue: #0d2a6e; --txt-main: #FFFFFF; --txt-muted: #8a97b4; --border: #11244d; --accent: #2f6bff; --accent-hover: #4a80ff; --danger: #EF4444; }
html { color-scheme: dark; }
body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: radial-gradient(1200px 600px at 70% -10%, #0a1d46 0%, var(--bg-app) 60%); background-color: var(--bg-app); color: var(--txt-main); line-height: 1.5; overflow: hidden; -webkit-font-smoothing: antialiased; }
button { font: inherit; color: inherit; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

.auth-screen { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
.auth-screen h1 { margin: 24px 0; font-size: 28px; }
.app-layout { display: flex; height: 100vh; width: 100vw; }

.sidebar { width: 250px; background: var(--bg-sidebar); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 24px 14px; }
.logo-header { display: flex; align-items: center; gap: 12px; margin-bottom: 36px; padding: 0 12px; line-height: 1.25; }
.logo-header small { color: var(--txt-muted); font-size: 13px; }
.logo-icon { font-size: 24px; }
.nav-menu { display: flex; flex-direction: column; gap: 4px; }
.nav-link { display: flex; align-items: center; gap: 14px; background: transparent; border: none; border-left: 2px solid transparent; color: var(--txt-muted); padding: 12px 14px; border-radius: 10px; cursor: pointer; font-size: 15px; font-weight: 500; text-align: left; transition: all .15s; }
.nav-link:hover { color: var(--txt-main); background: rgba(255,255,255,.04); }
.nav-link.active { color: var(--txt-main); background: rgba(47,107,255,.14); border-left-color: var(--accent); }
.nav-link.active svg { color: var(--accent); }

.main-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar { height: 68px; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; border-bottom: 1px solid var(--border); background: rgba(3,10,26,.6); backdrop-filter: blur(8px); }
.breadcrumb { font-weight: 600; font-size: 15px; }
.user-menu { display: flex; align-items: center; gap: 14px; }
.name-btn { background: none; border: none; color: var(--txt-main); font-weight: 600; cursor: pointer; padding: 6px 12px; border-radius: 8px; transition: .2s; }
.name-btn:hover { background: rgba(255,255,255,.06); }
.logout-btn { background: transparent; border: 1px solid var(--border); color: var(--txt-muted); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.logout-btn:hover { color: var(--danger); border-color: var(--danger); }
.scroll-area { flex: 1; overflow-y: auto; padding: 32px; }

.accueil-view { max-width: 1000px; margin: 0 auto; }
.greeting { font-size: clamp(26px, 4vw, 36px); margin-bottom: 30px; line-height: 1.15; letter-spacing: -.02em; }
.dashboard-grid { display: grid; grid-template-columns: 1fr; gap: 22px; }
.dash-card { border-radius: 18px; padding: 24px; border: 1px solid var(--border); }
.primary-card { background: var(--bg-card-blue); border-color: transparent; }
.primary-card h3 { margin-bottom: 16px; font-size: 17px; }
.task-item { background: rgba(255,255,255,.1); padding: 16px; border-radius: 12px; display: flex; align-items: center; gap: 16px; }
.task-number { background: rgba(255,255,255,.2); width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
.secondary-card { background: var(--bg-card); }
.secondary-card h3 { font-size: 17px; }
.dash-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
.link-btn { background: none; border: none; cursor: pointer; }
.link-muted { color: var(--txt-main); font-size: 14px; text-decoration: underline; opacity: .85; }
.next-item { display: flex; align-items: center; gap: 14px; padding: 10px 0; }
.next-item + .next-item { border-top: 1px solid var(--border); }
.next-date { width: 46px; height: 50px; border-radius: 12px; background: rgba(47,107,255,.14); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; }
.next-date span { font-size: 11px; text-transform: uppercase; color: var(--txt-muted); }
.next-date b { font-size: 18px; }
.next-title { font-weight: 600; }
.badge { background: rgba(47,107,255,.15); color: var(--accent); padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; border: 1px solid rgba(47,107,255,.3); }

.empty-state { text-align: center; padding: 40px 20px; }
.empty-icon { font-size: 32px; margin-bottom: 12px; opacity: .7; }
.placeholder-view { text-align: center; padding: 64px 20px; }
.admin-panel-highlight { border: 1px solid var(--accent) !important; background: linear-gradient(180deg, rgba(47,107,255,.07) 0%, rgba(47,107,255,0) 100%); }

.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 24px; }
.row { display: grid; gap: 16px; grid-template-columns: 1fr; }
label { display: block; font-size: 14px; font-weight: 500; color: var(--txt-muted); margin-bottom: 8px; }
input, select { width: 100%; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-app); color: var(--txt-main); font-size: 15px; margin-top: 6px; }
input:focus, select:focus { outline: none; border-color: var(--accent); }

.btn { display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: #fff; border: 0; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 15px; cursor: pointer; transition: .2s; }
.btn:hover:not(:disabled) { background: var(--accent-hover); }
.btn.ghost { background: transparent; border: 1px solid var(--border); color: var(--txt-main); margin-top: 16px; }
.btn.ghost:hover:not(:disabled) { background: rgba(255,255,255,.05); }
.btn.full { width: 100%; }
.btn:disabled { opacity: .5; cursor: not-allowed; }

.drop { margin-top: 16px; border: 2px dashed var(--border); border-radius: 12px; padding: 32px 16px; text-align: center; cursor: pointer; transition: .2s; background: rgba(255,255,255,.02); }
.drop:hover, .drop.on { border-color: var(--accent); background: rgba(47,107,255,.1); }
.drop span { display: block; color: var(--txt-muted); font-size: 14px; margin-top: 8px; }
.files { list-style: none; margin-top: 16px; display: grid; gap: 8px; }
.files li { display: flex; justify-content: space-between; align-items: center; background: var(--bg-app); padding: 10px 16px; border-radius: 8px; font-size: 14px; border: 1px solid var(--border); }
.files button { background: none; border: 0; color: var(--danger); cursor: pointer; }

.grid { display: grid; gap: 20px; grid-template-columns: 1fr; }
.head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 12px; gap: 12px; }
.count { background: rgba(255,255,255,.1); border-radius: 20px; padding: 2px 10px; font-size: 12px; }
.muted { color: var(--txt-muted); }
.msg { margin-top: 16px; font-size: 14px; color: var(--accent); text-align: center; }
.list { list-style: none; display: grid; gap: 12px; margin-bottom: 12px; }
.list li { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,.03); border-radius: 8px; }
.list small { display: block; color: var(--txt-muted); font-size: 12px; margin-top: 4px; }
.list em { font-style: normal; font-size: 12px; padding: 4px 10px; border-radius: 20px; }
.ok { background: rgba(34,197,94,.15); color: #4ade80; }
.wait { background: rgba(255,255,255,.1); color: var(--txt-muted); }
.right { display: flex; align-items: center; gap: 8px; }
.action-btn { background: none; border: 0; cursor: pointer; filter: grayscale(1); opacity: .7; font-size: 14px; transition: .2s; }
.action-btn:hover { filter: grayscale(0); opacity: 1; transform: scale(1.1); }
.x:hover { color: var(--danger); }

/* ====== Planning : grille de la semaine ====== */
.planning-view { max-width: 1150px; margin: 0 auto; }
.cal-toolbar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; margin-bottom: 18px; }
.cal-nav { display: flex; align-items: center; gap: 8px; }
.pill-btn { background: transparent; border: 1px solid var(--border); border-radius: 99px; padding: 9px 20px; font-size: 14px; font-weight: 500; cursor: pointer; transition: .15s; }
.pill-btn:hover { background: rgba(255,255,255,.06); }
.round-btn { width: 36px; height: 36px; border-radius: 50%; background: transparent; border: 0; color: var(--txt-muted); font-size: 24px; line-height: 1; cursor: pointer; }
.round-btn:hover { color: #fff; background: rgba(255,255,255,.06); }
.cal-title { font-size: 22px; font-weight: 700; letter-spacing: -.01em; text-align: center; }
.sync { justify-self: end; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--txt-muted); }
.sync i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }
.sync.bad i { background: var(--danger); }
.cal-error { color: var(--danger); font-size: 13px; margin-bottom: 14px; }

.cal-box { background: rgba(7,18,41,.7); border: 1px solid var(--border); border-radius: 20px; overflow: hidden; }
.cal-head { display: flex; border-bottom: 1px solid var(--border); padding: 4px 0; }
.cal-gutter { width: 62px; flex: none; position: relative; }
.cal-days { flex: 1; display: grid; }
.cal-dayhead { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px 4px; color: var(--txt-muted); font-size: 15px; }
.cal-dayhead .num { min-width: 30px; height: 30px; padding: 0 4px; border-radius: 99px; display: inline-flex; align-items: center; justify-content: center; }
.cal-dayhead .num.today { background: #fff; color: #050b1c; font-weight: 700; }
.cal-body { display: flex; position: relative; }
.cal-hour { position: absolute; left: 0; right: 0; transform: translateY(-9px); padding-left: 20px; font-size: 13px; font-weight: 600; color: var(--txt-main); }
.cal-cols { flex: 1; display: grid; position: relative; background-image: linear-gradient(var(--border) 1px, transparent 1px); }
.cal-col { position: relative; border-left: 1px solid rgba(17,36,77,.55); }
.cal-col.today { background: rgba(47,107,255,.05); }
.cal-event { position: absolute; border: 0; border-left: 3px solid; border-radius: 8px; padding: 6px 8px; text-align: left; cursor: pointer; overflow: hidden; display: flex; flex-direction: column; gap: 1px; transition: filter .15s; }
.cal-event:hover { filter: brightness(1.35); z-index: 2; }
.cal-event b { font-size: 12.5px; line-height: 1.25; overflow-wrap: anywhere; }
.cal-event span { font-size: 11.5px; color: rgba(255,255,255,.75); }
.cal-now { position: absolute; left: 0; right: 0; height: 2px; background: var(--danger); z-index: 3; }
.cal-now::before { content: ""; position: absolute; left: -4px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--danger); }
.cal-empty { position: absolute; inset: 0 0 0 62px; display: flex; align-items: center; justify-content: center; color: var(--txt-muted); font-size: 15px; pointer-events: none; }

.cal-chips { flex: 1; display: flex; justify-content: space-around; padding: 6px 4px; }
.chip { background: none; border: 0; color: var(--txt-muted); display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 8px; border-radius: 12px; cursor: pointer; text-transform: capitalize; font-size: 12px; }
.chip b { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; color: var(--txt-main); }
.chip.today b { background: #fff; color: #050b1c; }
.chip.sel { background: rgba(47,107,255,.18); color: #fff; }

.modal { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
.modal-card { position: relative; background: var(--bg-card); border: 1px solid var(--border); border-radius: 18px; padding: 26px; width: 100%; max-width: 380px; overflow: hidden; }
.modal-bar { position: absolute; left: 0; top: 0; right: 0; height: 4px; }
.modal-card h3 { font-size: 19px; margin: 6px 0 8px; }
.modal-room { margin-top: 10px; font-weight: 600; }

.bottom-bar { display: none; background: var(--bg-sidebar); border-top: 1px solid var(--border); height: 68px; padding-bottom: env(safe-area-inset-bottom); }
.bottom-link { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; background: transparent; border: none; color: var(--txt-muted); cursor: pointer; }
.bottom-link.active { color: var(--accent); }
.bottom-link .nav-label { font-size: 10.5px; font-weight: 500; }

@media (max-width: 768px) {
  .desktop-only { display: none !important; }
  .bottom-bar.mobile-only { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; }
  .app-layout { flex-direction: column; }
  .topbar { padding: 0 20px; height: 60px; }
  .scroll-area { padding: 18px 14px; margin-bottom: 68px; }
  .cal-toolbar { grid-template-columns: 1fr 1fr; }
  .cal-title { grid-column: 1 / 2; grid-row: 1; text-align: left; font-size: 20px; }
  .cal-nav { grid-column: 1 / 3; grid-row: 2; }
  .sync { grid-column: 2; grid-row: 1; }
  .cal-gutter { width: 46px; }
  .cal-hour { padding-left: 8px; }
  .cal-empty { inset: 0 0 0 46px; }
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