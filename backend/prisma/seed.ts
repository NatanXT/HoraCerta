import { PrismaClient, Weekday } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'usuario@horacerta.local' },
    update: { name: 'Usuário HoraCerta' },
    create: {
      name: 'Usuário HoraCerta',
      email: 'usuario@horacerta.local',
    },
  });

  const defaultSchedules: { weekday: Weekday; expectedMinutes: number }[] = [
    { weekday: Weekday.MONDAY, expectedMinutes: 480 },
    { weekday: Weekday.TUESDAY, expectedMinutes: 480 },
    { weekday: Weekday.WEDNESDAY, expectedMinutes: 480 },
    { weekday: Weekday.THURSDAY, expectedMinutes: 480 },
    { weekday: Weekday.FRIDAY, expectedMinutes: 480 },
    { weekday: Weekday.SATURDAY, expectedMinutes: 0 },
    { weekday: Weekday.SUNDAY, expectedMinutes: 0 },
  ];

  for (const schedule of defaultSchedules) {
    await prisma.workSchedule.upsert({
      where: {
        userId_weekday: {
          userId: user.id,
          weekday: schedule.weekday,
        },
      },
      update: {
        expectedMinutes: schedule.expectedMinutes,
      },
      create: {
        userId: user.id,
        weekday: schedule.weekday,
        expectedMinutes: schedule.expectedMinutes,
      },
    });
  }

  console.log('Seed executed successfully!');
  console.log(`User ID: ${user.id} (${user.email})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
