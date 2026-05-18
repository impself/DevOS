import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// ─── Password strength calculator ────────────────────────────────────
// Returns 0-4 score: length, uppercase, lowercase, digit, special char
function calcStrength(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 6) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (pw.length >= 10) s++;
  return Math.min(s, 4);
}

// ─── EyeBall — full eye with sclera, tracking pupil, blink support ───
interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  emotion?: "neutral" | "worried" | "happy" | "excited";
  forceLookX?: number;
  forceLookY?: number;
}

const EyeBall = ({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = "white",
  pupilColor = "black",
  isBlinking = false,
  emotion = "neutral",
  forceLookX,
  forceLookY,
}: EyeBallProps) => {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  const pos = (() => {
    if (!eyeRef.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    const r = eyeRef.current.getBoundingClientRect();
    const dx = mouseX - (r.left + r.width / 2);
    const dy = mouseY - (r.top + r.height / 2);
    const d = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const a = Math.atan2(dy, dx);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
  })();

  // Pupil size varies with emotion
  const pSize = emotion === "excited" ? pupilSize + 3 : emotion === "worried" ? pupilSize - 2 : pupilSize;

  return (
    <div
      ref={eyeRef}
      className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{
        width: `${size}px`,
        height: isBlinking ? "2px" : `${size}px`,
        backgroundColor: eyeColor,
        overflow: "hidden",
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: `${pSize}px`,
            height: `${pSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            transition: "transform 0.1s ease-out, width 0.3s, height 0.3s",
          }}
        />
      )}
    </div>
  );
};

// ─── Pupil — standalone pupil dot, no sclera ─────────────────────────
interface PupilProps {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
  forceLookX?: number;
  forceLookY?: number;
}

const Pupil = ({ size = 12, maxDistance = 5, pupilColor = "black", forceLookX, forceLookY }: PupilProps) => {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  const pos = (() => {
    if (!ref.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    const r = ref.current.getBoundingClientRect();
    const dx = mouseX - (r.left + r.width / 2);
    const dy = mouseY - (r.top + r.height / 2);
    const d = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const a = Math.atan2(dy, dx);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
  })();

  return (
    <div
      ref={ref}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: "transform 0.1s ease-out",
      }}
    />
  );
};

// ─── RegisterPage ─────────────────────────────────────────────────────
// Characters unlock progressively:
//   email filled    → purple lights up
//   username filled → black grows from ground
//   password typing → orange rolls in + all react to password strength
//   password match  → yellow slides in + celebration
//
// Password strength drives character emotions:
//   weak   (0-1) → worried, trembling
//   medium (2-3) → curious
//   strong (4)   → excited, bouncing

function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  // Form state
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Character unlock flags
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const usernameValid = username.length >= 2;
  const pwStrength = calcStrength(password);
  const pwMatch = password.length > 0 && confirmPw === password;

  // Derive unlock state from field values
  const purpleUnlocked = emailValid;
  const blackUnlocked = purpleUnlocked && usernameValid;
  const orangeUnlocked = blackUnlocked && password.length >= 4;
  const yellowUnlocked = orangeUnlocked && pwMatch;

  // Character emotion based on password strength
  const emotion: "neutral" | "worried" | "happy" | "excited" =
    password.length === 0 ? "neutral" : pwStrength <= 1 ? "worried" : pwStrength <= 3 ? "happy" : "excited";

  // Blinking timers
  const [purpleBlink, setPurpleBlink] = useState(false);
  const [blackBlink, setBlackBlink] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const sched = () => { t = setTimeout(() => { setPurpleBlink(true); setTimeout(() => { setPurpleBlink(false); sched(); }, 150); }, Math.random() * 4000 + 3000); };
    if (purpleUnlocked) sched();
    return () => clearTimeout(t);
  }, [purpleUnlocked]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const sched = () => { t = setTimeout(() => { setBlackBlink(true); setTimeout(() => { setBlackBlink(false); sched(); }, 150); }, Math.random() * 4000 + 3000); };
    if (blackUnlocked) sched();
    return () => clearTimeout(t);
  }, [blackUnlocked]);

  // Celebration bounce animation trigger
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (yellowUnlocked) {
      setCelebrating(true);
      const t = setTimeout(() => setCelebrating(false), 2000);
      return () => clearTimeout(t);
    }
  }, [yellowUnlocked]);

  // Mouse tracking for body lean
  const [mx, setMx] = useState(0);
  useEffect(() => {
    const h = (e: MouseEvent) => setMx(e.clientX);
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  const getLean = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return 0;
    const r = ref.current.getBoundingClientRect();
    return Math.max(-6, Math.min(6, -(mx - (r.left + r.width / 2)) / 120));
  };

  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);

  // Tremble effect for weak password
  const tremble = pwStrength <= 1 && password.length > 0 ? `translateX(${Math.sin(Date.now() / 100) * 2}px)` : "";

  // Submit: register then auto-login
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPw) { setError("Passwords do not match."); return; }
    if (pwStrength < 2) { setError("Password is too weak. Use uppercase, numbers, or special characters."); return; }
    setIsLoading(true);
    try {
      // AuthContext.register handles register + auto-login + token persistence + navigation
      await register(email, username, password);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Registration failed, please try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [email, username, password, confirmPw, pwStrength, register]);

  // Strength label and color for the progress bar
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][pwStrength] || "";
  const strengthColor = ["", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-green-500"][pwStrength] || "";

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — animated characters area */}
      <div className="relative hidden lg:flex flex-col justify-between bg-primary p-12 text-primary-foreground">
        <div className="relative z-20">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <div className="size-8 rounded-lg bg-primary-foreground/10 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="size-4" />
            </div>
            <span>DevOS</span>
          </div>
        </div>

        <div className="relative z-20 flex items-end justify-center h-[500px]">
          <div className="relative" style={{ width: "550px", height: "400px" }}>

            {/* ── Purple character ─────────────────────────────────── */}
            <div
              ref={purpleRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: "70px",
                width: "180px",
                height: "400px",
                backgroundColor: purpleUnlocked ? "#6C3FF5" : "#3a2a5c",
                borderRadius: "10px 10px 0 0",
                zIndex: 1,
                transform: `skewX(${purpleUnlocked ? getLean(purpleRef) : 0}deg) ${celebrating && purpleUnlocked ? "translateY(-10px)" : ""}`,
                transformOrigin: "bottom center",
                opacity: purpleUnlocked ? 1 : 0.35,
                filter: purpleUnlocked ? "none" : "grayscale(0.6)",
                animation: celebrating && purpleUnlocked ? "celebrate 0.4s ease-in-out 3" : "none",
              }}
            >
              {purpleUnlocked && (
                <div className="absolute flex gap-8 transition-all duration-500" style={{ left: "45px", top: "40px" }}>
                  <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#2D2D2D" isBlinking={purpleBlink} emotion={emotion} />
                  <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#2D2D2D" isBlinking={purpleBlink} emotion={emotion} />
                </div>
              )}
              {/* Speech bubble hint when locked */}
              {!purpleUnlocked && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-primary-foreground/10 backdrop-blur-sm rounded-lg px-3 py-1 text-xs text-primary-foreground/70 whitespace-nowrap">
                  Enter email to wake me up ↑
                </div>
              )}
            </div>

            {/* ── Black character ──────────────────────────────────── */}
            <div
              ref={blackRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: "240px",
                width: "120px",
                height: blackUnlocked ? "310px" : "0px",
                backgroundColor: blackUnlocked ? "#2D2D2D" : "#1a1a1a",
                borderRadius: "8px 8px 0 0",
                zIndex: 2,
                transform: `skewX(${blackUnlocked ? getLean(blackRef) : 0}deg) ${celebrating && blackUnlocked ? "translateY(-10px)" : ""}`,
                transformOrigin: "bottom center",
                opacity: blackUnlocked ? 1 : 0,
                animation: celebrating && blackUnlocked ? "celebrate 0.4s ease-in-out 3" : "none",
              }}
            >
              {blackUnlocked && (
                <div className="absolute flex gap-6 transition-all duration-500" style={{ left: "26px", top: "32px" }}>
                  <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#2D2D2D" isBlinking={blackBlink} emotion={emotion} />
                  <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#2D2D2D" isBlinking={blackBlink} emotion={emotion} />
                </div>
              )}
              {!blackUnlocked && purpleUnlocked && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-primary-foreground/10 backdrop-blur-sm rounded-lg px-3 py-1 text-xs text-primary-foreground/70 whitespace-nowrap">
                  Username? ↑
                </div>
              )}
            </div>

            {/* ── Orange character ─────────────────────────────────── */}
            <div
              ref={orangeRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: "0px",
                width: "240px",
                height: "200px",
                backgroundColor: orangeUnlocked ? "#FF9B6B" : "#7a4a30",
                borderRadius: "120px 120px 0 0",
                zIndex: 3,
                transform: `skewX(${orangeUnlocked ? getLean(orangeRef) : 0}deg) ${tremble} ${celebrating && orangeUnlocked ? "translateY(-10px)" : ""}`,
                transformOrigin: "bottom center",
                opacity: orangeUnlocked ? 1 : 0.15,
                filter: orangeUnlocked ? "none" : "grayscale(0.6)",
                animation: celebrating && orangeUnlocked ? "celebrate 0.4s ease-in-out 3" : "none",
              }}
            >
              {orangeUnlocked && (
                <div className="absolute flex gap-8 transition-all duration-300" style={{ left: "82px", top: "90px" }}>
                  <Pupil size={emotion === "excited" ? 15 : emotion === "worried" ? 9 : 12} maxDistance={5} pupilColor="#2D2D2D" />
                  <Pupil size={emotion === "excited" ? 15 : emotion === "worried" ? 9 : 12} maxDistance={5} pupilColor="#2D2D2D" />
                </div>
              )}
              {/* Mouth changes with emotion */}
              {orangeUnlocked && (
                <div
                  className="absolute rounded-full transition-all duration-300"
                  style={{
                    left: "90px",
                    top: "130px",
                    width: emotion === "excited" ? "40px" : "30px",
                    height: emotion === "excited" ? "20px" : emotion === "worried" ? "4px" : "8px",
                    backgroundColor: "#2D2D2D",
                    borderRadius: emotion === "excited" ? "50%" : "999px",
                  }}
                />
              )}
            </div>

            {/* ── Yellow character ─────────────────────────────────── */}
            <div
              ref={yellowRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: "310px",
                width: "140px",
                height: "230px",
                backgroundColor: yellowUnlocked ? "#E8D754" : "#6b6327",
                borderRadius: "70px 70px 0 0",
                zIndex: 4,
                transform: `skewX(${yellowUnlocked ? getLean(yellowRef) : 0}deg) ${celebrating ? "translateY(-10px)" : ""}`,
                transformOrigin: "bottom center",
                opacity: yellowUnlocked ? 1 : 0,
                animation: celebrating ? "celebrate 0.4s ease-in-out 3" : "none",
              }}
            >
              {yellowUnlocked && (
                <>
                  <div className="absolute flex gap-6 transition-all duration-300" style={{ left: "52px", top: "40px" }}>
                    <Pupil size={14} maxDistance={5} pupilColor="#2D2D2D" />
                    <Pupil size={14} maxDistance={5} pupilColor="#2D2D2D" />
                  </div>
                  {/* Happy smile when all unlocked */}
                  <div
                    className="absolute rounded-full bg-[#2D2D2D]"
                    style={{ left: "40px", top: "88px", width: "40px", height: "12px", borderRadius: "999px" }}
                  />
                </>
              )}
            </div>

            {/* ── Strength indicator below characters ──────────────── */}
            {password.length > 0 && (
              <div className="absolute bottom-[-40px] left-1/2 -translate-x-1/2 w-[300px] transition-all duration-500">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= pwStrength ? strengthColor : "bg-primary-foreground/10"}`} />
                  ))}
                </div>
                <p className="text-center text-xs text-primary-foreground/60">{strengthLabel}</p>
              </div>
            )}
          </div>
        </div>

        <div className="relative z-20 flex items-center gap-8 text-sm text-primary-foreground/60">
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
          <span>Contact</span>
        </div>

        {/* Decorative background */}
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
        <div className="absolute top-1/4 right-1/4 size-64 bg-primary-foreground/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 size-96 bg-primary-foreground/5 rounded-full blur-3xl" />
      </div>

      {/* Right — registration form */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 text-lg font-semibold mb-8">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="size-4 text-primary" />
            </div>
            <span>DevOS</span>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Create account</h1>
            <p className="text-muted-foreground text-sm">Wake up your team, one character at a time</p>
          </div>

          {/* Registration form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email {purpleUnlocked && <span className="text-purple-500">✓</span>}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="dev@devos.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-background border-border/60 focus:border-purple-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Username {blackUnlocked && <span className="text-gray-500">✓</span>}
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="cooldev"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={2}
                className="h-11 bg-background border-border/60 focus:border-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
                {password.length > 0 && (
                  <span className={`ml-2 text-xs ${pwStrength <= 1 ? "text-red-400" : pwStrength <= 3 ? "text-yellow-500" : "text-green-500"}`}>
                    {strengthLabel}
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pr-10 bg-background border-border/60 focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
              {/* Inline strength bar */}
              {password.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= pwStrength ? strengthColor : "bg-border"}`} />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPw" className="text-sm font-medium">
                Confirm password {yellowUnlocked && <span className="text-yellow-500">✓ match!</span>}
              </Label>
              <Input
                id="confirmPw"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
                className="h-11 bg-background border-border/60 focus:border-yellow-500"
              />
            </div>

            {error && (
              <div className="p-3 text-sm text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium"
              size="lg"
              disabled={isLoading || !yellowUnlocked}
            >
              {isLoading ? "Creating account..." : yellowUnlocked ? "Create account" : "Fill all fields to unlock"}
            </Button>
          </form>

          {/* Login link */}
          <div className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-foreground font-medium hover:underline"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>

      {/* Celebration keyframes */}
      <style>{`
        @keyframes celebrate {
          0%, 100% { transform: translateY(0) skewX(0deg); }
          50% { transform: translateY(-15px) skewX(0deg); }
        }
      `}</style>
    </div>
  );
}

export const Component = RegisterPage;
