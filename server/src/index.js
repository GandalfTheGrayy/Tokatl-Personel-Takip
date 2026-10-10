import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw new Error("JWT_SECRET must contain at least 32 characters");
const db = new PrismaClient(),
  app = express(),
  production = process.env.NODE_ENV === "production";
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
const fail = (res, code, message) => res.status(code).json({ error: message });
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const dayFor = (date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const today = () => dayFor(new Date());
const clock = (date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  name: u.name,
  profilePhoto: u.profilePhoto || null,
  role: u.role.code,
  roleLabel: u.customRole?.active ? u.customRole.name : u.role.name,
  customRole: u.customRole
    ? {
        id: u.customRole.id,
        name: u.customRole.name,
        color: u.customRole.color,
        active: u.customRole.active,
      }
    : null,
  permissions: effectivePermissions(u),
  memberClass: u.memberClass || null,
  mustChangePassword: u.mustChangePassword,
  active: u.active,
});
const log = (req, action, target, detail) =>
  db.auditLogs
    .create({
      data: { actorId: req.user?.id, action, target, ip: req.ip, detail },
    })
    .catch((e) => console.error("audit error", e));
const roleCode = z.enum(["GOD", "ADMIN", "SUPERVISOR", "STAFF"]);
const memberClass = z.enum(["ACADEMY", "LORD"]);
const outingKind = z.enum(["OUTING", "PERMISSION"]);
const PERMISSION_GROUPS = [
  {
    id: "overview",
    name: "Genel görünüm",
    permissions: [
      ["dashboard.view", "Yönetim özetini görüntüleme"],
      ["presence.view", "Online ve mahalle durumunu görüntüleme"],
      ["rankings.view", "Tier List'i görüntüleme"],
    ],
  },
  {
    id: "outings",
    name: "Çıkış işlemleri",
    permissions: [
      ["outings.start", "Kendi canlı çıkışını başlatma ve dönüş yapma"],
      ["outings.history.create", "Kendi geçmiş tarihli kaydını girme"],
      ["outings.own.view", "Kendi çıkış geçmişini görme"],
      ["outings.view_all", "Tüm kişilerin çıkışlarını görme"],
      ["outings.approve", "Bekleyen çıkışları onaylama"],
      ["outings.reject", "Bekleyen çıkışları gerekçeli reddetme"],
    ],
  },
  {
    id: "users",
    name: "Kullanıcı yönetimi",
    permissions: [
      ["users.view", "Kullanıcı listesini görme"],
      ["users.create", "Yeni kullanıcı oluşturma"],
      ["users.edit_identity", "Ad, kullanıcı adı ve profil fotoğrafı düzenleme"],
      ["users.edit_role", "Sistem rolü ve özel rol atama"],
      ["users.edit_class", "Academy/Lord sınıfı atama"],
      ["users.edit_password", "Parola belirleme ve sıfırlama"],
      ["users.edit_status", "Hesabı etkinleştirme veya kapatma"],
      ["users.delete", "Hesabı ve ilişkili verileri kalıcı silme"],
    ],
  },
  {
    id: "roles",
    name: "Rol mimarisi",
    permissions: [
      ["roles.view", "Özel rolleri ve yetki kataloğunu görme"],
      ["roles.create", "Yeni özel rol oluşturma"],
      ["roles.edit", "Özel rol adını, rengini ve yetkilerini düzenleme"],
      ["roles.delete", "Özel rolü silme ve atamaları kaldırma"],
    ],
  },
  {
    id: "settings",
    name: "Sistem ayarları",
    permissions: [
      ["settings.branding", "Uygulama adı ve yüklenebilir logoyu düzenleme"],
      ["settings.outing_rules", "İzin türleri, akşam, seri ve sıralama kurallarını düzenleme"],
      ["settings.schedule", "Eski mesai ve izin kategorisi ayarlarını düzenleme"],
    ],
  },
  {
    id: "records",
    name: "Kayıt, rapor ve yedek",
    permissions: [
      ["audit.view", "İşlem kayıtlarını görme"],
      ["reports.view", "Rapor ekranını ve rapor verilerini görme"],
      ["reports.export", "XLSX/PDF rapor indirme"],
      ["backup.download", "Veritabanı yedeği indirme"],
    ],
  },
];
const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map(([key]) => key),
);
const BASE_ROLE_PERMISSIONS = {
  GOD: ALL_PERMISSIONS,
  ADMIN: [
    "dashboard.view",
    "presence.view",
    "rankings.view",
    "outings.start",
    "outings.history.create",
    "outings.own.view",
    "outings.view_all",
    "outings.approve",
    "outings.reject",
    "users.view",
    "users.create",
    "users.edit_identity",
    "users.edit_role",
    "users.edit_class",
    "users.edit_password",
    "users.edit_status",
    "reports.view",
    "reports.export",
    "audit.view",
    "backup.download",
  ],
  SUPERVISOR: [
    "dashboard.view",
    "presence.view",
    "rankings.view",
    "outings.start",
    "outings.history.create",
    "outings.own.view",
    "outings.view_all",
    "outings.approve",
    "outings.reject",
  ],
  STAFF: [
    "presence.view",
    "rankings.view",
    "outings.start",
    "outings.history.create",
    "outings.own.view",
  ],
};
const effectivePermissions = (user) => {
  if (user.role.code === "GOD") return ALL_PERMISSIONS;
  if (user.customRole)
    return user.customRole.active && Array.isArray(user.customRole.permissions)
      ? user.customRole.permissions.filter((key) => ALL_PERMISSIONS.includes(key))
      : [];
  return BASE_ROLE_PERMISSIONS[user.role.code] || [];
};
const hasPermission = (user, permission) =>
  user.role.code === "GOD" || effectivePermissions(user).includes(permission);
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9._-]{3,40}$/,
    "Kullanıcı adı 3-40 karakter olmalı; yalnızca küçük harf, rakam, nokta, tire ve alt çizgi kullanılabilir.",
  );
const profilePhoto = z
  .string()
  .regex(
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/,
    "Profil fotoğrafı PNG, JPG veya WebP olmalıdır.",
  )
  .max(350000, "Profil fotoğrafı çok büyük.")
  .nullable();
const cookieOptions = {
  httpOnly: true,
  secure: production,
  sameSite: "strict",
  path: "/",
};
const csrfOptions = { secure: production, sameSite: "strict", path: "/" };
function setSession(res, user, existingCsrf) {
  res.cookie(
    "session",
    jwt.sign(
      { sub: user.id, version: user.updatedAt.getTime() },
      process.env.JWT_SECRET,
      { expiresIn: "12h", issuer: "kurum-yoklama", audience: "kurum-yoklama" },
    ),
    { ...cookieOptions, maxAge: 12 * 3600 * 1000 },
  );
  const token = existingCsrf || randomBytes(32).toString("hex");
  res.cookie("csrf", token, { ...csrfOptions, maxAge: 12 * 3600 * 1000 });
  return token;
}
function clearSession(res) {
  res.clearCookie("session", cookieOptions);
  res.clearCookie("csrf", csrfOptions);
}
const auth = wrap(async (req, res, next) => {
  try {
    const payload = jwt.verify(req.cookies.session, process.env.JWT_SECRET, {
      issuer: "kurum-yoklama",
      audience: "kurum-yoklama",
    });
    const u = await db.user.findUnique({
      where: { id: payload.sub },
      include: { role: true, customRole: true, presence: true },
    });
    if (!u || !u.active || u.updatedAt.getTime() !== payload.version)
      return fail(res, 401, "Oturum geçersiz.");
    req.user = u;
    const now = new Date();
    if (
      !u.presence ||
      now.getTime() - u.presence.lastSeenAt.getTime() > 45000
    )
      db.presence
        .upsert({
          where: { userId: u.id },
          update: { lastSeenAt: now },
          create: { userId: u.id, lastSeenAt: now },
        })
        .catch((error) => console.error("presence error", error));
    next();
  } catch {
    return fail(res, 401, "Oturum açmanız gerekiyor.");
  }
});
const role =
  (...roles) =>
  (req, res, next) =>
    req.user.role.code === "GOD" ||
    (!req.user.customRole && roles.includes(req.user.role.code))
      ? next()
      : fail(res, 403, "Bu işlem için yetkiniz yok.");
