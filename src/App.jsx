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
    setBusy(true); setMsg("");
    let error;
    if (mode === "login") {
      const res = await supabase.auth.signInWithPassword({ email, password: pwd });
      error = res.error;
    } else {
      const res = await supabase.auth.signUp({ 
        email, password: pwd, options: { data: { prenom: prenom.trim() } }
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
        <div className="logo-header"><span className="logo-icon">🚀</span> Espace Étudiant</div>
        <h1>{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
        <form className="card" onSubmit={submit}>
          {mode === "signup" && (
            <label>Prénom <input type="text" required value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Ex: Léa" /></label>
          )}
          <div style={{ height: 16 }} />
          <label>Email <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <div style={{ height: 16 }} />
          <label>Mot de passe <input type="password" required minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)} /></label>
          <button className="btn full" disabled={busy} style={{ marginTop: 24 }}>
            {busy ? "…" : mode === "login" ? "Se connecter" : "S'inscrire"}
          </button>
          {msg && <p className="msg">{msg}</p>}
          <p className="muted" style={{ marginTop: 20, textAlign: "center" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "login" ? "signup" : "login"); setMsg(""); }}>
              {mode === "login" ? "Créer un compte" : "Se connecter"}
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Hooks pour la base de données ---------------- */
function useCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let cache = null;
    try { cache = localStorage.getItem("edt-cache"); } catch (e) {}
    if (cache) { try { setEvents(parseICS(cache)); setLoading(false); } catch (e) {} }

    fetch("/api/edt")
      .then(async (r) => {
        if (!r.ok) throw new Error("Erreur " + r.status);
        const txt = await r.text();
        if (!txt.includes("BEGIN:VCALENDAR")) throw new Error("Agenda invalide.");
        return txt;
      })
      .then((txt) => { setEvents(parseICS(txt)); setErreur(""); try { localStorage.setItem("edt-cache", txt); } catch (e) {} })
      .catch((err) => setErreur(err.message))
      .finally(() => setLoading(false));
  }, []);
  return { events, loading, erreur };
}

function useManuels() {
  const [rows, setRows] = useState([]);
  const charger = async () => {
    const { data } = await supabase.from("cours_manuels").select("*").order("debut", { ascending: true });
    if (data) setRows(data);
  };
  useEffect(() => { charger(); }, []);
  return { rows, charger };
}

function usePlanning() {
  const ics = useCalendar();
  const man = useManuels();
  const events = useMemo(() => {
    const manuels = man.rows.map((r) => ({ id: r.id, manuel: true, matiere: r.titre, salle: r.salle, description: r.description, debut: new Date(r.debut), fin: new Date(r.fin) }));
    return [...ics.events, ...manuels].sort((a, b) => a.debut - b.debut);
  }, [ics.events, man.rows]);
  return { events, loading: ics.loading, erreur: ics.erreur, recharger: man.charger };
}

function useDates() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const charger = async () => {
    const { data } = await supabase.from("dates_importantes").select("*").order("date", { ascending: true });
    if (data) setRows(data);
    setLoading(false);
  };
  useEffect(() => { charger(); }, []);
  return { rows, loading, charger };
}
const parseJour = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
const debutAujourdhui = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
function jMoins(d) {
  const n = Math.round((d - debutAujourdhui()) / 86400000);
  return n === 0 ? "Aujourd'hui" : n === 1 ? "Demain" : n < 0 ? "Passé" : "J-" + n;
}

