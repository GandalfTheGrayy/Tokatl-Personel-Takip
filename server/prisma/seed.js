import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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
} finally {
  await db.$disconnect();
}