const permit = (permission) => (req, res, next) =>
  hasPermission(req.user, permission)
    ? next()
    : fail(res, 403, "Bu işlem için yetkiniz yok.");
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  const host = req.get("host");
  if (origin) {
    try {
      if (new URL(origin).host !== host)
        return fail(res, 403, "İstek kaynağı geçersiz.");
    } catch {
      return fail(res, 403, "İstek kaynağı geçersiz.");
    }
  }
  if (["/api/auth/login", "/api/auth/register"].includes(req.path))
    return next();
  if (!req.path.startsWith("/api/")) return next();
  const a = req.cookies.csrf,
    b = req.get("x-csrf-token");
  if (
    !a ||
    !b ||
    a.length !== b.length ||
    !timingSafeEqual(Buffer.from(a), Buffer.from(b))
  )
    return fail(res, 403, "Güvenlik doğrulaması başarısız.");
  next();
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Çok fazla deneme. 15 dakika sonra tekrar deneyin." },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Çok fazla kayıt denemesi. Bir saat sonra tekrar deneyin.",
  },
});
app.post(
  "/api/auth/login",
  loginLimiter,
  wrap(async (req, res) => {
    const input = z
      .object({
        username: z.string().trim().toLowerCase().min(1),
        password: z.string().min(1),
      })
      .parse(req.body);
    const u = await db.user.findUnique({
      where: { username: input.username },
      include: { role: true, customRole: true },
    });
    if (
      !u ||
      !u.active ||
      !(await bcrypt.compare(input.password, u.passwordHash))
    ) {
      await log(req, "LOGIN_FAILED", input.username);
      return fail(res, 401, "Kullanıcı adı veya şifre hatalı.");
    }
    const csrf = setSession(res, u);
    await log({ ...req, user: u }, "LOGIN", u.id);
    res.json({ user: publicUser(u), csrf });
  }),
);
app.post(
  "/api/auth/register",
  registerLimiter,
  wrap(async (req, res) => {
    const x = z
      .object({
        username,
        name: z.string().trim().min(2).max(120),
        password: z.string().min(8).max(128),
        profilePhoto: profilePhoto.optional().default(null),
      })
      .parse(req.body);
    const staffRole = await db.role.findUnique({ where: { code: "STAFF" } });
    const u = await db.user.create({
      data: {
        username: x.username,
        name: x.name,
        profilePhoto: x.profilePhoto,
        passwordHash: await bcrypt.hash(x.password, 12),
        mustChangePassword: false,
        roleId: staffRole.id,
      },
      include: { role: true },
    });
    const csrf = setSession(res, u);
    await log({ ...req, user: u }, "PUBLIC_REGISTRATION", u.id, {
      username: u.username,
    });
    res.status(201).json({ user: publicUser(u), csrf });
  }),
);
app.get("/api/auth/me", auth, (req, res) =>
  res.json({ user: publicUser(req.user), csrf: req.cookies.csrf }),
);
app.post(
  "/api/auth/logout",
  auth,
  wrap(async (req, res) => {
    await log(req, "LOGOUT", req.user.id);
    clearSession(res);
    res.json({ ok: true });
  }),
);
app.post(
  "/api/auth/password",
  auth,
  wrap(async (req, res) => {
    const x = z
      .object({ current: z.string(), password: z.string().min(12).max(128) })
      .parse(req.body);
    if (!(await bcrypt.compare(x.current, req.user.passwordHash)))
      return fail(res, 400, "Mevcut şifre hatalı.");
    if (x.current === x.password)
      return fail(res, 400, "Yeni şifre farklı olmalı.");
    await db.user.update({
      where: { id: req.user.id },
      data: {
        passwordHash: await bcrypt.hash(x.password, 12),
        mustChangePassword: false,
      },
    });
    await log(req, "PASSWORD_CHANGED", req.user.id);
    clearSession(res);
    res.json({ ok: true });
  }),
);
app.get(
  "/api/public/branding",
  wrap(async (req, res) => {
    const s = await db.settings.findUnique({ where: { id: 1 } });
    res.json({
      institutionName: s?.institutionName || "Tokatlı Next Gen",
      logoData: s?.logoData || null,
    });
  }),
);
app.use("/api", auth, (req, res, next) =>
  req.user.mustChangePassword
    ? fail(res, 403, "Önce şifrenizi değiştirin.")
    : next(),
);
app.get(
  "/api/bootstrap",
  wrap(async (req, res) => {
    const [settings, schedule, pending] = await Promise.all([
      db.settings.findUnique({ where: { id: 1 } }),
      db.workSchedule.findUnique({ where: { id: 1 } }),
      hasPermission(req.user, "outings.view_all")
        ? db.outing.count({ where: { status: "PENDING" } })
        : Promise.resolve(0),
    ]);
    res.json({ settings, schedule, pending, today: today() });
  }),
);

const outingDuration = (outing, now = new Date(), capHours) => {
  const end = outing.endedAt || now;
  const minutes = Math.max(
    0,
    Math.round((end.getTime() - outing.startedAt.getTime()) / 60000),
  );
  return capHours ? Math.min(minutes, capHours * 60) : minutes;
};
const outingView = (outing, capHours) => ({
  ...outing,
  durationMinutes: outingDuration(outing, new Date(), capHours),
});
async function notifyManagers(message) {
  const managers = await db.user.findMany({
    where: { active: true },
    include: { role: true, customRole: true },
  });
  const recipients = managers.filter(
    (manager) =>
      hasPermission(manager, "outings.approve") ||
      hasPermission(manager, "outings.reject"),
  );
  if (recipients.length)
    await db.notifications.createMany({
      data: recipients.map((manager) => ({ userId: manager.id, message })),
    });
}
async function validateOutingCategory(kind, category) {
  if (kind !== "PERMISSION") return null;
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (!category || !settings.permissionCategories.includes(category))
    throw Error("İzin kategorisi geçersiz.");
  return category;
}

