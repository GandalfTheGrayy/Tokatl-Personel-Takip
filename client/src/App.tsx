import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileBarChart2,
  FileDown,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  Settings2,
  ShieldCheck,
  Sun,
  Users,
  UserRound,
  UserRoundCheck,
  X,
  ClipboardCheck,
  Bell,
  Printer,
  Search,
  Plus,
  Database,
  History,
  MapPin,
  Trophy,
  Flame,
  Timer,
  Crown,
  GraduationCap,
  ArrowUpRight,
  RotateCcw,
  Radio,
  House,
  Shield,
  Pencil,
  Trash2,
  KeyRound,
  UserCog,
  Sparkles,
} from "lucide-react";
import {
  api,
  post,
  download,
  setCsrf,
  dateTR,
  timeTR,
  statusText,
  type User,
  type Settings,
  type Schedule,
  type Entry,
  type Attendance,
  type Leave,
  type Outing,
  type RankingRow,
  type MemberClass,
  type CustomRole,
  type PermissionGroup,
  type PresenceRow,
} from "./api";

type Page =
  | "home"
  | "approvals"
  | "rankings"
  | "calendar"
  | "history"
  | "presence"
  | "users"
  | "roles"
  | "settings"
  | "reports"
  | "audit";
const DEFAULT_APP_NAME = "Tokatlı Next Gen";
const DEFAULT_EMBLEM = "/icon-512.png";
const can = (user: User, permission: string) =>
  user.role === "GOD" || user.permissions.includes(permission);
