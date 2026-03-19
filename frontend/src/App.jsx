import { useState, useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// Constants & Styles
// ---------------------------------------------------------------------------
const STEPS = ["Details", "Photo", "Documents", "Video", "Review"];
const ACCENT = "#0f3d5c";
const ACCENT_LIGHT = "#e8f4f8";
const SUCCESS = "#16a34a";
const MONO = "'JetBrains Mono', monospace";

const inputStyle = {
  width: "100%", padding: "12px 16px", border: "2px solid #e2e8f0",
  borderRadius: 10, fontSize: 15, fontFamily: "inherit", outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s", background: "#fafbfc",
  boxSizing: "border-box",
};
const labelStyle = {
  display: "block", fontSize: 13, fontWeight: 600, color: "#475569",
  marginBottom: 6, letterSpacing: "0.02em",
};
const btnPrimary = {
  padding: "14px 36px", background: ACCENT, color: "#fff", border: "none",
  borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer",
  letterSpacing: "0.03em", transition: "all 0.2s",
};
const btnSecondary = {
  ...btnPrimary, background: "transparent", color: ACCENT, border: `2px solid ${ACCENT}`,
};

// ---------------------------------------------------------------------------
// Reusable Components
// ---------------------------------------------------------------------------
function StepIndicator({ current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 36, flexWrap: "wrap" }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 52 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, fontFamily: MONO,
              background: i < current ? SUCCESS : i === current ? ACCENT : "#e2e8f0",
              color: i <= current ? "#fff" : "#94a3b8",
              transition: "all 0.4s",
              boxShadow: i === current ? `0 0 0 4px ${ACCENT}22` : "none",
            }}>
              {i < current ? "✓" : i + 1}
            </div>
            <span style={{
              fontSize: 9, fontWeight: 600, marginTop: 5,
              color: i === current ? ACCENT : "#94a3b8",
              letterSpacing: "0.05em", textTransform: "uppercase",
            }}>{s}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{
              width: 32, height: 2, background: i < current ? SUCCESS : "#e2e8f0",
              margin: "0 2px", marginBottom: 18, borderRadius: 2, transition: "background 0.4s",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ marginBottom: 18 }}><label style={labelStyle}>{label}</label>{children}</div>;
}

