import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import fs from "node:fs";

const db = new PrismaClient();
const categories = [
  "Yıllık İzin",
  "Mazeret İzni",
  "Saatlik İzin",
  "Hastane",
  "Sağlık Raporu",
  "Refakat",
  "İdari İzin",
  "Görevli",
  "Eğitim",
  "Ücretsiz İzin",
  "Diğer",
];
const permissionCategories = [
  "Normal İzin",
  "Akşam İzni",
  "Özel İzin",
  "Görev",
  "Diğer",
];
const names = [
  "Ahmet Yılmaz",
  "Ayşe Demir",
  "Mehmet Kaya",
  "Fatma Çelik",
  "Ali Şahin",
  "Zeynep Aydın",
  "Mustafa Arslan",
  "Elif Doğan",
  "Ömer Kılıç",
  "Merve Aslan",
  "Emre Yıldız",
  "Selin Koç",
  "Burak Özkan",
  "Derya Polat",
  "Can Aksoy",
  "Ece Kurt",
  "Kerem Güneş",
  "İrem Çetin",
  "Deniz Ergin",
  "Seda Yalçın",
];
const tzDate = (d) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
try {
  for (const [code, name] of [
    ["GOD", "Tanrı"],
    ["ADMIN", "Yönetici"],
    ["SUPERVISOR", "Amir"],
    ["STAFF", "Üye"],
  ])
    await db.role.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
  await db.workSchedule.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  await db.settings.upsert({
    where: { id: 1 },
    update: { institutionName: "Tokatlı Next Gen", permissionCategories },
    create: {
      id: 1,
      institutionName: "Tokatlı Next Gen",
      leaveCategories: categories,
      permissionCategories,
    },
  });
  const godUsername = (process.env.GOD_USERNAME || "muharrem")
    .trim()
    .toLowerCase();
  const godName = (process.env.GOD_NAME || "Muharrem").trim();
  const godPassword = process.env.GOD_PASSWORD;
  if (!godPassword || godPassword.length < 8)
    throw Error("GOD_PASSWORD must contain at least 8 characters");
  const godRole = await db.role.findUnique({ where: { code: "GOD" } });
  const existingGod = await db.user.findUnique({
    where: { username: godUsername },
  });
  if (existingGod) {
    const promoted = existingGod.roleId !== godRole.id;
    await db.user.update({
      where: { id: existingGod.id },
      data: {
        name: godName,
        roleId: godRole.id,
        active: true,
        mustChangePassword: false,
        passwordHash: promoted ? await bcrypt.hash(godPassword, 12) : undefined,
      },
    });
  } else
    await db.user.create({
      data: {
        username: godUsername,
        name: godName,
        roleId: godRole.id,
        passwordHash: await bcrypt.hash(godPassword, 12),
        mustChangePassword: false,
      },
    });
  const accounts = [
    { username: "yonetici", name: "Sistem Yöneticisi", role: "ADMIN" },
    ...Array.from({ length: 3 }, (_, i) => ({
      username: `amir${i + 1}`,
      name: ["Murat Erdem", "Gül Özdemir", "Hakan Yücel"][i],
      role: "SUPERVISOR",
    })),
    ...names.map((name, i) => ({
      username: `personel${String(i + 1).padStart(2, "0")}`,
      name,
      role: "STAFF",
      memberClass: i % 2 ? "LORD" : "ACADEMY",
    })),
  ];
  const credentials = [];
  for (const item of accounts) {
    const existing = await db.user.findUnique({
      where: { username: item.username },
    });
    if (existing) continue;
    const password = randomBytes(15).toString("base64url");
    const role = await db.role.findUnique({ where: { code: item.role } });
    await db.user.create({
      data: {
        username: item.username,
        name: item.name,
        roleId: role.id,
        memberClass: item.memberClass,
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    credentials.push(`${item.username}\t${password}\t${item.role}`);
  }
  if (credentials.length) {
    const path = process.env.CREDENTIALS_FILE || "/data/ilk-hesaplar.txt";
    fs.mkdirSync(new URL(".", `file://${path}`).pathname, { recursive: true });
    fs.writeFileSync(
      path,
      `İLK KURULUM HESAPLARI — ilk girişte şifre değişimi zorunlu\nKullanıcı adı\tGeçici şifre\tRol\n${credentials.join("\n")}\n`,
      { flag: "wx", mode: 0o600 },
    );
    console.log(
      `Created ${credentials.length} accounts; credentials saved to ${path}`,
    );
  }
  const staff = await db.user.findMany({
    where: { role: { code: "STAFF" } },
    orderBy: { username: "asc" },
  });
  if ((await db.attendance.count()) === 0) {
    for (let offset = 1; offset <= 8; offset++) {
      const d = new Date(Date.now() - offset * 86400000),
        day = tzDate(d);
      if ([0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay())) continue;
      for (let i = 0; i < staff.length; i++) {
        if ((i + offset) % 11 === 0) continue;
        const hour = (i + offset) % 7 === 0 ? 8 : 7,
          minute = (i * 7 + offset) % 58;
        const checkedInAt = new Date(
          `${day}T${String(hour - 3).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`,
        );
        await db.attendance.create({
          data: {
            userId: staff[i].id,
            day,
            checkedInAt,
            note: "",
            arrival:
              hour === 8
                ? minute > 30
                  ? "VERY_LATE"
                  : minute > 5
                    ? "LATE"
                    : "ON_TIME"
                : "ON_TIME",
            status: "APPROVED",
          },
        });
      }
    }
  }
  if ((await db.leaveRequests.count()) === 0) {
    let count = 0;
    for (let offset = 1; offset <= 8 && count < 3; offset++) {
      const day = tzDate(new Date(Date.now() - offset * 86400000));
      if ([0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay())) continue;
      for (const user of staff) {
        if (
          await db.attendance.findUnique({
            where: { userId_day: { userId: user.id, day } },
          })
        )
          continue;
        await db.leaveRequests.create({
          data: {
            userId: user.id,
            day,
            category: ["Yıllık İzin", "Hastane", "Mazeret İzni"][count],
            note: "Örnek geçmiş kayıt",
            status: "APPROVED",
          },
        });
        count++;
        break;
      }
    }
  }
} finally {
  await db.$disconnect();
}