app.get(
  "/api/outings/me",
  permit("outings.own.view"),
  wrap(async (req, res) => {
    const settings = await db.settings.findUnique({ where: { id: 1 } });
    const [active, history] = await Promise.all([
      db.outing.findFirst({
        where: {
          userId: req.user.id,
          status: { in: ["PENDING", "APPROVED"] },
          endedAt: null,
        },
        include: { approvedBy: { select: { name: true } } },
        orderBy: { startedAt: "desc" },
      }),
      db.outing.findMany({
        where: { userId: req.user.id },
        include: { approvedBy: { select: { name: true } } },
        orderBy: { startedAt: "desc" },
        take: 120,
      }),
    ]);
    res.json({
      active: active ? outingView(active, settings.maxOpenOutingHours) : null,
      history: history.map((row) =>
        outingView(row, settings.maxOpenOutingHours),
      ),
    });
  }),
);
app.post(
  "/api/outings/start",
  permit("outings.start"),
  wrap(async (req, res) => {
    const x = z
      .object({
        kind: outingKind.default("OUTING"),
        category: z.string().trim().max(100).nullable().optional(),
        note: z.string().trim().max(1000).default(""),
      })
      .parse(req.body);
    const category = await validateOutingCategory(x.kind, x.category);
    const now = new Date();
    const outing = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${req.user.id}))`;
      const open = await tx.outing.findFirst({
        where: {
          userId: req.user.id,
          status: { in: ["PENDING", "APPROVED"] },
          endedAt: null,
        },
      });
      if (open) return null;
      return tx.outing.create({
        data: {
          userId: req.user.id,
          day: dayFor(now),
          startedAt: now,
          kind: x.kind,
          category,
          note: x.note,
        },
      });
    });
    if (!outing) return fail(res, 409, "Önce açık çıkış kaydınızı kapatın.");
    await Promise.all([
      log(req, "OUTING_STARTED", outing.id, { kind: x.kind, category }),
      notifyManagers(`${req.user.name} yeni bir çıkış onayı bekliyor.`),
    ]);
    res.status(201).json(outingView(outing));
  }),
);
app.post(
  "/api/outings/historical",
  permit("outings.history.create"),
  wrap(async (req, res) => {
    const x = z
      .object({
        startedAt: z.coerce.date(),
        endedAt: z.coerce.date(),
        kind: outingKind.default("OUTING"),
        category: z.string().trim().max(100).nullable().optional(),
        note: z.string().trim().max(1000).default(""),
      })
      .parse(req.body);
    const settings = await db.settings.findUnique({ where: { id: 1 } });
    if (!settings.allowHistoricalEntries)
      return fail(res, 403, "Geçmiş tarihli kayıt girişi kapalı.");
    const now = new Date();
    if (dayFor(x.startedAt).slice(0, 4) !== today().slice(0, 4))
      return fail(
        res,
        400,
        "Yalnızca içinde bulunduğumuz yıla kayıt girilebilir.",
      );
    if (x.startedAt > now || x.endedAt > now)
      return fail(res, 400, "Geçmiş kayıt saatleri gelecekte olamaz.");
    if (x.endedAt <= x.startedAt)
      return fail(res, 400, "Dönüş zamanı çıkıştan sonra olmalıdır.");
    if (
      (x.endedAt.getTime() - x.startedAt.getTime()) / 3600000 >
      settings.maxOpenOutingHours
    )
      return fail(
        res,
        400,
        `Bir kayıt en fazla ${settings.maxOpenOutingHours} saat olabilir.`,
      );
    const category = await validateOutingCategory(x.kind, x.category);
    const outing = await db.outing.create({
      data: {
        userId: req.user.id,
        day: dayFor(x.startedAt),
        startedAt: x.startedAt,
        endedAt: x.endedAt,
        kind: x.kind,
        category,
        note: x.note,
        source: "HISTORICAL",
      },
    });
    await Promise.all([
      log(req, "HISTORICAL_OUTING_CREATED", outing.id),
      notifyManagers(`${req.user.name} geçmiş tarihli bir kayıt gönderdi.`),
    ]);
    res.status(201).json(outingView(outing));
  }),
);
app.post(
  "/api/outings/:id/return",
  permit("outings.start"),
  wrap(async (req, res) => {
    const outing = await db.outing.findUnique({ where: { id: req.params.id } });
    if (!outing || outing.userId !== req.user.id)
      return fail(res, 404, "Açık çıkış kaydı bulunamadı.");
    if (outing.endedAt) return fail(res, 409, "Bu çıkış zaten kapatılmış.");
    if (outing.status === "REJECTED")
      return fail(res, 409, "Reddedilen kayıt kapatılamaz.");
    const updated = await db.outing.update({
      where: { id: outing.id },
      data: { endedAt: new Date() },
    });
    await log(req, "OUTING_RETURNED", outing.id, {
      durationMinutes: outingDuration(updated),
    });
    res.json(outingView(updated));
  }),
);
app.delete(
  "/api/outings/:id",
  permit("outings.start"),
  wrap(async (req, res) => {
    const outing = await db.outing.findUnique({ where: { id: req.params.id } });
    if (!outing || outing.userId !== req.user.id)
      return fail(res, 404, "Kayıt bulunamadı.");
    if (outing.status !== "PENDING")
      return fail(res, 409, "Yalnızca onay bekleyen kayıt silinebilir.");
    await db.outing.delete({ where: { id: outing.id } });
    await log(req, "OUTING_CANCELLED", outing.id);
    res.json({ ok: true });
  }),
);
app.get(
  "/api/outings/manage",
  permit("outings.view_all"),
  wrap(async (req, res) => {
    const q = z
      .object({
        status: z
          .enum(["PENDING", "APPROVED", "REJECTED", "ALL"])
          .default("PENDING"),
        year: z
          .string()
          .regex(/^\d{4}$/)
          .default(today().slice(0, 4)),
      })
      .parse(req.query);
    const rows = await db.outing.findMany({
      where: {
        day: { gte: `${q.year}-01-01`, lte: `${q.year}-12-31` },
        ...(q.status === "ALL" ? {} : { status: q.status }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            profilePhoto: true,
            memberClass: true,
          },
        },
        approvedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    const settings = await db.settings.findUnique({ where: { id: 1 } });
    res.json({
      rows: rows.map((row) => outingView(row, settings.maxOpenOutingHours)),
    });
  }),
);
app.post(
  "/api/outings/:id/decision",
  wrap(async (req, res) => {
    const x = z
      .object({
        decision: z.enum(["APPROVED", "REJECTED"]),
        reason: z.string().trim().max(1000).default(""),
      })
      .parse(req.body);
    const requiredPermission =
      x.decision === "APPROVED" ? "outings.approve" : "outings.reject";
    if (!hasPermission(req.user, requiredPermission))
      return fail(res, 403, "Bu karar için yetkiniz yok.");
    if (x.decision === "REJECTED" && !x.reason)
      return fail(res, 400, "Ret gerekçesi zorunludur.");
    const outing = await db.outing.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { name: true } } },
    });
    if (!outing || outing.status !== "PENDING")
      return fail(res, 409, "Onay bekleyen kayıt bulunamadı.");
    if (outing.userId === req.user.id)
      return fail(res, 403, "Kendi çıkış kaydınızı onaylayamazsınız.");
    const updated = await db.$transaction(async (tx) => {
      const applied = await tx.outing.updateMany({
        where: { id: outing.id, status: "PENDING" },
        data: {
          status: x.decision,
          decisionNote: x.reason || null,
          approvedById: req.user.id,
          approvedAt: new Date(),
          endedAt:
            x.decision === "REJECTED" && !outing.endedAt
              ? new Date()
              : undefined,
        },
      });
      if (applied.count !== 1)
        throw Error("Kayıt başka bir yetkili tarafından işlendi.");
      return tx.outing.findUnique({ where: { id: outing.id } });
    });
    await Promise.all([
      db.notifications.create({
        data: {
          userId: outing.userId,
          message: `Çıkış kaydınız ${x.decision === "APPROVED" ? "onaylandı" : "reddedildi"}.${x.reason ? ` Gerekçe: ${x.reason}` : ""}`,
        },
      }),
      log(req, "OUTING_DECIDED", outing.id, {
        decision: x.decision,
        reason: x.reason,
      }),
    ]);
    res.json(outingView(updated));
  }),
);
app.get(
  "/api/outings/overview",
  permit("dashboard.view"),
  wrap(async (_req, res) => {
    const day = today();
    const [outsideNow, pending, approvedToday, people, settings] =
      await Promise.all([
        db.outing.count({ where: { status: "APPROVED", endedAt: null } }),
        db.outing.count({ where: { status: "PENDING" } }),
        db.outing.findMany({
          where: { day, status: "APPROVED" },
        }),
        db.user.count({ where: { active: true, memberClass: { not: null } } }),
        db.settings.findUnique({ where: { id: 1 } }),
      ]);
    res.json({
      outsideNow,
      pending,
      approvedToday: approvedToday.length,
      people,
      minutesToday: approvedToday.reduce(
        (sum, row) =>
          sum + outingDuration(row, new Date(), settings.maxOpenOutingHours),
        0,
      ),
    });
  }),
);
app.get(
  "/api/rankings",
  permit("rankings.view"),
  wrap(async (_req, res) => {
    const settings = await db.settings.findUnique({ where: { id: 1 } });
    const from = new Date(
      Date.now() - (settings.rankingWindowDays - 1) * 86400000,
    );
    const fromDay = dayFor(from);
    const [users, outings] = await Promise.all([
      db.user.findMany({
        where: { active: true, memberClass: { not: null } },
        select: {
          id: true,
          name: true,
          username: true,
          profilePhoto: true,
          memberClass: true,
        },
      }),
      db.outing.findMany({
        where: { status: "APPROVED", day: { gte: fromDay } },
      }),
    ]);
    const byUser = new Map(
      users.map((user) => [
        user.id,
        {
          ...user,
          durationMinutes: 0,
          outingDays: new Set(),
          eveningCount: 0,
          permissionCount: 0,
        },
      ]),
    );
    for (const outing of outings) {
      const row = byUser.get(outing.userId);
      if (!row) continue;
      const minutes = outingDuration(
        outing,
        new Date(),
        settings.maxOpenOutingHours,
      );
      row.durationMinutes += minutes;
      if (minutes >= settings.streakMinMinutes) row.outingDays.add(outing.day);
      if (clock(outing.startedAt) >= settings.eveningStartTime)
        row.eveningCount += 1;
      if (outing.kind === "PERMISSION") row.permissionCount += 1;
    }
    const consecutive = (days) => {
      const sorted = [...days].sort();
      let longest = 0,
        current = 0,
        previous = null;
      for (const day of sorted) {
        const stamp = new Date(`${day}T12:00:00Z`).getTime();
        current =
          previous !== null && stamp - previous === 86400000 ? current + 1 : 1;
        longest = Math.max(longest, current);
        previous = stamp;
      }
      return longest;
    };
    const rows = [...byUser.values()].map((row) => ({
      id: row.id,
      name: row.name,
      username: row.username,
      profilePhoto: row.profilePhoto,
      memberClass: row.memberClass,
      durationMinutes: row.durationMinutes,
      outingDays: row.outingDays.size,
      streak: consecutive(row.outingDays),
      eveningCount: row.eveningCount,
      permissionCount: row.permissionCount,
    }));
    res.json({
      rows,
      periodDays: settings.rankingWindowDays,
      eveningStartTime: settings.eveningStartTime,
      streakMinMinutes: settings.streakMinMinutes,
    });
  }),
);
function arrival(now, s) {
  const [h, m] = s.startTime.split(":").map(Number),
    [nh, nm] = clock(now).split(":").map(Number),
    delta = nh * 60 + nm - h * 60 - m;
  return delta <= s.toleranceMinutes
    ? "ON_TIME"
    : delta <= s.veryLateMinutes
      ? "LATE"
      : "VERY_LATE";
}
app.get(
  "/api/my/today",
  role("STAFF"),
  wrap(async (req, res) => {
    const day = today();
    const [attendance, leave] = await Promise.all([
      db.attendance.findUnique({
        where: { userId_day: { userId: req.user.id, day } },
      }),
      db.leaveRequests.findUnique({
        where: { userId_day: { userId: req.user.id, day } },
      }),
    ]);
    res.json({ attendance, leave, day });
  }),
);
app.post(
  "/api/my/attendance",
  role("STAFF"),
  wrap(async (req, res) => {
    const { note } = z
        .object({ note: z.string().max(1000).default("") })
        .parse(req.body),
      day = today();
    const schedule = await db.workSchedule.findUnique({ where: { id: 1 } });
    const result = await db.$transaction(async (tx) => {
      if (
        await tx.leaveRequests.findUnique({
          where: { userId_day: { userId: req.user.id, day } },
        })
      )
        throw Error("Bugün için izin talebi var.");
      const existing = await tx.attendance.findUnique({
        where: { userId_day: { userId: req.user.id, day } },
      });
      if (existing && existing.status !== "PENDING")
        throw Error("Karara bağlanan kayıt değiştirilemez.");
      return existing
        ? tx.attendance.update({ where: { id: existing.id }, data: { note } })
        : tx.attendance.create({
            data: {
              userId: req.user.id,
              day,
              note,
              checkedInAt: new Date(),
              arrival: arrival(new Date(), schedule),
            },
          });
    });
    await log(req, "ATTENDANCE_SAVED", result.id);
    res.json(result);
  }),
);
app.post(
  "/api/my/leave",
  role("STAFF"),
  wrap(async (req, res) => {
    const x = z
        .object({
          category: z.string().min(1).max(100),
          note: z.string().max(1000).default(""),
        })
        .parse(req.body),
      day = today();
    const settings = await db.settings.findUnique({ where: { id: 1 } });
    if (!settings.leaveCategories.includes(x.category))
      return fail(res, 400, "İzin kategorisi geçersiz.");
    if (x.category === "Diğer" && !x.note.trim())
      return fail(res, 400, "Diğer kategorisi için açıklama zorunludur.");
    const result = await db.$transaction(async (tx) => {
      if (
        await tx.attendance.findUnique({
          where: { userId_day: { userId: req.user.id, day } },
        })
      )
        throw Error("Bugün için yoklama kaydı var.");
      const existing = await tx.leaveRequests.findUnique({
        where: { userId_day: { userId: req.user.id, day } },
      });
      if (existing && existing.status !== "PENDING")
        throw Error("Karara bağlanan talep değiştirilemez.");
      return existing
        ? tx.leaveRequests.update({ where: { id: existing.id }, data: x })
        : tx.leaveRequests.create({ data: { userId: req.user.id, day, ...x } });
    });
    await log(req, "LEAVE_SAVED", result.id);
    res.json(result);
  }),
);
app.get(
  "/api/my/history",
  role("STAFF"),
  wrap(async (req, res) => {
    const [attendance, leaves] = await Promise.all([
      db.attendance.findMany({
        where: { userId: req.user.id },
        orderBy: { day: "desc" },
        take: 180,
      }),
      db.leaveRequests.findMany({
        where: { userId: req.user.id },
        orderBy: { day: "desc" },
        take: 180,
      }),
    ]);
    res.json({ attendance, leaves });
  }),
);
app.get(
  "/api/calendar",
  wrap(async (req, res) => {
    const month = z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
        .parse(req.query.month),
      from = `${month}-01`,
      to = `${month}-31`;
    const filter =
      req.user.role.code === "STAFF" ? { userId: req.user.id } : {};
    const [attendance, leaves] = await Promise.all([
      db.attendance.findMany({
        where: { day: { gte: from, lte: to }, ...filter },
        include: { user: { select: { name: true } } },
      }),
      db.leaveRequests.findMany({
        where: { day: { gte: from, lte: to }, ...filter },
        include: { user: { select: { name: true } } },
      }),
    ]);
    res.json({ attendance, leaves });
  }),
);
app.get(
  "/api/approvals",
  role("SUPERVISOR", "ADMIN"),
  wrap(async (req, res) => {
    const day = today();
    const [attendance, leaves] = await Promise.all([
      db.attendance.findMany({
        where: { day: { gte: `${day.slice(0, 7)}-01` } },
        include: { user: { select: { name: true, username: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.leaveRequests.findMany({
        where: { day: { gte: `${day.slice(0, 7)}-01` } },
        include: { user: { select: { name: true, username: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);
    res.json({
      records: [
        ...attendance.map((a) => ({ ...a, type: "ATTENDANCE" })),
        ...leaves.map((l) => ({ ...l, type: "LEAVE" })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  }),
);
app.post(
  "/api/approvals/:type/:id",
  role("SUPERVISOR", "ADMIN"),
  wrap(async (req, res) => {
    const type = z.enum(["attendance", "leave"]).parse(req.params.type),
      x = z
        .object({
          decision: z.enum(["APPROVED", "REJECTED"]),
          reason: z.string().max(1000).default(""),
        })
        .parse(req.body);
    if (x.decision === "REJECTED" && !x.reason.trim())
      return fail(res, 400, "Ret gerekçesi zorunludur.");
    const model = type === "attendance" ? "attendance" : "leaveRequests";
    const result = await db.$transaction(async (tx) => {
      const row = await tx[model].findUnique({ where: { id: req.params.id } });
      if (!row || row.status !== "PENDING")
        throw Error("Bekleyen kayıt bulunamadı.");
      const updated = await tx[model].updateMany({
        where: { id: row.id, status: "PENDING" },
        data: { status: x.decision },
      });
      if (updated.count !== 1)
        throw Error("Kayıt başka bir amir tarafından işlendi.");
      await tx.approvals.create({
        data: {
          actorId: req.user.id,
          attendanceId: type === "attendance" ? row.id : null,
          leaveId: type === "leave" ? row.id : null,
          decision: x.decision,
          reason: x.reason || null,
        },
      });
      await tx.notifications.create({
        data: {
          userId: row.userId,
          message: `${type === "attendance" ? "Yoklama" : "İzin"} kaydınız ${x.decision === "APPROVED" ? "onaylandı" : "reddedildi"}.${x.reason ? ` Gerekçe: ${x.reason}` : ""}`,
        },
      });
      return row;
    });
    await log(req, "APPROVAL_DECIDED", result.id, {
      type,
      decision: x.decision,
    });
    res.json({ ok: true });
  }),
);
app.get(
  "/api/notifications",
  wrap(async (req, res) =>
    res.json(
      await db.notifications.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ),
  ),
);
app.post(
  "/api/notifications/read",
  wrap(async (req, res) => {
    await db.notifications.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  }),
);
app.post(
  "/api/presence/ping",
  wrap(async (req, res) => {
    const lastSeenAt = new Date();
    await db.presence.upsert({
      where: { userId: req.user.id },
      update: { lastSeenAt },
      create: { userId: req.user.id, lastSeenAt },
    });
    res.json({ ok: true, lastSeenAt });
  }),
);
app.get(
  "/api/presence",
  permit("presence.view"),
  wrap(async (req, res) => {
    const now = new Date();
    const onlineAfter = new Date(now.getTime() - 2 * 60 * 1000);
    const users = await db.user.findMany({
      where: { active: true },
      include: {
        role: true,
        customRole: true,
        presence: true,
        outings: {
          where: {
            status: { in: ["PENDING", "APPROVED"] },
            endedAt: null,
          },
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });
    const rows = users.map((user) => {
      const openOuting = user.outings[0] || null;
      const lastSeenAt =
        user.id === req.user.id ? now : user.presence?.lastSeenAt || null;
      return {
        id: user.id,
        name: user.name,
        username: user.username,
        profilePhoto: user.profilePhoto,
        roleLabel: user.customRole?.active ? user.customRole.name : user.role.name,
        roleColor: user.customRole?.active ? user.customRole.color : null,
        memberClass: user.memberClass,
        lastSeenAt,
        online: !!lastSeenAt && lastSeenAt >= onlineAfter,
        location: openOuting ? "OUTSIDE" : "IN_NEIGHBORHOOD",
        outing: openOuting
          ? {
              id: openOuting.id,
              status: openOuting.status,
              startedAt: openOuting.startedAt,
              kind: openOuting.kind,
              category: openOuting.category,
            }
          : null,
      };
    });
    res.json({
      rows,
      generatedAt: now,
      onlineWindowSeconds: 120,
    });
  }),
);

const customRoleInput = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(300).default(""),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  permissions: z
    .array(
      z.string().refine((key) => ALL_PERMISSIONS.includes(key), {
        message: "Geçersiz yetki.",
      }),
    )
    .max(ALL_PERMISSIONS.length),
  active: z.boolean().default(true),
});
app.get(
  "/api/roles",
  permit("roles.view"),
  wrap(async (_req, res) => {
    const roles = await db.customRole.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json({ catalog: PERMISSION_GROUPS, roles });
  }),
);
app.post(
  "/api/roles",
  permit("roles.create"),
  wrap(async (req, res) => {
    const input = customRoleInput.parse(req.body);
    const role = await db.customRole.create({
      data: {
        ...input,
        permissions: [...new Set(input.permissions)],
      },
      include: { _count: { select: { users: true } } },
    });
    await log(req, "CUSTOM_ROLE_CREATED", role.id, {
      name: role.name,
      permissions: input.permissions,
    });
    res.status(201).json(role);
  }),
);
app.patch(
  "/api/roles/:id",
  permit("roles.edit"),
  wrap(async (req, res) => {
    const input = customRoleInput.parse(req.body);
    const role = await db.customRole.update({
      where: { id: req.params.id },
      data: {
        ...input,
        permissions: [...new Set(input.permissions)],
      },
      include: { _count: { select: { users: true } } },
    });
    await log(req, "CUSTOM_ROLE_UPDATED", role.id, {
      name: role.name,
      permissions: input.permissions,
      active: input.active,
    });
    res.json(role);
  }),
);
app.delete(
  "/api/roles/:id",
  permit("roles.delete"),
  wrap(async (req, res) => {
    const target = await db.customRole.findUnique({
      where: { id: req.params.id },
    });
    if (!target) return fail(res, 404, "Rol bulunamadı.");
    await db.$transaction([
      db.user.updateMany({
        where: { customRoleId: target.id },
        data: { customRoleId: null },
      }),
      db.customRole.delete({ where: { id: target.id } }),
    ]);
    await log(req, "CUSTOM_ROLE_DELETED", target.id, { name: target.name });
    res.json({ ok: true });
  }),
);
app.get(
  "/api/role-options",
  permit("users.view"),
  wrap(async (_req, res) =>
    res.json(
      await db.customRole.findMany({
        where: { active: true },
        select: { id: true, name: true, color: true },
        orderBy: { name: "asc" },
      }),
    ),
  ),
);
app.get(
  "/api/dashboard",
  permit("dashboard.view"),
  wrap(async (req, res) => {
    const day = today();
    const [users, present, leave, pendingAttendance, pendingLeaves, late] =
      await Promise.all([
        db.user.count({ where: { active: true, role: { code: "STAFF" } } }),
        db.attendance.count({ where: { day, status: "APPROVED" } }),
        db.leaveRequests.count({ where: { day, status: "APPROVED" } }),
        db.attendance.count({ where: { day, status: "PENDING" } }),
        db.leaveRequests.count({ where: { day, status: "PENDING" } }),
        db.attendance.count({
          where: {
            day,
            status: "APPROVED",
            arrival: { in: ["LATE", "VERY_LATE"] },
          },
        }),
      ]);
    res.json({
      users,
      present,
      leave,
      absent: Math.max(0, users - present - leave),
      late,
      pending: pendingAttendance + pendingLeaves,
    });
  }),
);
app.get(
  "/api/users",
  permit("users.view"),
  wrap(async (req, res) => {
    const list = await db.user.findMany({
      include: { role: true, customRole: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(list.map(publicUser));
  }),
);
app.post(
  "/api/users",
  permit("users.create"),
  wrap(async (req, res) => {
    const x = z
      .object({
        username,
        name: z.string().trim().min(2).max(120),
        role: roleCode.default("STAFF"),
        customRoleId: z.string().uuid().nullable().optional().default(null),
        memberClass: memberClass.nullable().optional().default(null),
        password: z.string().min(8).max(128).optional(),
        profilePhoto: profilePhoto.optional().default(null),
      })
      .parse(req.body);
    if (x.role === "GOD" && req.user.role.code !== "GOD")
      return fail(
        res,
        403,
        "Tanrı rolünü yalnızca Tanrı yetkisine sahip kullanıcı verebilir.",
      );
    if (
      (x.role !== "STAFF" || x.customRoleId) &&
      !hasPermission(req.user, "users.edit_role")
    )
      return fail(res, 403, "Rol atama yetkiniz yok.");
    if (
      x.memberClass &&
      !hasPermission(req.user, "users.edit_class")
    )
      return fail(res, 403, "Sınıf atama yetkiniz yok.");
    if (x.password && !hasPermission(req.user, "users.edit_password"))
      return fail(res, 403, "Parola belirleme yetkiniz yok.");
    if (x.customRoleId) {
      const customRole = await db.customRole.findUnique({
        where: { id: x.customRoleId },
      });
      if (!customRole) return fail(res, 400, "Özel rol bulunamadı.");
    }
    const password = x.password || randomBytes(15).toString("base64url");
    const r = await db.role.findUnique({ where: { code: x.role } });
    const u = await db.user.create({
      data: {
        username: x.username,
        name: x.name,
        profilePhoto: x.profilePhoto,
        memberClass: x.memberClass,
        customRoleId: x.customRoleId,
        roleId: r.id,
        passwordHash: await bcrypt.hash(password, 12),
        mustChangePassword: !x.password,
      },
      include: { role: true, customRole: true },
    });
    await log(req, "USER_CREATED", u.id, {
      username: u.username,
      role: x.role,
    });
    res.status(201).json({
      user: publicUser(u),
      temporaryPassword: x.password ? null : password,
    });
  }),
);
app.patch(
  "/api/users/:id",
  permit("users.view"),
  wrap(async (req, res) => {
    const x = z
      .object({
        username: username.optional(),
        name: z.string().trim().min(2).max(120).optional(),
        role: roleCode.optional(),
        customRoleId: z.string().uuid().nullable().optional(),
        memberClass: memberClass.nullable().optional(),
        active: z.boolean().optional(),
        password: z.string().min(8).max(128).optional(),
        profilePhoto: profilePhoto.optional(),
      })
      .parse(req.body);
    const target = await db.user.findUnique({
      where: { id: req.params.id },
      include: { role: true, customRole: true },
    });
    if (!target) return fail(res, 404, "Kullanıcı bulunamadı.");
    const identityChanged =
      (x.username !== undefined && x.username !== target.username) ||
      (x.name !== undefined && x.name !== target.name) ||
      (x.profilePhoto !== undefined && x.profilePhoto !== target.profilePhoto);
    const roleChanged =
      (x.role !== undefined && x.role !== target.role.code) ||
      (x.customRoleId !== undefined && x.customRoleId !== target.customRoleId);
    const classChanged =
      x.memberClass !== undefined && x.memberClass !== target.memberClass;
    const statusChanged = x.active !== undefined && x.active !== target.active;
    const checks = [
      [identityChanged, "users.edit_identity", "Kimlik bilgilerini düzenleme"],
      [roleChanged, "users.edit_role", "Rol atama"],
      [classChanged, "users.edit_class", "Sınıf atama"],
      [!!x.password, "users.edit_password", "Parola düzenleme"],
      [statusChanged, "users.edit_status", "Hesap durumu düzenleme"],
    ];
    for (const [changed, permission, label] of checks)
      if (changed && !hasPermission(req.user, permission))
        return fail(res, 403, `${label} yetkiniz yok.`);
    if (
      (target.role.code === "GOD" || x.role === "GOD") &&
      req.user.role.code !== "GOD"
    )
      return fail(
        res,
        403,
        "Tanrı hesabını yalnızca Tanrı yetkisine sahip kullanıcı düzenleyebilir.",
      );
    if (
      req.params.id === req.user.id &&
      (x.active === false ||
        (x.role && x.role !== req.user.role.code) ||
        (x.customRoleId !== undefined &&
          x.customRoleId !== req.user.customRoleId))
    )
      return fail(
        res,
        400,
        "Kendi hesabınızın rolünü, özel rolünü veya aktiflik durumunu değiştiremezsiniz.",
      );
    const r = x.role
      ? await db.role.findUnique({ where: { code: x.role } })
      : null;
    if (x.customRoleId) {
      const customRole = await db.customRole.findUnique({
        where: { id: x.customRoleId },
      });
      if (!customRole) return fail(res, 400, "Özel rol bulunamadı.");
    }
    const u = await db.user.update({
      where: { id: req.params.id },
      data: {
        username: x.username,
        name: x.name,
        profilePhoto: x.profilePhoto,
        active: x.active,
        memberClass: x.memberClass,
        customRoleId: x.customRoleId,
        roleId: r?.id,
        passwordHash: x.password
          ? await bcrypt.hash(x.password, 12)
          : undefined,
        mustChangePassword: x.password ? false : undefined,
      },
      include: { role: true, customRole: true },
    });
    if (u.id === req.user.id) setSession(res, u, req.cookies.csrf);
    await log(req, "USER_UPDATED", u.id, {
      username: x.username,
      name: x.name,
      role: x.role,
      customRoleId: x.customRoleId,
      memberClass: x.memberClass,
      active: x.active,
      passwordChanged: !!x.password,
      profilePhotoChanged: x.profilePhoto !== undefined,
    });
    res.json(publicUser(u));
  }),
);
app.delete(
  "/api/users/:id",
  permit("users.delete"),
  wrap(async (req, res) => {
    if (req.params.id === req.user.id)
      return fail(res, 400, "Kendi hesabınızı silemezsiniz.");
    const target = await db.user.findUnique({
      where: { id: req.params.id },
      include: { role: true },
    });
    if (!target) return fail(res, 404, "Kullanıcı bulunamadı.");
    if (target.role.code === "GOD" && req.user.role.code !== "GOD")
      return fail(res, 403, "Tanrı hesabını silemezsiniz.");
    await db.$transaction(async (tx) => {
      const [attendance, leaves] = await Promise.all([
        tx.attendance.findMany({
          where: { userId: target.id },
          select: { id: true },
        }),
        tx.leaveRequests.findMany({
          where: { userId: target.id },
          select: { id: true },
        }),
      ]);
      await tx.approvals.deleteMany({
        where: {
          OR: [
            { actorId: target.id },
            { attendanceId: { in: attendance.map((x) => x.id) } },
            { leaveId: { in: leaves.map((x) => x.id) } },
          ],
        },
      });
      await tx.notifications.deleteMany({ where: { userId: target.id } });
      await tx.outing.deleteMany({ where: { userId: target.id } });
      await tx.attendance.deleteMany({ where: { userId: target.id } });
      await tx.leaveRequests.deleteMany({ where: { userId: target.id } });
      await tx.user.delete({ where: { id: target.id } });
    });
    await log(req, "USER_PERMANENTLY_DELETED", target.id, {
      username: target.username,
      role: target.role.code,
    });
    res.json({ ok: true });
  }),
);
app.post(
  "/api/users/:id/reset",
  permit("users.edit_password"),
  wrap(async (req, res) => {
    const target = await db.user.findUnique({
      where: { id: req.params.id },
      include: { role: true },
    });
    if (!target) return fail(res, 404, "Kullanıcı bulunamadı.");
    if (target.role.code === "GOD" && req.user.role.code !== "GOD")
      return fail(
        res,
        403,
        "Tanrı hesabının şifresini yalnızca Tanrı yetkisine sahip kullanıcı değiştirebilir.",
      );
    const password = randomBytes(15).toString("base64url");
    await db.user.update({
      where: { id: req.params.id },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        mustChangePassword: true,
      },
    });
    await log(req, "PASSWORD_RESET", req.params.id);
    res.json({ temporaryPassword: password });
  }),
);
app.put(
  "/api/settings",
  wrap(async (req, res) => {
    if (
      ![
        "settings.branding",
        "settings.outing_rules",
        "settings.schedule",
      ].some((permission) => hasPermission(req.user, permission))
    )
      return fail(res, 403, "Sistem ayarlarını düzenleme yetkiniz yok.");
    const x = z
      .object({
        institutionName: z.string().min(2).max(100),
        logoData: z
          .string()
          .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
          .max(350000)
          .nullable(),
        leaveCategories: z
          .array(z.string().trim().min(2).max(100))
          .min(1)
          .max(30),
        permissionCategories: z
          .array(z.string().trim().min(2).max(100))
          .min(1)
          .max(30),
        eveningStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        streakMinMinutes: z.number().int().min(1).max(1440),
        rankingWindowDays: z.number().int().min(7).max(365),
        maxOpenOutingHours: z.number().int().min(1).max(72),
        allowHistoricalEntries: z.boolean(),
        startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        toleranceMinutes: z.number().int().min(0).max(120),
        veryLateMinutes: z.number().int().min(1).max(240),
      })
      .parse(req.body);
    if (x.startTime >= x.endTime || x.veryLateMinutes <= x.toleranceMinutes)
      return fail(res, 400, "Mesai saatleri veya tolerans geçersiz.");
    const [currentSettings, currentSchedule] = await Promise.all([
      db.settings.findUnique({ where: { id: 1 } }),
      db.workSchedule.findUnique({ where: { id: 1 } }),
    ]);
    const brandingChanged =
      x.institutionName !== currentSettings.institutionName ||
      x.logoData !== currentSettings.logoData;
    const outingRulesChanged =
      JSON.stringify(x.permissionCategories) !==
        JSON.stringify(currentSettings.permissionCategories) ||
      x.eveningStartTime !== currentSettings.eveningStartTime ||
      x.streakMinMinutes !== currentSettings.streakMinMinutes ||
      x.rankingWindowDays !== currentSettings.rankingWindowDays ||
      x.maxOpenOutingHours !== currentSettings.maxOpenOutingHours ||
      x.allowHistoricalEntries !== currentSettings.allowHistoricalEntries;
    const scheduleChanged =
      JSON.stringify(x.leaveCategories) !==
        JSON.stringify(currentSettings.leaveCategories) ||
      x.startTime !== currentSchedule.startTime ||
      x.endTime !== currentSchedule.endTime ||
      x.toleranceMinutes !== currentSchedule.toleranceMinutes ||
      x.veryLateMinutes !== currentSchedule.veryLateMinutes;
    for (const [changed, permission] of [
      [brandingChanged, "settings.branding"],
      [outingRulesChanged, "settings.outing_rules"],
      [scheduleChanged, "settings.schedule"],
    ])
      if (changed && !hasPermission(req.user, permission))
        return fail(res, 403, "Değiştirdiğiniz ayar için yetkiniz yok.");
    const [settings, schedule] = await db.$transaction([
      db.settings.update({
        where: { id: 1 },
        data: {
          institutionName: x.institutionName,
          logoData: x.logoData,
          leaveCategories: [...new Set(x.leaveCategories)],
          permissionCategories: [...new Set(x.permissionCategories)],
          eveningStartTime: x.eveningStartTime,
          streakMinMinutes: x.streakMinMinutes,
          rankingWindowDays: x.rankingWindowDays,
          maxOpenOutingHours: x.maxOpenOutingHours,
          allowHistoricalEntries: x.allowHistoricalEntries,
        },
      }),
      db.workSchedule.update({
        where: { id: 1 },
        data: {
          startTime: x.startTime,
          endTime: x.endTime,
          toleranceMinutes: x.toleranceMinutes,
          veryLateMinutes: x.veryLateMinutes,
        },
      }),
    ]);
    await log(req, "SETTINGS_UPDATED", "global");
    res.json({ settings, schedule });
  }),
);
const reportQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  userId: z.string().uuid().optional(),
  kind: z
    .enum(["all", "attendance", "leave", "absence", "late"])
    .default("all"),
});
async function report(q) {
  if (q.from > q.to) throw Error("Tarih aralığı geçersiz.");
  const span = (new Date(q.to) - new Date(q.from)) / 86400000;
  if (span > 730) throw Error("Rapor aralığı en fazla iki yıl olabilir.");
  const users = await db.user.findMany({
    where: { role: { code: "STAFF" }, ...(q.userId ? { id: q.userId } : {}) },
    orderBy: { name: "asc" },
  });
  const [attendance, leaves] = await Promise.all([
    db.attendance.findMany({
      where: {
        day: { gte: q.from, lte: q.to },
        userId: { in: users.map((u) => u.id) },
      },
    }),
    db.leaveRequests.findMany({
      where: {
        day: { gte: q.from, lte: q.to },
        userId: { in: users.map((u) => u.id) },
      },
    }),
  ]);
  const am = new Map(attendance.map((a) => [`${a.userId}/${a.day}`, a])),
    lm = new Map(leaves.map((l) => [`${l.userId}/${l.day}`, l]));
  const rows = [];
  for (
    let d = new Date(`${q.from}T12:00:00Z`);
    d <= new Date(`${q.to}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    if ([0, 6].includes(d.getUTCDay())) continue;
    const day = d.toISOString().slice(0, 10);
    if (day > today()) continue;
    for (const u of users) {
      const a = am.get(`${u.id}/${day}`),
        l = lm.get(`${u.id}/${day}`);
      const kind =
        l?.status === "APPROVED"
          ? "leave"
          : a?.status === "APPROVED"
            ? "attendance"
            : l?.status === "PENDING" || a?.status === "PENDING"
              ? "pending"
              : "absence";
      if (
        (q.kind === "late" &&
          (!a || a.status !== "APPROVED" || a.arrival === "ON_TIME")) ||
        (q.kind !== "all" && q.kind !== "late" && q.kind !== kind)
      )
        continue;
      rows.push({
        personel: u.name,
        kullanici: u.username,
        tarih: day,
        tur:
          kind === "leave"
            ? "İzin"
            : kind === "attendance"
              ? "Yoklama"
              : kind === "pending"
                ? "Onay bekliyor"
                : "Gelmedi",
        saat: a ? clock(a.checkedInAt) : "",
        kategori: l?.category || "",
        durum: l?.status || a?.status || "ABSENT",
        gelis: a?.arrival || "",
        aciklama: l?.note || a?.note || "",
      });
    }
  }
  return rows;
}
app.get(
  "/api/reports",
  permit("reports.view"),
  wrap(async (req, res) => {
    const q = reportQuery.parse(req.query);
    res.json({ rows: await report(q) });
  }),
);
app.get(
  "/api/reports/:format",
  permit("reports.export"),
  wrap(async (req, res) => {
    const format = z.enum(["xlsx", "pdf"]).parse(req.params.format),
      q = reportQuery.parse(req.query),
      rows = await report(q);
    await log(req, "REPORT_EXPORTED", format, {
      from: q.from,
      to: q.to,
      kind: q.kind,
    });
    if (format === "xlsx") {
      const book = new ExcelJS.Workbook(),
        sheet = book.addWorksheet("Yoklama Raporu");
      sheet.columns = Object.keys(
        rows[0] || {
          personel: "",
          kullanici: "",
          tarih: "",
          tur: "",
          saat: "",
          kategori: "",
          durum: "",
          gelis: "",
          aciklama: "",
        },
      ).map((key) => ({
        header: key.toLocaleUpperCase("tr-TR"),
        key,
        width: key === "aciklama" ? 40 : 20,
      }));
      sheet.addRows(rows);
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF183B65" },
      };
      res.set({
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="yoklama-raporu.xlsx"',
      });
      await book.xlsx.write(res);
      res.end();
    } else {
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="yoklama-raporu.pdf"',
      });
      const doc = new PDFDocument({ size: "A4", margin: 35 });
      doc.pipe(res);
      const font = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
      if (fs.existsSync(font)) doc.font(font);
      doc.fontSize(17).text("Personel Yoklama Raporu");
      doc
        .fontSize(9)
        .text(`${q.from} — ${q.to} | ${rows.length} kayıt`)
        .moveDown();
      for (const r of rows) {
        if (doc.y > 760) doc.addPage();
        doc
          .fontSize(9)
          .text(
            `${r.tarih}   ${r.personel}   ${r.tur}   ${r.saat}   ${r.kategori}   ${r.durum}`,
            { width: 530 },
          );
        if (r.aciklama)
          doc
            .fontSize(8)
            .fillColor("#53677e")
            .text(r.aciklama, { width: 530 })
            .fillColor("#000000");
        doc.moveDown(0.35);
      }
      doc.end();
    }
  }),
);
app.get(
  "/api/audit",
  permit("audit.view"),
  wrap(async (req, res) =>
    res.json(
      await db.auditLogs.findMany({
        include: { actor: { select: { name: true, username: true } } },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
    ),
  ),
);
app.get(
  "/api/backup",
  permit("backup.download"),
  wrap(async (req, res) => {
    await log(req, "BACKUP_DOWNLOADED", "database");
    const url = new URL(process.env.DATABASE_URL),
      args = [
        "--format=custom",
        "--no-owner",
        "--no-acl",
        "--host",
        url.hostname,
        "--port",
        url.port || "5432",
        "--username",
        decodeURIComponent(url.username),
        decodeURIComponent(url.pathname.slice(1)),
      ];
    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="yoklama-${today()}.dump"`,
    });
    const { spawn } = await import("node:child_process");
    const p = spawn("pg_dump", args, {
      env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
    });
    p.stdout.pipe(res);
    let error = "";
    p.stderr.on("data", (d) => (error += d.toString()));
    p.on("close", (code) => {
      if (code !== 0) {
        console.error("pg_dump failed", error);
        if (!res.headersSent) fail(res, 500, "Yedek alınamadı.");
        else res.destroy();
      }
    });
    p.on("error", (e) => {
      console.error(e);
      if (!res.headersSent) fail(res, 500, "Yedek alınamadı.");
    });
  }),
);
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use((err, req, res, next) => {
  if (err instanceof z.ZodError)
    return fail(res, 400, err.issues.map((x) => x.message).join(", "));
  if (err.code === "P2002") return fail(res, 409, "Bu kayıt zaten mevcut.");
  if (err.code === "P2025") return fail(res, 404, "Kayıt bulunamadı.");
  if (err.message === "İzin kategorisi geçersiz.")
    return fail(res, 400, err.message);
  if (
    [
      "Bugün için izin talebi var.",
      "Bugün için yoklama kaydı var.",
      "Karara bağlanan kayıt değiştirilemez.",
      "Karara bağlanan talep değiştirilemez.",
      "Bekleyen kayıt bulunamadı.",
      "Kayıt başka bir amir tarafından işlendi.",
      "Kayıt başka bir yetkili tarafından işlendi.",
      "Tarih aralığı geçersiz.",
      "Rapor aralığı en fazla iki yıl olabilir.",
    ].includes(err.message)
  )
    return fail(res, 409, err.message);
  console.error(err);
  fail(res, 500, "İşlem tamamlanamadı.");
});
app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
  console.log("API ready"),
);