function Thumbnail({ src, label, onRemove }) {
  return (
    <div style={{
      display: "inline-flex", flexDirection: "column", alignItems: "center",
      background: "#f8fafc", border: "2px solid #e2e8f0", borderRadius: 12,
      padding: 10, position: "relative", width: 130,
    }}>
      <img src={src} alt={label} style={{ width: 110, height: 82, objectFit: "cover", borderRadius: 8 }} />
      <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", marginTop: 5 }}>{label}</span>
      {onRemove && (
        <button onClick={onRemove} style={{
          position: "absolute", top: 4, right: 4, width: 22, height: 22,
          borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff",
          fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>×</button>
      )}
    </div>
  );
}

function InfoBox({ color, bg, border, children }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 13, color, border: `1px solid ${border}` }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Camera Component
// ---------------------------------------------------------------------------
function CameraView({ onCapture, label, mirrored = true }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mirrored ? "user" : "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setActive(true); // render the video element first
    } catch { setError("Camera access denied. Please allow camera permissions."); }
  };

  // Bind stream to video element AFTER it's rendered in DOM
  useEffect(() => {
    if (!active || !streamRef.current) return;
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = streamRef.current;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");

    const onPlaying = () => setReady(true);
    video.addEventListener("playing", onPlaying);

    video.play().catch(() => {});

    // Fallback: if "playing" event never fires, enable capture after 2s
    const fallback = setTimeout(() => setReady(true), 2000);

    return () => {
      video.removeEventListener("playing", onPlaying);
      clearTimeout(fallback);
    };
  }, [active]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setActive(false); setReady(false);
  };

  const capture = () => {
    const v = videoRef.current; if (!v) return;
    const w = v.videoWidth || v.clientWidth || 640;
    const h = v.videoHeight || v.clientHeight || 480;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (mirrored) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0, w, h);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    if (dataUrl.length < 1000) {
      setError("Capture failed — please wait a moment and try again.");
      return;
    }
    stopCamera(); onCapture(dataUrl);
  };

  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  return (
    <div style={{ textAlign: "center" }}>
      {error && <InfoBox color="#dc2626" bg="#fef2f2" border="#fecaca">{error}</InfoBox>}
      {!active ? (
        <button onClick={startCamera} style={{ ...btnPrimary, background: "#1e6b8a" }}>📷 Open Camera — {label}</button>
      ) : (
        <div>
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: `3px solid ${ACCENT}`, display: "inline-block", maxWidth: "100%" }}>
            <video ref={videoRef} style={{ width: "100%", maxWidth: 520, display: "block", transform: mirrored ? "scaleX(-1)" : "none" }} autoPlay playsInline muted />
            {ready && (
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.5))", padding: "20px 0 14px", textAlign: "center" }}>
                <button onClick={capture} style={{ width: 60, height: 60, borderRadius: "50%", border: "4px solid #fff", background: "#ef4444", cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }} />
              </div>
            )}
            {!ready && (
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.5)", padding: "16px 0", textAlign: "center", color: "#fff", fontSize: 13 }}>
                Starting camera...
              </div>
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={stopCamera} style={{ ...btnSecondary, padding: "8px 20px", fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Video Recorder
// ---------------------------------------------------------------------------
function VideoRecorder({ onRecord }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);
  const [phase, setPhase] = useState("idle");
  const [countdown, setCountdown] = useState(10);
  const [error, setError] = useState(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setPhase("preview"); setError(null);
    } catch { setError("Camera/microphone access denied."); }
  };

  const startRecording = () => {
    chunksRef.current = [];
    // Pick best supported format — Safari only does MP4, Chrome/Firefox do WebM
    let mimeType = "video/webm";
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) mimeType = "video/webm;codecs=vp9,opus";
    else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) mimeType = "video/webm;codecs=vp8,opus";
    else if (MediaRecorder.isTypeSupported("video/webm")) mimeType = "video/webm";
    else if (MediaRecorder.isTypeSupported("video/mp4")) mimeType = "video/mp4";
    
    const isMP4 = mimeType.startsWith("video/mp4");
    const ext = isMP4 ? "mp4" : "webm";
    const blobType = isMP4 ? "video/mp4" : "video/webm";
    
    const rec = new MediaRecorder(streamRef.current, { mimeType });
    rec.ondataavailable = e => e.data.size > 0 && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: blobType });
      const reader = new FileReader();
      reader.onloadend = () => onRecord({ blob, url: URL.createObjectURL(blob), base64: reader.result, ext });
      reader.readAsDataURL(blob);
      streamRef.current?.getTracks().forEach(t => t.stop());
      setPhase("done");
    };
    recorderRef.current = rec; rec.start(); setPhase("recording"); setCountdown(10);
    let sec = 10;
    timerRef.current = setInterval(() => {
      sec -= 1; setCountdown(sec);
      if (sec <= 0) { clearInterval(timerRef.current); rec.stop(); }
    }, 1000);
  };

  const cancel = () => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setPhase("idle");
  };

  useEffect(() => () => { clearInterval(timerRef.current); streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  return (
    <div style={{ textAlign: "center" }}>
      {error && <InfoBox color="#dc2626" bg="#fef2f2" border="#fecaca">{error}</InfoBox>}
      {phase === "idle" && <button onClick={startCamera} style={{ ...btnPrimary, background: "#7c3aed" }}>🎬 Open Camera for Video</button>}
      {(phase === "preview" || phase === "recording") && (
        <div>
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: phase === "recording" ? "3px solid #ef4444" : `3px solid ${ACCENT}`, display: "inline-block", maxWidth: "100%" }}>
            <video ref={videoRef} style={{ width: "100%", maxWidth: 520, display: "block", transform: "scaleX(-1)" }} autoPlay playsInline muted />
            {phase === "recording" && (
              <div style={{
                position: "absolute", top: 16, right: 16, background: "#ef4444", color: "#fff",
                borderRadius: 20, padding: "6px 16px", fontSize: 18, fontWeight: 800, fontFamily: MONO,
                display: "flex", alignItems: "center", gap: 8, animation: "pulse 1s infinite",
              }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff", display: "inline-block" }} /> {countdown}s
              </div>
            )}
            {phase === "preview" && (
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.6))", padding: "24px 0 16px", textAlign: "center" }}>
                <button onClick={startRecording} style={{ padding: "12px 28px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  ● Start 10s Recording
                </button>
              </div>
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={cancel} style={{ ...btnSecondary, padding: "8px 20px", fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}
      {phase === "done" && (
        <div style={{ background: "#f0fdf4", border: "2px solid #86efac", borderRadius: 12, padding: 20, display: "inline-flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 600, color: SUCCESS }}>
          ✓ Video recorded successfully
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin Dashboard
// ---------------------------------------------------------------------------
function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);

  const login = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/admin/submissions?password=${encodeURIComponent(password)}`);
      if (!res.ok) throw new Error("Invalid password");
      const data = await res.json();
      setSubmissions(data); setAuthed(true);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const fileUrl = (sub, filename) =>
    `/api/admin/file/${sub.id}/${filename}?password=${encodeURIComponent(password)}`;

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0f9ff, #e8f4f8)" }}>
        <div style={{ background: "#fff", padding: 40, borderRadius: 20, boxShadow: "0 8px 40px rgba(15,61,92,0.08)", maxWidth: 400, width: "100%", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: ACCENT, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🔒</div>
          <h2 style={{ fontSize: 22, color: ACCENT, margin: "0 0 8px", fontWeight: 800 }}>Admin Access</h2>
          <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>Enter the admin password to view submissions.</p>
          {error && <InfoBox color="#dc2626" bg="#fef2f2" border="#fecaca">{error}</InfoBox>}
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
            style={{ ...inputStyle, marginBottom: 16, textAlign: "center", fontSize: 16 }}
          />
          <button onClick={login} disabled={loading} style={{ ...btnPrimary, width: "100%", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Checking..." : "Login →"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #f0f9ff 0%, #eef2f7 50%, #e8f4f8 100%)" }}>
      <div style={{ background: ACCENT, color: "#fff", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>🛡️</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.04em" }}>KYE ADMIN</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Leapfour Media — {submissions.length} submission{submissions.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <button onClick={() => { setAuthed(false); setPassword(""); }} style={{ ...btnSecondary, color: "#fff", borderColor: "rgba(255,255,255,0.3)", padding: "8px 16px", fontSize: 12 }}>
          Logout
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
        {submissions.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <p style={{ fontSize: 16 }}>No submissions yet.</p>
          </div>
        ) : submissions.map(sub => (
          <div key={sub.id} style={{
            background: "#fff", borderRadius: 16, marginBottom: 16,
            boxShadow: "0 2px 12px rgba(15,61,92,0.05)", border: "1px solid #e8edf2",
            overflow: "hidden", animation: "fadeIn 0.3s ease",
          }}>
            {/* Header */}
            <div
              onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}
              style={{ padding: "18px 24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {sub.face_photo_path ? (
                  <img src={fileUrl(sub, "face.jpg")} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid #e2e8f0" }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👤</div>
                )}
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{sub.full_name}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{sub.phone} • {new Date(sub.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
              <span style={{ fontSize: 18, color: "#94a3b8", transition: "transform 0.2s", transform: expanded === sub.id ? "rotate(180deg)" : "none" }}>▾</span>
            </div>

            {/* Expanded details */}
            {expanded === sub.id && (
              <div style={{ padding: "0 24px 24px", borderTop: "1px solid #f1f5f9" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 24px", fontSize: 14, color: "#334155", marginTop: 16, marginBottom: 20 }}>
                  {[
                    ["DOB", sub.dob], ["Gender", sub.gender], ["Nationality", sub.nationality],
                    ["Email", sub.email], ["Address", sub.current_address], ["PIN", sub.pin_code],
                    ["Aadhaar", sub.aadhaar_number], ["PAN", sub.pan_number], ["Father", sub.father_name],
                    ["Emergency", `${sub.emergency_name || "—"} (${sub.emergency_relation || "—"}) ${sub.emergency_phone || ""}`],
                    ["Bank", `${sub.bank_name || "—"} / ${sub.ifsc || "—"}`], ["A/C", sub.account_number],
                  ].map(([l, v]) => (
                    <div key={l}><div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>{l}</div><div>{v || "—"}</div></div>
                  ))}
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Captured Media</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
                  {[
                    ["face.jpg", "Face"], ["aadhaar_front.jpg", "Aadhaar Front"],
                    ["aadhaar_back.jpg", "Aadhaar Back"], ["pan.jpg", "PAN"],
                    ...(sub.additional_id_path ? [["additional_id.jpg", "Additional ID"]] : []),
                  ].map(([file, label]) => (
                    <a key={file} href={fileUrl(sub, file)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <div style={{ width: 130, background: "#f8fafc", border: "2px solid #e2e8f0", borderRadius: 10, padding: 8, textAlign: "center" }}>
                        <img src={fileUrl(sub, file)} alt={label} style={{ width: 114, height: 80, objectFit: "cover", borderRadius: 6 }} />
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", marginTop: 4 }}>{label}</div>
                      </div>
                    </a>
                  ))}
                  {sub.video_path && (
                    <div style={{ width: 200 }}>
                      <video src={fileUrl(sub, sub.video_path.split("/").pop())} controls style={{ width: "100%", borderRadius: 10, border: "2px solid #e2e8f0" }} />
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", marginTop: 4, textAlign: "center" }}>Live Video</div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 16, fontSize: 11, color: "#94a3b8" }}>
                  ID: <span style={{ fontFamily: MONO }}>{sub.id}</span> • IP: {sub.ip_address || "—"}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main KYE Form
// ---------------------------------------------------------------------------
function KYEForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    fullName: "", dob: "", fatherName: "", gender: "", nationality: "Indian",
    phone: "", email: "", currentAddress: "", pinCode: "", permanentAddress: "",
    aadhaarNumber: "", panNumber: "",
    emergencyName: "", emergencyRelation: "", emergencyPhone: "",
    bankName: "", accountNumber: "", ifsc: "",
  });
  const [facePhoto, setFacePhoto] = useState(null);
  const [docs, setDocs] = useState({ aadhaarFront: null, aadhaarBack: null, pan: null, additional: null });
  const [video, setVideo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const DOC_LABELS = [
    { key: "aadhaarFront", label: "Aadhaar Card — Front" },
    { key: "aadhaarBack", label: "Aadhaar Card — Back" },
    { key: "pan", label: "PAN Card" },
    { key: "additional", label: "Additional ID (Optional)" },
  ];

  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const isStep0Valid = form.fullName && form.dob && form.phone && form.currentAddress && form.pinCode && form.aadhaarNumber && form.panNumber;
  const isStep1Valid = !!facePhoto;
  const isStep2Valid = docs.aadhaarFront && docs.aadhaarBack && docs.pan;
  const isStep3Valid = !!video;
  const canProceed = [isStep0Valid, isStep1Valid, isStep2Valid, isStep3Valid, true][step];

  const next = () => setStep(s => Math.min(s + 1, 4));
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    setSubmitting(true); setSubmitError("");
    try {
      const payload = {
        form,
        facePhoto,
        aadhaarFront: docs.aadhaarFront,
        aadhaarBack: docs.aadhaarBack,
        pan: docs.pan,
        additionalId: docs.additional || null,
        video: video.base64,
        videoExt: video.ext || "webm",
      };
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Submission failed");
      }
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e.message || "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0f9ff, #e8f4f8)" }}>
        <div style={{ textAlign: "center", maxWidth: 500, padding: 40, animation: "fadeIn 0.5s ease" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: SUCCESS, margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: "#fff" }}>✓</div>
          <h1 style={{ fontSize: 28, color: ACCENT, margin: "0 0 12px" }}>Verification Complete</h1>
          <p style={{ color: "#64748b", fontSize: 16, lineHeight: 1.6 }}>
            Thank you, <strong>{form.fullName}</strong>. Your KYE documents have been submitted successfully. The team will review and confirm within 3 business days.
          </p>
          <div style={{ marginTop: 32, padding: 20, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", textAlign: "left", fontSize: 14, color: "#475569" }}>
            <strong>Submission Summary</strong>
            <div style={{ marginTop: 12, lineHeight: 2 }}>
              📋 Basic details — filled<br />
              📸 Face photo — captured<br />
              🪪 Documents — {Object.values(docs).filter(Boolean).length} captured<br />
              🎬 Live video — recorded
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #f0f9ff 0%, #eef2f7 50%, #e8f4f8 100%)" }}>
      {/* Header */}
      <div style={{ background: ACCENT, color: "#fff", padding: "16px 24px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 24px rgba(15,61,92,0.15)" }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛡️</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.04em" }}>LEAPFOUR MEDIA</div>
          <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 500 }}>Know Your Employee — Live Verification</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 16px 80px" }}>
        <StepIndicator current={step} />
        <div style={{
          background: "#fff", borderRadius: 20, padding: "28px 24px",
          boxShadow: "0 8px 40px rgba(15,61,92,0.06)", border: "1px solid #e8edf2",
          animation: "fadeIn 0.3s ease",
        }}>

          {/* Step 0: Form */}
          {step === 0 && (
            <div>
              <h2 style={{ fontSize: 20, color: ACCENT, margin: "0 0 4px", fontWeight: 800 }}>Personal Details</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 22px" }}>Fill in your information as per government-issued ID.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <Field label="Full Name *"><input style={inputStyle} value={form.fullName} onChange={e => u("fullName", e.target.value)} placeholder="As per Aadhaar/PAN" /></Field>
                </div>
                <Field label="Date of Birth *"><input style={inputStyle} type="date" value={form.dob} onChange={e => u("dob", e.target.value)} /></Field>
                <Field label="Gender">
                  <select style={inputStyle} value={form.gender} onChange={e => u("gender", e.target.value)}>
                    <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Father's / Mother's Name"><input style={inputStyle} value={form.fatherName} onChange={e => u("fatherName", e.target.value)} /></Field>
                <Field label="Phone Number *"><input style={inputStyle} value={form.phone} onChange={e => u("phone", e.target.value)} placeholder="+91 ..." /></Field>
                <div style={{ gridColumn: "1/-1" }}>
                  <Field label="Email"><input style={inputStyle} type="email" value={form.email} onChange={e => u("email", e.target.value)} /></Field>
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <Field label="Current Address *"><textarea style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} value={form.currentAddress} onChange={e => u("currentAddress", e.target.value)} /></Field>
                </div>
                <Field label="PIN Code *"><input style={inputStyle} value={form.pinCode} onChange={e => u("pinCode", e.target.value)} maxLength={6} /></Field>
                <Field label="Nationality"><input style={inputStyle} value={form.nationality} onChange={e => u("nationality", e.target.value)} /></Field>
                <div style={{ gridColumn: "1/-1" }}>
                  <Field label="Permanent Address (if different)"><textarea style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} value={form.permanentAddress} onChange={e => u("permanentAddress", e.target.value)} /></Field>
                </div>

                <div style={{ gridColumn: "1/-1", margin: "6px 0", borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.06em" }}>ID Numbers</span>
                </div>
                <Field label="Aadhaar Number *"><input style={inputStyle} value={form.aadhaarNumber} onChange={e => u("aadhaarNumber", e.target.value)} maxLength={14} placeholder="XXXX XXXX XXXX" /></Field>
                <Field label="PAN Number *"><input style={inputStyle} value={form.panNumber} onChange={e => u("panNumber", e.target.value)} maxLength={10} placeholder="ABCDE1234F" /></Field>

                <div style={{ gridColumn: "1/-1", margin: "6px 0", borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.06em" }}>Emergency Contact</span>
                </div>
                <Field label="Contact Name"><input style={inputStyle} value={form.emergencyName} onChange={e => u("emergencyName", e.target.value)} /></Field>
                <Field label="Relationship"><input style={inputStyle} value={form.emergencyRelation} onChange={e => u("emergencyRelation", e.target.value)} /></Field>
                <Field label="Contact Phone"><input style={inputStyle} value={form.emergencyPhone} onChange={e => u("emergencyPhone", e.target.value)} /></Field>

                <div style={{ gridColumn: "1/-1", margin: "6px 0", borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.06em" }}>Bank Details</span>
                </div>
                <Field label="Bank Name"><input style={inputStyle} value={form.bankName} onChange={e => u("bankName", e.target.value)} /></Field>
                <Field label="Account Number"><input style={inputStyle} value={form.accountNumber} onChange={e => u("accountNumber", e.target.value)} /></Field>
                <Field label="IFSC Code"><input style={inputStyle} value={form.ifsc} onChange={e => u("ifsc", e.target.value)} placeholder="e.g. SBIN0001234" /></Field>
              </div>
            </div>
          )}

          {/* Step 1: Face */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 20, color: ACCENT, margin: "0 0 4px", fontWeight: 800 }}>Face Photograph</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 22px" }}>Capture a clear, front-facing photo. Look directly at the camera.</p>
              <InfoBox color="#334155" bg={ACCENT_LIGHT} border="#bfdbfe">
                <strong>Tips:</strong> Ensure good lighting. Remove sunglasses or hats. Keep a plain background.
              </InfoBox>
              {facePhoto ? (
                <div style={{ textAlign: "center" }}>
                  <Thumbnail src={facePhoto} label="Your Photo" onRemove={() => setFacePhoto(null)} />
                </div>
              ) : (
                <CameraView onCapture={setFacePhoto} label="Face Photo" mirrored={true} />
              )}
            </div>
          )}

          {/* Step 2: Documents */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 20, color: ACCENT, margin: "0 0 4px", fontWeight: 800 }}>Document Capture</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 22px" }}>Hold each document in front of the camera so it's fully visible.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
                {DOC_LABELS.map(({ key, label }) =>
                  docs[key] ? (
                    <Thumbnail key={key} src={docs[key]} label={label} onRemove={() => setDocs(p => ({ ...p, [key]: null }))} />
                  ) : (
                    <div key={key} style={{ width: 130, height: 110, border: "2px dashed #cbd5e1", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#94a3b8", textAlign: "center", padding: 8 }}>
                      {label}
                    </div>
                  )
                )}
              </div>
              {(() => {
                const pending = DOC_LABELS.filter(({ key }) => !docs[key]);
                if (pending.length === 0) return <InfoBox color={SUCCESS} bg="#f0fdf4" border="#86efac"><strong>✓ All required documents captured</strong></InfoBox>;
                const cur = pending[0];
                return (
                  <div>
                    <div style={{ textAlign: "center", marginBottom: 12, fontSize: 14, fontWeight: 600, color: ACCENT }}>
                      Now: {cur.label} {cur.key === "additional" && "(optional)"}
                    </div>
                    <CameraView key={cur.key} label={cur.label} mirrored={false} onCapture={img => setDocs(p => ({ ...p, [cur.key]: img }))} />
                    {cur.key === "additional" && !docs.additional && (
                      <div style={{ textAlign: "center", marginTop: 12 }}>
                        <span style={{ fontSize: 13, color: "#94a3b8" }}>This is optional — you can skip and proceed.</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Step 3: Video */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 20, color: ACCENT, margin: "0 0 4px", fontWeight: 800 }}>Live Video Verification</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 22px" }}>Record a 10-second video stating your name and today's date.</p>
              <InfoBox color="#6b21a8" bg="#fdf4ff" border="#e9d5ff">
                <strong>Script:</strong> "My name is <em>{form.fullName || "___"}</em>. Today's date is <em>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</em>. I am completing my KYE verification for Leapfour Media."
              </InfoBox>
              {video ? (
                <div style={{ textAlign: "center" }}>
                  <video src={video.url} controls style={{ maxWidth: 400, borderRadius: 12, border: "2px solid #e2e8f0" }} />
                  <div style={{ marginTop: 12 }}><button onClick={() => setVideo(null)} style={{ ...btnSecondary, padding: "8px 20px", fontSize: 13 }}>Re-record</button></div>
                </div>
              ) : (
                <VideoRecorder onRecord={setVideo} />
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 20, color: ACCENT, margin: "0 0 4px", fontWeight: 800 }}>Review & Submit</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 22px" }}>Verify all info before submission.</p>

              <div style={{ background: "#f8fafc", borderRadius: 12, padding: 18, marginBottom: 16, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Personal Info</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", fontSize: 13, color: "#334155" }}>
                  {[["Name", form.fullName], ["DOB", form.dob], ["Phone", form.phone], ["Email", form.email || "—"],
                    ["Address", form.currentAddress], ["PIN", form.pinCode], ["Aadhaar", form.aadhaarNumber], ["PAN", form.panNumber],
                  ].map(([l, v]) => <div key={l}><span style={{ color: "#94a3b8", fontSize: 11 }}>{l}</span><br />{v}</div>)}
                </div>
              </div>

              <div style={{ background: "#f8fafc", borderRadius: 12, padding: 18, marginBottom: 16, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Captured Media</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {facePhoto && <Thumbnail src={facePhoto} label="Face" />}
                  {DOC_LABELS.filter(({ key }) => docs[key]).map(({ key, label }) => <Thumbnail key={key} src={docs[key]} label={label} />)}
                </div>
                {video && (
                  <div style={{ marginTop: 12 }}>
                    <video src={video.url} controls style={{ maxWidth: 280, borderRadius: 10, border: "1px solid #e2e8f0" }} />
                  </div>
                )}
              </div>

              {submitError && <InfoBox color="#dc2626" bg="#fef2f2" border="#fecaca">{submitError}</InfoBox>}

              <InfoBox color="#92400e" bg="#fffbeb" border="#fde68a">
                By clicking Submit, I confirm that all information is true and accurate. I consent to Leapfour Media storing and processing this data per the KYE Policy and applicable data protection laws.
              </InfoBox>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: step === 0 ? "flex-end" : "space-between", marginTop: 28, paddingTop: 18, borderTop: "1px solid #f1f5f9" }}>
            {step > 0 && <button onClick={prev} style={btnSecondary}>← Back</button>}
            {step < 4 ? (
              <button onClick={next} disabled={!canProceed} style={{
                ...btnPrimary, opacity: canProceed ? 1 : 0.4, cursor: canProceed ? "pointer" : "not-allowed",
              }}>Next →</button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting} style={{
                ...btnPrimary, background: SUCCESS, opacity: submitting ? 0.6 : 1,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                {submitting && <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" }} />}
                {submitting ? "Submitting..." : "✓ Submit Verification"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App Router
// ---------------------------------------------------------------------------
export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (path.startsWith("/admin")) return <AdminDashboard />;
  return <KYEForm />;
}
