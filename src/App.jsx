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
      {!ready ? null : session ? <Home session={session} /> : <Login />}
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
    <div className="hero full-screen">
      <div className="wrap" style={{ maxWidth: 420 }}>
        <span className="badge">📚 Cours de la classe</span>
        <h1>{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
        <form className="card" onSubmit={submit} style={{ color: "var(--txt)" }}>
          <label>Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <div style={{ height: 12 }} />
          <label>Mot de passe
            <input type="password" required minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </label>
          <button className="btn full" disabled={busy}>
            {busy ? "…" : mode === "login" ? "Se connecter" : "S'inscrire"}
          </button>
          {msg && <p className="msg">{msg}</p>}
          <p className="muted" style={{ marginTop: 14, textAlign: "center" }}>
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

/* ---------------- Page principale ---------------- */
function Home({ session }) {
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
    if (error) setMsg("Erreur de chargement : " + error.message);
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

        const ins = await supabase.from("cours").insert({
          matiere, auteur: auteur.trim(), fichier: path,
        });
        if (ins.error) throw ins.error;

        // Plus tard : déclencher la transcription IA
        // fetch("/api/transcribe", { method: "POST", headers: {"Content-Type":"application/json"},
        //   body: JSON.stringify({ path }) });
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
    setMsg(`Le PDF « ${m} » sera généré ici quand /api/merge sera branché.`);
    // const r = await fetch(`/api/merge?matiere=${encodeURIComponent(m)}`);
    // window.open(URL.createObjectURL(await r.blob()));
  }

  return (
    <>
      <header className="hero">
        <div className="wrap">
          <div className="top">
            <span className="badge">📚 Cours de la classe</span>
            <button className="link" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
          </div>
          <h1>Dépose tes notes,<br />l'IA fait le reste.</h1>
          <p>Prends en photo ton cours manuscrit. Il est retranscrit en PDF, puis fusionné avec ceux des autres pour créer le cours complet de la classe.</p>
          <a href="#depot" className="btn">Déposer un cours</a>
        </div>
      </header>

      <main className="wrap">
        <section className="steps">
          {[
            ["📸", "Dépose", "Photo ou PDF de ton cours manuscrit"],
            ["🤖", "Transcrit", "L'IA lit ton écriture et la met au propre"],
            ["📄", "Fusionne", "Un PDF par matière avec les notes de tous"],
          ].map(([i, t, d]) => (
            <div className="card step" key={t}>
              <div className="ico">{i}</div>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </section>

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
                          <em className={c.statut === "transcrit" ? "ok" : "wait"}>{c.statut}</em>
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
      </main>

      <footer>Fait par et pour la classe 💙</footer>
    </>
  );
}

const css = `
*{box-sizing:border-box;margin:0}
:root{--bg:#f6f7fb;--card:#fff;--txt:#1b1d2a;--mut:#6b7086;--pri:#5b5bf0;--pri2:#8b5cf6;--bd:#e6e8f0}
@media(prefers-color-scheme:dark){:root{--bg:#0f1016;--card:#181a24;--txt:#eef0f8;--mut:#9aa0b8;--bd:#272a38}}
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--txt);line-height:1.5}
a{color:var(--pri)}
.wrap{max-width:1000px;margin:0 auto;padding:0 16px}
.hero{background:linear-gradient(135deg,var(--pri),var(--pri2));color:#fff;padding:40px 0 64px;margin-bottom:-28px}
.hero.full-screen{min-height:100vh;margin:0;display:flex;align-items:center;padding:24px 0}
.hero h1{font-size:clamp(28px,6vw,48px);line-height:1.1;margin:14px 0}
.hero p{max-width:540px;opacity:.92;margin-bottom:22px}
.top{display:flex;justify-content:space-between;align-items:center}
.badge{background:rgba(255,255,255,.2);padding:6px 12px;border-radius:99px;font-size:14px}
.link{background:none;border:0;color:#fff;opacity:.85;cursor:pointer;font-size:14px;text-decoration:underline}
.btn{display:inline-block;background:#fff;color:var(--pri);border:0;padding:12px 22px;border-radius:12px;font-weight:600;font-size:16px;cursor:pointer;text-decoration:none}
form .btn,.card .btn{background:var(--pri);color:#fff}
.btn.ghost{background:transparent!important;color:var(--pri)!important;border:1.5px solid var(--pri)}
.btn.full{width:100%;margin-top:14px}
.btn:disabled{opacity:.45;cursor:not-allowed}
main{padding-bottom:40px}
section{margin-top:28px}
h2{font-size:22px;margin-bottom:14px}
.card{background:var(--card);border:1px solid var(--bd);border-radius:18px;padding:20px;box-shadow:0 4px 18px rgba(20,20,60,.05)}
.steps{display:grid;gap:12px;grid-template-columns:1fr}
.step{text-align:center}.step .ico{font-size:30px}.step p{color:var(--mut);font-size:14px}
.row{display:grid;gap:12px;grid-template-columns:1fr}
label{display:block;font-size:14px;font-weight:600}
input,select{width:100%;margin-top:6px;padding:12px;border-radius:10px;border:1px solid var(--bd);background:var(--bg);color:var(--txt);font-size:16px}
.drop{margin-top:14px;border:2px dashed var(--bd);border-radius:14px;padding:28px 16px;text-align:center;cursor:pointer;display:flex;flex-direction:column;gap:4px;transition:.15s}
.drop span{color:var(--mut);font-size:14px}
.drop.on,.drop:hover{border-color:var(--pri);background:rgba(91,91,240,.06)}
.files{list-style:none;padding:0;margin-top:12px;display:grid;gap:6px}
.files li{display:flex;justify-content:space-between;align-items:center;background:var(--bg);padding:8px 12px;border-radius:8px;font-size:14px}
.files button{background:none;border:0;color:var(--mut);cursor:pointer;font-size:16px}
.msg{margin-top:12px;font-size:14px;color:var(--pri)}
.grid{display:grid;gap:14px;grid-template-columns:1fr}
.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.count{background:var(--pri);color:#fff;border-radius:99px;min-width:26px;text-align:center;padding:2px 8px;font-size:13px}
.muted{color:var(--mut);font-size:14px}
.list{list-style:none;padding:0;display:grid;gap:8px}
.list li{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--bd)}
.list small{display:block;color:var(--mut);font-size:12px}
.list em{font-style:normal;font-size:12px;padding:3px 9px;border-radius:99px;white-space:nowrap}
.right{display:flex;align-items:center;gap:6px}
.x{background:none;border:0;cursor:pointer;font-size:15px}
.ok{background:rgba(34,197,94,.15);color:#16a34a}.wait{background:rgba(245,158,11,.15);color:#d97706}
footer{text-align:center;color:var(--mut);padding:24px;font-size:14px}
@media(min-width:720px){
  .steps{grid-template-columns:repeat(3,1fr)}
  .row{grid-template-columns:1fr 1fr}
  .grid{grid-template-columns:repeat(2,1fr)}
  .hero{padding:60px 0 80px}
}
@media(min-width:980px){.grid{grid-template-columns:repeat(3,1fr)}}
`;