/* ---------------- Icônes ---------------- */
const ICON_PATHS = {
  home: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  cal: "M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  book: "M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  power: "M12 3v9M6.3 6.8a8 8 0 1 0 11.4 0",
};
function Icon({ n, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={ICON_PATHS[n]} /></svg>;
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
    { id: "Fiches IA", icon: "book" }, 
    { id: "Date importante", icon: "star" },
  ];

  return (
    <div className="app-layout">
      <aside className="sidebar desktop-only">
        <div className="logo-header">
          <span className="logo-icon">🚀</span>
          <div><strong>Espace</strong><br /><small>Étudiant</small></div>
        </div>
        <nav className="nav-menu">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} className={`nav-link ${activeTab === item.id ? "active" : ""}`} onClick={() => setActiveTab(item.id)}>
              <Icon n={item.icon} size={18} /> {item.id}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">{activeTab === "Profil" ? "Mon profil" : activeTab}</div>
          <div className="user-menu">
            <button className="user-name desktop-only name-btn" onClick={() => setActiveTab("Profil")}>{prenom} {isAdmin && "👑"}</button>
            <button className="logout-btn mobile-only" onClick={() => setActiveTab("Profil")} title="Profil">👤</button>
            <button className="logout-btn" onClick={() => supabase.auth.signOut()} title="Déconnexion"><Icon n="power" size={16} /></button>
          </div>
        </header>

        <div className="scroll-area">
          {activeTab === "Accueil" && <AccueilView prenom={prenom} isAdmin={isAdmin} setActiveTab={setActiveTab} />}
          {activeTab === "Profil" && <ProfilView prenomActuel={prenom} />}
          {activeTab === "Fiches IA" && <FichesView session={session} prenom={prenom} isAdmin={isAdmin} />}
          {activeTab === "Planning" && <PlanningView isAdmin={isAdmin} />}
          {activeTab === "Date importante" && <DatesView isAdmin={isAdmin} />}
        </div>
      </main>

      <nav className="bottom-bar mobile-only">
        {NAV_ITEMS.map((item) => (
          <button key={item.id} className={`bottom-link ${activeTab === item.id ? "active" : ""}`} onClick={() => setActiveTab(item.id)}>
            <Icon n={item.icon} size={21} /> <span className="nav-label">{item.id.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---------------- Vues de base (Accueil, Profil, Dates) ---------------- */
function AccueilView({ prenom, isAdmin, setActiveTab }) {
  const { events, loading } = usePlanning();
  const now = new Date();
  const prochaines = events.filter((e) => (e.fin || e.debut) > now).slice(0, 3);
  const dates = useDates();
  const datesAVenir = dates.rows.filter((r) => parseJour(r.date) >= debutAujourdhui()).slice(0, 4);

  return (
    <div className="accueil-view">
      <h1 className="greeting">Bonjour,<br />{prenom} {isAdmin && <span title="Admin">👑</span>}</h1>
      <div className="dashboard-grid">
        <div className="dash-card primary-card">
          <div className="dash-card-header">
            <h3>Dates importantes</h3>
            <button onClick={() => setActiveTab("Date importante")} className="link-btn link-muted">Voir tout</button>
          </div>
          {dates.loading && <p style={{ opacity: .8 }}>Chargement…</p>}
          {!dates.loading && datesAVenir.length === 0 && <p style={{ opacity: .8 }}>Aucune date importante à venir.</p>}
          {datesAVenir.map((r) => {
            const d = parseJour(r.date);
            return (
              <div className="task-item date-item" key={r.id}>
                <div className="date-badge"><span>{d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</span><b>{d.getDate()}</b></div>
                <div className="date-info"><p>{r.titre}</p>{r.detail && <small>{r.detail}</small>}</div>
                <span className="date-left">{jMoins(d)}</span>
              </div>
            );
          })}
        </div>
        <div className="dash-card secondary-card">
          <div className="dash-card-header">
            <h3>Prochaines séances</h3>
            <button onClick={() => setActiveTab("Planning")} className="link-btn link-muted">Voir tout</button>
          </div>
          {loading && prochaines.length === 0 && <p className="muted">Chargement…</p>}
          {!loading && prochaines.length === 0 && (
            <div className="empty-state" style={{ padding: "16px 0" }}>
              <div className="empty-icon">⏳</div><p style={{ fontWeight: 600 }}>Rien à voir ici.</p>
              <p className="muted" style={{ fontSize: 14 }}>Aucune séance planifiée pour le moment.</p>
            </div>
          )}
          {prochaines.map((e, i) => (
            <div className="next-item" key={i}>
              <div className="next-date"><span>{e.debut.toLocaleDateString("fr-FR", { weekday: "short" })}</span><b>{e.debut.getDate()}</b></div>
              <div>
                <div className="next-title">{e.matiere || "Cours"}</div>
                <div className="muted" style={{ fontSize: 13 }}>{hhmm(e.debut)}{e.fin ? ` – ${hhmm(e.fin)}` : ""}{e.salle ? ` · ${e.salle}` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfilView({ prenomActuel }) {
  const [nvPrenom, setNvPrenom] = useState(prenomActuel);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function updateProfil(e) {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.updateUser({ data: { prenom: nvPrenom.trim() } });
    if (error) setMsg("Erreur: " + error.message); else setMsg("Profil mis à jour ! 👑 (Rechargez la page si besoin)");
    setBusy(false);
  }
  return (
    <div className="card" style={{ maxWidth: 500, margin: "0 auto" }}>
      <h2>Mon Profil</h2>
      <form onSubmit={updateProfil}>
        <div className="row"><label>Prénom affiché<input required value={nvPrenom} onChange={e => setNvPrenom(e.target.value)} /></label></div>
        <button className="btn full" disabled={busy || !nvPrenom} style={{ marginTop: 20 }}>{busy ? "Mise à jour..." : "Enregistrer"}</button>
        {msg && <p className="msg">{msg}</p>}
      </form>
    </div>
  );
}

function DatesView({ isAdmin }) {
  const { rows, loading, charger } = useDates();
  const [titre, setTitre] = useState("");
  const [date, setDate] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function ajouter(e) {
    e.preventDefault();
    if (!titre.trim() || !date) return setMsg("Remplis le titre et la date.");
    setBusy(true); setMsg("");
    const { error } = await supabase.from("dates_importantes").insert({ titre: titre.trim(), date, detail: detail.trim() });
    setBusy(false);
    if (error) return setMsg("Erreur : " + error.message);
    setTitre(""); setDate(""); setDetail(""); charger();
  }
  async function supprimer(id) {
    if (!confirm("Supprimer cette date ?")) return;
    await supabase.from("dates_importantes").delete().eq("id", id);
    charger();
  }

  const aVenir = rows.filter((r) => parseJour(r.date) >= debutAujourdhui());
  const passees = rows.filter((r) => parseJour(r.date) < debutAujourdhui()).reverse();
  const ligne = (r, passe) => {
    const d = parseJour(r.date);
    return (
      <div className={"date-row" + (passe ? " past" : "")} key={r.id}>
        <div className="date-badge"><span>{d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</span><b>{d.getDate()}</b></div>
        <div className="date-info"><p>{r.titre}</p><small>{maj(d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}{r.detail ? " · " + r.detail : ""}</small></div>
        <span className="date-left">{jMoins(d)}</span>
        {isAdmin && <button className="action-btn x" onClick={() => supprimer(r.id)}>🗑</button>}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {isAdmin && (
        <section className="card admin-panel-highlight" style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 16 }}>👑 Ajouter une date importante</h2>
          <form onSubmit={ajouter}>
            <div className="row">
              <label>Titre <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex : Partiel de maths" /></label>
              <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            </div>
            <label style={{ marginTop: 16 }}>Détail (facultatif) <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Ex : Salle 204, 9h" /></label>
            <button className="btn full" disabled={busy} style={{ marginTop: 16 }}>{busy ? "Ajout…" : "Ajouter"}</button>
            {msg && <p className="msg">{msg}</p>}
          </form>
        </section>
      )}
      <h2 style={{ marginBottom: 20 }}>À venir</h2>
      {loading ? <p className="muted">Chargement…</p> : aVenir.length === 0 ? <div className="card empty-state"><p className="muted">Aucune date importante à venir.</p></div> : <div className="date-list">{aVenir.map((r) => ligne(r, false))}</div>}
      {passees.length > 0 && <><h2 style={{ margin: "36px 0 20px" }}>Passées</h2><div className="date-list">{passees.map((r) => ligne(r, true))}</div></>}
    </div>
  );
}

/* ---------------- Affichage du Markdown (titres, gras, listes… sans symboles) ---------------- */
function mdInline(text, base) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0], key = base + "-" + i++;
    if (t.startsWith("**") || t.startsWith("__")) out.push(<strong key={key}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={key}>{t.slice(1, -1)}</code>);
    else out.push(<em key={key}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ texte }) {
  const lignes = String(texte || "").replace(/\r/g, "").split("\n");
  const blocs = [];
  let liste = null, table = null, k = 0;
  const fermer = () => {
    if (liste) {
      blocs.push(liste.ord ? <ol key={k++}>{liste.items}</ol> : <ul key={k++}>{liste.items}</ul>);
      liste = null;
    }
    if (table) {
      const [tete, ...corps] = table;
      blocs.push(
        <div className="md-table" key={k++}>
          <table>
            <thead><tr>{tete.map((c, i) => <th key={i}>{mdInline(c, "h" + i)}</th>)}</tr></thead>
            <tbody>{corps.map((r, j) => <tr key={j}>{r.map((c, i) => <td key={i}>{mdInline(c, j + "-" + i)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      table = null;
    }
  };

  lignes.forEach((brut) => {
    const l = brut.trimEnd();
    let m;
    if (l.trim().startsWith("|")) {
      if (/^\|?[\s:|-]+\|?$/.test(l.trim())) return; // ligne de séparation du tableau
      if (liste) fermer();
      if (!table) table = [];
      table.push(l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
      return;
    }
    fermer();
    if (!l.trim()) return;
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { blocs.push(<hr key={k++} />); return; }
    if ((m = l.match(/^(#{1,5})\s+(.*)$/))) {
      const Tag = "h" + Math.min(m[1].length + 1, 5);
      blocs.push(<Tag key={k++}>{mdInline(m[2], "t" + k)}</Tag>);
      return;
    }
    if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) {
      if (!liste || liste.ord) { fermer(); liste = { ord: false, items: [] }; }
      liste.items.push(<li key={liste.items.length}>{mdInline(m[1], "l" + k + "-" + liste.items.length)}</li>);
      return;
    }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (!liste || !liste.ord) { fermer(); liste = { ord: true, items: [] }; }
      liste.items.push(<li key={liste.items.length}>{mdInline(m[1], "o" + k + "-" + liste.items.length)}</li>);
      return;
    }
    blocs.push(<p key={k++}>{mdInline(l.trim(), "p" + k)}</p>);
  });
  fermer();
  return <>{blocs}</>;
}

/* ---------------- VUE SYNTHESES IA (Génération à la volée) ---------------- */

// Fonction utilitaire pour lire un fichier local et le convertir en Base64
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = error => reject(error);
});

// Réduit les photos (max 1600 px, JPEG) pour pouvoir envoyer beaucoup de pages d'un coup.
// Les PDF ne sont pas modifiés.
async function preparerFichier(file) {
  if (!file.type.startsWith("image/")) return { mimeType: file.type, data: await fileToBase64(file) };
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const r = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    return { mimeType: "image/jpeg", data: c.toDataURL("image/jpeg", 0.72).split(",")[1] };
  } catch (e) {
    return { mimeType: file.type, data: await fileToBase64(file) };
  }
}
const LIMITE_ENVOI = 4 * 1024 * 1024; // Vercel refuse les envois > 4,5 Mo
const taille = (o) => (o / 1024 / 1024).toFixed(1).replace(".", ",") + " Mo";

/* ---------------- Compteur de générations IA (offre gratuite de Gemini) ---------------- */
// À recopier depuis aistudio.google.com/rate-limit si les limites changent (même valeurs que dans api/generer-cours.js)
const LIMITES_IA = {
  "gemini-3.8-flash": { rpm: 5, rpd: 20 },
  "gemini-3.5-flash": { rpm: 5, rpd: 20 },
};
function debutJourPacifique(now) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Los_Angeles", hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(now);
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  return new Date(now.getTime() - (g("hour") * 3600 + g("minute") * 60 + g("second")) * 1000 - now.getMilliseconds());
}
const dureeTxt = (ms) => {
  const s = Math.max(1, Math.ceil(ms / 1000));
  return s >= 3600 ? Math.floor(s / 3600) + " h " + String(Math.floor((s % 3600) / 60)).padStart(2, "0") + " min"
    : s >= 60 ? Math.floor(s / 60) + " min " + String(s % 60).padStart(2, "0") + " s" : s + " s";
};

function useQuotaIA(cle) {
  const [rows, setRows] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let vivant = true;
    const charger = async () => {
      const depuis = debutJourPacifique(new Date()).toISOString();
      const { data, error } = await supabase.from("ia_usage").select("modele,created_at").gte("created_at", depuis).order("created_at", { ascending: true }).limit(1000);
      if (vivant) setRows(error ? "erreur" : data);
    };
    charger();
    const t = setInterval(charger, 30000); // pour voir aussi les générations des autres élèves
    return () => { vivant = false; clearInterval(t); };
  }, [cle]);

  const q = useMemo(() => {
    if (!Array.isArray(rows)) return null;
    const debut = debutJourPacifique(new Date(now)).getTime();
    const reset = debut + 86400000;
    const ts = rows.map((r) => ({ m: r.modele, t: new Date(r.created_at).getTime() }));
    let restJour = 0, totalJour = 0, dispoMin = 0, totalMin = 0, plusAncien = null;
    for (const [m, l] of Object.entries(LIMITES_IA)) {
      const duJour = ts.filter((x) => x.m === m && x.t >= debut);
      const derniereMin = duJour.filter((x) => x.t > now - 60000);
      const roomJour = Math.max(0, l.rpd - duJour.length);
      const roomMin = Math.max(0, l.rpm - derniereMin.length);
      restJour += roomJour; totalJour += l.rpd; totalMin += l.rpm;
      dispoMin += Math.min(roomJour, roomMin);
      if (roomJour > 0 && derniereMin.length) {
        const t0 = Math.min(...derniereMin.map((x) => x.t));
        plusAncien = plusAncien === null ? t0 : Math.min(plusAncien, t0);
      }
    }
    return {
      restJour, totalJour, dispoMin, totalMin, reset,
      attenteMin: plusAncien === null ? 0 : Math.max(0, plusAncien + 60000 - now),
    };
  }, [rows, now]);

  return { q, now };
}

function QuotaIA({ q, now }) {
  if (!q) return null;
  const barre = (reste, total) => (
    <div className="quota-bar"><i style={{ width: (total ? (reste / total) * 100 : 0) + "%", background: reste === 0 ? "var(--danger)" : reste / total < 0.25 ? "#f59e0b" : "#22c55e" }} /></div>
  );
  let pied;
  if (q.restJour === 0) pied = "Quota du jour épuisé pour toute la classe. Retour dans " + dureeTxt(q.reset - now) + " (vers " + new Date(q.reset).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + ").";
  else if (q.dispoMin === 0) pied = "Limite par minute atteinte. Prochaine génération possible dans " + dureeTxt(q.attenteMin) + ".";
  else pied = "Le compteur du jour revient à zéro dans " + dureeTxt(q.reset - now) + " (vers " + new Date(q.reset).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + ").";
  return (
    <div className="quota">
      <div className="quota-title">⚡ Générations IA restantes <span>· partagées par toute la classe</span></div>
      <div className="quota-grid">
        <div>
          <div className="quota-line"><span>Cette minute</span><b>{q.dispoMin} / {q.totalMin}</b></div>
          {barre(q.dispoMin, q.totalMin)}
        </div>
        <div>
          <div className="quota-line"><span>Aujourd'hui</span><b>{q.restJour} / {q.totalJour}</b></div>
          {barre(q.restJour, q.totalJour)}
        </div>
      </div>
      <p className="quota-foot">{pied}</p>
    </div>
  );
}

function FichesView({ session, prenom, isAdmin }) {
  const [fiches, setFiches] = useState([]);
  
  // Champs pour générer une nouvelle fiche
  const [matiere, setMatiere] = useState(""); 
  const [chapitre, setChapitre] = useState(""); 
  const [fichiers, setFichiers] = useState([]);
  const [quotaKey, setQuotaKey] = useState(0);
  const { q: quota, now: maintenant } = useQuotaIA(quotaKey);
  
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  
  // Modales
  const [previewModal, setPreviewModal] = useState(null); // Contient le texte généré à l'instant
  const [lectureModal, setLectureModal] = useState(null); // Pour lire une fiche déjà enregistrée dans la BDD
  
  const inputRef = useRef(null);

  async function chargerFiches() {
    const { data } = await supabase.from("fiches_ia").select("*").order("created_at", { ascending: false });
    if (data) setFiches(data);
  }
  
  useEffect(() => { chargerFiches(); }, []);

  // Grouper les fiches pour l'affichage (Uniquement les publiques OU celles de l'auteur)
  const fichesVisibles = useMemo(() => {
    return fiches.filter(f => f.is_public || f.auteur === prenom || isAdmin);
  }, [fiches, prenom, isAdmin]);

  const matieresExistantes = useMemo(() => [...new Set(fichesVisibles.map(f => f.matiere))], [fichesVisibles]);
  const parMatiereEtChapitre = useMemo(() => {
    const m = {};
    matieresExistantes.forEach(mat => { m[mat] = {}; });
    fichesVisibles.forEach(f => {
      const chap = f.chapitre || "Général";
      if (!m[f.matiere][chap]) m[f.matiere][chap] = [];
      m[f.matiere][chap].push(f);
    });
    return m;
  }, [fichesVisibles, matieresExistantes]);

  const ajouterFichiers = (list) => {
    const ok = Array.from(list).filter((f) => /image\/|application\/pdf/.test(f.type));
    setFichiers((prev) => [...prev, ...ok].slice(0, 20));
  };
  const deplacer = (i, d) => {
    setFichiers((prev) => {
      const j = i + d;
      if (j < 0 || j >= prev.length) return prev;
      const c = [...prev]; [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  };

  // 1. Envoyer les fichiers directement à l'API (SANS les sauvegarder dans Supabase)
  async function genererSynthese(e) {
    e.preventDefault();
    if (!matiere.trim() || !fichiers.length) return setMsg("Remplis la matière et ajoute au moins un fichier.");
    if (quota && quota.dispoMin === 0) return setMsg(quota.restJour === 0 ? "Le quota du jour est épuisé pour la classe." : "Limite par minute atteinte, patiente " + dureeTxt(quota.attenteMin) + ".");
    
    setBusy(true); 
    setMsg("L'IA lit tes fichiers, ça peut prendre 30 secondes...");
    
    try {
      // Préparer les fichiers en Base64
      const base64Files = [];
      for (const f of fichiers) {
        const p = await preparerFichier(f);
        base64Files.push({ nom: f.name, mimeType: p.mimeType, data: p.data });
      }
      const poids = base64Files.reduce((t, f) => t + f.data.length, 0);
      if (poids > LIMITE_ENVOI) {
        setMsg("Trop lourd pour un seul envoi (" + taille(poids) + ", maximum 4 Mo). Retire quelques fichiers (surtout les PDF) ou fais deux fiches.");
        setBusy(false);
        return;
      }

      const { data: { session: sess } } = await supabase.auth.getSession();
      
      // On envoie le texte en JSON au backend Vercel
      const res = await fetch("/api/generer-cours", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": "Bearer " + sess.access_token 
        },
        body: JSON.stringify({ 
          matiere: matiere.trim(), 
          chapitre: chapitre.trim() || "Général",
          fichiers: base64Files 
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur inconnu");
      
      // On ouvre la modale avec le texte généré (pas encore sauvegardé)
      setPreviewModal({
        matiere: matiere.trim(),
        chapitre: chapitre.trim() || "Général",
        texte: data.cours_markdown
      });
      
      setFichiers([]);
      setMatiere("");
      setChapitre("");
      setMsg("");
    } catch (err) { 
      setMsg("Erreur de l'IA : " + err.message); 
    } finally { 
      setBusy(false); 
      setQuotaKey((k) => k + 1);
    }
  }

  // 2. Sauvegarder la synthèse dans la base de données (Privée ou Publique)
  async function sauvegarderFiche(isPublic) {
    if (!previewModal) return;
    setBusy(true);
    
    const { error } = await supabase.from("fiches_ia").insert({
      matiere: previewModal.matiere,
      chapitre: previewModal.chapitre,
      contenu: previewModal.texte,
      auteur: prenom,
      is_public: isPublic
    });

    setBusy(false);
    if (error) {
      alert("Erreur lors de la sauvegarde : " + error.message);
    } else {
      setPreviewModal(null);
      chargerFiches();
    }
  }

  async function supprimerFiche(id) {
    if (!confirm("Supprimer cette fiche définitivement ?")) return;
    await supabase.from("fiches_ia").delete().eq("id", id);
    chargerFiches();
  }

  return (
    <div className="cours-view" style={{ maxWidth: 1000, margin: "0 auto" }}>
      
      <section className="card" style={{ marginBottom: 32, background: "linear-gradient(145deg, #0d2a6e 0%, #071229 100%)", borderColor: "var(--accent)" }}>
        <h2>✨ Générer une fiche de révision IA</h2>
        <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>
          Glisse tes propres notes ou les PDF du prof. L'IA les lira et créera un résumé clair. 
          <strong> Le PDF original ne sera jamais sauvegardé ni partagé.</strong>
        </p>
        
        <form onSubmit={genererSynthese}>
          <div className="row">
            <label>Matière concernée
              <input value={matiere} onChange={(e) => setMatiere(e.target.value)} placeholder="Ex: Finance d'entreprise" list="matieres-list" />
              <datalist id="matieres-list">{matieresExistantes.map(m => <option key={m} value={m} />)}</datalist>
            </label>
            <label>Chapitre / Thème
              <input value={chapitre} onChange={(e) => setChapitre(e.target.value)} placeholder="Ex: Chapitre 2 - Les taux" />
            </label>
          </div>
          
          <div className={"drop" + (drag ? " on" : "")} onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); ajouterFichiers(e.dataTransfer.files); }}>
            <div style={{ fontSize: 32 }}>⬆️</div>
            <strong>Glisse les PDF ou photos ici</strong><span>ou touche pour parcourir</span>
            <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { ajouterFichiers(e.target.files); e.target.value = ""; }} />
          </div>
          
          {fichiers.length > 0 && (
            <ul className="files">
              {fichiers.map((f, i) => (
                <li key={f.name + i}>
                  <span><b style={{ color: "var(--accent)", marginRight: 8 }}>{i + 1}.</b>{f.name}</span>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button type="button" style={{ color: "var(--txt-muted)" }} disabled={i === 0} onClick={() => deplacer(i, -1)} title="Monter">↑</button>
                    <button type="button" style={{ color: "var(--txt-muted)" }} disabled={i === fichiers.length - 1} onClick={() => deplacer(i, 1)} title="Descendre">↓</button>
                    <button type="button" onClick={() => setFichiers(fichiers.filter((_, j) => j !== i))}>✕</button>
                  </span>
                </li>
              ))}
              <li style={{ background: "transparent", border: "none", padding: "2px 4px", color: "var(--txt-muted)", fontSize: 13 }}>
                {fichiers.length} fichier{fichiers.length > 1 ? "s" : ""} · {taille(fichiers.reduce((t, f) => t + f.size, 0))} · l'IA les lit dans cet ordre (maximum 20)
              </li>
            </ul>
          )}
          
          <QuotaIA q={quota} now={maintenant} />
          <button className="btn full" disabled={busy || !matiere || fichiers.length === 0 || (quota && quota.dispoMin === 0)} style={{ marginTop: 16, background: "linear-gradient(135deg, #8b5cf6, #3b82f6)", border: "none" }}>
            {busy ? <span className="spin-emoji">🤖</span> : "✨ Générer la Fiche avec Gemini"}
          </button>
          {msg && <p className="msg">{msg}</p>}
        </form>
      </section>

      <section>
        <h2 style={{ marginBottom: 24 }}>Fiches de la classe & Privées</h2>
        {matieresExistantes.length === 0 ? (
          <div className="card empty-state"><p className="muted">Aucune fiche n'a encore été générée.</p></div>
        ) : (
          <div className="grid">
            {matieresExistantes.map((m) => {
              const totalFiches = Object.values(parMatiereEtChapitre[m]).flat().length;
              return (
                <div className="card" key={m} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="head">
                    <h3 style={{ wordBreak: 'break-word' }}>{m}</h3><span className="count">{totalFiches} fiches</span>
                  </div>
                  <div style={{ flex: 1, maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                    {Object.keys(parMatiereEtChapitre[m]).map(chap => (
                      <div key={chap} className="chapitre-group">
                        <div className="chapitre-title">📁 {chap}</div>
                        <ul className="list" style={{ marginBottom: 0 }}>
                          {parMatiereEtChapitre[m][chap].map((f) => (
                            <li key={f.id} style={{ cursor: "pointer", transition: "0.2s" }} onClick={() => setLectureModal(f)}>
                              <div style={{ paddingRight: "10px", minWidth: 0 }}>
                                <b style={{ display: "block", wordBreak: "break-word", fontSize: "14px", lineHeight: "1.3", marginBottom: "4px" }}>
                                  Synthèse IA - {f.auteur}
                                </b>
                                <small>
                                  {new Date(f.created_at).toLocaleDateString("fr-FR")} 
                                  {f.is_public ? " 🌍 (Public)" : " 🔒 (Privé)"}
                                </small>
                              </div>
                              <div className="right">
                                {(f.auteur === prenom || isAdmin) && (
                                  <button className="action-btn x" onClick={(e) => { e.stopPropagation(); supprimerFiche(f.id); }} title="Supprimer">🗑</button>
                                )}
                                <span style={{ fontSize: "16px" }}>📖</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODALE 1 : PREVIEW (Juste après la génération de l'IA, avant sauvegarde) */}
      {previewModal && (
        <div className="modal" onClick={() => { if(confirm("Quitter sans sauvegarder la fiche ?")) setPreviewModal(null); }}>
          <div className="modal-card" style={{ maxWidth: 800, width: "90%", display: "flex", flexDirection: "column", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-bar" style={{ background: "linear-gradient(135deg, #8b5cf6, #3b82f6)" }} />
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>✨ Voici ta synthèse ({previewModal.matiere})</h3>
              <button className="action-btn x" onClick={() => { if(confirm("Quitter sans sauvegarder la fiche ?")) setPreviewModal(null); }} style={{ fontSize: 20 }}>✕</button>
            </div>

            <div className="markdown-body" style={{ flex: 1, background: "rgba(0,0,0,0.2)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", overflowY: "auto", lineHeight: "1.6", fontSize: "15px" }}>
              <Markdown texte={previewModal.texte} />
            </div>
            
            <div className="form-2" style={{ marginTop: 20 }}>
              <button className="btn ghost full" disabled={busy} onClick={() => sauvegarderFiche(false)}>
                🔒 Sauvegarder pour moi
              </button>
              <button className="btn full" disabled={busy} style={{ background: "linear-gradient(135deg, #8b5cf6, #3b82f6)", border: "none" }} onClick={() => sauvegarderFiche(true)}>
                🌍 Partager à la classe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE 2 : LECTURE D'UNE FICHE DEJA ENREGISTREE */}
      {lectureModal && (
        <div className="modal" onClick={() => setLectureModal(null)}>
          <div className="modal-card" style={{ maxWidth: 800, width: "90%", display: "flex", flexDirection: "column", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-bar" style={{ background: "var(--accent)" }} />
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <h3 style={{ margin: 0 }}>{lectureModal.matiere} - {lectureModal.chapitre}</h3>
                <small className="muted">Généré par {lectureModal.auteur} {lectureModal.is_public ? "🌍" : "🔒"}</small>
              </div>
              <button className="action-btn x" onClick={() => setLectureModal(null)} style={{ fontSize: 20 }}>✕</button>
            </div>

            <div className="markdown-body" style={{ flex: 1, background: "rgba(0,0,0,0.2)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", overflowY: "auto", lineHeight: "1.6", fontSize: "15px" }}>
              <Markdown texte={lectureModal.contenu} />
            </div>
            
            <button className="btn full" style={{ marginTop: 20 }} onClick={() => setLectureModal(null)}>Fermer</button>
          </div>
        </div>
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

const dateLocale = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const heureLocale = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function CoursForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k, v) => setF({ ...f, [k]: v });

  async function submit(e) {
    e.preventDefault();
    if (!f.titre.trim() || !f.date || !f.debut || !f.fin) return setMsg("Remplis le nom, la date et les heures.");
    const d0 = new Date(`${f.date}T${f.debut}`);
    const e0 = new Date(`${f.date}T${f.fin}`);
    if (e0 <= d0) return setMsg("L'heure de fin doit être après le début.");

    setBusy(true); setMsg("");
    const base = { titre: f.titre.trim(), salle: f.salle.trim(), description: f.description.trim() };
    let error;
    if (f.id) {
      ({ error } = await supabase.from("cours_manuels").update({ ...base, debut: d0.toISOString(), fin: e0.toISOString() }).eq("id", f.id));
    } else {
      const n = Math.max(1, Math.min(40, parseInt(f.repeter) || 1));
      const rows = [];
      for (let i = 0; i < n; i++) {
        const a = new Date(d0), b = new Date(e0);
        a.setDate(a.getDate() + 7 * i); b.setDate(b.getDate() + 7 * i);
        rows.push({ ...base, debut: a.toISOString(), fin: b.toISOString() });
      }
      ({ error } = await supabase.from("cours_manuels").insert(rows));
    }
    setBusy(false);
    if (error) return setMsg("Erreur : " + error.message);
    onSaved();
  }

  return (
    <div className="modal" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-bar" style={{ background: "var(--accent)" }} />
        <h3>{f.id ? "Modifier le cours" : "Ajouter un cours"}</h3>
        <label>Nom du cours<input value={f.titre} onChange={(e) => set("titre", e.target.value)} placeholder="Ex : Statistiques" autoFocus /></label>
        <label>Date<input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></label>
        <div className="form-2">
          <label>Début<input type="time" value={f.debut} onChange={(e) => set("debut", e.target.value)} /></label>
          <label>Fin<input type="time" value={f.fin} onChange={(e) => set("fin", e.target.value)} /></label>
        </div>
        <label>Salle<input value={f.salle} onChange={(e) => set("salle", e.target.value)} placeholder="Ex : A204" /></label>
        <label>Notes (prof, groupe…)<input value={f.description} onChange={(e) => set("description", e.target.value)} /></label>
        {!f.id && (
          <label>Répéter chaque semaine pendant (semaines)
            <input type="number" min="1" max="40" value={f.repeter} onChange={(e) => set("repeter", e.target.value)} />
          </label>
        )}
        <button className="btn full" disabled={busy} style={{ marginTop: 14 }}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
        <button type="button" className="btn ghost full" style={{ marginTop: 8 }} onClick={onClose}>Annuler</button>
        {msg && <p className="msg">{msg}</p>}
      </form>
    </div>
  );
}

function PlanningView({ isAdmin }) {
  const { events, loading, erreur, recharger } = usePlanning();
  const mobile = useMedia("(max-width: 768px)");
  const [debut, setDebut] = useState(lundiDe(new Date()));
  const [choisi, setChoisi] = useState(null);       
  const [form, setForm] = useState(null);           
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
    return tous.filter((j, i) => i < 6 || j.evts.length > 0);   
  }, [events, debut]);

  const affiches = mobile ? [jours[Math.min(jourMobile, jours.length - 1)]] : jours;

  const heures = useMemo(() => {
    let min = 8, max = 20;
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

  function nouveauForm(lundi0) {
    const auj = new Date();
    const d = auj >= lundi0 && auj < new Date(lundi0.getTime() + 7 * 86400000) ? auj : lundi0;
    return { titre: "", date: dateLocale(d), debut: "08:00", fin: "10:00", salle: "", description: "", repeter: 1 };
  }
  function formDepuis(e) {
    return { id: e.id, titre: e.matiere || "", date: dateLocale(e.debut), debut: heureLocale(e.debut), fin: heureLocale(e.fin), salle: e.salle || "", description: e.description || "", repeter: 1 };
  }
  async function supprimerManuel(e) {
    if (!confirm("Supprimer ce cours ?")) return;
    const { error } = await supabase.from("cours_manuels").delete().eq("id", e.id);
    if (error) return alert("Erreur : " + error.message);
    setChoisi(null);
    recharger();
  }
  const cols = `repeat(${affiches.length}, minmax(0, 1fr))`;

  return (
    <div className="planning-view">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button className="pill-btn" onClick={aujourdhui}>Aujourd'hui</button>
          <button className="round-btn" onClick={() => decale(-1)} aria-label="Semaine précédente">‹</button>
          <button className="round-btn" onClick={() => decale(1)} aria-label="Semaine suivante">›</button>
          {isAdmin && (
            <button className="pill-btn primary" onClick={() => setForm(nouveauForm(debut))}>+ Ajouter</button>
          )}
        </div>
        <h2 className="cal-title">{titre}</h2>
        <span className={"sync " + (erreur ? "bad" : "ok")}>
          <i /> {loading && !events.length ? "Chargement" : erreur ? "Non synchronisé" : "Synchronisé"}
        </span>
      </div>

      {erreur && <p className="cal-error">{erreur}</p>}

      <div className="cal-box">
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
            {choisi.manuel && <p className="tag-manuel">✎ Ajouté à la main</p>}
            {isAdmin && choisi.manuel && (
              <div className="form-2" style={{ marginTop: 16 }}>
                <button className="btn ghost full" style={{ marginTop: 0 }} onClick={() => { setForm(formDepuis(choisi)); setChoisi(null); }}>Modifier</button>
                <button className="btn ghost full danger" style={{ marginTop: 0 }} onClick={() => supprimerManuel(choisi)}>Supprimer</button>
              </div>
            )}
            <button className="btn full" style={{ marginTop: 14 }} onClick={() => setChoisi(null)}>Fermer</button>
          </div>
        </div>
      )}

      {form && (
        <CoursForm initial={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); recharger(); }} />
      )}
    </div>
  );
}

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

function parseICSDate(str) {
  const m = str.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h = 0, mi = 0, sec = 0, z] = m;
  const n = [y, mo - 1, d, h, mi, sec].map(Number);
  return z ? new Date(Date.UTC(...n)) : new Date(...n);
}

/* ---------------- Styles CSS ---------------- */
const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --bg-app: #030a1a; --bg-sidebar: #040c1f; --bg-card: #071229; --bg-card-blue: #0d2a6e; --txt-main: #FFFFFF; --txt-muted: #8a97b4; --border: #11244d; --accent: #2f6bff; --accent-hover: #4a80ff; --danger: #EF4444; }
html { color-scheme: dark; height: 100%; }
body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: radial-gradient(1200px 600px at 70% -10%, #0a1d46 0%, var(--bg-app) 60%); background-color: var(--bg-app); color: var(--txt-main); line-height: 1.5; overflow: hidden; height: 100%; overscroll-behavior: none; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; }
button { font: inherit; color: inherit; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

.auth-screen { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
.auth-screen h1 { margin: 24px 0; font-size: 28px; }
.app-layout { display: flex; height: 100vh; height: 100dvh; width: 100%; overflow: hidden; }

.sidebar { width: 250px; background: var(--bg-sidebar); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 24px 14px; }
.logo-header { display: flex; align-items: center; gap: 12px; margin-bottom: 36px; padding: 0 12px; line-height: 1.25; }
.logo-header small { color: var(--txt-muted); font-size: 13px; }
.logo-icon { font-size: 24px; }
.nav-menu { display: flex; flex-direction: column; gap: 4px; }
.nav-link { display: flex; align-items: center; gap: 14px; background: transparent; border: none; border-left: 2px solid transparent; color: var(--txt-muted); padding: 12px 14px; border-radius: 10px; cursor: pointer; font-size: 15px; font-weight: 500; text-align: left; transition: all .15s; }
.nav-link:hover { color: var(--txt-main); background: rgba(255,255,255,.04); }
.nav-link.active { color: var(--txt-main); background: rgba(47,107,255,.14); border-left-color: var(--accent); }
.nav-link.active svg { color: var(--accent); }

.main-content { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; }
.topbar { flex: none; height: 68px; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; border-bottom: 1px solid var(--border); background: rgba(3,10,26,.6); backdrop-filter: blur(8px); }
.breadcrumb { font-weight: 600; font-size: 15px; }
.user-menu { display: flex; align-items: center; gap: 14px; }
.name-btn { background: none; border: none; color: var(--txt-main); font-weight: 600; cursor: pointer; padding: 6px 12px; border-radius: 8px; transition: .2s; }
.name-btn:hover { background: rgba(255,255,255,.06); }
.logout-btn { background: transparent; border: 1px solid var(--border); color: var(--txt-muted); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.logout-btn:hover { color: var(--danger); border-color: var(--danger); }
.scroll-area { flex: 1; min-height: 0; min-width: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding: 32px 32px 56px; }

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

.empty-state { text-align: center; padding: 40px 20px; }
.empty-icon { font-size: 32px; margin-bottom: 12px; opacity: .7; }

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

/* -- Nouveaux styles pour les dossiers/chapitres -- */
.chapitre-group { margin-bottom: 12px; }
.chapitre-title { font-size: 13px; font-weight: 600; color: var(--txt-muted); margin-bottom: 8px; margin-left: 4px; display: flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.5px; }

.list { list-style: none; display: grid; gap: 12px; margin-bottom: 12px; }
.list li { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,.03); border-radius: 8px; }
.list li:hover { background: rgba(255,255,255,.06); }
.list small { display: block; color: var(--txt-muted); font-size: 12px; margin-top: 4px; }
.action-btn { background: none; border: 0; cursor: pointer; filter: grayscale(1); opacity: .7; font-size: 14px; transition: .2s; }
.action-btn:hover { filter: grayscale(0); opacity: 1; transform: scale(1.1); }
.x:hover { color: var(--danger); }

/* ====== Planning : grille de la semaine ====== */
.planning-view { max-width: 1150px; margin: 0 auto; }
.cal-toolbar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; margin-bottom: 18px; }
.cal-nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
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
.modal-card { max-height: 92vh; overflow-y: auto; position: relative; background: var(--bg-card); border: 1px solid var(--border); border-radius: 18px; padding: 26px; width: 100%; max-width: 380px; overflow: hidden; }
.modal-bar { position: absolute; left: 0; top: 0; right: 0; height: 4px; }
.modal-card h3 { font-size: 19px; margin: 6px 0 8px; }
.modal-room { margin-top: 10px; font-weight: 600; }
.modal-card label { margin-top: 12px; margin-bottom: 0; }
.form-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pill-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.pill-btn.primary:hover { background: var(--accent-hover); }
.tag-manuel { margin-top: 12px; font-size: 12px; color: var(--accent); }
.btn.danger { color: var(--danger); }

.date-item + .date-item { margin-top: 10px; }
.date-badge { width: 46px; height: 50px; flex: none; border-radius: 12px; background: rgba(255,255,255,.14); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; }
.date-badge span { font-size: 11px; text-transform: uppercase; opacity: .75; }
.date-badge b { font-size: 18px; }
.date-info { flex: 1; min-width: 0; }
.date-info p { font-weight: 600; overflow-wrap: anywhere; }
.date-info small { display: block; opacity: .75; font-size: 13px; margin-top: 2px; }
.date-left { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; background: rgba(255,255,255,.16); white-space: nowrap; }
.date-list { display: grid; gap: 12px; }
.date-row { display: flex; align-items: center; gap: 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 14px 18px; }
.date-row .date-badge { background: rgba(47,107,255,.14); }
.date-row .date-left { background: rgba(47,107,255,.15); color: var(--accent); }
.date-row.past { opacity: .5; }
.bottom-bar { display: none; background: var(--bg-sidebar); border-top: 1px solid var(--border); height: 68px; padding-bottom: env(safe-area-inset-bottom); }
.bottom-link { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; background: transparent; border: none; color: var(--txt-muted); cursor: pointer; }
.bottom-link.active { color: var(--accent); }
.bottom-link .nav-label { font-size: 10.5px; font-weight: 500; }


/* ====== Texte des fiches (Markdown) ====== */
.markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5 { line-height: 1.3; margin: 22px 0 8px; letter-spacing: -.01em; }
.markdown-body > :first-child { margin-top: 0; }
.markdown-body h2 { font-size: 21px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
.markdown-body h3 { font-size: 18px; color: #9db8ff; }
.markdown-body h4, .markdown-body h5 { font-size: 16px; }
.markdown-body p { margin: 8px 0; }
.markdown-body ul, .markdown-body ol { margin: 8px 0 8px 22px; }
.markdown-body li { margin: 4px 0; }
.markdown-body strong { color: #fff; font-weight: 700; }
.markdown-body hr { border: 0; border-top: 1px solid var(--border); margin: 18px 0; }
.markdown-body code { background: rgba(255,255,255,.08); padding: 1px 6px; border-radius: 5px; font-size: .92em; }
.markdown-body .md-table { overflow-x: auto; margin: 12px 0; }
.markdown-body table { border-collapse: collapse; width: 100%; font-size: 14px; }
.markdown-body th, .markdown-body td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
.markdown-body th { background: rgba(47,107,255,.14); }


/* ====== Compteur IA ====== */
.quota { margin-top: 16px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 12px; background: rgba(255,255,255,.03); }
.quota-title { font-weight: 600; font-size: 14px; margin-bottom: 10px; }
.quota-title span { font-weight: 400; color: var(--txt-muted); }
.quota-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.quota-line { display: flex; justify-content: space-between; font-size: 13px; color: var(--txt-muted); margin-bottom: 6px; }
.quota-line b { color: var(--txt-main); }
.quota-bar { height: 6px; border-radius: 99px; background: rgba(255,255,255,.1); overflow: hidden; }
.quota-bar i { display: block; height: 100%; border-radius: 99px; transition: width .4s; }
.quota-foot { margin-top: 10px; font-size: 12.5px; color: var(--txt-muted); }
@media (max-width: 520px) { .quota-grid { grid-template-columns: 1fr; } }

@keyframes spin { 100% { transform: rotate(360deg); } }
.spin-emoji { display: inline-block; animation: spin 2s linear infinite; }

.markdown-body h1, .markdown-body h2 { color: #fff; margin-top: 1em; margin-bottom: 0.5em; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; }
.markdown-body ul, .markdown-body ol { padding-left: 20px; margin-bottom: 1em; }
.markdown-body li { margin-bottom: 4px; }
.markdown-body strong { color: var(--accent); }

@media (max-width: 768px) {
  .desktop-only { display: none !important; }
  .bottom-bar.mobile-only { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; }
  .app-layout { flex-direction: column; }
  .topbar { padding: 0 20px; height: 60px; }
  .scroll-area { padding: 18px 14px calc(96px + env(safe-area-inset-bottom)); }
  input, select { font-size: 16px; }
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