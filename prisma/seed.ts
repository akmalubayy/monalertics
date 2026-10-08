import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const plans = [
  {
    name: 'FREE',
    displayName: 'Free',
    maxMonitors: 3,
    minIntervalSeconds: 300,
    retentionDays: 7,
    supportsTelegram: false,
    supportsDiscord: false,
    maxScreenshots: 3,
    supportsStatusPage: false,
    priceMonthly: 0,
  },
  {
    name: 'BASIC',
    displayName: 'Basic',
    maxMonitors: 10,
    minIntervalSeconds: 60,
    retentionDays: 30,
    supportsTelegram: true,
    supportsDiscord: false,
    maxScreenshots: 30,
    supportsStatusPage: false,
    priceMonthly: 49000,
  },
  {
    name: 'PRO',
    displayName: 'Pro',
    maxMonitors: 50,
    minIntervalSeconds: 60,
    retentionDays: 90,
    supportsTelegram: true,
    supportsDiscord: true,
    maxScreenshots: 200,
    supportsStatusPage: true,
    priceMonthly: 149000,
  },
  {
    name: 'ENTERPRISE',
    displayName: 'Enterprise',
    maxMonitors: 500,
    minIntervalSeconds: 60,
    retentionDays: 365,
    supportsTelegram: true,
    supportsDiscord: true,
    maxScreenshots: 2000,
    supportsStatusPage: true,
    priceMonthly: 499000,
  },
]

async function main() {
  console.log('Seeding plans...')
  const planMap: Record<string, string> = {}
  for (const plan of plans) {
    const p = await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    })
    planMap[plan.name] = p.id
    console.log(`  ✓ Plan ${plan.displayName}`)
  }

  // User demo
  console.log('\nSeeding demo user...')
  const passwordHash = await bcrypt.hash('password123', 12)

  const user = await prisma.user.upsert({
    where: { email: 'admin@monalertics.com' },
    update: {},
    create: {
      email: 'admin@monalertics.com',
      passwordHash,
      name: 'Admin Demo',
      emailVerified: new Date(),
    },
  })
  console.log(`  ✓ User ${user.email}`)

  // Workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: {
      name: 'Demo Workspace',
      slug: 'demo-workspace',
    },
  })
  console.log(`  ✓ Workspace ${workspace.name}`)

  // Member
  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId: workspace.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      workspaceId: workspace.id,
      role: 'OWNER',
    },
  })
  console.log(`  ✓ Member workspace (OWNER)`)

  // Subscription Free
  await prisma.subscription.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: {
      workspaceId: workspace.id,
      planId: planMap['FREE'],
      status: 'ACTIVE',
    },
  })
  console.log(`  ✓ Subscription Free Plan`)

  // Sample monitors
  const sampleMonitors = [
    {
      name: 'Google Uptime',
      type: 'UPTIME' as const,
      target: 'https://www.google.com',
      intervalSeconds: 300,
      lastStatus: 'UP' as const,
      lastCheckedAt: new Date(),
    },
    {
      name: 'SSL Google',
      type: 'SSL' as const,
      target: 'google.com',
      intervalSeconds: 3600,
      lastStatus: 'UP' as const,
      lastCheckedAt: new Date(),
    },
    {
      name: 'Domain Example',
      type: 'DOMAIN' as const,
      target: 'example.com',
      intervalSeconds: 3600,
      lastStatus: 'UNKNOWN' as const,
      lastCheckedAt: null,
    },
  ]

  console.log('\nSeeding sample monitors...')
  for (const m of sampleMonitors) {
    const monitor = await prisma.monitor.create({
      data: {
        workspaceId: workspace.id,
        name: m.name,
        type: m.type,
        target: m.target,
        intervalSeconds: m.intervalSeconds,
        lastStatus: m.lastStatus,
        lastCheckedAt: m.lastCheckedAt,
        isActive: true,
      },
    })
    console.log(`  ✓ Monitor ${monitor.name} (${monitor.type})`)

    // Sample checks
    if (m.lastStatus !== 'UNKNOWN') {
      await prisma.monitorCheck.createMany({
        data: Array.from({ length: 5 }, (_, i) => ({
          monitorId: monitor.id,
          status: i === 2 ? 'DOWN' : 'UP' as const,
          responseTimeMs: m.type === 'UPTIME' ? 80 + Math.floor(Math.random() * 200) : null,
          statusCode: m.type === 'UPTIME' ? (i === 2 ? 503 : 200) : null,
          errorMessage: i === 2 ? 'Connection timeout' : null,
          checkedAt: new Date(Date.now() - (5 - i) * m.intervalSeconds * 1000),
        })),
      })
      console.log(`    ✓ 5 sample checks`)
    }
  }

  console.log('\n✅ Seed selesai!')
  console.log('   Email   : admin@monalertics.com')
  console.log('   Password: password123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