function DavidStar({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2 21 17H3L12 2Z" />
      <path d="M12 22 3 7h18L12 22Z" />
    </svg>
  );
}
function BrandSignature({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-signature ${compact ? "compact" : ""}`}>
      Made by <b>Muharrem Pehlevan</b> <DavidStar size={compact ? 13 : 15} />
    </span>
  );
}
const formatDay = (d = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
const monthLabel = (m: string) =>
  new Date(`${m}-15T12:00:00`).toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });
const badge = (s: string) => (
  <span
    className={`badge ${s === "PENDING" ? "badge-pending" : s === "APPROVED" ? "badge-approved" : s === "REJECTED" ? "badge-rejected" : "badge-leave"}`}
  >
    {statusText(s)}
  </span>
);
function loadImage(
  file: File | undefined,
  done: (value: string) => void,
  fail: (message: string) => void,
) {
  if (!file) return;
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 250000
  ) {
    fail("PNG, JPG veya WebP biçiminde en fazla 250 KB görsel yükleyin.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => done(String(reader.result));
  reader.onerror = () => fail("Görsel okunamadı.");
  reader.readAsDataURL(file);
}
function Button({
  children,
  onClick,
  kind = "primary",
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "soft" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`btn btn-${kind} ${className}`}
    >
      {children}
    </button>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 p-0 sm:p-4 flex items-end sm:items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card w-full max-w-lg p-5 sm:p-6 max-h-[92dvh] overflow-y-auto rounded-b-none sm:rounded-b-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={close}
            aria-label="Kapat"
            className="touch-target p-2 rounded-lg hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Notice({ message, clear }: { message: string; clear: () => void }) {
  return message ? (
    <div
      role="alert"
      className="fixed bottom-5 right-5 left-5 sm:left-auto z-[60] sm:max-w-md bg-navy text-white rounded-xl shadow-xl p-4 flex gap-4 items-center"
    >
      <span className="flex-1">{message}</span>
      <button onClick={clear} aria-label="Kapat">
        <X size={18} />
      </button>
    </div>
  ) : null;
}
function Login({
  onLogin,
  name,
  logo,
}: {
  onLogin: (u: User, csrf: string) => void;
  name: string;
  logo: string | null;
}) {
  const [mode, M] = useState<"login" | "register">("login"),
    [username, U] = useState(""),
    [fullName, N] = useState(""),
    [password, P] = useState(""),
    [confirm, C] = useState(""),
    [photo, PH] = useState<string | null>(null),
    [busy, B] = useState(false),
    [error, E] = useState("");
  function changeMode(next: "login" | "register") {
    M(next);
    E("");
    P("");
    C("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "register" && password !== confirm) {
      E("Şifreler birbiriyle eşleşmiyor.");
      return;
    }
    B(true);
    E("");
    try {
      const data = await post<{ user: User; csrf: string }>(
        mode === "login" ? "/auth/login" : "/auth/register",
        mode === "login"
          ? { username, password }
          : { username, name: fullName, password, profilePhoto: photo },
      );
      onLogin(data.user, data.csrf);
    } catch (err) {
      E((err as Error).message);
    } finally {
      B(false);
    }
  }
  return (
    <div className="min-h-[100dvh] flex">
      <div className="hidden lg:flex lg:w-[48%] bg-[#153657] text-white relative overflow-hidden p-16 flex-col justify-between">
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-11 w-11 bg-white/15 rounded-xl grid place-items-center">
            <img
              src={logo || DEFAULT_EMBLEM}
              className="h-10 w-10 object-contain"
              alt="Tokatlı Next Gen kirpi amblemi"
            />
          </div>
          <span className="font-bold tracking-wide text-lg">{name}</span>
        </div>
        <div className="relative z-10 max-w-lg">
          <div className="w-14 h-1 bg-[#5fd0be] mb-8" />
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Mahalle hareketlerinde
            <br />
            net bir görünüm.
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed">
            Çıkış, dönüş, izin ve yetkili onayları tek bir güvenli alanda.
          </p>
        </div>
        <div className="relative z-10 text-sm text-blue-200 flex flex-col gap-2">
          <span>
            NEXT GEN MAHALLE SİSTEMİ <span className="mx-2">/</span> GÜVENLİ
            ERİŞİM
          </span>
          <BrandSignature />
        </div>
        <div className="absolute -right-36 -bottom-36 h-[560px] w-[560px] rounded-full border-[95px] border-white/[.045]" />
      </div>
      <div className="flex-1 flex items-start sm:items-center justify-center p-4 py-6 sm:p-10 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-7 text-navy">
            <div className="h-11 w-11 bg-navy text-white rounded-xl grid place-items-center">
              <img
                src={logo || DEFAULT_EMBLEM}
                className="h-10 w-10 object-contain"
                alt="Tokatlı Next Gen kirpi amblemi"
              />
            </div>
            <b className="truncate">{name}</b>
          </div>
          <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1 mb-7">
            <button
              type="button"
              className={`min-h-11 rounded-lg text-sm font-semibold ${mode === "login" ? "bg-white text-blue shadow-sm" : "text-slate-500"}`}
              onClick={() => changeMode("login")}
            >
              Giriş yap
            </button>
            <button
              type="button"
              className={`min-h-11 rounded-lg text-sm font-semibold ${mode === "register" ? "bg-white text-blue shadow-sm" : "text-slate-500"}`}
              onClick={() => changeMode("register")}
            >
              Kayıt ol
            </button>
          </div>
          <div className="mb-7">
            <p className="text-xs font-bold tracking-widest text-blue uppercase mb-2">
              MAHALLE PORTALI
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#163a5c] mb-2">
              {mode === "login"
                ? "Hesabınıza giriş yapın"
                : "Yeni hesabınızı oluşturun"}
            </h2>
            <p className="text-slate-500 text-sm">
              {mode === "login"
                ? "Devam etmek için hesap bilgilerinizi kullanın."
                : "Kayıt olan herkes Üye rolüyle başlar."}
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <>
                <div>
                  <label className="label" htmlFor="fullName">
                    Ad soyad
                  </label>
                  <input
                    id="fullName"
                    autoComplete="name"
                    className="field"
                    value={fullName}
                    onChange={(e) => N(e.target.value)}
                    minLength={2}
                    maxLength={120}
                    required
                    placeholder="Adınız ve soyadınız"
                  />
                </div>
                <div>
                  <label className="label">
                    Profil fotoğrafı (isteğe bağlı)
                  </label>
                  <div className="flex items-center gap-3">
                    {photo ? (
                      <img
                        src={photo}
                        className="h-14 w-14 rounded-full object-cover"
                        alt="Profil önizlemesi"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-slate-100 grid place-items-center text-slate-500">
                        <UserRound />
                      </div>
                    )}
                    <input
                      className="text-sm min-w-0 flex-1"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => loadImage(e.target.files?.[0], PH, E)}
                    />
                    {photo && (
                      <button
                        type="button"
                        className="text-sm text-red-600"
                        onClick={() => PH(null)}
                      >
                        Kaldır
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="label" htmlFor="username">
                Kullanıcı adı
              </label>
              <input
                id="username"
                autoComplete="username"
                className="field"
                value={username}
                onChange={(e) => U(e.target.value.toLowerCase())}
                pattern="[a-z0-9._-]{3,40}"
                required
                placeholder="kullanici.adi"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Şifre
              </label>
              <input
                id="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                className="field"
                value={password}
                onChange={(e) => P(e.target.value)}
                minLength={mode === "register" ? 8 : undefined}
                required
                placeholder={
                  mode === "register" ? "En az 8 karakter" : "Şifreniz"
                }
              />
            </div>
            {mode === "register" && (
              <div>
                <label className="label" htmlFor="confirmPassword">
                  Şifreyi tekrar yazın
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className="field"
                  value={confirm}
                  onChange={(e) => C(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="text-red-600 text-sm bg-red-50 rounded-lg p-3"
              >
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full !py-3">
              {busy
                ? "İşleniyor..."
                : mode === "login"
                  ? "Giriş yap"
                  : "Hesap oluştur"}{" "}
              <ChevronRight size={17} />
            </Button>
          </form>
          {mode === "login" && (
            <p className="mt-7 text-sm text-slate-500">
              Şifrenizi unuttuysanız sistem yöneticinizle iletişime geçin.
            </p>
          )}
          <div className="lg:hidden mt-7 text-slate-500 flex justify-center">
            <BrandSignature compact />
          </div>
        </div>
      </div>
    </div>
  );
}
function PasswordChange({ done }: { done: () => void }) {
  const [current, C] = useState(""),
    [password, P] = useState(""),
    [error, E] = useState(""),
    [busy, B] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    B(true);
    E("");
    try {
      await post("/auth/password", { current, password });
      done();
    } catch (err) {
      E((err as Error).message);
    } finally {
      B(false);
    }
  }
  return (
    <div className="min-h-screen grid place-items-center p-4 bg-[#edf2f7]">
      <form onSubmit={submit} className="card w-full max-w-md p-8">
        <div className="h-12 w-12 bg-blue-50 text-blue rounded-xl grid place-items-center mb-6">
          <LockKeyhole />
        </div>
        <h1 className="text-2xl font-bold mb-2">Şifrenizi değiştirin</h1>
        <p className="text-slate-500 mb-7">
          İlk girişinizde güvenlik için yeni bir şifre belirlemeniz gerekiyor.
        </p>
        <label className="label">Geçici şifre</label>
        <input
          className="field mb-5"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => C(e.target.value)}
          required
        />
        <label className="label">Yeni şifre (en az 12 karakter)</label>
        <input
          className="field mb-5"
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={password}
          onChange={(e) => P(e.target.value)}
          required
        />
        {error && <p className="text-red-600 mb-4">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          Şifreyi kaydet
        </Button>
      </form>
    </div>
  );
}
export default function App() {
  const [user, U] = useState<User | null>(null),
    [loading, L] = useState(true),
    [page, P] = useState<Page>("home"),
    [settings, S] = useState<Settings | null>(null),
    [schedule, SC] = useState<Schedule | null>(null),
    [pending, PE] = useState(0),
    [day, D] = useState(formatDay()),
    [toast, T] = useState(""),
    [dark, DK] = useState(localStorage.getItem("dark") === "true"),
    [menu, M] = useState(false),
    [notifications, N] = useState<
      { id: string; message: string; readAt: string | null }[]
    >([]),
    [showNotifications, SN] = useState(false);
  const notify = (m: string) => {
    T(m);
    setTimeout(() => T(""), 5000);
  };
  async function refresh() {
    try {
      const x = await api<{
        settings: Settings;
        schedule: Schedule;
        pending: number;
        today: string;
      }>("/bootstrap");
      S(x.settings);
      SC(x.schedule);
      PE(x.pending);
      D(x.today);
      const n = await api<typeof notifications>("/notifications");
      N(n);
    } catch (err) {
      notify((err as Error).message);
    }
  }
  useEffect(() => {
    api<{ institutionName: string; logoData: string | null }>(
      "/public/branding",
    )
      .then((x) =>
        S({
          id: 1,
          institutionName: x.institutionName,
          logoData: x.logoData,
          leaveCategories: [],
          permissionCategories: [],
          eveningStartTime: "18:00",
          streakMinMinutes: 30,
          rankingWindowDays: 30,
          maxOpenOutingHours: 18,
          allowHistoricalEntries: true,
        }),
      )
      .catch(() => {});
    api<{ user: User; csrf: string }>("/auth/me")
      .then((x) => {
        U(x.user);
        setCsrf(x.csrf);
        if (!x.user.mustChangePassword) refresh();
      })
      .catch(() => {})
      .finally(() => L(false));
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("dark", String(dark));
  }, [dark]);
  useEffect(() => {
    if (user?.role === "STAFF" && page === "home")
      notify("Çıkış yaptıysanız kaydınızı başlatmayı unutmayın.");
    if (user && user.role !== "STAFF" && pending > 0)
      notify("Bekleyen onaylarınız bulunmaktadır.");
  }, [user?.id, pending]);
  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    const ping = () => post("/presence/ping", {}).catch(() => {});
    ping();
    const timer = window.setInterval(ping, 45000);
    return () => window.clearInterval(timer);
  }, [user?.id, user?.mustChangePassword]);
  async function logout() {
    try {
      await post("/auth/logout", {});
    } catch {}
    U(null);
    S(null);
    P("home");
  }
  if (loading)
    return (
      <div className="min-h-screen grid place-items-center text-blue">
        <Activity className="animate-pulse" size={40} />
      </div>
    );
  if (!user)
    return (
      <Login
        name={settings?.institutionName || DEFAULT_APP_NAME}
        logo={settings?.logoData || null}
        onLogin={(u, token) => {
          U(u);
          setCsrf(token);
          if (!u.mustChangePassword) refresh();
        }}
      />
    );
  if (user.mustChangePassword)
    return (
      <PasswordChange
        done={() => {
          U(null);
          notify("Şifreniz değişti. Yeni şifrenizle giriş yapın.");
        }}
      />
    );
  const links: {
    id: Page;
    title: string;
    icon: typeof LayoutDashboard;
    permission?: string;
    anyPermissions?: string[];
  }[] = [
    {
      id: "home",
      title: "Çıkış Merkezi",
      icon: LayoutDashboard,
    },
    {
      id: "approvals",
      title: "Onay İşlemleri",
      icon: ClipboardCheck,
      permission: "outings.view_all",
    },
    {
      id: "presence",
      title: "Canlı Durum",
      icon: Radio,
      permission: "presence.view",
    },
    {
      id: "rankings",
      title: "Tier List",
      icon: Trophy,
      permission: "rankings.view",
    },
    {
      id: "history",
      title: "Çıkış Geçmişim",
      icon: History,
      permission: "outings.own.view",
    },
    {
      id: "users",
      title: "Kullanıcılar",
      icon: Users,
      permission: "users.view",
    },
    {
      id: "roles",
      title: "Rol Mimarisi",
      icon: UserCog,
      permission: "roles.view",
    },
    {
      id: "reports",
      title: "Raporlar",
      icon: FileBarChart2,
      permission: "reports.view",
    },
    {
      id: "settings",
      title: "Sistem Kuralları",
      icon: Settings2,
      anyPermissions: ["settings.branding", "settings.outing_rules"],
    },
    {
      id: "audit",
      title: "İşlem Kayıtları",
      icon: ShieldCheck,
      permission: "audit.view",
    },
  ];
  const current = links.find((x) => x.id === page)?.title || "Onay İşlemleri";
  return (
    <div className="min-h-screen flex">
      <aside
        className={`${menu ? "fixed inset-y-0 left-0 z-40" : "hidden"} lg:flex flex-col w-[250px] shrink-0 bg-[#173a60] text-white min-h-screen`}
      >
        <div className="h-20 px-6 flex items-center gap-3 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-white/15 grid place-items-center">
            <img
              src={settings?.logoData || DEFAULT_EMBLEM}
              className="w-10 h-10 object-contain"
              alt="Tokatlı Next Gen kirpi amblemi"
            />
          </div>
          <div className="min-w-0">
            <div className="font-bold truncate leading-5">
              {settings?.institutionName || DEFAULT_APP_NAME}
            </div>
            <div className="text-[11px] text-blue-200 mt-1 uppercase tracking-widest">
              NEXT GEN MERKEZİ
            </div>
          </div>
          <button className="lg:hidden ml-auto" onClick={() => M(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="px-4 pt-7 text-[11px] font-semibold uppercase tracking-widest text-blue-200/70 mb-3">
          ÇALIŞMA ALANI
        </div>
        <nav className="px-3 space-y-1 flex-1">
          {links
            .filter(
              (x) =>
                (!x.permission && !x.anyPermissions) ||
                (x.permission && can(user, x.permission)) ||
                x.anyPermissions?.some((permission) => can(user, permission)),
            )
            .map((x) => (
              <button
                key={x.id}
                onClick={() => {
                  P(x.id);
                  M(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm text-left transition ${page === x.id ? "bg-white/15 text-white font-semibold border-l-[3px] border-[#62d0b3]" : "text-blue-100 hover:bg-white/10"}`}
              >
                <x.icon size={18} />
                <span>{x.title}</span>
                {x.id === "approvals" && pending > 0 && (
                  <span className="ml-auto text-[11px] bg-[#d5a443] text-[#253544] px-2 py-0.5 rounded-full font-bold">
                    {pending}
                  </span>
                )}
              </button>
            ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex gap-3 items-center p-2">
            <div className="h-9 w-9 rounded-full bg-[#27608e] grid place-items-center text-sm font-bold overflow-hidden">
              {user.profilePhoto ? (
                <img
                  src={user.profilePhoto}
                  className="w-full h-full object-cover"
                  alt=""
                />
              ) : (
                user.name.slice(0, 1)
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{user.name}</div>
              <div className="text-xs text-blue-200">{user.roleLabel}</div>
            </div>
          </div>
          <button
            className="flex items-center gap-2 p-2 mt-2 text-sm text-blue-100 hover:text-white"
            onClick={logout}
          >
            <LogOut size={16} /> Çıkış yap
          </button>
          <div className="mt-4 px-2 text-blue-200/80">
            <BrandSignature compact />
          </div>
        </div>
      </aside>
      {menu && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => M(false)}
        />
      )}
      <div className="flex-1 min-w-0">
        <header className="h-20 px-5 md:px-9 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2"
              onClick={() => M(true)}
              aria-label="Menüyü aç"
            >
              <Menu size={23} />
            </button>
            <div>
              <div className="text-xs text-slate-500 hidden sm:block">
                Çalışma Alanı <span className="px-2">/</span> {current}
              </div>
              <h1 className="font-bold text-lg md:text-xl text-[#173a60] dark:text-white">
                {current}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden md:block text-sm text-slate-500">
              {dateTR(day)}
            </span>
            <button
              title={dark ? "Açık tema" : "Koyu tema"}
              className="p-2.5 rounded-lg hover:bg-slate-100"
              onClick={() => DK(!dark)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <div className="relative">
              <button
                title="Bildirimler"
                className="p-2.5 rounded-lg hover:bg-slate-100 relative"
                onClick={() => SN(!showNotifications)}
              >
                <Bell size={19} />
                {notifications.some((n) => !n.readAt) && (
                  <span className="absolute right-1 top-1 h-2 w-2 bg-red-500 rounded-full" />
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-12 z-20 card w-80 max-w-[90vw] p-3 shadow-xl">
                  <div className="flex justify-between items-center px-2 py-1">
                    <b className="text-sm">Bildirimler</b>
                    <button
                      className="text-xs text-blue"
                      onClick={async () => {
                        await post("/notifications/read", {});
                        N(notifications.map((n) => ({ ...n, readAt: "ok" })));
                      }}
                    >
                      Okundu işaretle
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length ? (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className="p-3 text-sm border-b border-slate-200"
                        >
                          {n.message}
                        </div>
                      ))
                    ) : (
                      <p className="p-3 text-sm text-slate-500">
                        Yeni bildirim yok.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="h-9 w-9 bg-[#dcebf6] text-blue rounded-full grid place-items-center font-bold text-sm overflow-hidden">
              {user.profilePhoto ? (
                <img
                  src={user.profilePhoto}
                  className="w-full h-full object-cover"
                  alt=""
                />
              ) : (
                user.name.slice(0, 1)
              )}
            </div>
          </div>
        </header>
        <main className="p-5 md:p-9 max-w-[1500px] mx-auto">
          <div className="mb-7">
            <p className="text-xs font-bold text-[#26739f] dark:text-[#7cb9e0] uppercase tracking-[.16em] mb-2">
              {user.customRole
                ? `${user.customRole.name.toLocaleUpperCase("tr-TR")} ALANI`
                : user.role === "STAFF"
                  ? "ÜYE ALANI"
                  : user.role === "GOD"
                    ? "TANRI PANELİ"
                    : user.role === "ADMIN"
                      ? "YÖNETİM PANELİ"
                      : "AMİR PANELİ"}
            </p>
            <h2 className="text-2xl md:text-[28px] font-bold text-[#173a60] dark:text-white">
              {page === "home"
                ? `Merhaba, ${user.name.split(" ")[0]}`
                : current}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {page === "home"
                ? "Çıkış, dönüş ve onay akışını tek ekrandan yönetin."
                : page === "approvals"
                  ? "Çıkış taleplerini inceleyip karara bağlayın."
                  : page === "reports"
                    ? "İhtiyacınız olan dönem ve rapor türünü seçin."
                    : "Kayıtlar ve işlemler burada görüntülenir."}
            </p>
          </div>
          {page === "home" &&
            (!can(user, "dashboard.view") ? (
              <OutingHome
                day={day}
                schedule={schedule}
                categories={settings?.permissionCategories || []}
                allowHistorical={settings?.allowHistoricalEntries ?? true}
                notify={notify}
                refresh={refresh}
              />
            ) : (
              <OutingAdminHome day={day} go={P} user={user} />
            ))}
          {page === "approvals" && (
            <OutingApprovals
              day={day}
              notify={notify}
              refresh={refresh}
              canApprove={can(user, "outings.approve")}
              canReject={can(user, "outings.reject")}
            />
          )}
          {page === "presence" && <PresenceView />}
          {page === "rankings" && <RankingsView />}
          {page === "calendar" && <Calendar user={user} day={day} />}
          {page === "history" && <OutingHistoryView />}
          {page === "users" && (
            <UsersView
              currentUser={user}
              onCurrentUserUpdate={U}
              notify={notify}
            />
          )}
          {page === "roles" && <RolesView user={user} notify={notify} />}
          {page === "settings" && settings && schedule && (
            <OutingSettingsView
              settings={settings}
              schedule={schedule}
              notify={notify}
              refresh={refresh}
              user={user}
            />
          )}
          {page === "reports" && <ReportsView day={day} />}
          {page === "audit" && <AuditView />}
        </main>
      </div>
      <Notice message={toast} clear={() => T("")} />
    </div>
  );
}

const durationTR = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} sa ${rest} dk` : `${rest} dk`;
};
const dateTimeTR = (value: string) =>
  new Date(value).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const localInputValue = (date = new Date()) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
const memberClassName = (value: MemberClass | null) =>
  value === "ACADEMY" ? "Akademi" : value === "LORD" ? "Lord" : "Sınıfsız";
function MemberClassPill({ value }: { value: MemberClass | null }) {
  return (
    <span
      className={`class-pill ${value === "LORD" ? "class-lord" : value === "ACADEMY" ? "class-academy" : ""}`}
    >
      {value === "LORD" ? <Crown size={13} /> : <GraduationCap size={13} />}
      {memberClassName(value)}
    </span>
  );
}
function PersonAvatar({
  name,
  photo,
  size = "md",
}: {
  name: string;
  photo?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const classes =
    size === "lg"
      ? "h-16 w-16 text-xl"
      : size === "sm"
        ? "h-9 w-9 text-sm"
        : "h-12 w-12";
  return (
    <div
      className={`${classes} rounded-2xl bg-gradient-to-br from-blue-100 to-teal-100 text-blue grid place-items-center font-extrabold overflow-hidden shrink-0`}
    >
      {photo ? (
        <img src={photo} className="h-full w-full object-cover" alt="" />
      ) : (
        name.slice(0, 1)
      )}
    </div>
  );
}

function OutingHome({
  categories,
  allowHistorical,
  notify,
  refresh,
}: {
  day: string;
  schedule: Schedule | null;
  categories: string[];
  allowHistorical: boolean;
  notify: (message: string) => void;
  refresh: () => void;
}) {
  const [data, setData] = useState<{
    active: Outing | null;
    history: Outing[];
  }>({
    active: null,
    history: [],
  });
  const [modal, setModal] = useState<"start" | "historical" | null>(null);
  const [kind, setKind] = useState<"OUTING" | "PERMISSION">("OUTING");
  const [category, setCategory] = useState(categories[0] || "");
  const [note, setNote] = useState("");
  const [startedAt, setStartedAt] = useState(
    localInputValue(new Date(Date.now() - 3600000)),
  );
  const [endedAt, setEndedAt] = useState(localInputValue());
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const load = () =>
    api<{ active: Outing | null; history: Outing[] }>("/outings/me")
      .then(setData)
      .catch((e) => notify(e.message));
  useEffect(() => {
    load();
    const timer = window.setInterval(() => tick((value) => value + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (categories.length && !categories.includes(category))
      setCategory(categories[0]);
  }, [categories]);
  const activeMinutes = data.active
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(data.active.startedAt).getTime()) / 60000,
        ),
      )
    : 0;
  const approved = data.history.filter((row) => row.status === "APPROVED");
  const totalMinutes = approved.reduce(
    (sum, row) => sum + row.durationMinutes,
    0,
  );
  const approvedDays = new Set(approved.map((row) => row.day)).size;
  async function start() {
    setBusy(true);
    try {
      await post("/outings/start", {
        kind,
        category: kind === "PERMISSION" ? category : null,
        note,
      });
      setModal(null);
      setNote("");
      notify("Çıkışınız yetkili onayına gönderildi.");
      load();
      refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function returnNow() {
    if (
      !data.active ||
      !confirm("Döndüğünüz saat şimdi olarak kaydedilsin mi?")
    )
      return;
    setBusy(true);
    try {
      await post(`/outings/${data.active.id}/return`, {});
      notify("Dönüş saatiniz kaydedildi.");
      load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!data.active || !confirm("Onay bekleyen çıkış kaydı iptal edilsin mi?"))
      return;
    try {
      await api(`/outings/${data.active.id}`, { method: "DELETE" });
      notify("Çıkış kaydı iptal edildi.");
      load();
      refresh();
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function addHistorical(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await post("/outings/historical", {
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        kind,
        category: kind === "PERMISSION" ? category : null,
        note,
      });
      setModal(null);
      setNote("");
      notify("Geçmiş kayıt yönetici onayına gönderildi.");
      load();
      refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section
        className={`outing-hero ${data.active ? "outing-hero-active" : ""}`}
      >
        <div className="relative z-10 max-w-2xl">
          <div className="eyebrow-light">
            <span className={`live-dot ${data.active ? "is-live" : ""}`} />
            {data.active
              ? data.active.status === "APPROVED"
                ? "ONAYLI · ŞU AN DIŞARIDASIN"
                : "YETKİLİ ONAYI BEKLENİYOR"
              : "ŞU AN İÇERİDESİN"}
          </div>
          <h3 className="text-3xl sm:text-5xl font-black tracking-tight mt-4 mb-3">
            {data.active ? durationTR(activeMinutes) : "Çıkmaya hazır mısın?"}
          </h3>
          <p className="text-white/75 max-w-xl">
            {data.active
              ? `${dateTimeTR(data.active.startedAt)} tarihinde başlayan çıkışın devam ediyor.`
              : "Çıkışını tek dokunuşla bildir. Süren, serin ve sıralamadaki yerin onaydan sonra otomatik hesaplansın."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-7">
            {data.active ? (
              <>
                <button
                  className="hero-action"
                  onClick={returnNow}
                  disabled={busy}
                >
                  <RotateCcw size={19} /> Döndüm
                </button>
                {data.active.status === "PENDING" && (
                  <button className="hero-action-secondary" onClick={cancel}>
                    Kaydı iptal et
                  </button>
                )}
              </>
            ) : (
              <button className="hero-action" onClick={() => setModal("start")}>
                <MapPin size={19} /> Çıktım
              </button>
            )}
            {allowHistorical && !data.active && (
              <button
                className="hero-action-secondary"
                onClick={() => setModal("historical")}
              >
                <History size={18} /> Geçmiş kayıt ekle
              </button>
            )}
          </div>
        </div>
        <div className="outing-orbit" />
      </section>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-5">
        {(
          [
            ["Onaylı gün", approvedDays, CalendarDays, "sky"],
            ["Toplam süre", durationTR(totalMinutes), Timer, "violet"],
            [
              "İzinli çıkış",
              approved.filter((x) => x.kind === "PERMISSION").length,
              ShieldCheck,
              "amber",
            ],
            [
              "Onay bekleyen",
              data.history.filter((x) => x.status === "PENDING").length,
              Clock3,
              "teal",
            ],
          ] as const
        ).map(([label, value, Icon, tone]) => (
          <div className={`metric-card metric-${tone}`} key={String(label)}>
            <Icon size={20} />
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <section className="card mt-5 overflow-hidden">
        <div className="p-5 sm:p-6 flex items-center justify-between border-b border-slate-200">
          <div>
            <p className="eyebrow">SON HAREKETLER</p>
            <h3 className="text-lg font-bold mt-1">Çıkış geçmişin</h3>
          </div>
          <History className="text-slate-400" />
        </div>
        <div className="divide-y divide-slate-100">
          {data.history.slice(0, 5).map((row) => (
            <div
              key={row.id}
              className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4"
            >
              <div className={`status-icon ${row.status.toLowerCase()}`}>
                {row.status === "APPROVED" ? (
                  <Check size={18} />
                ) : row.status === "REJECTED" ? (
                  <X size={18} />
                ) : (
                  <Clock3 size={18} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">
                  {row.kind === "PERMISSION" ? row.category : "Mahalle çıkışı"}
                </div>
                <div className="text-xs sm:text-sm text-slate-500 mt-1">
                  {dateTimeTR(row.startedAt)} ·{" "}
                  {row.endedAt
                    ? durationTR(row.durationMinutes)
                    : "Devam ediyor"}
                </div>
              </div>
              {badge(row.status)}
            </div>
          ))}
          {!data.history.length && (
            <p className="p-8 text-center text-slate-500">
              Henüz bir çıkış kaydın yok.
            </p>
          )}
        </div>
      </section>
      {modal && (
        <Modal
          title={modal === "start" ? "Yeni çıkış bildir" : "Geçmiş çıkış ekle"}
          close={() => setModal(null)}
        >
          <form
            onSubmit={
              modal === "historical"
                ? addHistorical
                : (e) => {
                    e.preventDefault();
                    start();
                  }
            }
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setKind("OUTING")}
                className={`choice-tab ${kind === "OUTING" ? "active" : ""}`}
              >
                Normal çıkış
              </button>
              <button
                type="button"
                onClick={() => setKind("PERMISSION")}
                className={`choice-tab ${kind === "PERMISSION" ? "active" : ""}`}
              >
                İzinli çıkış
              </button>
            </div>
            {kind === "PERMISSION" && (
              <div>
                <label className="label">İzin türü</label>
                <select
                  className="field"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  {categories.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
            )}
            {modal === "historical" && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Çıkış zamanı</label>
                  <input
                    className="field"
                    type="datetime-local"
                    value={startedAt}
                    max={localInputValue()}
                    onChange={(e) => setStartedAt(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Dönüş zamanı</label>
                  <input
                    className="field"
                    type="datetime-local"
                    value={endedAt}
                    max={localInputValue()}
                    onChange={(e) => setEndedAt(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
            <div>
              <label className="label">Açıklama</label>
              <textarea
                className="field min-h-28 resize-y"
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nereye gittiğinizi veya gerekli açıklamayı yazın"
              />
            </div>
            <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
              {modal === "start"
                ? "Saat otomatik olarak şimdi kaydedilir. Yetkili onayından sonra sıralamalara eklenir."
                : "Geçmiş kayıtlar yalnızca bu yıl için girilebilir ve yönetici onayı olmadan istatistiklere katılmaz."}
            </div>
            <Button
              type="submit"
              disabled={busy || (kind === "PERMISSION" && !category)}
              className="w-full"
            >
              {busy ? "Gönderiliyor..." : "Onaya gönder"}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}

function OutingAdminHome({
  go,
  user,
}: {
  day: string;
  go: (page: Page) => void;
  user: User;
}) {
  const [overview, setOverview] = useState<{
    outsideNow: number;
    pending: number;
    approvedToday: number;
    people: number;
    minutesToday: number;
  } | null>(null);
  const [leaders, setLeaders] = useState<RankingRow[]>([]);
  useEffect(() => {
    api<typeof overview>("/outings/overview")
      .then(setOverview)
      .catch(() => {});
    api<{ rows: RankingRow[] }>("/rankings")
      .then((x) =>
        setLeaders(
          x.rows
            .sort((a, b) => b.durationMinutes - a.durationMinutes)
            .slice(0, 3),
        ),
      )
      .catch(() => {});
  }, []);
  return (
    <>
      <section className="admin-hero">
        <div>
          <p className="eyebrow-light">CANLI MAHALLE DURUMU</p>
          <h3 className="text-3xl sm:text-4xl font-black mt-3">
            {overview?.outsideNow ?? "—"} kişi şu an dışarıda
          </h3>
          <p className="text-white/70 mt-2">
            Onay akışını takip edin, bekleyen kayıtları hızla sonuçlandırın.
          </p>
        </div>
        <button
          className="hero-action mt-6 sm:mt-0"
          onClick={() => go("approvals")}
        >
          <ClipboardCheck size={18} /> {overview?.pending || 0} onay bekliyor
        </button>
      </section>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mt-5">
        {(
          [
            ["Şu an dışarıda", overview?.outsideNow, MapPin, "violet"],
            ["Bugün onaylanan", overview?.approvedToday, CheckCircle2, "teal"],
            [
              "Bugünkü toplam",
              overview ? durationTR(overview.minutesToday) : "—",
              Timer,
              "sky",
            ],
            ["Takip edilen kişi", overview?.people, Users, "amber"],
          ] as const
        ).map(([label, value, Icon, tone]) => (
          <div className={`metric-card metric-${tone}`} key={String(label)}>
            <Icon size={20} />
            <strong>{value ?? "—"}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-5 mt-5">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="eyebrow">LİDERLER</p>
              <h3 className="font-bold text-lg mt-1">
                En uzun dışarıda kalanlar
              </h3>
            </div>
            <button
              className="text-blue text-sm font-semibold flex items-center gap-1"
              onClick={() => go("rankings")}
            >
              Tüm liste <ChevronRight size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {leaders.map((person, index) => (
              <div key={person.id} className="leader-row">
                <span className="leader-rank">{index + 1}</span>
                <PersonAvatar
                  name={person.name}
                  photo={person.profilePhoto}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{person.name}</div>
                  <MemberClassPill value={person.memberClass} />
                </div>
                <strong>{durationTR(person.durationMinutes)}</strong>
              </div>
            ))}
            {!leaders.length && (
              <p className="text-slate-500 text-sm">
                Henüz onaylı çıkış bulunmuyor.
              </p>
            )}
          </div>
        </section>
        <section className="card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-700 grid place-items-center mb-5">
              <ShieldCheck />
            </div>
            <h3 className="font-bold text-xl">Kontrol sende</h3>
            <p className="text-slate-500 mt-2">
              Akşam eşiği, seri süresi, sıralama dönemi ve izin türleri Tanrı
              panelinden belirlenir.
            </p>
          </div>
          {user.role === "GOD" ? (
            <Button
              kind="soft"
              className="w-full mt-6"
              onClick={() => go("settings")}
            >
              Kuralları düzenle <ArrowUpRight size={16} />
            </Button>
          ) : (
            <Button
              kind="soft"
              className="w-full mt-6"
              onClick={() => go("approvals")}
            >
              Onay merkezine git <ArrowUpRight size={16} />
            </Button>
          )}
        </section>
      </div>
    </>
  );
}

function OutingApprovals({
  notify,
  refresh,
  canApprove,
  canReject,
}: {
  day: string;
  notify: (message: string) => void;
  refresh: () => void;
  canApprove: boolean;
  canReject: boolean;
}) {
  const [tab, setTab] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">(
    "PENDING",
  );
  const [rows, setRows] = useState<Outing[]>([]);
  const [selected, setSelected] = useState<{
    row: Outing;
    decision: "APPROVED" | "REJECTED";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () =>
    api<{ rows: Outing[] }>(
      `/outings/manage?status=${tab}&year=${new Date().getFullYear()}`,
    )
      .then((x) => setRows(x.rows))
      .catch((e) => notify(e.message));
  useEffect(() => {
    load();
  }, [tab]);
  async function decide() {
    if (!selected) return;
    setBusy(true);
    try {
      await post(`/outings/${selected.row.id}/decision`, {
        decision: selected.decision,
        reason,
      });
      notify(
        selected.decision === "APPROVED"
          ? "Çıkış onaylandı."
          : "Çıkış reddedildi.",
      );
      setSelected(null);
      setReason("");
      load();
      refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
        {(
          [
            ["PENDING", "Bekleyen"],
            ["APPROVED", "Onaylanan"],
            ["REJECTED", "Reddedilen"],
            ["ALL", "Tümü"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`filter-chip ${tab === value ? "active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid xl:grid-cols-2 gap-4">
        {rows.map((row) => (
          <article className="approval-card" key={row.id}>
            <div className="flex items-start gap-3">
              <PersonAvatar
                name={row.user?.name || "?"}
                photo={row.user?.profilePhoto}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-lg">{row.user?.name}</h3>
                  <MemberClassPill value={row.user?.memberClass || null} />
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  @{row.user?.username} ·{" "}
                  {row.source === "HISTORICAL" ? "Geçmiş kayıt" : "Canlı çıkış"}
                </p>
              </div>
              {badge(row.status)}
            </div>
            <div className="outing-timeline">
              <div>
                <span>Çıkış</span>
                <strong>{dateTimeTR(row.startedAt)}</strong>
              </div>
              <div className="timeline-line">
                <span />
              </div>
              <div>
                <span>Dönüş</span>
                <strong>
                  {row.endedAt ? dateTimeTR(row.endedAt) : "Henüz dönmedi"}
                </strong>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="info-tile">
                <span>Süre</span>
                <strong>
                  {row.endedAt
                    ? durationTR(row.durationMinutes)
                    : "Devam ediyor"}
                </strong>
              </div>
              <div className="info-tile">
                <span>Tür</span>
                <strong>
                  {row.kind === "PERMISSION" ? row.category : "Normal çıkış"}
                </strong>
              </div>
            </div>
            {row.note && (
              <p className="rounded-xl bg-slate-50 p-3 text-sm mt-4">
                {row.note}
              </p>
            )}
            {row.decisionNote && (
              <p className="text-sm text-red-600 mt-3">
                Gerekçe: {row.decisionNote}
              </p>
            )}
            {row.status === "PENDING" && (
              <div className="flex gap-3 mt-5">
                {canReject && (
                  <Button
                    kind="danger"
                    className="flex-1"
                    onClick={() => setSelected({ row, decision: "REJECTED" })}
                  >
                    <X size={17} /> Reddet
                  </Button>
                )}
                {canApprove && (
                  <Button
                    className="flex-1"
                    onClick={() => setSelected({ row, decision: "APPROVED" })}
                  >
                    <Check size={17} /> Onayla
                  </Button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      {!rows.length && (
        <div className="empty-state">
          <ClipboardCheck size={32} />
          <h3>Bu listede kayıt yok</h3>
          <p>Yeni talepler geldiğinde burada görünecek.</p>
        </div>
      )}
      {selected && (
        <Modal
          title={
            selected.decision === "APPROVED" ? "Çıkışı onayla" : "Çıkışı reddet"
          }
          close={() => setSelected(null)}
        >
          <div className="rounded-xl bg-slate-50 p-4 mb-4">
            <b>{selected.row.user?.name}</b>
            <p className="text-sm text-slate-500 mt-1">
              {dateTimeTR(selected.row.startedAt)} ·{" "}
              {selected.row.kind === "PERMISSION"
                ? selected.row.category
                : "Normal çıkış"}
            </p>
          </div>
          <label className="label">
            {selected.decision === "REJECTED"
              ? "Ret gerekçesi (zorunlu)"
              : "Onay notu (isteğe bağlı)"}
          </label>
          <textarea
            className="field min-h-28"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
          />
          <Button
            className="w-full mt-5"
            kind={selected.decision === "REJECTED" ? "danger" : "primary"}
            disabled={
              busy || (selected.decision === "REJECTED" && !reason.trim())
            }
            onClick={decide}
          >
            {busy
              ? "Kaydediliyor..."
              : selected.decision === "APPROVED"
                ? "Onayı kesinleştir"
                : "Reddet"}
          </Button>
        </Modal>
      )}
    </>
  );
}

function PresenceView() {
  const [rows, setRows] = useState<PresenceRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [filter, setFilter] = useState<
    "ALL" | "ONLINE" | "IN_NEIGHBORHOOD" | "OUTSIDE"
  >("ALL");
  const load = () =>
    api<{ rows: PresenceRow[]; generatedAt: string }>("/presence")
      .then((result) => {
        setRows(result.rows);
        setGeneratedAt(result.generatedAt);
      })
      .catch(() => {});
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);
  const online = rows.filter((row) => row.online).length;
  const inside = rows.filter((row) => row.location === "IN_NEIGHBORHOOD").length;
  const outside = rows.length - inside;
  const visible = rows.filter((row) => {
    if (filter === "ONLINE") return row.online;
    if (filter === "IN_NEIGHBORHOOD")
      return row.location === "IN_NEIGHBORHOOD";
    if (filter === "OUTSIDE") return row.location === "OUTSIDE";
    return true;
  });
  const lastSeen = (value: string | null) => {
    if (!value) return "Henüz görülmedi";
    const minutes = Math.max(
      0,
      Math.floor((Date.now() - new Date(value).getTime()) / 60000),
    );
    if (minutes < 1) return "Şimdi aktif";
    if (minutes < 60) return `${minutes} dk önce`;
    return dateTimeTR(value);
  };
  return (
    <>
      <section className="presence-hero">
        <div>
          <p className="eyebrow-light">CANLI NABIZ</p>
          <h3 className="text-3xl sm:text-4xl font-black mt-2">
            Mahalle şu an burada
          </h3>
          <p className="text-white/70 mt-2">
            Online olanlar ve anlık mahalle konumu 15 saniyede bir yenilenir.
          </p>
        </div>
        <div className="live-radar" aria-hidden="true">
          <span />
          <Radio size={32} />
        </div>
      </section>
      <div className="grid grid-cols-3 gap-3 mt-5">
        {(
          [
            ["Online", online, Radio, "#19a981"],
            ["Mahallede", inside, House, "#2878a5"],
            ["Dışarıda", outside, MapPin, "#7255bd"],
          ] as const
        ).map(([label, value, Icon, color]) => (
          <div className="presence-stat" key={String(label)}>
            <Icon size={19} style={{ color: String(color) }} />
            <strong>{String(value)}</strong>
            <span>{String(label)}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto py-4 no-scrollbar">
        {(
          [
            ["ALL", "Herkes"],
            ["ONLINE", "Online"],
            ["IN_NEIGHBORHOOD", "Mahallede"],
            ["OUTSIDE", "Dışarıda"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className={`filter-chip ${filter === value ? "active" : ""}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="presence-grid">
        {visible.map((person) => (
          <article className="presence-card" key={person.id}>
            <div className="relative">
              <PersonAvatar
                name={person.name}
                photo={person.profilePhoto}
                size="lg"
              />
              <span
                className={`online-indicator ${person.online ? "active" : ""}`}
                title={person.online ? "Online" : "Offline"}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold truncate">{person.name}</h3>
                <span
                  className="role-dot-label"
                  style={{
                    color: person.roleColor || "#2878a5",
                    borderColor: `${person.roleColor || "#2878a5"}55`,
                  }}
                >
                  {person.roleLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                @{person.username} · {lastSeen(person.lastSeenAt)}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span
                  className={`location-pill ${
                    person.location === "IN_NEIGHBORHOOD" ? "inside" : "outside"
                  }`}
                >
                  {person.location === "IN_NEIGHBORHOOD" ? (
                    <House size={13} />
                  ) : (
                    <MapPin size={13} />
                  )}
                  {person.location === "IN_NEIGHBORHOOD"
                    ? "Mahallede"
                    : person.outing?.status === "PENDING"
                      ? "Dışarıda · onay bekliyor"
                      : "Dışarıda"}
                </span>
                {person.memberClass && (
                  <MemberClassPill value={person.memberClass} />
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <div className="empty-state">
          <Radio size={32} />
          <h3>Bu durumda kimse yok</h3>
          <p>Filtreyi değiştirerek diğer kişileri görebilirsiniz.</p>
        </div>
      )}
      {generatedAt && (
        <p className="text-xs text-slate-500 text-center mt-5">
          Son yenileme: {dateTimeTR(generatedAt)}
        </p>
      )}
    </>
  );
}

type RoleForm = {
  name: string;
  description: string;
  color: string;
  permissions: string[];
  active: boolean;
};
const emptyRoleForm: RoleForm = {
  name: "",
  description: "",
  color: "#2878a5",
  permissions: [],
  active: true,
};
function RolesView({
  user,
  notify,
}: {
  user: User;
  notify: (message: string) => void;
}) {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [catalog, setCatalog] = useState<PermissionGroup[]>([]);
  const [editing, setEditing] = useState<CustomRole | "new" | null>(null);
  const [form, setForm] = useState<RoleForm>(emptyRoleForm);
  const [busy, setBusy] = useState(false);
  const load = () =>
    api<{ roles: CustomRole[]; catalog: PermissionGroup[] }>("/roles")
      .then((result) => {
        setRoles(result.roles);
        setCatalog(result.catalog);
      })
      .catch((error) => notify(error.message));
  useEffect(() => {
    load();
  }, []);
  function open(role?: CustomRole) {
    if (role) {
      setEditing(role);
      setForm({
        name: role.name,
        description: role.description,
        color: role.color,
        permissions: [...role.permissions],
        active: role.active,
      });
    } else {
      setEditing("new");
      setForm({ ...emptyRoleForm, permissions: [] });
    }
  }
  function togglePermission(permission: string) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  }
  function toggleGroup(group: PermissionGroup) {
    const keys = group.permissions.map(([key]) => key);
    const allSelected = keys.every((key) => form.permissions.includes(key));
    setForm((current) => ({
      ...current,
      permissions: allSelected
        ? current.permissions.filter((key) => !keys.includes(key))
        : [...new Set([...current.permissions, ...keys])],
    }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      if (editing === "new") await post("/roles", form);
      else await post(`/roles/${editing.id}`, form, "PATCH");
      notify(editing === "new" ? "Yeni rol oluşturuldu." : "Rol güncellendi.");
      setEditing(null);
      load();
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(role: CustomRole) {
    if (
      !confirm(
        `${role.name} rolü silinsin mi? ${role._count.users} kullanıcının özel rol ataması kaldırılacak.`,
      )
    )
      return;
    try {
      await api(`/roles/${role.id}`, { method: "DELETE" });
      notify("Rol silindi.");
      load();
    } catch (error) {
      notify((error as Error).message);
    }
  }
  return (
    <>
      <section className="roles-hero">
        <div>
          <p className="eyebrow-light">TANRI YETKİ MİMARİSİ</p>
          <h3 className="text-3xl sm:text-4xl font-black mt-2">
            Her yetki, ayrı bir anahtar
          </h3>
          <p className="text-white/70 mt-2 max-w-2xl">
            Yeni roller kurun; görüntüleme, onay, kullanıcı, ayar, rapor
            ve yedek yetkilerini tek tek belirleyin.
          </p>
        </div>
        <KeyRound size={70} className="text-white/20" />
      </section>
      <div className="flex items-center justify-between gap-4 my-5">
        <div>
          <h3 className="font-bold text-xl">Özel roller</h3>
          <p className="text-sm text-slate-500 mt-1">
            Özel rol atandığında sistem rolünün yetkilerinin yerini alır.
          </p>
        </div>
        {can(user, "roles.create") && (
          <Button className="shrink-0" onClick={() => open()}>
            <Plus size={17} /> Rol ekle
          </Button>
        )}
      </div>
      <div className="role-card-grid">
        {roles.map((role) => (
          <article className="role-card" key={role.id}>
            <div className="role-color" style={{ background: role.color }} />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-xl">{role.name}</h3>
                  {!role.active && <span className="mini-tag">Pasif</span>}
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  {role.description || "Açıklama eklenmedi."}
                </p>
              </div>
              <Shield style={{ color: role.color }} />
            </div>
            <div className="role-metrics">
              <span>
                <b>{role.permissions.length}</b> yetki
              </span>
              <span>
                <b>{role._count.users}</b> kullanıcı
              </span>
            </div>
            <div className="flex gap-2 mt-5">
              {can(user, "roles.edit") && (
                <Button kind="soft" className="flex-1" onClick={() => open(role)}>
                  <Pencil size={16} /> Düzenle
                </Button>
              )}
              {can(user, "roles.delete") && (
                <Button kind="danger" onClick={() => remove(role)}>
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!roles.length && (
        <div className="empty-state">
          <UserCog size={34} />
          <h3>Henüz özel rol yok</h3>
          <p>İlk rolü oluşturup yetkileri tek tek seçebilirsiniz.</p>
        </div>
      )}
      {editing && (
        <Modal
          title={editing === "new" ? "Yeni rol oluştur" : "Rolü düzenle"}
          close={() => setEditing(null)}
        >
          <form onSubmit={save} className="space-y-5">
            <div className="grid grid-cols-[1fr_72px] gap-3">
              <div>
                <label className="label">Rol adı</label>
                <input
                  className="field"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  minLength={2}
                  maxLength={40}
                  required
                />
              </div>
              <div>
                <label className="label">Renk</label>
                <input
                  className="role-color-input"
                  type="color"
                  value={form.color}
                  onChange={(event) =>
                    setForm({ ...form, color: event.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="label">Açıklama</label>
              <textarea
                className="field min-h-20"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                maxLength={300}
                placeholder="Bu rolün amacını yazın"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
              <div>
                <b>Rol aktif</b>
                <p className="text-xs text-slate-500 mt-1">
                  Pasif rollerin tüm yetkileri geçici olarak kapanır.
                </p>
              </div>
              <button
                type="button"
                className={`toggle ${form.active ? "active" : ""}`}
                onClick={() => setForm({ ...form, active: !form.active })}
                aria-pressed={form.active}
              >
                <span />
              </button>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="eyebrow">YETKİ MATRİSİ</p>
                  <h3 className="font-bold text-lg mt-1">
                    {form.permissions.length} yetki seçili
                  </h3>
                </div>
                <Sparkles className="text-violet-500" />
              </div>
              <div className="permission-groups">
                {catalog.map((group) => {
                  const groupKeys = group.permissions.map(([key]) => key);
                  const groupSelected = groupKeys.every((key) =>
                    form.permissions.includes(key),
                  );
                  return (
                    <section className="permission-group" key={group.id}>
                      <button
                        type="button"
                        className="permission-group-head"
                        onClick={() => toggleGroup(group)}
                      >
                        <span>{group.name}</span>
                        <span>{groupSelected ? "Tümünü kaldır" : "Tümünü seç"}</span>
                      </button>
                      <div className="space-y-1">
                        {group.permissions.map(([key, label]) => (
                          <label className="permission-row" key={key}>
                            <input
                              type="checkbox"
                              checked={form.permissions.includes(key)}
                              onChange={() => togglePermission(key)}
                            />
                            <span>
                              <b>{label}</b>
                              <small>{key}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Kaydediliyor..." : "Rolü ve yetkileri kaydet"}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}

function RankingsView() {
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [period, setPeriod] = useState(30);
  const [metric, setMetric] = useState<
    | "durationMinutes"
    | "outingDays"
    | "eveningCount"
    | "streak"
    | "permissionCount"
  >("durationMinutes");
  const [memberClass, setMemberClass] = useState<"ALL" | MemberClass>("ALL");
  useEffect(() => {
    api<{ rows: RankingRow[]; periodDays: number }>("/rankings")
      .then((result) => {
        setRows(result.rows);
        setPeriod(result.periodDays);
      })
      .catch(() => {});
  }, []);
  const sorted = rows
    .filter((row) => memberClass === "ALL" || row.memberClass === memberClass)
    .sort((a, b) => b[metric] - a[metric]);
  const metricInfo = {
    durationMinutes: {
      label: "Dışarıda kalma",
      icon: Timer,
      value: (row: RankingRow) => durationTR(row.durationMinutes),
    },
    outingDays: {
      label: "Çıkış günü",
      icon: CalendarDays,
      value: (row: RankingRow) => `${row.outingDays} gün`,
    },
    eveningCount: {
      label: "Akşam çıkışı",
      icon: Moon,
      value: (row: RankingRow) => `${row.eveningCount} çıkış`,
    },
    streak: {
      label: "En uzun seri",
      icon: Flame,
      value: (row: RankingRow) => `${row.streak} gün`,
    },
    permissionCount: {
      label: "İzinli çıkış",
      icon: ShieldCheck,
      value: (row: RankingRow) => `${row.permissionCount} izin`,
    },
  };
  const selectedMetric = metricInfo[metric];
  return (
    <>
      <section className="ranking-hero">
        <div>
          <p className="eyebrow-light">SON {period} GÜN</p>
          <h3 className="text-3xl sm:text-4xl font-black mt-2">
            Mahallenin Tier List’i
          </h3>
          <p className="text-white/70 mt-2">
            Yalnızca yetkili tarafından onaylanan kayıtlar puanlanır.
          </p>
        </div>
        <Trophy size={76} className="text-amber-300/80" />
      </section>
      <div className="flex gap-2 overflow-x-auto py-4 no-scrollbar">
        {(
          Object.entries(metricInfo) as [typeof metric, typeof selectedMetric][]
        ).map(([value, info]) => (
          <button
            key={value}
            onClick={() => setMetric(value)}
            className={`filter-chip flex items-center gap-2 ${metric === value ? "active" : ""}`}
          >
            <info.icon size={16} />
            {info.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {(
          [
            ["ALL", "Tümü"],
            ["ACADEMY", "Akademi"],
            ["LORD", "Lord"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className={`class-filter ${memberClass === value ? "active" : ""}`}
            onClick={() => setMemberClass(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="podium-grid">
        {sorted.slice(0, 3).map((person, index) => (
          <article
            key={person.id}
            className={`podium-card podium-${index + 1}`}
          >
            <span className="podium-number">#{index + 1}</span>
            <PersonAvatar
              name={person.name}
              photo={person.profilePhoto}
              size="lg"
            />
            <h3 className="font-extrabold mt-3 truncate w-full">
              {person.name}
            </h3>
            <MemberClassPill value={person.memberClass} />
            <strong className="text-xl mt-4">
              {selectedMetric.value(person)}
            </strong>
          </article>
        ))}
      </div>
      <div className="card mt-5 overflow-hidden">
        {sorted.slice(3).map((person, index) => (
          <div key={person.id} className="ranking-row">
            <span className="leader-rank">{index + 4}</span>
            <PersonAvatar
              name={person.name}
              photo={person.profilePhoto}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{person.name}</div>
              <span className="text-xs text-slate-500">
                {memberClassName(person.memberClass)}
              </span>
            </div>
            <strong>{selectedMetric.value(person)}</strong>
          </div>
        ))}
        {!sorted.length && (
          <p className="p-10 text-center text-slate-500">
            Bu sınıfta sıralanacak onaylı kayıt yok.
          </p>
        )}
      </div>
    </>
  );
}

function OutingHistoryView() {
  const [rows, setRows] = useState<Outing[]>([]);
  const [filter, setFilter] = useState<
    "ALL" | "PENDING" | "APPROVED" | "REJECTED"
  >("ALL");
  useEffect(() => {
    api<{ history: Outing[] }>("/outings/me")
      .then((x) => setRows(x.history))
      .catch(() => {});
  }, []);
  const visible = rows.filter(
    (row) => filter === "ALL" || row.status === filter,
  );
  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
        {(
          [
            ["ALL", "Tümü"],
            ["PENDING", "Bekleyen"],
            ["APPROVED", "Onaylanan"],
            ["REJECTED", "Reddedilen"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className={`filter-chip ${filter === value ? "active" : ""}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {visible.map((row) => (
          <article className="history-card" key={row.id}>
            <div className={`status-icon ${row.status.toLowerCase()}`}>
              {row.status === "APPROVED" ? (
                <Check />
              ) : row.status === "REJECTED" ? (
                <X />
              ) : (
                <Clock3 />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold">
                  {row.kind === "PERMISSION" ? row.category : "Normal çıkış"}
                </h3>
                {row.source === "HISTORICAL" && (
                  <span className="mini-tag">Geçmiş giriş</span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {dateTimeTR(row.startedAt)} →{" "}
                {row.endedAt ? dateTimeTR(row.endedAt) : "Devam ediyor"}
              </p>
              {row.note && <p className="text-sm mt-2">{row.note}</p>}
              {row.decisionNote && (
                <p className="text-sm text-red-600 mt-2">
                  Gerekçe: {row.decisionNote}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <strong>
                {row.endedAt ? durationTR(row.durationMinutes) : "—"}
              </strong>
              <div className="mt-2">{badge(row.status)}</div>
            </div>
          </article>
        ))}
        {!visible.length && (
          <div className="empty-state">
            <History size={32} />
            <h3>Kayıt bulunamadı</h3>
            <p>Seçilen durumda bir çıkış kaydı yok.</p>
          </div>
        )}
      </div>
    </>
  );
}

export function StaffHome({
  day,
  schedule,
  categories,
  notify,
  refresh,
}: {
  day: string;
  schedule: Schedule | null;
  categories: string[];
  notify: (m: string) => void;
  refresh: () => void;
}) {
  const [data, SET] = useState<{
      attendance: Attendance | null;
      leave: Leave | null;
    } | null>(null),
    [modal, MOD] = useState<"attendance" | "leave" | null>(null),
    [note, NOTE] = useState(""),
    [category, CAT] = useState(categories[0] || ""),
    [busy, B] = useState(false);
  const load = () =>
    api<{ attendance: Attendance | null; leave: Leave | null }>("/my/today")
      .then(SET)
      .catch((e) => notify(e.message));
  useEffect(() => {
    load();
  }, [day]);
  const row = data?.attendance || data?.leave;
  async function save() {
    B(true);
    try {
      await post(
        `/my/${modal}`,
        modal === "attendance" ? { note } : { category, note },
      );
      MOD(null);
      NOTE("");
      notify("Kaydınız amir onayına gönderildi.");
      load();
      refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      B(false);
    }
  }
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="card lg:col-span-2 p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#e5f2fa] dark:bg-[#203c55] rounded-bl-[80px]" />
          <div className="relative">
            <div className="text-sm text-slate-500 mb-3">
              BUGÜNKÜ DURUM · {dateTR(day)}
            </div>
            <div className="flex gap-3 items-center mb-5">
              <div
                className={`w-12 h-12 rounded-xl grid place-items-center ${row ? "bg-[#e5f5ed] text-[#138662]" : "bg-[#e9f1f8] text-[#3272a5]"}`}
              >
                {row ? <CheckCircle2 size={25} /> : <Clock3 size={25} />}
              </div>
              <div>
                <h3 className="font-bold text-xl">
                  {row
                    ? data?.leave
                      ? "İzin talebiniz kaydedildi"
                      : "Yoklamanız kaydedildi"
                    : "Henüz yoklama vermediniz"}
                </h3>
                <p className="text-sm text-slate-500">
                  {row
                    ? `Durum: ${statusText(row.status)}`
                    : "Bugünkü durumunuzu bildirmek için aşağıdan seçim yapın."}
                </p>
              </div>
            </div>
            {row && (
              <div className="flex flex-wrap gap-3 mb-5 text-sm">
                <span className="bg-slate-100 px-3 py-2 rounded-lg">
                  {data?.attendance
                    ? `Giriş: ${timeTR(data.attendance.checkedInAt)}`
                    : `İzin: ${data?.leave?.category}`}
                </span>
                {data?.attendance && (
                  <span className="bg-slate-100 px-3 py-2 rounded-lg">
                    {statusText(data.attendance.arrival)}
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={
                  !!row && (!data?.attendance || row.status !== "PENDING")
                }
                onClick={() => {
                  NOTE(data?.attendance?.note || "");
                  MOD("attendance");
                }}
              >
                <UserRoundCheck size={18} />
                {data?.attendance ? "Kaydı düzenle" : "Bugün Görevdeyim"}
              </Button>
              <Button
                kind="soft"
                disabled={!!row && (!data?.leave || row.status !== "PENDING")}
                onClick={() => {
                  NOTE(data?.leave?.note || "");
                  CAT(data?.leave?.category || categories[0]);
                  MOD("leave");
                }}
              >
                <CalendarDays size={18} />
                {data?.leave ? "Talebi düzenle" : "Bugün Gelemeyeceğim"}
              </Button>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3 text-blue mb-5">
            <Clock3 size={20} />
            <h3 className="font-bold text-[#173a60] dark:text-white">
              Mesai Bilgileri
            </h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <span className="text-sm text-slate-500">Başlangıç</span>
              <b className="text-lg">{schedule?.startTime || "—"}</b>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <span className="text-sm text-slate-500">Bitiş</span>
              <b className="text-lg">{schedule?.endTime || "—"}</b>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Geç kalma toleransı
              </span>
              <b>{schedule?.toleranceMinutes || 0} dk</b>
            </div>
          </div>
        </div>
      </div>
      <RecentRecords />
      {modal && (
        <Modal
          title={modal === "attendance" ? "Bugünkü yoklama" : "İzin talebi"}
          close={() => MOD(null)}
        >
          <p className="text-sm text-slate-500 mb-5">
            Tarih ve saat sistem tarafından otomatik kaydedilir. Amir onayına
            kadar düzenleyebilirsiniz.
          </p>
          {modal === "leave" && (
            <div className="mb-4">
              <label className="label">İzin kategorisi</label>
              <select
                className="field"
                value={category}
                onChange={(e) => CAT(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          <label className="label">
            Açıklama{" "}
            {modal === "leave" && category === "Diğer"
              ? "(zorunlu)"
              : "(isteğe bağlı)"}
          </label>
          <textarea
            className="field min-h-28 resize-y"
            maxLength={1000}
            value={note}
            onChange={(e) => NOTE(e.target.value)}
            placeholder="Gerekli bilgileri yazın"
          />
          <div className="flex justify-end gap-2 mt-6">
            <Button kind="soft" onClick={() => MOD(null)}>
              Vazgeç
            </Button>
            <Button
              disabled={
                busy ||
                (modal === "leave" && category === "Diğer" && !note.trim())
              }
              onClick={save}
            >
              Onaya gönder
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function RecentRecords() {
  const [rows, R] = useState<Entry[]>([]);
  useEffect(() => {
    api<{ attendance: Attendance[]; leaves: Leave[] }>("/my/history")
      .then((x) =>
        R(
          [...x.attendance, ...x.leaves]
            .sort((a, b) => b.day.localeCompare(a.day))
            .slice(0, 5),
        ),
      )
      .catch(() => {});
  }, []);
  return (
    <div className="card">
      <div className="p-5 border-b border-slate-200">
        <h3 className="font-bold">Son kayıtlarım</h3>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>İşlem</th>
              <th>Saat / Kategori</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{dateTR(r.day)}</td>
                <td>{"category" in r ? "İzin" : "Yoklama"}</td>
                <td>{"category" in r ? r.category : timeTR(r.checkedInAt)}</td>
                <td>{badge(r.status)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="text-slate-500">
                  Henüz kayıt bulunmuyor.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export function AdminHome({ day, go }: { day: string; go: (p: Page) => void }) {
  const [d, D] = useState<{
    users: number;
    present: number;
    absent: number;
    leave: number;
    late: number;
    pending: number;
  } | null>(null);
  useEffect(() => {
    api<typeof d>("/dashboard")
      .then(D)
      .catch(() => {});
  }, [day]);
  const cards = [
    ["Bugün Gelen", d?.present, UserRoundCheck, "#e0f5ed", "#17805b"],
    ["Bugün Gelmeyen", d?.absent, UserRound, "#ffe9e8", "#bc4b48"],
    ["İzinli", d?.leave, CalendarDays, "#e4efff", "#3c71ae"],
    ["Geç Gelen", d?.late, Clock3, "#fff2dc", "#a77a22"],
    ["Onay Bekleyen", d?.pending, ClipboardCheck, "#fff2da", "#a77a22"],
    ["Toplam Personel", d?.users, Users, "#e9f0f9", "#3b6996"],
  ] as const;
  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {cards.map(([title, value, Icon, bg, color]) => (
          <div
            key={title}
            className="card p-5 md:p-6 flex items-start justify-between gap-3"
          >
            <div>
              <p className="text-sm text-slate-500 mb-3">{title}</p>
              <div className="text-3xl font-bold">{value ?? "—"}</div>
            </div>
            <div
              className="w-11 h-11 rounded-xl grid place-items-center shrink-0"
              style={{ background: bg, color }}
            >
              <Icon size={21} />
            </div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card p-6">
          <h3 className="font-bold text-lg mb-2">Onay akışı</h3>
          <p className="text-sm text-slate-500 mb-5">
            Bekleyen yoklama ve izin kayıtlarını inceleyin.
          </p>
          <Button onClick={() => go("approvals")}>
            Onayları görüntüle <ChevronRight size={17} />
          </Button>
        </div>
        <div className="card p-6">
          <h3 className="font-bold text-lg mb-2">Dönem raporları</h3>
          <p className="text-sm text-slate-500 mb-5">
            Personel, devamsızlık ve izin kayıtlarını indirin.
          </p>
          <Button kind="soft" onClick={() => go("reports")}>
            Raporlara git <ChevronRight size={17} />
          </Button>
        </div>
      </div>
    </>
  );
}
export function Approvals({
  day,
  notify,
  refresh,
}: {
  day: string;
  notify: (m: string) => void;
  refresh: () => void;
}) {
  const [rows, R] = useState<Entry[]>([]),
    [tab, T] = useState("PENDING"),
    [selected, S] = useState<{
      row: Entry;
      decision: "APPROVED" | "REJECTED";
    } | null>(null),
    [reason, RE] = useState(""),
    [busy, B] = useState(false);
  const load = () =>
    api<{ records: Entry[] }>("/approvals")
      .then((x) => R(x.records))
      .catch((e) => notify(e.message));
  useEffect(() => {
    load();
  }, []);
  const visible = rows.filter((r) =>
    tab === "TODAY" ? r.day === day : tab === r.status,
  );
  async function decide() {
    if (!selected) return;
    B(true);
    try {
      await post(
        `/approvals/${"category" in selected.row ? "leave" : "attendance"}/${selected.row.id}`,
        { decision: selected.decision, reason },
      );
      S(null);
      RE("");
      notify("Karar kaydedildi.");
      load();
      refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      B(false);
    }
  }
  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-4 no-print">
        {[
          ["PENDING", "Bekleyen"],
          ["TODAY", "Bugünkü Kayıtlar"],
          ["APPROVED", "Onaylananlar"],
          ["REJECTED", "Reddedilenler"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => T(id)}
            className={`px-4 py-2.5 whitespace-nowrap rounded-lg font-semibold text-sm ${tab === id ? "bg-navy text-white" : "bg-white dark:bg-[#1b3045] text-slate-600"}`}
          >
            {label}{" "}
            {id === "PENDING" &&
              `(${rows.filter((r) => r.status === "PENDING").length})`}
          </button>
        ))}
      </div>
      <div className="card table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Personel</th>
              <th>Tarih</th>
              <th>Tür</th>
              <th>Saat / Kategori</th>
              <th>Açıklama</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold">{r.user?.name}</td>
                <td>{dateTR(r.day)}</td>
                <td>{"category" in r ? "İzin" : "Yoklama"}</td>
                <td>{"category" in r ? r.category : timeTR(r.checkedInAt)}</td>
                <td className="max-w-[220px] break-words">{r.note || "—"}</td>
                <td>{badge(r.status)}</td>
                <td>
                  {r.status === "PENDING" ? (
                    <div className="flex gap-2">
                      <button
                        title="Onayla"
                        className="p-2 rounded-lg bg-green-50 text-green-700"
                        onClick={() => S({ row: r, decision: "APPROVED" })}
                      >
                        <Check size={18} />
                      </button>
                      <button
                        title="Reddet"
                        className="p-2 rounded-lg bg-red-50 text-red-700"
                        onClick={() => S({ row: r, decision: "REJECTED" })}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={7} className="text-center text-slate-500 py-12">
                  Bu sekmede kayıt bulunmuyor.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && (
        <Modal
          title={
            selected.decision === "APPROVED" ? "Kaydı onayla" : "Kaydı reddet"
          }
          close={() => S(null)}
        >
          <p className="mb-4">
            {selected.row.user?.name} · {dateTR(selected.row.day)}
          </p>
          {selected.decision === "REJECTED" && (
            <>
              <label className="label">Ret gerekçesi (zorunlu)</label>
              <textarea
                className="field min-h-28"
                maxLength={1000}
                value={reason}
                onChange={(e) => RE(e.target.value)}
                placeholder="Personelin göreceği gerekçeyi yazın"
              />
            </>
          )}
          <div className="flex justify-end gap-2 mt-6">
            <Button kind="soft" onClick={() => S(null)}>
              Vazgeç
            </Button>
            <Button
              disabled={
                busy || (selected.decision === "REJECTED" && !reason.trim())
              }
              kind={selected.decision === "REJECTED" ? "danger" : "primary"}
              onClick={decide}
            >
              {selected.decision === "REJECTED" ? "Reddet" : "Onayla"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Calendar({ user, day }: { user: User; day: string }) {
  const [month, M] = useState(day.slice(0, 7)),
    [rows, R] = useState<Entry[]>([]);
  useEffect(() => {
    api<{ attendance: Attendance[]; leaves: Leave[] }>(
      `/calendar?month=${month}`,
    )
      .then((x) => R([...x.attendance, ...x.leaves]))
      .catch(() => {});
  }, [month]);
  const first = new Date(`${month}-01T12:00:00`),
    days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(),
    offset = (first.getDay() + 6) % 7;
  const change = (n: number) => {
    const d = new Date(first.getFullYear(), first.getMonth() + n, 1);
    M(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const current = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  return (
    <div className="card p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold capitalize">{monthLabel(month)}</h3>
        <div className="flex gap-1">
          <button
            aria-label="Önceki ay"
            className="p-2 rounded-lg hover:bg-slate-100"
            onClick={() => change(-1)}
          >
            <ChevronLeft />
          </button>
          <button
            aria-label="Sonraki ay"
            className="p-2 rounded-lg hover:bg-slate-100"
            onClick={() => change(1)}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 md:gap-2 text-center text-xs md:text-sm">
        {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((x) => (
          <div key={x} className="font-semibold text-slate-500 py-2">
            {x}
          </div>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const n = i + 1,
            date = current(n),
            weekend = [0, 6].includes(new Date(`${date}T12:00:00`).getDay()),
            todayRows = rows.filter((r) => r.day === date),
            approvedLeave = todayRows.some(
              (r) => "category" in r && r.status === "APPROVED",
            ),
            pending = todayRows.some((r) => r.status === "PENDING"),
            present = todayRows.some(
              (r) => !("category" in r) && r.status === "APPROVED",
            ),
            absent = !weekend && date <= day && !todayRows.length;
          const color = weekend
            ? "bg-slate-100 text-slate-500"
            : pending
              ? "bg-amber-100 text-amber-800"
              : approvedLeave
                ? "bg-blue-100 text-blue-800"
                : present
                  ? "bg-green-100 text-green-800"
                  : absent
                    ? "bg-red-50 text-red-700"
                    : "bg-slate-50";
          return (
            <div
              key={n}
              title={todayRows
                .map(
                  (r) =>
                    `${r.user?.name || "Ben"} · ${"category" in r ? r.category : statusText(r.status)}`,
                )
                .join("\n")}
              className={`min-h-16 md:min-h-24 rounded-lg p-2 text-left ${color} ${date === day ? "ring-2 ring-blue" : ""}`}
            >
              <span className="font-semibold">{n}</span>
              {todayRows.length > 0 && (
                <span className="block text-[11px] md:text-xs mt-2 leading-tight">
                  {user.role === "STAFF"
                    ? approvedLeave
                      ? "İzinli"
                      : pending
                        ? "Bekliyor"
                        : "Geldi"
                    : `${todayRows.length} kayıt`}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-6 text-xs md:text-sm text-slate-600">
        {[
          ["#d1fae5", "Geldi"],
          ["#fef3c7", "Onay bekliyor"],
          ["#dbeafe", "İzinli"],
          ["#fee2e2", "Gelmedi"],
          ["#e2e8f0", "Hafta sonu"],
        ].map(([color, label]) => (
          <span key={label} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: color }}
            />
            {label}
          </span>
        ))}
      </div>
      {user.role !== "STAFF" && (
        <p className="text-xs text-slate-500 mt-4">
          Yönetici takvimindeki “Gelmedi” rengi günlük toplu görünümü temsil
          eder; kişi bazlı eksikler raporda gösterilir.
        </p>
      )}
    </div>
  );
}
export function HistoryView() {
  const [tab, T] = useState<"attendance" | "leaves">("attendance"),
    [rows, R] = useState<{ attendance: Attendance[]; leaves: Leave[] }>({
      attendance: [],
      leaves: [],
    });
  useEffect(() => {
    api<typeof rows>("/my/history")
      .then(R)
      .catch(() => {});
  }, []);
  const list = rows[tab];
  return (
    <div className="card">
      <div className="p-5 flex gap-2">
        <Button
          kind={tab === "attendance" ? "primary" : "soft"}
          onClick={() => T("attendance")}
        >
          Yoklama geçmişi
        </Button>
        <Button
          kind={tab === "leaves" ? "primary" : "soft"}
          onClick={() => T("leaves")}
        >
          İzin geçmişi
        </Button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Saat / Kategori</th>
              <th>Açıklama</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>{dateTR(r.day)}</td>
                <td>{"category" in r ? r.category : timeTR(r.checkedInAt)}</td>
                <td>{r.note || "—"}</td>
                <td>{badge(r.status)}</td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan={4} className="text-slate-500">
                  Henüz kayıt yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
type UserForm = {
  username: string;
  name: string;
  role: User["role"];
  customRoleId: string | null;
  memberClass: MemberClass | null;
  password: string;
  profilePhoto: string | null;
  active: boolean;
};
const emptyUserForm: UserForm = {
  username: "",
  name: "",
  role: "STAFF",
  customRoleId: null,
  memberClass: null,
  password: "",
  profilePhoto: null,
  active: true,
};
function UsersView({
  currentUser,
  onCurrentUserUpdate,
  notify,
}: {
  currentUser: User;
  onCurrentUserUpdate: (user: User) => void;
  notify: (m: string) => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [customRoles, setCustomRoles] = useState<
    { id: string; name: string; color: string }[]
  >([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [form, setForm] = useState<UserForm>(emptyUserForm);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const isGod = currentUser.role === "GOD";
  const canCreate = can(currentUser, "users.create");
  const canIdentity = can(currentUser, "users.edit_identity");
  const canRole = can(currentUser, "users.edit_role");
  const canClass = can(currentUser, "users.edit_class");
  const canPassword = can(currentUser, "users.edit_password");
  const canStatus = can(currentUser, "users.edit_status");
  const canDelete = can(currentUser, "users.delete");
  const canEditAny =
    canIdentity || canRole || canClass || canPassword || canStatus;
  const load = () =>
    api<User[]>("/users")
      .then(setUsers)
      .catch((e) => notify(e.message));
  useEffect(() => {
    load();
    api<{ id: string; name: string; color: string }[]>("/role-options")
      .then(setCustomRoles)
      .catch(() => {});
  }, []);
  const visible = users.filter((u) =>
    `${u.name} ${u.username}`
      .toLocaleLowerCase("tr-TR")
      .includes(search.toLocaleLowerCase("tr-TR")),
  );
  function openNew() {
    setForm({ ...emptyUserForm });
    setEditing("new");
  }
  function openEdit(user: User) {
    setForm({
      username: user.username,
      name: user.name,
      role: user.role,
      customRoleId: user.customRole?.id || null,
      memberClass: user.memberClass,
      password: "",
      profilePhoto: user.profilePhoto,
      active: user.active,
    });
    setEditing(user);
  }
  function change<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing === "new") {
        const result = await post<{
          user: User;
          temporaryPassword: string | null;
        }>("/users", {
          ...form,
          password: form.password || undefined,
        });
        if (result.temporaryPassword)
          setSecret(`${result.user.username}: ${result.temporaryPassword}`);
        notify("Kullanıcı oluşturuldu.");
      } else if (editing) {
        const updated = await post<User>(
          `/users/${editing.id}`,
          { ...form, password: form.password || undefined },
          "PATCH",
        );
        if (editing.id === currentUser.id) onCurrentUserUpdate(updated);
        notify("Kullanıcı bilgileri güncellendi.");
      }
      setEditing(null);
      load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function update(id: string, data: unknown) {
    try {
      await post(`/users/${id}`, data, "PATCH");
      load();
      notify("Kullanıcı güncellendi.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function resetPassword(user: User) {
    if (!confirm(`${user.name} için yeni bir geçici şifre oluşturulsun mu?`))
      return;
    try {
      const result = await post<{ temporaryPassword: string }>(
        `/users/${user.id}/reset`,
        {},
      );
      setSecret(`${user.username}: ${result.temporaryPassword}`);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function remove(user: User) {
    if (
      !confirm(
        `${user.name} hesabı ve bu hesaba bağlı tüm kayıtlar kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`,
      )
    )
      return;
    try {
      await api(`/users/${user.id}`, { method: "DELETE" });
      load();
      notify("Hesap kalıcı olarak silindi.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const actions = (user: User, mobile = false) => {
    const canManage = isGod || user.role !== "GOD";
    return (
      <div className={`flex flex-wrap ${mobile ? "gap-2" : "gap-x-3 gap-y-2"}`}>
        {canEditAny && (
          <button
            className="text-blue text-sm font-semibold"
            disabled={!canManage}
            onClick={() => openEdit(user)}
          >
            Düzenle
          </button>
        )}
        {canPassword && (
          <button
            className="text-blue text-sm font-semibold"
            disabled={!canManage}
            onClick={() => resetPassword(user)}
          >
            Şifre sıfırla
          </button>
        )}
        {canStatus && user.id !== currentUser.id && canManage && (
          <button
            className="text-amber-700 text-sm font-semibold"
            onClick={() => update(user.id, { active: !user.active })}
          >
            {user.active ? "Devre dışı bırak" : "Etkinleştir"}
          </button>
        )}
        {canDelete && user.id !== currentUser.id && canManage && (
          <button
            className="text-red-600 text-sm font-semibold"
            onClick={() => remove(user)}
          >
            Kalıcı sil
          </button>
        )}
      </div>
    );
  };
  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 justify-between mb-5">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-3 text-slate-500" size={18} />
          <input
            className="field !pl-10"
            placeholder="Ad veya kullanıcı adı ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canCreate && (
          <Button onClick={openNew} className="w-full sm:w-auto">
            <Plus size={17} /> Kullanıcı ekle
          </Button>
        )}
      </div>
      <div className="md:hidden space-y-3">
        {visible.map((user) => (
          <div className="card p-4" key={user.id}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-slate-100 grid place-items-center font-bold text-blue overflow-hidden shrink-0">
                {user.profilePhoto ? (
                  <img
                    src={user.profilePhoto}
                    className="h-full w-full object-cover"
                    alt=""
                  />
                ) : (
                  user.name.slice(0, 1)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{user.name}</div>
                <div className="text-sm text-slate-500 truncate">
                  @{user.username}
                </div>
              </div>
              <span
                className={
                  user.active
                    ? "text-green-700 text-sm"
                    : "text-slate-500 text-sm"
                }
              >
                {user.active ? "Aktif" : "Pasif"}
              </span>
            </div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
              {user.roleLabel}
            </div>
            <div className="mb-3">
              <MemberClassPill value={user.memberClass} />
            </div>
            {actions(user, true)}
          </div>
        ))}
      </div>
      <div className="card table-wrap hidden md:block">
        <table className="data-table">
          <thead>
            <tr>
              <th>Kullanıcı</th>
              <th>Rol</th>
              <th>Durum</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100 grid place-items-center font-bold text-blue overflow-hidden shrink-0">
                      {user.profilePhoto ? (
                        <img
                          src={user.profilePhoto}
                          className="h-full w-full object-cover"
                          alt=""
                        />
                      ) : (
                        user.name.slice(0, 1)
                      )}
                    </div>
                    <div>
                      <div className="font-semibold">{user.name}</div>
                      <div className="text-xs text-slate-500">
                        @{user.username}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div>{user.roleLabel}</div>
                  <div className="mt-1">
                    <MemberClassPill value={user.memberClass} />
                  </div>
                </td>
                <td
                  className={user.active ? "text-green-700" : "text-slate-500"}
                >
                  {user.active ? "Aktif" : "Pasif"}
                </td>
                <td>{actions(user)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && (
        <div className="card p-10 text-center text-slate-500">
          Kullanıcı bulunamadı.
        </div>
      )}
      {editing && (
        <Modal
          title={editing === "new" ? "Yeni kullanıcı" : "Kullanıcıyı düzenle"}
          close={() => setEditing(null)}
        >
          <form onSubmit={save} className="space-y-4">
            <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-3">
              <div className="h-16 w-16 rounded-full bg-slate-100 grid place-items-center text-blue overflow-hidden shrink-0">
                {form.profilePhoto ? (
                  <img
                    src={form.profilePhoto}
                    className="h-full w-full object-cover"
                    alt=""
                  />
                ) : (
                  <UserRound />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <label className="label">Profil fotoğrafı</label>
                <input
                  className="text-sm w-full"
                  type="file"
                  disabled={editing !== "new" && !canIdentity}
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) =>
                    loadImage(
                      e.target.files?.[0],
                      (value) => change("profilePhoto", value),
                      notify,
                    )
                  }
                />
                {form.profilePhoto && (
                  <button
                    type="button"
                    className="text-red-600 text-sm mt-2"
                    onClick={() => change("profilePhoto", null)}
                    disabled={editing !== "new" && !canIdentity}
                  >
                    Fotoğrafı kaldır
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="label">Ad soyad</label>
              <input
                className="field"
                disabled={editing !== "new" && !canIdentity}
                value={form.name}
                onChange={(e) => change("name", e.target.value)}
                minLength={2}
                maxLength={120}
                required
              />
            </div>
            <div>
              <label className="label">Kullanıcı adı</label>
              <input
                className="field"
                disabled={editing !== "new" && !canIdentity}
                value={form.username}
                onChange={(e) =>
                  change("username", e.target.value.toLowerCase())
                }
                pattern="[a-z0-9._-]{3,40}"
                required
              />
            </div>
            <div>
              <label className="label">Rol</label>
              <select
                className="field"
                disabled={!canRole}
                value={form.role}
                onChange={(e) => change("role", e.target.value as User["role"])}
              >
                <option value="STAFF">Üye</option>
                <option value="SUPERVISOR">Amir</option>
                <option value="ADMIN">Yönetici</option>
                {isGod && <option value="GOD">Tanrı</option>}
              </select>
            </div>
            <div>
              <label className="label">Özel rol</label>
              <select
                className="field"
                value={form.customRoleId || ""}
                disabled={!canRole}
                onChange={(event) =>
                  change("customRoleId", event.target.value || null)
                }
              >
                <option value="">Sistem rolünü kullan</option>
                {customRoles.map((role) => (
                  <option value={role.id} key={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Özel rol seçilirse yetkiler sistem rolünün yerine geçer.
              </p>
            </div>
            <div>
              <label className="label">Üyelik sınıfı</label>
              <select
                className="field"
                disabled={!canClass}
                value={form.memberClass || ""}
                onChange={(e) =>
                  change(
                    "memberClass",
                    (e.target.value || null) as MemberClass | null,
                  )
                }
              >
                <option value="">Sınıf atanmadı</option>
                <option value="ACADEMY">Akademi</option>
                <option value="LORD">Lord</option>
              </select>
            </div>
            <div>
              <label className="label">
                {editing === "new"
                  ? "Şifre (boş bırakılırsa otomatik üretilir)"
                  : "Yeni şifre (değişmeyecekse boş bırakın)"}
              </label>
              <input
                className="field"
                type="password"
                disabled={!canPassword}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => change("password", e.target.value)}
                minLength={form.password ? 8 : undefined}
                placeholder="En az 8 karakter"
              />
            </div>
            {canStatus && editing !== "new" && editing.id !== currentUser.id && (
              <label className="flex items-center gap-3 min-h-11 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => change("active", e.target.checked)}
                />
                Hesap aktif
              </label>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy
                ? "Kaydediliyor..."
                : editing === "new"
                  ? "Kullanıcı oluştur"
                  : "Değişiklikleri kaydet"}
            </Button>
          </form>
        </Modal>
      )}
      {secret && (
        <Modal title="Geçici giriş bilgisi" close={() => setSecret("")}>
          <p className="text-sm text-slate-500 mb-4">
            Bu bilgi tekrar gösterilmeyecek. Güvenli bir kanaldan kullanıcıya
            iletin.
          </p>
          <div className="p-4 rounded-lg bg-slate-100 font-mono break-all select-all">
            {secret}
          </div>
          <Button className="mt-5 w-full" onClick={() => setSecret("")}>
            Tamam
          </Button>
        </Modal>
      )}
    </>
  );
}
function OutingSettingsView({
  settings,
  schedule,
  notify,
  refresh,
  user,
}: {
  settings: Settings;
  schedule: Schedule;
  notify: (message: string) => void;
  refresh: () => void;
  user: User;
}) {
  const canBranding = can(user, "settings.branding");
  const canRules = can(user, "settings.outing_rules");
  const [institutionName, setInstitutionName] = useState(
    settings.institutionName,
  );
  const [logo, setLogo] = useState<string | null>(settings.logoData);
  const [permissionCategories, setPermissionCategories] = useState(
    settings.permissionCategories.join("\n"),
  );
  const [eveningStartTime, setEveningStartTime] = useState(
    settings.eveningStartTime,
  );
  const [streakMinMinutes, setStreakMinMinutes] = useState(
    settings.streakMinMinutes,
  );
  const [rankingWindowDays, setRankingWindowDays] = useState(
    settings.rankingWindowDays,
  );
  const [maxOpenOutingHours, setMaxOpenOutingHours] = useState(
    settings.maxOpenOutingHours,
  );
  const [allowHistoricalEntries, setAllowHistoricalEntries] = useState(
    settings.allowHistoricalEntries,
  );
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await post(
        "/settings",
        {
          institutionName,
          logoData: logo,
          leaveCategories: settings.leaveCategories.length
            ? settings.leaveCategories
            : ["Diğer"],
          permissionCategories: permissionCategories
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          eveningStartTime,
          streakMinMinutes,
          rankingWindowDays,
          maxOpenOutingHours,
          allowHistoricalEntries,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          toleranceMinutes: schedule.toleranceMinutes,
          veryLateMinutes: schedule.veryLateMinutes,
        },
        "PUT",
      );
      notify("Mahalle kuralları kaydedildi.");
      refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="space-y-5">
      <section className="rules-hero">
        <div>
          <p className="eyebrow-light">TANRI KONTROL MERKEZİ</p>
          <h3 className="text-3xl font-black mt-2">
            Oyunun kurallarını belirle
          </h3>
          <p className="text-white/70 mt-2 max-w-2xl">
            Tier List hesapları, geçmiş kayıt izni ve çıkış kategorileri burada
            belirlenir.
          </p>
        </div>
        <Settings2 size={62} className="text-white/20" />
      </section>
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="card p-5 sm:p-6 space-y-5">
          <div>
            <p className="eyebrow">KİMLİK</p>
            <h3 className="font-bold text-xl mt-1">Mahalle görünümü</h3>
          </div>
          <div>
            <label className="label">Uygulama adı</label>
            <input
              className="field"
              disabled={!canBranding}
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              minLength={2}
              maxLength={100}
              required
            />
          </div>
          <div>
            <label className="label">Logo</label>
            <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-3">
              <div className="h-16 w-16 rounded-2xl bg-white grid place-items-center overflow-hidden shrink-0">
                {logo ? (
                  <img
                    src={logo}
                    className="h-full w-full object-contain"
                    alt=""
                  />
                ) : (
                  <img src={DEFAULT_EMBLEM} className="h-full w-full object-contain" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <input
                  className="text-sm w-full"
                  type="file"
                  disabled={!canBranding}
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) =>
                    loadImage(e.target.files?.[0], setLogo, notify)
                  }
                />
                {logo && (
                  <button
                    type="button"
                    className="text-red-600 text-sm mt-2"
                    onClick={() => setLogo(null)}
                    disabled={!canBranding}
                  >
                    Logoyu kaldır
                  </button>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="label">İzin türleri (her satıra bir tane)</label>
            <textarea
              className="field min-h-48"
              disabled={!canRules}
              value={permissionCategories}
              onChange={(e) => setPermissionCategories(e.target.value)}
              required
            />
          </div>
        </section>
        <div className="space-y-5">
          <section className="card p-5 sm:p-6">
            <div className="mb-5">
              <p className="eyebrow">TIER LIST MOTORU</p>
              <h3 className="font-bold text-xl mt-1">Puanlama eşikleri</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Akşam başlangıcı</label>
                <input
                  className="field"
                  type="time"
                  disabled={!canRules}
                  value={eveningStartTime}
                  onChange={(e) => setEveningStartTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Sıralama dönemi</label>
                <select
                  className="field"
                  disabled={!canRules}
                  value={rankingWindowDays}
                  onChange={(e) => setRankingWindowDays(Number(e.target.value))}
                >
                  <option value={7}>Son 7 gün</option>
                  <option value={30}>Son 30 gün</option>
                  <option value={90}>Son 90 gün</option>
                  <option value={365}>Son 1 yıl</option>
                </select>
              </div>
              <div>
                <label className="label">Seriye sayılacak minimum süre</label>
                <div className="input-suffix">
                  <input
                    className="field"
                    type="number"
                    disabled={!canRules}
                    min={1}
                    max={1440}
                    value={streakMinMinutes}
                    onChange={(e) =>
                      setStreakMinMinutes(Number(e.target.value))
                    }
                  />
                  <span>dk</span>
                </div>
              </div>
              <div>
                <label className="label">Tek kayıtta en uzun süre</label>
                <div className="input-suffix">
                  <input
                    className="field"
                    type="number"
                    disabled={!canRules}
                    min={1}
                    max={72}
                    value={maxOpenOutingHours}
                    onChange={(e) =>
                      setMaxOpenOutingHours(Number(e.target.value))
                    }
                  />
                  <span>saat</span>
                </div>
              </div>
            </div>
          </section>
          <section className="card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg">Geçmiş kayıt girişi</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Kişiler bu yılın eski çıkışlarını girip onaya gönderebilir.
                </p>
              </div>
              <button
                type="button"
                aria-pressed={allowHistoricalEntries}
                onClick={() =>
                  setAllowHistoricalEntries(!allowHistoricalEntries)
                }
                disabled={!canRules}
                className={`toggle ${allowHistoricalEntries ? "active" : ""}`}
              >
                <span />
              </button>
            </div>
          </section>
          <Button type="submit" disabled={busy} className="w-full !py-3">
            {busy ? "Kaydediliyor..." : "Tüm kuralları kaydet"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function SettingsView({
  settings,
  schedule,
  notify,
  refresh,
}: {
  settings: Settings;
  schedule: Schedule;
  notify: (m: string) => void;
  refresh: () => void;
}) {
  const [name, N] = useState(settings.institutionName),
    [logo, L] = useState<string | null>(settings.logoData),
    [start, ST] = useState(schedule.startTime),
    [end, EN] = useState(schedule.endTime),
    [tolerance, TO] = useState(schedule.toleranceMinutes),
    [veryLate, VL] = useState(schedule.veryLateMinutes),
    [categories, C] = useState(settings.leaveCategories.join("\n")),
    [busy, B] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    B(true);
    try {
      await post(
        "/settings",
        {
          institutionName: name,
          logoData: logo,
          leaveCategories: categories
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          startTime: start,
          endTime: end,
          toleranceMinutes: tolerance,
          veryLateMinutes: veryLate,
        },
        "PUT",
      );
      notify("Sistem ayarları kaydedildi.");
      refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      B(false);
    }
  }
  function upload(file?: File) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 250000
    ) {
      notify("PNG, JPG veya WebP biçiminde en fazla 250 KB görsel yükleyin.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => L(String(reader.result));
    reader.readAsDataURL(file);
  }
  return (
    <form onSubmit={save} className="grid lg:grid-cols-2 gap-5">
      <div className="card p-6 space-y-5">
        <h3 className="font-bold text-lg">Kurum ve görünüm</h3>
        <div>
          <label className="label">Kurum adı</label>
          <input
            className="field"
            value={name}
            onChange={(e) => N(e.target.value)}
            maxLength={100}
            required
          />
        </div>
        <div>
          <label className="label">
            Logo (PNG, JPG, WebP · en fazla 250 KB)
          </label>
          <div className="flex items-center gap-3">
            {logo && (
              <img
                src={logo}
                className="h-12 w-12 object-contain rounded-lg bg-slate-100"
              />
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => upload(e.target.files?.[0])}
              className="text-sm w-full"
            />
            {logo && (
              <button
                type="button"
                className="text-red-600 text-sm"
                onClick={() => L(null)}
              >
                Kaldır
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="label">
            İzin kategorileri (her satıra bir kategori)
          </label>
          <textarea
            className="field min-h-48"
            value={categories}
            onChange={(e) => C(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-5">
        <div className="card p-6">
          <h3 className="font-bold text-lg mb-5">Mesai düzeni</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Başlangıç</label>
              <input
                className="field"
                type="time"
                value={start}
                onChange={(e) => ST(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Bitiş</label>
              <input
                className="field"
                type="time"
                value={end}
                onChange={(e) => EN(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Geç kalma toleransı (dk)</label>
              <input
                className="field"
                type="number"
                min="0"
                max="120"
                value={tolerance}
                onChange={(e) => TO(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Çok geç eşiği (dk)</label>
              <input
                className="field"
                type="number"
                min="1"
                max="240"
                value={veryLate}
                onChange={(e) => VL(Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Tolerans dolduktan sonra “Geç”, çok geç eşiği aşıldığında “Çok Geç”
            görünür. Saat dilimi: Türkiye.
          </p>
        </div>
        <div className="card p-6">
          <h3 className="font-bold text-lg mb-2">Veritabanı yedeği</h3>
          <p className="text-sm text-slate-500 mb-4">
            Tüm kayıtları geri yüklenebilir PostgreSQL biçiminde indirin.
          </p>
          <Button
            kind="soft"
            onClick={() =>
              download("/backup", `yoklama-${formatDay()}.dump`).catch((e) =>
                notify(e.message),
              )
            }
          >
            <Database size={17} /> Tek tıkla yedek al
          </Button>
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          Ayarları kaydet
        </Button>
      </div>
    </form>
  );
}
function ReportsView({ day }: { day: string }) {
  const [from, F] = useState(`${day.slice(0, 7)}-01`),
    [to, T] = useState(day),
    [kind, K] = useState("all"),
    [userId, U] = useState(""),
    [users, US] = useState<User[]>([]),
    [rows, R] = useState<Record<string, string>[]>([]),
    [busy, B] = useState(false),
    [error, E] = useState("");
  useEffect(() => {
    api<User[]>("/users")
      .then(US)
      .catch(() => {});
  }, []);
  const query = () =>
    new URLSearchParams({
      from,
      to,
      kind,
      ...(userId ? { userId } : {}),
    }).toString();
  async function view() {
    B(true);
    E("");
    try {
      const x = await api<{ rows: Record<string, string>[] }>(
        `/reports?${query()}`,
      );
      R(x.rows);
    } catch (e) {
      E((e as Error).message);
    } finally {
      B(false);
    }
  }
  const exportFile = (format: "xlsx" | "pdf") =>
    download(`/reports/${format}?${query()}`, `yoklama-raporu.${format}`).catch(
      (e) => E(e.message),
    );
  return (
    <>
      <div className="card p-5 md:p-6 mb-5 no-print">
        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <div>
            <label className="label">Başlangıç</label>
            <input
              type="date"
              className="field"
              value={from}
              onChange={(e) => F(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Bitiş</label>
            <input
              type="date"
              className="field"
              value={to}
              onChange={(e) => T(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Rapor türü</label>
            <select
              className="field"
              value={kind}
              onChange={(e) => K(e.target.value)}
            >
              {[
                ["all", "Tüm kayıtlar"],
                ["attendance", "Yoklama"],
                ["leave", "İzin"],
                ["absence", "Devamsızlık"],
                ["late", "Geç kalma"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Personel</label>
            <select
              className="field"
              value={userId}
              onChange={(e) => U(e.target.value)}
            >
              <option value="">Tüm personel</option>
              {users
                .filter((u) => u.role === "STAFF")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" disabled={busy} onClick={view}>
              Rapor oluştur
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Aylık ve yıllık rapor için tarih aralığını seçin. Hafta sonları
          devamsızlık hesabına katılmaz.
        </p>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-red-600">
          {error}
        </p>
      )}
      <div className="card">
        <div className="p-5 border-b border-slate-200 flex flex-wrap gap-3 items-center justify-between">
          <h3 className="font-bold">
            Rapor Sonuçları{" "}
            <span className="font-normal text-slate-500 text-sm">
              ({rows.length} kayıt)
            </span>
          </h3>
          <div className="flex gap-2 no-print">
            <Button kind="soft" onClick={() => exportFile("xlsx")}>
              <Download size={16} /> Excel
            </Button>
            <Button kind="soft" onClick={() => exportFile("pdf")}>
              <FileDown size={16} /> PDF
            </Button>
            <Button kind="soft" onClick={() => window.print()}>
              <Printer size={16} /> Yazdır
            </Button>
          </div>
        </div>
        <div className="table-wrap max-h-[650px] overflow-y-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Personel</th>
                <th>Tür</th>
                <th>Saat</th>
                <th>Kategori</th>
                <th>Durum</th>
                <th>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 1000).map((r, i) => (
                <tr key={i}>
                  <td>{r.tarih}</td>
                  <td>{r.personel}</td>
                  <td>{r.tur}</td>
                  <td>{r.saat}</td>
                  <td>{r.kategori}</td>
                  <td>{statusText(r.durum)}</td>
                  <td>{r.aciklama}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-500 py-12">
                    Rapor oluşturmak için filtreleri seçin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 1000 && (
          <p className="p-4 text-sm text-slate-500">
            Ekranda ilk 1000 kayıt gösterilir. İndirilen dosya tüm kayıtları
            içerir.
          </p>
        )}
      </div>
    </>
  );
}
function AuditView() {
  const [rows, R] = useState<
    {
      id: string;
      createdAt: string;
      actor?: { name: string; username: string };
      action: string;
      target: string;
      ip: string;
    }[]
  >([]);
  useEffect(() => {
    api<typeof rows>("/audit")
      .then(R)
      .catch(() => {});
  }, []);
  return (
    <div className="card table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Zaman</th>
            <th>Kullanıcı</th>
            <th>İşlem</th>
            <th>Hedef</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                {new Date(r.createdAt).toLocaleString("tr-TR", {
                  timeZone: "Europe/Istanbul",
                })}
              </td>
              <td>{r.actor?.name || "Sistem"}</td>
              <td>{r.action}</td>
              <td>{r.target || "—"}</td>
              <td>{r.ip || "—"}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={5}>Kayıt yok.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
