import { PrismaClient, Weekday } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'usuario@horacerta.local' },
    update: {},
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

  const baseEffectiveFrom = new Date('2000-01-01T00:00:00.000Z');

  for (const schedule of defaultSchedules) {
    await prisma.workSchedule.upsert({
      where: {
        userId_weekday_effectiveFrom: {
          userId: user.id,
          weekday: schedule.weekday,
          effectiveFrom: baseEffectiveFrom,
        },
      },
      update: {
        expectedMinutes: schedule.expectedMinutes,
      },
      create: {
        userId: user.id,
        weekday: schedule.weekday,
        expectedMinutes: schedule.expectedMinutes,
        effectiveFrom: baseEffectiveFrom,
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
