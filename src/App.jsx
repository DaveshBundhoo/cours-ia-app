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

/* ---------------- Layout & Navigation ---------------- */
function Layout({ session }) {
  const [activeTab, setActiveTab] = useState("Accueil");
  
  const meta = session?.user?.user_metadata || {};
  const prenom = meta.prenom || session.user.email.split('@')[0];
  const isAdmin = prenom.trim().toLowerCase() === "davesh";

  const NAV_ITEMS = [
    { id: "Accueil", icon: "🏠" },
    { id: "Planning", icon: "📅" },
    { id: "Cours", icon: "📚" },
    { id: "Date importante", icon: "⭐" },
    { id: "Adresse mail important", icon: "✉️" },
  ];

  return (
    <div className="app-layout">
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

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">{activeTab}</div>
          <div className="user-menu">
            <button className="user-name desktop-only name-btn" onClick={() => setActiveTab("Profil")}>
              {prenom} {isAdmin && "👑"}
            </button>
            <button className="logout-btn mobile-only" onClick={() => setActiveTab("Profil")} title="Profil">
              👤
            </button>
            <button className="logout-btn" onClick={() => supabase.auth.signOut()} title="Déconnexion">
              ⏻
            </button>
          </div>
        </header>
        
        <div className="scroll-area">
          {activeTab === "Accueil" && <AccueilView prenom={prenom} isAdmin={isAdmin} setActiveTab={setActiveTab} />}
          {activeTab === "Profil" && <ProfilView prenomActuel={prenom} />}
          {activeTab === "Cours" && <CoursView session={session} prenom={prenom} isAdmin={isAdmin} />}
          {activeTab === "Adresse mail important" && <AnnuaireView isAdmin={isAdmin} />}
          {activeTab === "Planning" && <PlanningView />}
          
          {["Date importante"].includes(activeTab) && (
            <AdminPlaceholderView title={activeTab} isAdmin={isAdmin} />
          )}
        </div>
      </main>

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

/* ---------------- Vue Accueil ---------------- */
function AccueilView({ prenom, isAdmin, setActiveTab }) {
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
          <div className="empty-state" style={{ padding: '16px 0' }}>
            <p className="muted">Consultez l'onglet Planning pour voir votre emploi du temps synchronisé.</p>
          </div>
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

/* ---------------- Vue PLANNING (Auto-synchronisé via ICS) ---------------- */
function PlanningView() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    async function chargerCalendrier() {
      try {
        const icsUrl = "https://cloud.timeedit.net/fr_gge/web/public/s.ics?i=6Z9Q0Q6n5Z5aQu988632YoyZZQ0Q55";
        
        // Proxy public qui évite l'erreur CORS sans avoir besoin de créer d'API backend
        const proxyUrl = `https://proxy.cors.sh/${icsUrl}?t=${new Date().getTime()}`;
        
        const res = await fetch(proxyUrl, {
            headers: {
                'x-cors-api-key': 'temp_81cc0010996841fb404760a95f850239' 
            }
        });

        if (!res.ok) throw new Error(`Le serveur a répondu avec le code ${res.status}`);
        
        const text = await res.text();
        
        if (text && text.includes("BEGIN:VCALENDAR")) {
          const parsedEvents = parseICS(text);
          const aujourdhui = new Date();
          aujourdhui.setHours(0, 0, 0, 0);
          const aVenir = parsedEvents.filter(e => e.fin >= aujourdhui);
          
          setEvents(aVenir);
          try { localStorage.setItem("edt-cache", JSON.stringify(aVenir)); } catch (e) {}
        } else {
          throw new Error("Le format reçu n'est pas un calendrier valide");
        }
      } catch (err) {
        console.error("Détails de l'erreur calendrier :", err);
        // Fallback : chargement depuis le cache en cas d'erreur réseau
        try {
            const cache = localStorage.getItem("edt-cache");
            if(cache) {
                const parsedCache = JSON.parse(cache).map(e => ({
                    ...e,
                    debut: new Date(e.debut),
                    fin: new Date(e.fin)
                }));
                setEvents(parsedCache);
                setErreur(`Mode hors ligne: Impossible de mettre à jour (${err.message})`);
            } else {
                 setErreur(`Impossible de charger le calendrier : ${err.message}`);
            }
        } catch(e) {
             setErreur(`Impossible de charger le calendrier : ${err.message}`);
        }
      } finally {
        setLoading(false);
      }
    }

    // Affichage immédiat du cache pour éviter l'écran de chargement
    try {
        const cache = localStorage.getItem("edt-cache");
        if(cache) {
            const parsedCache = JSON.parse(cache).map(e => ({
                ...e, debut: new Date(e.debut), fin: new Date(e.fin)
            }));
            setEvents(parsedCache);
        }
    } catch(e) {}

    chargerCalendrier();
  }, []);

  const eventsParJour = useMemo(() => {
    const groupes = {};
    events.forEach(e => {
      const dateStr = e.debut.toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'long' });
      const datePropre = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
      if (!groupes[datePropre]) groupes[datePropre] = [];
      groupes[datePropre].push(e);
    });
    return groupes;
  }, [events]);

  if (loading && events.length === 0) return <div className="placeholder-view"><p>⏳ Synchronisation du planning en cours...</p></div>;
  if (erreur && events.length === 0) return <div className="placeholder-view"><p style={{ color: "var(--danger)", maxWidth: 600, margin: "0 auto" }}>{erreur}</p></div>;
  if (events.length === 0) return <div className="placeholder-view"><p className="muted">Aucun cours à venir trouvé dans le calendrier.</p></div>;

  return (
    <div className="planning-view" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ margin: 0 }}>Emploi du temps</h2>
        {erreur ? (
             <span className="badge" style={{background: "rgba(239, 68, 68, 0.15)", color: "var(--danger)", border: "1px solid rgba(239, 68, 68, 0.3)"}}>⚠️ Non synchronisé</span>
        ) : (
            <span className="badge">🔄 Synchronisé</span>
        )}
      </div>
      
      {erreur && <p style={{ color: "var(--danger)", fontSize: "14px", marginBottom: "20px" }}>{erreur}</p>}

      <div className="planning-list">
        {Object.entries(eventsParJour).map(([jour, coursDuJour]) => (
          <div key={jour} style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 16, color: "var(--txt-muted)", marginBottom: 12, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
              {jour}
            </h3>
            <div className="grid">
              {coursDuJour.map((cours, idx) => (
                <div className="card" key={idx} style={{ padding: 16, borderLeft: "4px solid var(--accent)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <h4 style={{ fontSize: 16, marginBottom: 4 }}>{cours.matiere}</h4>
                      <div className="muted" style={{ fontSize: 14 }}>
                        {cours.debut.toLocaleTimeString("fr-FR", {hour: '2-digit', minute:'2-digit'})} 
                        {cours.fin && <> {' - '} {cours.fin.toLocaleTimeString("fr-FR", {hour: '2-digit', minute:'2-digit'})}</>}
                      </div>
                    </div>
                    {cours.salle && (
                      <div style={{ background: "var(--bg-card-blue)", color: "#fff", padding: "6px 12px", borderRadius: 8, fontWeight: "bold", fontSize: 14 }}>
                        📍 {cours.salle}
                      </div>
                    )}
                  </div>
                  {cours.description && (
                    <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>{cours.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Fonction utilitaire pour décoder le format ICS (iCalendar)
function unescapeICS(t = "") {
  return t.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

function parseICS(icsText) {
  if (!icsText) return [];
  const unfolded = icsText.replace(/\r\n[ \t]/g, '');
  const lines = unfolded.split(/\r\n|\n|\r/);
  const events = [];
  let currentEvent = null;

  lines.forEach(line => {
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT') {
      if (currentEvent && currentEvent.debut) events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent) {
      const match = line.match(/^([^:]+):(.*)$/);
      if (match) {
        const [, fullKey, value] = match;
        const key = fullKey.split(';')[0]; 
        
        if (key === 'SUMMARY') currentEvent.matiere = unescapeICS(value);
        if (key === 'LOCATION') currentEvent.salle = unescapeICS(value);
        if (key === 'DESCRIPTION') currentEvent.description = unescapeICS(value);
        if (key === 'DTSTART') currentEvent.debut = parseICSDate(value);
        if (key === 'DTEND') currentEvent.fin = parseICSDate(value);
      }
    }
  });
  return events.sort((a, b) => a.debut - b.debut);
}

function parseICSDate(icsDateStr) {
  const match = icsDateStr.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (match) {
    const [, y, m, d, h, min, s] = match;
    if (icsDateStr.endsWith('Z')) {
      return new Date(Date.UTC(y, m - 1, d, h, min, s));
    } else {
      return new Date(y, m - 1, d, h, min, s);
    }
  }
  return new Date();
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
:root { --bg-app: #05050A; --bg-sidebar: #090B14; --bg-card: #0F121E; --bg-card-blue: #0E296F; --txt-main: #FFFFFF; --txt-muted: #8B95A5; --border: #1E2438; --accent: #2563EB; --accent-hover: #3B82F6; --danger: #EF4444; }
body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg-app); color: var(--txt-main); line-height: 1.5; overflow: hidden; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

.auth-screen { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
.auth-screen h1 { margin: 24px 0; font-size: 28px; }
.app-layout { display: flex; height: 100vh; width: 100vw; }

.sidebar { width: 260px; background: var(--bg-sidebar); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 24px 16px; }
.logo-header { display: flex; align-items: center; gap: 12px; margin-bottom: 40px; padding: 0 12px; }
.logo-icon { font-size: 24px; }
.nav-menu { display: flex; flex-direction: column; gap: 6px; }
.nav-link { display: flex; align-items: center; gap: 12px; background: transparent; border: none; color: var(--txt-muted); padding: 12px 16px; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 500; text-align: left; transition: all 0.2s; }
.nav-link:hover { color: var(--txt-main); background: rgba(255,255,255,0.03); }
.nav-link.active { color: var(--txt-main); background: rgba(255,255,255,0.08); }

.main-content { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar { height: 70px; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; border-bottom: 1px solid var(--border); background: var(--bg-app); }
.breadcrumb { font-weight: 600; color: var(--txt-muted); }
.user-menu { display: flex; align-items: center; gap: 16px; }
.name-btn { background: none; border: none; color: var(--txt-main); font-weight: 600; cursor: pointer; padding: 6px 12px; border-radius: 6px; transition: 0.2s; }
.name-btn:hover { background: rgba(255,255,255,0.05); }
.logout-btn { background: transparent; border: 1px solid var(--border); color: var(--txt-muted); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.logout-btn:hover { color: var(--danger); border-color: var(--danger); }
.scroll-area { flex: 1; overflow-y: auto; padding: 32px; }

.accueil-view { max-width: 1000px; margin: 0 auto; }
.greeting { font-size: clamp(24px, 4vw, 32px); margin-bottom: 32px; line-height: 1.2; }
.dashboard-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }

.dash-card { border-radius: 16px; padding: 24px; border: 1px solid var(--border); }
.primary-card { background: var(--bg-card-blue); border-color: transparent; }
.primary-card h3 { margin-bottom: 16px; font-size: 16px; }
.task-item { background: rgba(255,255,255,0.1); padding: 16px; border-radius: 12px; display: flex; align-items: center; gap: 16px; }
.task-number { background: rgba(255,255,255,0.2); width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: bold; }

.secondary-card { background: var(--bg-card); }
.dash-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
.link-btn { background: none; border: none; cursor: pointer; }
.link-muted { color: var(--txt-muted); font-size: 14px; text-decoration: underline; }
.badge { background: rgba(37,99,235,0.15); color: var(--accent); padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; border: 1px solid rgba(37,99,235,0.3); }

.empty-state { text-align: center; padding: 40px 20px; }
.empty-icon { font-size: 32px; margin-bottom: 16px; opacity: 0.5; }
.placeholder-view { text-align: center; padding: 64px 20px; }
.admin-panel-highlight { border: 1px solid var(--accent) !important; background: linear-gradient(180deg, rgba(37,99,235,0.05) 0%, rgba(37,99,235,0) 100%); }

.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 24px; }
.row { display: grid; gap: 16px; grid-template-columns: 1fr; }
label { display: block; font-size: 14px; font-weight: 500; color: var(--txt-muted); margin-bottom: 8px;}
input, select { width: 100%; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-app); color: var(--txt-main); font-size: 15px; margin-top: 6px;}
input:focus, select:focus { outline: none; border-color: var(--accent); }

.btn { display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: #fff; border: 0; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 15px; cursor: pointer; transition: 0.2s;}
.btn:hover:not(:disabled) { background: var(--accent-hover); }
.btn.ghost { background: transparent; border: 1px solid var(--border); color: var(--txt-main); margin-top: 16px;}
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
.head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 12px; gap: 12px; }
.count { background: rgba(255,255,255,0.1); border-radius: 20px; padding: 2px 10px; font-size: 12px; }
.muted { color: var(--txt-muted); }
.msg { margin-top: 16px; font-size: 14px; color: var(--accent); text-align: center; }

.list { list-style: none; display: grid; gap: 12px; margin-bottom: 12px; }
.list li { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 8px; }
.list small { display: block; color: var(--txt-muted); font-size: 12px; margin-top: 4px; }
.list em { font-style: normal; font-size: 12px; padding: 4px 10px; border-radius: 20px; }
.ok { background: rgba(34,197,94,0.15); color: #4ade80; }
.wait { background: rgba(255,255,255,0.1); color: var(--txt-muted); }
.right { display: flex; align-items: center; gap: 8px; }
.action-btn { background: none; border: 0; cursor: pointer; filter: grayscale(1); opacity: 0.7; font-size: 14px; transition: 0.2s;}
.action-btn:hover { filter: grayscale(0); opacity: 1; transform: scale(1.1); }
.x:hover { color: var(--danger); }

.bottom-bar { display: none; background: var(--bg-sidebar); border-top: 1px solid var(--border); height: 70px; }
.bottom-link { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; background: transparent; border: none; color: var(--txt-muted); cursor: pointer; }
.bottom-link.active { color: var(--accent); }
.bottom-link .nav-icon { font-size: 20px; }
.bottom-link .nav-label { font-size: 10px; font-weight: 500; }

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