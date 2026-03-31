import 'dotenv/config';
import { PrismaClient, Role, VerificationStatus, ServiceType, EventType, BookingStatus, PaymentStatus, ProductType, OrderStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const hash = (pw: string) => bcrypt.hash(pw, 10);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const future = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const past = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Spiritual California database...\n');

  // ── 1. Platform Settings ────────────────────────────────────────────────────
  console.log('⚙️  Platform settings...');
  await prisma.platformSetting.createMany({
    skipDuplicates: true,
    data: [
      { key: 'platform_commission_percent', value: '15', type: 'number' },
      { key: 'payout_threshold_usd', value: '100', type: 'number' },
      { key: 'platform_name', value: 'Spiritual California', type: 'string' },
      { key: 'platform_email', value: 'hello@spiritualcalifornia.com', type: 'string' },
      { key: 'subscription_enabled', value: 'false', type: 'boolean' },
      { key: 'subscription_price_usd', value: '50', type: 'number' },
    ],
  });

  // ── 2. Institution References ───────────────────────────────────────────────
  console.log('🏫 Institution references...');
  await prisma.institutionReference.createMany({
    skipDuplicates: true,
    data: [
      { name: 'California Institute of Integral Studies', aliases: ['CIIS'], country: 'US', type: 'university' },
      { name: 'Esalen Institute', aliases: ['Esalen'], country: 'US', type: 'wellness_school' },
      { name: 'Chopra Center for Wellbeing', aliases: ['Chopra Center'], country: 'US', type: 'wellness_school' },
      { name: 'Yoga Alliance', aliases: ['YA'], country: 'US', type: 'certification_body' },
      { name: 'International Coach Federation', aliases: ['ICF'], country: 'US', type: 'certification_body' },
      { name: 'National Certification Commission for Acupuncture', aliases: ['NCCAOM'], country: 'US', type: 'certification_body' },
      { name: 'American Board of Hypnotherapy', aliases: ['ABH'], country: 'US', type: 'certification_body' },
      { name: 'Reiki Healing Association', aliases: ['RHA'], country: 'US', type: 'certification_body' },
      { name: 'San Jose State University', aliases: ['SJSU'], country: 'US', type: 'university' },
      { name: 'Stanford University', aliases: ['Stanford'], country: 'US', type: 'university' },
      { name: 'University of California Santa Cruz', aliases: ['UCSC'], country: 'US', type: 'university' },
    ],
  });

  // ── 3. Categories & Subcategories ──────────────────────────────────────────
  console.log('📂 Categories...');
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'mind-healing' },
      update: {},
      create: { name: 'Mind Healing', slug: 'mind-healing', description: 'Meditation, hypnotherapy, NLP and mindfulness practices', sortOrder: 1, isActive: true },
    }),
    prisma.category.upsert({
      where: { slug: 'body-healing' },
      update: {},
      create: { name: 'Body Healing', slug: 'body-healing', description: 'Yoga, Reiki, acupuncture, and energy work', sortOrder: 2, isActive: true },
    }),
    prisma.category.upsert({
      where: { slug: 'soul-travels' },
      update: {},
      create: { name: 'Soul Travels', slug: 'soul-travels', description: 'Spiritual retreats and nature-based healing journeys', sortOrder: 3, isActive: true },
    }),
    prisma.category.upsert({
      where: { slug: 'life-coaching' },
      update: {},
      create: { name: 'Life Coaching', slug: 'life-coaching', description: 'Career, relationship, executive and purpose coaching', sortOrder: 4, isActive: true },
    }),
    prisma.category.upsert({
      where: { slug: 'creative-arts' },
      update: {},
      create: { name: 'Creative Arts', slug: 'creative-arts', description: 'Art therapy, music therapy and expressive arts', sortOrder: 5, isActive: true },
    }),
  ]);

  const [mindCat, bodyCat, soulCat, coachCat, artsCat] = categories;

  const subcatData = [
    { categoryId: mindCat.id, name: 'Meditation', slug: 'meditation', isApproved: true },
    { categoryId: mindCat.id, name: 'Hypnotherapy', slug: 'hypnotherapy', isApproved: true },
    { categoryId: mindCat.id, name: 'NLP', slug: 'nlp', isApproved: true },
    { categoryId: mindCat.id, name: 'Mindfulness Coaching', slug: 'mindfulness-coaching', isApproved: true },
    { categoryId: mindCat.id, name: 'Breathwork', slug: 'breathwork', isApproved: true },
    { categoryId: bodyCat.id, name: 'Yoga', slug: 'yoga', isApproved: true },
    { categoryId: bodyCat.id, name: 'Reiki', slug: 'reiki', isApproved: true },
    { categoryId: bodyCat.id, name: 'QiGong', slug: 'qigong', isApproved: true },
    { categoryId: bodyCat.id, name: 'Acupuncture', slug: 'acupuncture', isApproved: true },
    { categoryId: bodyCat.id, name: 'Sound Healing', slug: 'sound-healing', isApproved: true },
    { categoryId: bodyCat.id, name: 'Energy Healing', slug: 'energy-healing', isApproved: true },
    { categoryId: soulCat.id, name: 'Spiritual Retreats', slug: 'spiritual-retreats', isApproved: true },
    { categoryId: soulCat.id, name: 'Nature-Based Healing', slug: 'nature-based-healing', isApproved: true },
    { categoryId: coachCat.id, name: 'Career Coaching', slug: 'career-coaching', isApproved: true },
    { categoryId: coachCat.id, name: 'Relationship Coaching', slug: 'relationship-coaching', isApproved: true },
    { categoryId: coachCat.id, name: 'Executive Coaching', slug: 'executive-coaching', isApproved: true },
    { categoryId: coachCat.id, name: 'Purpose Coaching', slug: 'purpose-coaching', isApproved: true },
    { categoryId: artsCat.id, name: 'Art Therapy', slug: 'art-therapy', isApproved: true },
    { categoryId: artsCat.id, name: 'Music Therapy', slug: 'music-therapy', isApproved: true },
    { categoryId: artsCat.id, name: 'Dance Movement Therapy', slug: 'dance-movement-therapy', isApproved: true },
  ];

  for (const sub of subcatData) {
    await prisma.subcategory.upsert({
      where: { categoryId_slug: { categoryId: sub.categoryId, slug: sub.slug } },
      update: {},
      create: sub,
    });
  }

  const subcats = await prisma.subcategory.findMany();
  const subBySlug = Object.fromEntries(subcats.map((s) => [s.slug, s]));

  // ── 4. Super Admin (skip if exists) ────────────────────────────────────────
  console.log('👑 Super Admin user...');
  const adminEmail = 'admin@spiritualcalifornia.com';
  if (!(await prisma.user.findUnique({ where: { email: adminEmail } }))) {
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hash('12345678'),
        firstName: 'Super',
        lastName: 'Admin',
        isEmailVerified: true,
        isActive: true,
        roles: { create: [{ role: Role.SUPER_ADMIN }, { role: Role.ADMIN }] },
      },
    });
    console.log(`  ✓ admin@spiritualcalifornia.com / 12345678`);
  } else {
    console.log('  ✓ Admin already exists, skipping');
  }

  // ── 5. Seekers ──────────────────────────────────────────────────────────────
  console.log('🔍 Seeker users...');

  const seekerData = [
    { email: 'jessica.martinez@gmail.com', firstName: 'Jessica', lastName: 'Martinez', location: 'San Jose, CA', interests: ['Meditation', 'Yoga', 'Mindfulness'] },
    { email: 'david.nguyen@icloud.com', firstName: 'David', lastName: 'Nguyen', location: 'Santa Clara, CA', interests: ['Life Coaching', 'NLP', 'Career Growth'] },
    { email: 'emily.watson@gmail.com', firstName: 'Emily', lastName: 'Watson', location: 'Cupertino, CA', interests: ['Reiki', 'Energy Healing', 'Sound Healing'] },
    { email: 'raj.patel@yahoo.com', firstName: 'Raj', lastName: 'Patel', location: 'Sunnyvale, CA', interests: ['Yoga', 'Ayurveda', 'Meditation'] },
    { email: 'sarah.kim@gmail.com', firstName: 'Sarah', lastName: 'Kim', location: 'Mountain View, CA', interests: ['Art Therapy', 'Mindfulness', 'Breathwork'] },
    { email: 'mike.johnson@gmail.com', firstName: 'Mike', lastName: 'Johnson', location: 'Los Gatos, CA', interests: ['Executive Coaching', 'Purpose Coaching', 'Hypnotherapy'] },
  ];

  const seekerUsers: any[] = [];
  for (const s of seekerData) {
    let user = await prisma.user.findUnique({ where: { email: s.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: s.email,
          passwordHash: await hash('12345678'),
          firstName: s.firstName,
          lastName: s.lastName,
          isEmailVerified: true,
          isActive: true,
          roles: { create: [{ role: Role.SEEKER }] },
          seekerProfile: {
            create: {
              location: s.location,
              timezone: 'America/Los_Angeles',
              interests: s.interests,
            },
          },
        },
        include: { seekerProfile: true },
      });
    }
    seekerUsers.push(user);
  }
  console.log(`  ✓ ${seekerData.length} seekers created`);

  // ── 6. Guides ───────────────────────────────────────────────────────────────
  console.log('🧘 Guide users & profiles...');

  const guideData = [
    {
      email: 'luna.rivera@gmail.com',
      firstName: 'Luna',
      lastName: 'Rivera',
      displayName: 'Luna Rivera',
      tagline: 'Meditation & Mindfulness Teacher | 15 Years Experience',
      bio: `Luna Rivera is a certified meditation teacher and mindfulness coach based in Los Gatos, CA. With over 15 years of practice and 8 years of teaching, she has helped hundreds of Silicon Valley professionals find peace and clarity amidst the chaos of tech culture.\n\nHer approach combines traditional Vipassana techniques with modern neuroscience research on stress reduction. Luna trained at the Spirit Rock Meditation Center in Woodacre, CA and completed her 500-hour yoga teacher training with the Yoga Alliance.\n\nShe works primarily with high-achieving professionals dealing with burnout, anxiety, and the search for deeper meaning in their work and lives.`,
      location: 'Los Gatos, CA',
      categorySlug: 'mind-healing',
      subcategorySlugs: ['meditation', 'mindfulness-coaching', 'breathwork'],
      averageRating: 4.9,
      totalReviews: 47,
      credentials: [
        { title: '500-Hour Yoga Teacher Training', institution: 'Yoga Alliance', issuedYear: 2016 },
        { title: 'Certified Mindfulness-Based Stress Reduction (MBSR) Teacher', institution: 'University of Massachusetts', issuedYear: 2018 },
        { title: 'Spirit Rock Community Dharma Leader', institution: 'Spirit Rock Meditation Center', issuedYear: 2020 },
      ],
      services: [
        { name: 'Private Meditation Session', price: 120, durationMin: 60, type: ServiceType.IN_PERSON, description: 'One-on-one personalized meditation session tailored to your goals, whether stress reduction, sleep improvement, or spiritual development. Held at my peaceful home studio in Los Gatos.' },
        { name: 'Mindfulness for Executives (Virtual)', price: 150, durationMin: 60, type: ServiceType.VIRTUAL, description: 'Corporate mindfulness coaching for busy tech executives. Learn science-backed techniques to improve focus, decision-making, and leadership presence.' },
        { name: 'Breathwork Journey Session', price: 95, durationMin: 90, type: ServiceType.IN_PERSON, description: 'Transformative breathwork session using conscious connected breathing to release stored tension and access deeper states of clarity and peace.' },
      ],
    },
    {
      email: 'dr.sarah.chen@gmail.com',
      firstName: 'Sarah',
      lastName: 'Chen',
      displayName: 'Dr. Sarah Chen, L.Ac.',
      tagline: 'Licensed Acupuncturist & Traditional Chinese Medicine Practitioner',
      bio: `Dr. Sarah Chen is a licensed acupuncturist and Traditional Chinese Medicine (TCM) practitioner serving the San Jose and South Bay area. She earned her Master of Science in Oriental Medicine from the Five Branches University in Santa Cruz and is nationally board-certified by the NCCAOM.\n\nDr. Chen specializes in treating chronic pain, hormonal imbalances, fertility support, and stress-related conditions. Her integrative approach combines classical acupuncture with herbal medicine, cupping, gua sha, and dietary therapy.\n\nHaving treated over 2,000 patients across 12 years of practice, Dr. Chen is known for her warm, thorough approach and her ability to explain complex TCM concepts in relatable terms for her tech-savvy San Jose clientele.`,
      location: 'San Jose, CA',
      categorySlug: 'body-healing',
      subcategorySlugs: ['acupuncture', 'energy-healing'],
      averageRating: 4.8,
      totalReviews: 89,
      credentials: [
        { title: 'Master of Science in Oriental Medicine', institution: 'Five Branches University', issuedYear: 2012 },
        { title: 'National Board Certification in Acupuncture', institution: 'National Certification Commission for Acupuncture', issuedYear: 2013 },
        { title: 'California Acupuncture License', institution: 'California Acupuncture Board', issuedYear: 2013 },
      ],
      services: [
        { name: 'Initial Acupuncture Consultation & Treatment', price: 175, durationMin: 90, type: ServiceType.IN_PERSON, description: 'Comprehensive first-visit includes detailed intake, pulse and tongue diagnosis, and full acupuncture treatment with optional cupping or gua sha.' },
        { name: 'Follow-Up Acupuncture Treatment', price: 110, durationMin: 60, type: ServiceType.IN_PERSON, description: 'Ongoing acupuncture treatment session for established patients. Includes brief check-in and full needle treatment.' },
        { name: 'TCM Herbal Consultation', price: 85, durationMin: 45, type: ServiceType.IN_PERSON, description: 'Personalized Chinese herbal medicine prescription consultation. Custom formula designed for your specific constitution and health goals.' },
      ],
    },
    {
      email: 'marcus.thompson@gmail.com',
      firstName: 'Marcus',
      lastName: 'Thompson',
      displayName: 'Marcus Thompson, PCC',
      tagline: 'ICF Professional Certified Coach | Tech Leadership & Purpose',
      bio: `Marcus Thompson is a Professional Certified Coach (PCC) through the International Coach Federation with over 10 years of experience coaching senior leaders and entrepreneurs in Silicon Valley. Before coaching, Marcus spent 8 years in product management at companies including LinkedIn and Cisco, giving him unique insight into the pressures and opportunities of the tech industry.\n\nMarcus specializes in helping high-performers who feel stuck, burned out, or disconnected from their sense of purpose. His coaching integrates evidence-based positive psychology, IFS (Internal Family Systems), and mindfulness practices.\n\nBased in Campbell, CA, Marcus works with clients across the Bay Area and remotely worldwide. He has been featured in Forbes, Inc. Magazine, and the Silicon Valley Business Journal.`,
      location: 'Campbell, CA',
      categorySlug: 'life-coaching',
      subcategorySlugs: ['executive-coaching', 'purpose-coaching', 'career-coaching'],
      averageRating: 4.9,
      totalReviews: 63,
      credentials: [
        { title: 'Professional Certified Coach (PCC)', institution: 'International Coach Federation', issuedYear: 2017 },
        { title: 'IFS Level 1 Certified Practitioner', institution: 'IFS Institute', issuedYear: 2019 },
        { title: 'Positive Intelligence (PQ) Certified Coach', institution: 'Positive Intelligence', issuedYear: 2021 },
      ],
      services: [
        { name: 'Executive Coaching Session', price: 300, durationMin: 60, type: ServiceType.VIRTUAL, description: 'One-on-one coaching session for senior leaders and executives. Topics include leadership presence, team dynamics, strategic thinking, and personal sustainability.' },
        { name: 'Purpose Discovery Intensive', price: 450, durationMin: 120, type: ServiceType.VIRTUAL, description: 'Deep 2-hour coaching intensive to clarify your core values, identify your unique strengths, and craft a compelling vision for your next chapter.' },
        { name: 'Career Transition Coaching', price: 250, durationMin: 75, type: ServiceType.VIRTUAL, description: 'Structured coaching for professionals navigating career change, whether pivoting industries, starting a business, or returning from a sabbatical.' },
      ],
    },
    {
      email: 'priya.sharma@gmail.com',
      firstName: 'Priya',
      lastName: 'Sharma',
      displayName: 'Priya Sharma, E-RYT 500',
      tagline: 'Ayurvedic Yoga Therapist & Wellness Educator | Cupertino',
      bio: `Priya Sharma is an Experienced Registered Yoga Teacher (E-RYT 500) and certified Ayurvedic Health Counselor based in Cupertino, CA. Born and raised in Pune, India, Priya brings an authentic lineage-based approach to her teaching, having studied with masters in Mysore and Rishikesh before settling in the Bay Area.\n\nPriya's specialty is therapeutic yoga for chronic conditions, women's health, and using Ayurvedic principles to help clients understand their unique constitutional needs. She teaches group classes at local studios in Cupertino and Sunnyvale, and offers private sessions and corporate wellness programs.\n\nAs a mother of two and a tech spouse who has witnessed Silicon Valley burnout firsthand, Priya brings deep empathy and practical wisdom to her work helping the South Bay community reconnect with their bodies and natural rhythms.`,
      location: 'Cupertino, CA',
      categorySlug: 'body-healing',
      subcategorySlugs: ['yoga', 'energy-healing'],
      averageRating: 4.7,
      totalReviews: 34,
      credentials: [
        { title: 'E-RYT 500 Experienced Registered Yoga Teacher', institution: 'Yoga Alliance', issuedYear: 2014 },
        { title: 'Ayurvedic Health Counselor Certification', institution: 'California College of Ayurveda', issuedYear: 2016 },
        { title: 'Yoga Therapy for Mental Health Certificate', institution: 'Yoga International', issuedYear: 2020 },
      ],
      services: [
        { name: 'Private Yoga Session', price: 130, durationMin: 75, type: ServiceType.IN_PERSON, description: 'Personalized one-on-one yoga session designed for your body, goals, and current condition. Includes posture alignment, breathwork, and Ayurvedic lifestyle guidance.' },
        { name: 'Ayurvedic Wellness Consultation', price: 110, durationMin: 60, type: ServiceType.IN_PERSON, description: 'Learn your Ayurvedic dosha type and receive personalized recommendations for diet, daily routine, herbs, and yoga practices to restore balance.' },
        { name: 'Restorative Yoga for Stress & Sleep', price: 100, durationMin: 90, type: ServiceType.IN_PERSON, description: 'Gentle, therapeutic restorative yoga session using bolsters, blankets, and props. Perfect for those dealing with insomnia, anxiety, or adrenal fatigue.' },
      ],
    },
    {
      email: 'james.obrien@gmail.com',
      firstName: 'James',
      lastName: "O'Brien",
      displayName: "James O'Brien, CHT",
      tagline: 'Certified Hypnotherapist | Anxiety, Habits & Subconscious Reprogramming',
      bio: `James O'Brien is a Certified Hypnotherapist (CHT) and NLP Master Practitioner based in Saratoga, CA, serving the greater Silicon Valley area. James discovered the power of hypnotherapy after it helped him overcome severe social anxiety in his 20s — an experience that inspired him to dedicate his career to helping others unlock the healing power of the subconscious mind.\n\nJames trained at the Hypnotherapy Academy of America and holds certifications from both the American Board of Hypnotherapy and the National Guild of Hypnotists. He has over 9 years of clinical experience helping clients overcome phobias, break unwanted habits (including smoking and overeating), resolve trauma, and improve performance.\n\nHis gentle, evidence-based approach makes hypnotherapy accessible even to skeptics, and he frequently works with engineers and scientists who appreciate his rational, data-informed explanations of how the process works.`,
      location: 'Saratoga, CA',
      categorySlug: 'mind-healing',
      subcategorySlugs: ['hypnotherapy', 'nlp'],
      averageRating: 4.8,
      totalReviews: 51,
      credentials: [
        { title: 'Certified Hypnotherapist (CHT)', institution: 'American Board of Hypnotherapy', issuedYear: 2015 },
        { title: 'NLP Master Practitioner Certification', institution: 'Society of NLP', issuedYear: 2016 },
        { title: 'Clinical Hypnotherapy Diploma', institution: 'Hypnotherapy Academy of America', issuedYear: 2015 },
      ],
      services: [
        { name: 'Hypnotherapy Session', price: 180, durationMin: 90, type: ServiceType.IN_PERSON, description: 'Full hypnotherapy session including pre-talk, induction, therapeutic work, and integration. Effective for anxiety, habits, phobias, confidence, and performance enhancement.' },
        { name: 'Smoking Cessation Program (3 Sessions)', price: 480, durationMin: 90, type: ServiceType.IN_PERSON, description: 'Comprehensive 3-session hypnotherapy program specifically designed for smoking cessation. Includes personalized recordings for home practice.' },
        { name: 'Virtual Hypnotherapy Session', price: 160, durationMin: 75, type: ServiceType.VIRTUAL, description: 'Online hypnotherapy session via Zoom. Equally effective as in-person for most issues. Requires a quiet, private space and stable internet connection.' },
      ],
    },
    {
      email: 'maya.williams@gmail.com',
      firstName: 'Maya',
      lastName: 'Williams',
      displayName: 'Maya Williams, Reiki Master',
      tagline: 'Usui Reiki Master Teacher & Intuitive Energy Healer | Los Altos',
      bio: `Maya Williams is a Usui Reiki Master Teacher and intuitive energy healer based in Los Altos, CA. With 12 years of practice and lineage tracing directly to Usui Shiki Ryoho traditions, Maya offers both individual healing sessions and Reiki training for those called to learn this ancient healing art.\n\nMaya's sessions combine traditional Reiki with crystal healing, sound therapy, and intuitive guidance. She holds a background in nursing (RN) which gives her unique insight into the body-mind connection and makes her especially effective for clients dealing with chronic illness, post-surgical recovery, or medical anxiety.\n\nMaya has taught Reiki to over 200 students and maintains a busy healing practice in her dedicated home studio in Los Altos, surrounded by the natural beauty of the hills above Silicon Valley.`,
      location: 'Los Altos, CA',
      categorySlug: 'body-healing',
      subcategorySlugs: ['reiki', 'energy-healing', 'sound-healing'],
      averageRating: 4.9,
      totalReviews: 78,
      credentials: [
        { title: 'Usui Reiki Master Teacher Certification', institution: 'Reiki Healing Association', issuedYear: 2013 },
        { title: 'Registered Nurse (RN)', institution: 'Stanford University', issuedYear: 2008 },
        { title: 'Crystal Healing Practitioner Certification', institution: 'Hibiscus Moon Crystal Academy', issuedYear: 2017 },
      ],
      services: [
        { name: 'Reiki Healing Session', price: 110, durationMin: 60, type: ServiceType.IN_PERSON, description: 'Full Reiki energy healing session in a peaceful, sacred space. Includes chakra assessment, hands-on Reiki, crystal placement, and an oracle card reading to close.' },
        { name: 'Reiki + Sound Bath Combo', price: 145, durationMin: 90, type: ServiceType.IN_PERSON, description: 'Deeply relaxing combined session featuring full Reiki treatment accompanied by live crystal singing bowls for an immersive healing experience.' },
        { name: 'Distance Reiki Session', price: 85, durationMin: 45, type: ServiceType.VIRTUAL, description: 'Remote Reiki healing session with equal effectiveness to in-person treatment. Includes a detailed written report of energy observations and intuitive insights.' },
      ],
    },
    {
      email: 'carlos.mendez@gmail.com',
      firstName: 'Carlos',
      lastName: 'Mendez',
      displayName: 'Carlos Mendez, QiGong Sifu',
      tagline: 'Medical QiGong Practitioner & Tai Chi Instructor | Downtown San Jose',
      bio: `Carlos Mendez is a certified Medical QiGong practitioner and Tai Chi instructor based in downtown San Jose. Carlos discovered QiGong during a difficult period of chronic back pain and autoimmune challenges that conventional medicine couldn't resolve. After experiencing profound healing through this ancient Chinese practice, he dedicated himself to sharing it with others.\n\nCarlos trained for 7 years under Sifu Yang Jwing-Ming at the YMAA Retreat Center in California and holds certification from the National Qigong Association. He teaches group classes in Guadalupe River Park and offers private instruction tailored for seniors, tech workers with desk-related pain, and those dealing with chronic health conditions.\n\nHis teaching style is warm, humorous, and deeply practical — focused on helping students feel immediate benefits and build a sustainable daily practice.`,
      location: 'San Jose, CA',
      categorySlug: 'body-healing',
      subcategorySlugs: ['qigong', 'energy-healing'],
      averageRating: 4.7,
      totalReviews: 29,
      credentials: [
        { title: 'Medical QiGong Practitioner Level 3', institution: 'National Qigong Association', issuedYear: 2017 },
        { title: 'Tai Chi Instructor Certification', institution: 'YMAA International', issuedYear: 2016 },
        { title: 'Traditional Chinese Health Arts Diploma', institution: 'California Institute of Integral Studies', issuedYear: 2018 },
      ],
      services: [
        { name: 'Private QiGong Instruction', price: 95, durationMin: 60, type: ServiceType.IN_PERSON, description: 'Personalized QiGong coaching session. Learn foundational forms, standing meditation, and targeted exercises for your specific health goals.' },
        { name: 'Medical QiGong Healing Session', price: 120, durationMin: 75, type: ServiceType.IN_PERSON, description: 'Therapeutic QiGong session focused on restoring energy flow, addressing specific health conditions, and teaching self-healing exercises you can practice daily.' },
      ],
    },
    {
      email: 'rebecca.stone@gmail.com',
      firstName: 'Rebecca',
      lastName: 'Stone',
      displayName: 'Rebecca Stone, ATR-BC',
      tagline: 'Board-Certified Art Therapist | Trauma, Grief & Creative Expression',
      bio: `Rebecca Stone is a Board-Certified Art Therapist (ATR-BC) and Licensed Marriage and Family Therapist (LMFT) based in Santa Clara, CA. She holds a Master of Arts in Art Therapy from Notre Dame de Namur University in Belmont and has over 11 years of clinical experience.\n\nRebecca specializes in using creative expression as a pathway for processing trauma, grief, life transitions, and anxiety. Her approach is trauma-informed and person-centered — no artistic skill or experience is needed, and clients are always in control of their creative process.\n\nShe works with adults, teens, and couples, and has extensive experience supporting the unique mental health challenges faced by tech workers: perfectionism, imposter syndrome, work-life balance, and identity beyond career. Her warm, non-judgmental presence creates a safe space for deep, meaningful healing work.`,
      location: 'Santa Clara, CA',
      categorySlug: 'creative-arts',
      subcategorySlugs: ['art-therapy'],
      averageRating: 4.8,
      totalReviews: 42,
      credentials: [
        { title: 'Board-Certified Art Therapist (ATR-BC)', institution: 'Art Therapy Credentials Board', issuedYear: 2014 },
        { title: 'Licensed Marriage and Family Therapist (LMFT)', institution: 'California Board of Behavioral Sciences', issuedYear: 2014 },
        { title: 'Master of Arts in Art Therapy', institution: 'Notre Dame de Namur University', issuedYear: 2013 },
      ],
      services: [
        { name: 'Art Therapy Individual Session', price: 160, durationMin: 60, type: ServiceType.IN_PERSON, description: 'Individual art therapy session in a fully equipped studio. No art experience needed. Materials provided. A safe, creative space to explore what words alone cannot express.' },
        { name: 'Grief & Loss Processing Session', price: 160, durationMin: 75, type: ServiceType.IN_PERSON, description: 'Specialized art therapy session for those navigating grief and loss. Combines expressive arts with somatic awareness and gentle therapeutic dialogue.' },
      ],
    },
    {
      email: 'michael.tanaka@gmail.com',
      firstName: 'Michael',
      lastName: 'Tanaka',
      displayName: 'Michael Tanaka',
      tagline: 'Sound Healing Practitioner & Tibetan Bowl Specialist | San Jose',
      bio: `Michael Tanaka is a certified sound healing practitioner and meditation teacher based in San Jose's Japantown neighborhood. Michael brings together his Japanese heritage, 8 years of study with Tibetan Buddhist masters in Nepal and India, and his background in music (Berkeley College of Music, class of 2005) to offer uniquely rich and transformative sound healing experiences.\n\nHis collection of over 40 authentic crystal and Tibetan singing bowls, gongs, and sacred instruments creates an immersive sonic environment that facilitates deep relaxation, stress relief, and meditative states. Michael offers both private sessions and group sound baths that have become beloved fixtures in the San Jose wellness community.\n\nHe has collaborated with Google, Apple, and Nvidia to offer employee wellness programs, and regularly hosts events at the San Jose Museum of Art and local yoga studios.`,
      location: 'San Jose, CA',
      categorySlug: 'body-healing',
      subcategorySlugs: ['sound-healing', 'meditation'],
      averageRating: 4.9,
      totalReviews: 96,
      credentials: [
        { title: 'Certified Sound Healing Practitioner', institution: 'California Institute of Integral Studies', issuedYear: 2017 },
        { title: 'Tibetan Buddhist Meditation Teacher Training', institution: 'Kopan Monastery', issuedYear: 2015 },
        { title: 'Bachelor of Music', institution: 'Berklee College of Music', issuedYear: 2005 },
      ],
      services: [
        { name: 'Private Sound Healing Session', price: 130, durationMin: 75, type: ServiceType.IN_PERSON, description: 'Private one-on-one sound bath using crystal and Tibetan singing bowls, gong, and other sacred instruments. Deeply restoring for the nervous system.' },
        { name: 'Sound Bath & Meditation Journey', price: 110, durationMin: 90, type: ServiceType.IN_PERSON, description: 'Extended session combining guided meditation, chakra toning, and full sound bath immersion. Ideal for those seeking a profound reset.' },
      ],
    },
    {
      email: 'elena.vasquez@gmail.com',
      firstName: 'Elena',
      lastName: 'Vasquez',
      displayName: 'Elena Vasquez, RMT',
      tagline: 'Registered Music Therapist & Sound Journey Facilitator | Palo Alto',
      bio: `Elena Vasquez is a Board-Certified Music Therapist (MT-BC) and Registered Music Therapist based in Palo Alto, CA. She holds a Master of Music Therapy from the University of the Pacific and has over 9 years of clinical experience working with diverse populations.\n\nElena specializes in using music and rhythm as therapeutic tools for anxiety, depression, PTSD, and neurological conditions. Her approach combines evidence-based music therapy techniques with elements of sound healing, drum circles, and songwriting for self-expression.\n\nShe works with individuals, groups, and corporate teams across the Peninsula and South Bay. Elena has partnered with Stanford Children's Hospital, the VA Palo Alto, and several tech companies to deliver music-based wellness programs. Her drum circle events at Mitchell Park have become a beloved community gathering.`,
      location: 'Palo Alto, CA',
      categorySlug: 'creative-arts',
      subcategorySlugs: ['music-therapy', 'dance-movement-therapy'],
      averageRating: 4.8,
      totalReviews: 37,
      credentials: [
        { title: 'Board-Certified Music Therapist (MT-BC)', institution: 'Certification Board for Music Therapists', issuedYear: 2016 },
        { title: 'Master of Music Therapy', institution: 'University of the Pacific', issuedYear: 2015 },
        { title: 'HealthRHYTHMS Drumming Facilitator', institution: 'Remo Recreational Music Center', issuedYear: 2018 },
      ],
      services: [
        { name: 'Individual Music Therapy Session', price: 140, durationMin: 60, type: ServiceType.IN_PERSON, description: 'One-on-one music therapy session using live instruments, guided listening, songwriting, and rhythmic exercises tailored to your therapeutic goals.' },
        { name: 'Group Drum Circle Experience', price: 40, durationMin: 90, type: ServiceType.IN_PERSON, description: 'Community drum circle open to all skill levels. No musical experience needed — drums provided. A joyful, stress-releasing group experience through shared rhythm.' },
        { name: 'Virtual Music & Mindfulness Session', price: 95, durationMin: 45, type: ServiceType.VIRTUAL, description: 'Online music therapy session combining guided listening, toning exercises, and mindfulness practices. Perfect for remote workers seeking creative stress relief.' },
      ],
    },
  ];

  const guideUsers: any[] = [];
  for (const g of guideData) {
    let user = await prisma.user.findUnique({ where: { email: g.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: g.email,
          passwordHash: await hash('12345678'),
          firstName: g.firstName,
          lastName: g.lastName,
          isEmailVerified: true,
          isActive: true,
          roles: { create: [{ role: Role.GUIDE }, { role: Role.SEEKER }] },
        },
      });
    }

    let guideProfile = await prisma.guideProfile.findUnique({ where: { userId: user.id } });
    if (!guideProfile) {
      const profileSlug = slug(`${g.firstName}-${g.lastName}`);
      guideProfile = await prisma.guideProfile.create({
        data: {
          userId: user.id,
          slug: profileSlug,
          displayName: g.displayName,
          tagline: g.tagline,
          bio: g.bio,
          location: g.location,
          timezone: 'America/Los_Angeles',
          isPublished: true,
          isVerified: true,
          verificationStatus: VerificationStatus.APPROVED,
          averageRating: g.averageRating,
          totalReviews: g.totalReviews,
        },
      });

      // Category links
      const cat = categories.find((c) => c.slug === g.categorySlug)!;
      for (const subSlug of g.subcategorySlugs) {
        const sub = subBySlug[subSlug];
        if (sub) {
          await prisma.guideCategory.create({
            data: { guideId: guideProfile.id, categoryId: cat.id, subcategoryId: sub.id },
          });
        }
      }

      // Credentials
      for (const cred of g.credentials) {
        await prisma.credential.create({
          data: {
            guideId: guideProfile.id,
            title: cred.title,
            institution: cred.institution,
            issuedYear: cred.issuedYear,
            verificationStatus: VerificationStatus.APPROVED,
            confidenceScore: 0.95,
            verifiedAt: past(30),
          },
        });
      }

      // Availability (Mon–Sat)
      for (let day = 1; day <= 6; day++) {
        await prisma.availability.create({
          data: {
            guideId: guideProfile.id,
            dayOfWeek: day,
            startTime: '09:00',
            endTime: '18:00',
            isRecurring: true,
            bufferMin: 15,
          },
        });
      }

      // Services
      for (const svc of g.services) {
        const service = await prisma.service.create({
          data: {
            guideId: guideProfile.id,
            name: svc.name,
            description: svc.description,
            type: svc.type,
            price: svc.price,
            durationMin: svc.durationMin,
            isActive: true,
          },
        });

        // Create past + future slots
        for (let i = -14; i <= 30; i++) {
          const start = new Date();
          start.setDate(start.getDate() + i);
          start.setHours(10, 0, 0, 0);
          const end = new Date(start);
          end.setMinutes(end.getMinutes() + svc.durationMin);

          await prisma.serviceSlot.create({
            data: {
              serviceId: service.id,
              startTime: start,
              endTime: end,
              isBooked: false,
            },
          });
        }
      }
    }

    guideUsers.push({ user, guideProfile });
  }

  // Set professional avatar URLs for guides
  const avatarUrls = [
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face', // Luna
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop&crop=face', // Sarah Chen
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face', // Marcus
    'https://images.unsplash.com/photo-1594824476967-48c8b964f137?w=400&h=400&fit=crop&crop=face', // Priya
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face', // James
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=face', // Maya W
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face', // Carlos
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face', // Rebecca
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=400&fit=crop&crop=face', // Michael T
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face', // Elena
  ];
  for (let i = 0; i < guideUsers.length; i++) {
    if (guideUsers[i]?.user && avatarUrls[i]) {
      await prisma.user.update({
        where: { id: guideUsers[i].user.id },
        data: { avatarUrl: avatarUrls[i] },
      });
    }
  }

  console.log(`  ✓ ${guideData.length} guides created with avatars`);

  // ── 7. Bookings & Payments ─────────────────────────────────────────────────
  console.log('📅 Bookings & payments...');

  const seekerProfiles = await prisma.seekerProfile.findMany();
  const allServices = await prisma.service.findMany();
  const allSlots = await prisma.serviceSlot.findMany({ where: { isBooked: false }, take: 40 });

  const bookingScenarios = [
    { seekerIdx: 0, serviceIdx: 0, slotIdx: 0, status: BookingStatus.COMPLETED, daysAgo: 20 },
    { seekerIdx: 0, serviceIdx: 3, slotIdx: 1, status: BookingStatus.COMPLETED, daysAgo: 14 },
    { seekerIdx: 1, serviceIdx: 7, slotIdx: 2, status: BookingStatus.COMPLETED, daysAgo: 10 },
    { seekerIdx: 1, serviceIdx: 6, slotIdx: 3, status: BookingStatus.CONFIRMED, daysAgo: -5 },
    { seekerIdx: 2, serviceIdx: 12, slotIdx: 4, status: BookingStatus.COMPLETED, daysAgo: 25 },
    { seekerIdx: 2, serviceIdx: 13, slotIdx: 5, status: BookingStatus.COMPLETED, daysAgo: 7 },
    { seekerIdx: 3, serviceIdx: 1, slotIdx: 6, status: BookingStatus.CONFIRMED, daysAgo: -3 },
    { seekerIdx: 3, serviceIdx: 9, slotIdx: 7, status: BookingStatus.COMPLETED, daysAgo: 18 },
    { seekerIdx: 4, serviceIdx: 17, slotIdx: 8, status: BookingStatus.COMPLETED, daysAgo: 12 },
    { seekerIdx: 5, serviceIdx: 4, slotIdx: 9, status: BookingStatus.COMPLETED, daysAgo: 30 },
    { seekerIdx: 5, serviceIdx: 5, slotIdx: 10, status: BookingStatus.CANCELLED, daysAgo: 8 },
    { seekerIdx: 0, serviceIdx: 16, slotIdx: 11, status: BookingStatus.COMPLETED, daysAgo: 45 },
  ];

  const createdBookings: any[] = [];
  for (const scenario of bookingScenarios) {
    const seeker = seekerProfiles[scenario.seekerIdx % seekerProfiles.length];
    const service = allServices[scenario.serviceIdx % allServices.length];
    const slot = allSlots[scenario.slotIdx % allSlots.length];
    if (!seeker || !service || !slot) continue;

    const slotStart = past(scenario.daysAgo);
    slotStart.setHours(10, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + service.durationMin);

    const freshSlot = await prisma.serviceSlot.create({
      data: { serviceId: service.id, startTime: slotStart, endTime: slotEnd, isBooked: true },
    });

    const booking = await prisma.booking.create({
      data: {
        seekerId: seeker.id,
        serviceId: service.id,
        slotId: freshSlot.id,
        status: scenario.status,
        totalAmount: service.price,
        completedAt: scenario.status === BookingStatus.COMPLETED ? past(scenario.daysAgo - 1) : null,
        cancelledAt: scenario.status === BookingStatus.CANCELLED ? past(scenario.daysAgo) : null,
      },
    });

    if (scenario.status !== BookingStatus.CANCELLED) {
      const platformFee = Number(service.price) * 0.15;
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          stripePaymentIntentId: `pi_test_${Math.random().toString(36).slice(2, 18)}`,
          amount: service.price,
          platformFee,
          guideAmount: Number(service.price) - platformFee,
          status: PaymentStatus.SUCCEEDED,
        },
      });
    }

    createdBookings.push({ booking, service, seekerProfile: seeker });
  }
  console.log(`  ✓ ${createdBookings.length} bookings created`);

  // ── 8. Reviews ──────────────────────────────────────────────────────────────
  console.log('⭐ Reviews...');

  const reviewTexts = [
    { rating: 5, title: 'Life-changing experience', body: 'I came in with severe work-related anxiety after 3 years at a startup. After just 4 sessions with this practitioner, I sleep through the night for the first time in years. The techniques I learned are practical and I use them daily. Highly recommend to anyone in the Silicon Valley grind.' },
    { rating: 5, title: 'Finally found the right practitioner', body: 'I have tried many wellness practitioners in the Bay Area and this is by far the most professional, knowledgeable, and compassionate experience I have had. The space is beautiful, the energy is welcoming, and I left feeling genuinely transformed. Already booked my next appointment.' },
    { rating: 5, title: 'Worth every penny', body: 'As a skeptic and software engineer, I was doubtful. But a colleague recommended this and I am so glad I gave it a try. The science-based explanation of the techniques made it accessible to my analytical mind. Real, measurable results.' },
    { rating: 4, title: 'Great session, will return', body: 'Really beneficial session. The practitioner is skilled, attentive, and clearly experienced. I felt very comfortable and safe throughout. The only reason for 4 stars instead of 5 is that parking in the area can be tricky — give yourself extra time.' },
    { rating: 5, title: 'Exactly what I needed', body: 'I was dealing with burnout after a big product launch and needed something different from talk therapy. This was perfect. Deeply relaxing, insightful, and practical. I left with concrete tools I could use immediately. My manager actually noticed the change in me the next day.' },
    { rating: 4, title: 'Professional and effective', body: 'Well-structured session with clear explanations. I appreciated that the practitioner asked good questions before starting and really tailored the session to my needs. Would definitely come back.' },
    { rating: 5, title: 'Incredible healing experience', body: 'One of the most profound experiences of my life. I went in with chronic tension headaches that I had been managing with ibuprofen for 2 years. After the session, I felt a significant release. I cried, which surprised me, but in a healing way. Book this now.' },
    { rating: 5, title: 'My weekly ritual now', body: 'I was skeptical at first but now this is non-negotiable in my calendar. The transformation in my stress levels, sleep quality, and overall mood has been remarkable. My husband jokes that I am a different person. Worth every dollar.' },
  ];

  let reviewCount = 0;
  const seekerUserObjs = await prisma.user.findMany({ where: { roles: { some: { role: Role.SEEKER } } } });
  const guideUserObjs = await prisma.user.findMany({ where: { roles: { some: { role: Role.GUIDE } } } });

  for (let i = 0; i < createdBookings.length; i++) {
    const { booking, seekerProfile } = createdBookings[i];
    if (booking.status !== BookingStatus.COMPLETED) continue;

    const seekerUser = seekerUserObjs[i % seekerUserObjs.length];
    const service = await prisma.service.findUnique({ where: { id: booking.serviceId } });
    const guideProfile = await prisma.guideProfile.findFirst({ where: { id: { in: guideUsers.map(g => g.guideProfile?.id).filter(Boolean) } }, include: { user: true } });
    if (!seekerUser || !service) continue;

    const guideForService = await prisma.guideProfile.findFirst({ where: { services: { some: { id: service.id } } }, include: { user: true } });
    if (!guideForService) continue;

    const reviewText = reviewTexts[i % reviewTexts.length];
    await prisma.review.create({
      data: {
        authorId: seekerUser.id,
        targetId: guideForService.userId,
        bookingId: booking.id,
        rating: reviewText.rating,
        title: reviewText.title,
        body: reviewText.body,
        isApproved: true,
      },
    });
    reviewCount++;
  }
  console.log(`  ✓ ${reviewCount} reviews created`);

  // ── 9. Events ───────────────────────────────────────────────────────────────
  console.log('🎉 Events...');

  const eventData = [
    {
      guideIdx: 0, // Luna Rivera
      title: 'Full Moon Meditation & Sound Bath — Los Gatos',
      description: `Join Luna Rivera and Michael Tanaka for a special Full Moon gathering combining guided meditation, pranayama breathwork, and an immersive crystal singing bowl sound bath.\n\nThis powerful combination harnesses the potent energy of the full moon for setting intentions, releasing what no longer serves, and aligning with your highest self.\n\nThe evening will include:\n• Welcome tea ceremony\n• 20 min Full Moon guided meditation\n• 15 min Pranayama breathwork\n• 45 min Crystal bowl sound bath immersion\n• Journaling and integration time\n\nAll levels welcome. Please bring a yoga mat, blanket, and journal. We provide bolsters and eye pillows.\n\nLocation: Los Gatos Community Center, 208 E Main St, Los Gatos, CA 95030`,
      type: EventType.IN_PERSON,
      location: 'Los Gatos Community Center, 208 E Main St, Los Gatos, CA 95030',
      daysFromNow: 8,
      durationHours: 2.5,
      tiers: [{ name: 'General Admission', price: 45, capacity: 40 }],
      coverImageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 8, // Michael Tanaka
      title: 'Corporate Sound Bath & Stress Reset — San Jose (Virtual)',
      description: `A 60-minute virtual group sound bath and guided meditation designed for remote teams and individuals who need a mid-week reset.\n\nJoin Michael Tanaka live via Zoom as he plays crystal singing bowls, Tibetan bowls, ocean drum, and chimes to create an immersive sonic healing environment right in your home or office.\n\nPerfect for:\n• Tech teams looking for a meaningful team wellness activity\n• Individuals seeking a midday stress reset\n• Anyone curious about sound healing from the comfort of home\n\nEarphones or headphones highly recommended for the best experience. Recording available for 48 hours after the live event.`,
      type: EventType.VIRTUAL,
      location: null,
      daysFromNow: 5,
      durationHours: 1,
      tiers: [
        { name: 'Individual', price: 25, capacity: 100 },
        { name: 'Corporate (Team of 5)', price: 99, capacity: 20 },
      ],
      coverImageUrl: 'https://images.unsplash.com/photo-1514533212735-5df27d970db0?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 2, // Marcus Thompson
      title: 'Silicon Valley Purpose Summit — Half-Day Coaching Intensive',
      description: `A transformative half-day group coaching intensive for high-achieving professionals who feel successful on paper but disconnected from meaning and purpose.\n\nFacilitated by Marcus Thompson (ICF PCC) with guest coaching from a panel of Bay Area coaches and conscious leaders.\n\nWhat you will experience:\n• The Silicon Valley Purpose Paradox — why success feels empty\n• Values excavation exercise\n• Strengths mapping using positive psychology tools\n• Small group peer coaching rounds\n• Crafting your personal Purpose Statement\n• Practical next steps and accountability pairing\n\nLimited to 30 participants for an intimate, high-impact experience.\n\nVenue: The Graduate Hotel, 233 E Santa Clara St, San Jose, CA 95113`,
      type: EventType.IN_PERSON,
      location: 'The Graduate Hotel, 233 E Santa Clara St, San Jose, CA 95113',
      daysFromNow: 21,
      durationHours: 4,
      tiers: [
        { name: 'Early Bird', price: 197, capacity: 10 },
        { name: 'General', price: 247, capacity: 20 },
      ],
      coverImageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 3, // Priya Sharma
      title: 'Yoga & Ayurveda Weekend Retreat — Santa Cruz Mountains',
      description: `Escape the Silicon Valley hustle for a deeply restorative weekend retreat in the majestic redwoods of the Santa Cruz Mountains.\n\nPriya Sharma leads this intimate 2-day immersion combining:\n• Daily morning yoga (all levels)\n• Ayurvedic dosha assessment and personalized guidance\n• Forest bathing and nature meditation\n• Organic, Ayurvedically-prepared meals\n• Evening yoga nidra and breathwork sessions\n• Personalized take-home wellness plan\n\nAccommodation options: glamping tents (included) or nearby cabin upgrades available.\n\nLocation: Redwood Retreat Center, 2400 Bear Creek Rd, Boulder Creek, CA 95006\n\nTransportation carpool organized from San Jose. This is a Soul Travel — the healing power of nature combined with ancient wisdom.`,
      type: EventType.SOUL_TRAVEL,
      location: 'Redwood Retreat Center, 2400 Bear Creek Rd, Boulder Creek, CA 95006',
      daysFromNow: 35,
      durationHours: 48,
      tiers: [
        { name: 'Glamping Tent (Shared)', price: 425, capacity: 8 },
        { name: 'Glamping Tent (Private)', price: 550, capacity: 4 },
      ],
      coverImageUrl: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 6, // Carlos Mendez
      title: 'Morning QiGong in Guadalupe River Park — 4-Week Series',
      description: `Join Carlos Mendez for an outdoor QiGong class series in the beautiful Guadalupe River Park in downtown San Jose. This 4-week series is perfect for beginners and those looking to establish a morning wellness practice.\n\nEach 60-minute session includes:\n• Warm-up and joint opening exercises\n• Ba Duan Jin (8 Brocades) QiGong form\n• Standing meditation (Zhan Zhuang)\n• Closing breathing exercises\n\nBenefits: improved balance, stress reduction, increased energy, better sleep, immune support.\n\nAll ages and fitness levels welcome. No special equipment needed — just comfortable clothes and flat shoes. Meet at the Willow Street entrance.\n\nDates: Every Tuesday & Thursday for 4 weeks (8 classes total)\nTime: 7:00–8:00 AM\nLocation: Guadalupe River Park, Willow St Entrance, San Jose, CA 95110`,
      type: EventType.IN_PERSON,
      location: 'Guadalupe River Park, Willow St Entrance, San Jose, CA 95110',
      daysFromNow: 10,
      durationHours: 1,
      tiers: [
        { name: 'Single Class', price: 20, capacity: 20 },
        { name: '4-Week Series (8 classes)', price: 120, capacity: 15 },
      ],
      coverImageUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 5, // Maya Williams
      title: 'Reiki Healing Circle — Los Altos Hills',
      description: 'A sacred group Reiki healing experience in Maya\'s beautiful hillside studio. Each participant receives individual Reiki energy while held in the collective healing container of the circle. Followed by tea and sharing.',
      type: EventType.IN_PERSON,
      location: 'Maya\'s Healing Studio, Los Altos Hills, CA',
      daysFromNow: 14,
      durationHours: 2,
      tiers: [{ name: 'General', price: 55, capacity: 12 }],
      coverImageUrl: 'https://images.unsplash.com/photo-1600618528240-fb9fc964b853?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 0, // Luna Rivera
      title: 'Sacred Silence: A Day of Mindful Retreat — Big Sur',
      description: 'A full-day silent retreat in the breathtaking Big Sur coastline. Immerse yourself in guided meditation, walking meditation through redwood groves, mindful eating, and contemplative journaling. This is a Soul Travel experience — the healing power of nature combined with structured mindfulness practice.',
      type: EventType.SOUL_TRAVEL,
      location: 'Esalen Institute, Big Sur, CA',
      daysFromNow: 28,
      durationHours: 10,
      tiers: [{ name: 'Day Pass (includes lunch)', price: 195, capacity: 20 }],
      coverImageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 5, // Maya Williams
      title: 'Crystal Healing & Reiki Intensive — Mount Shasta',
      description: 'A transformative 3-day Soul Travel retreat at the base of sacred Mount Shasta. Combine Reiki Level 1 attunement, crystal grid ceremony, forest meditation, and energy healing in one of California\'s most powerful vortex locations.',
      type: EventType.SOUL_TRAVEL,
      location: 'Mount Shasta Retreat Center, CA',
      daysFromNow: 42,
      durationHours: 72,
      tiers: [
        { name: 'Shared Room', price: 650, capacity: 8 },
        { name: 'Private Room', price: 850, capacity: 4 },
      ],
      coverImageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 9, // Elena Vasquez
      title: 'Rhythm & Renewal: Drum Journey Through Joshua Tree',
      description: 'A 2-day immersive drumming and music therapy retreat in the otherworldly landscape of Joshua Tree. Experience sunrise drum circles, guided sound journeys under the stars, rhythmic movement workshops, and deep silence in the desert.',
      type: EventType.SOUL_TRAVEL,
      location: 'Joshua Tree Retreat Center, Joshua Tree, CA',
      daysFromNow: 56,
      durationHours: 48,
      tiers: [
        { name: 'Camping', price: 375, capacity: 15 },
        { name: 'Private Casita', price: 525, capacity: 6 },
      ],
      coverImageUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 7, // Rebecca Stone
      title: 'Art & Nature Healing Retreat — Carmel Valley',
      description: 'A weekend of creative healing immersed in the beauty of Carmel Valley. Combine outdoor art-making, expressive writing, mindful hiking, and group art therapy in a stunning natural setting. All materials provided. No art experience needed.',
      type: EventType.SOUL_TRAVEL,
      location: 'Carmel Valley Ranch, CA',
      daysFromNow: 49,
      durationHours: 48,
      tiers: [{ name: 'All-Inclusive', price: 495, capacity: 12 }],
      coverImageUrl: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&h=400&fit=crop',
    },
  ];

  let eventCount = 0;
  for (const ev of eventData) {
    const guide = guideUsers[ev.guideIdx];
    if (!guide?.guideProfile) continue;

    const startTime = new Date();
    startTime.setDate(startTime.getDate() + ev.daysFromNow);
    startTime.setHours(10, 0, 0, 0);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + ev.durationHours * 60);

    const event = await prisma.event.create({
      data: {
        guideId: guide.guideProfile.id,
        title: ev.title,
        description: ev.description,
        type: ev.type,
        startTime,
        endTime,
        timezone: 'America/Los_Angeles',
        location: ev.location,
        coverImageUrl: (ev as any).coverImageUrl || null,
        isPublished: true,
        ticketTiers: {
          create: ev.tiers.map((t) => ({
            name: t.name,
            price: t.price,
            capacity: t.capacity,
            sold: Math.floor(t.capacity * 0.4),
            isActive: true,
          })),
        },
      },
    });
    eventCount++;
  }
  console.log(`  ✓ ${eventCount} events created`);

  // ── 10. Digital Products ────────────────────────────────────────────────────
  console.log('📦 Products...');

  const productData = [
    {
      guideIdx: 0,
      name: '21-Day Mindfulness for Tech Workers — Audio Course',
      description: 'A comprehensive 21-day guided audio meditation program designed specifically for software engineers, product managers, and startup founders dealing with the unique stressors of Silicon Valley. Includes 21 guided meditations (10–20 min each), a PDF workbook, and access to a private community.',
      type: ProductType.DIGITAL,
      price: 67,
      imageUrls: ['https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=400&h=400&fit=crop'],
    },
    {
      guideIdx: 0,
      name: 'Breath & Release — Breathwork Audio Series',
      description: '6 guided breathwork sessions ranging from 10 to 30 minutes. Covers calming breath, energizing breath, emotional release breathwork, and sleep preparation. Immediate digital download in MP3 format.',
      type: ProductType.DIGITAL,
      price: 29,
      imageUrls: ['https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=400&h=400&fit=crop'],
    },
    {
      guideIdx: 2,
      name: 'The Silicon Valley Purpose Workbook',
      description: 'A 60-page interactive PDF workbook based on Marcus Thompson\'s signature Purpose Discovery framework used with hundreds of coaching clients. Includes values excavation exercises, strengths mapping tools, vision crafting prompts, and a 90-day action planning template.',
      type: ProductType.DIGITAL,
      price: 37,
      imageUrls: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=400&fit=crop'],
    },
    {
      guideIdx: 4,
      name: 'Reprogram Your Mind — Hypnotherapy Audio Bundle',
      description: 'A collection of 8 professionally recorded hypnotherapy sessions by James O\'Brien covering: stress relief, confidence building, sleep improvement, overcoming procrastination, public speaking anxiety, morning motivation, breaking bad habits, and releasing perfectionism.',
      type: ProductType.DIGITAL,
      price: 89,
      imageUrls: ['https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400&h=400&fit=crop'],
    },
    {
      guideIdx: 5,
      name: 'Reiki Level 1 Home Practice Guide',
      description: 'Complete 45-page PDF guide to practicing Reiki self-healing at home. Written by Maya Williams (Usui Reiki Master Teacher). Includes hand positions, chakra system overview, setting sacred space, daily self-treatment routine, and troubleshooting common experiences.',
      type: ProductType.DIGITAL,
      price: 24,
      imageUrls: ['https://images.unsplash.com/photo-1600618528240-fb9fc964b853?w=400&h=400&fit=crop'],
    },
    {
      guideIdx: 8,
      name: 'Himalayan Crystal Singing Bowl — Hand-Selected by Michael Tanaka',
      description: 'A hand-selected, museum-quality 8" frosted crystal quartz singing bowl attuned to the F note (Heart Chakra). Michael personally selects and tests each bowl for tone purity and resonance quality. Includes mallet, O-ring, and beginner\'s practice guide. Ships from San Jose, CA.',
      type: ProductType.PHYSICAL,
      price: 185,
      stockQuantity: 8,
      imageUrls: ['https://images.unsplash.com/photo-1514533212735-5df27d970db0?w=400&h=400&fit=crop', 'https://images.unsplash.com/photo-1536623975707-c4b3b2af565d?w=400&h=400&fit=crop'],
    },
    {
      guideIdx: 3,
      name: 'Ayurvedic Morning Ritual Kit — Curated by Priya Sharma',
      description: 'A beautifully curated Ayurvedic self-care kit including: copper tongue scraper, organic sesame oil (8oz) for abhyanga, rose water mist, neem toothpaste, and Priya\'s 20-page Morning Ritual guide. Everything you need to start an authentic Ayurvedic morning routine.',
      type: ProductType.PHYSICAL,
      price: 68,
      stockQuantity: 25,
      imageUrls: ['https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=400&fit=crop', 'https://images.unsplash.com/photo-1611072337226-3b3e9a0e0f3f?w=400&h=400&fit=crop'],
    },
    {
      guideIdx: 9,
      name: 'Community Drum Circle Starter Kit',
      description: 'Everything you need to start your own healing drum circle: a hand-crafted African djembe drum, shaker, drumming guide booklet by Elena Vasquez, and access to online rhythm tutorials. Perfect for group wellness activities and team building.',
      type: ProductType.PHYSICAL,
      price: 145,
      stockQuantity: 12,
      imageUrls: ['https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=400&h=400&fit=crop'],
    },
    {
      guideIdx: 1,
      name: 'Traditional Chinese Herbal Tea Collection — Curated by Dr. Chen',
      description: 'A premium collection of 6 organic Chinese herbal teas hand-selected by Dr. Sarah Chen for common Silicon Valley ailments: stress relief, immune support, digestive harmony, sleep aid, energy boost, and mental clarity. Each tin contains 15 sachets. Includes a beautiful storage box and Dr. Chen\'s brewing guide.',
      type: ProductType.PHYSICAL,
      price: 78,
      stockQuantity: 30,
      imageUrls: ['https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&h=400&fit=crop', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=400&fit=crop'],
    },
  ];

  let productCount = 0;
  for (const prod of productData) {
    const guide = guideUsers[prod.guideIdx];
    if (!guide?.guideProfile) continue;

    await prisma.product.create({
      data: {
        guideId: guide.guideProfile.id,
        name: prod.name,
        description: prod.description,
        type: prod.type,
        price: prod.price,
        stockQuantity: prod.stockQuantity ?? null,
        imageUrls: prod.imageUrls || [],
        isActive: true,
      },
    });
    productCount++;
  }
  console.log(`  ✓ ${productCount} products created`);

  // ── 11. Blog Posts ──────────────────────────────────────────────────────────
  console.log('📝 Blog posts...');

  const blogData = [
    {
      guideIdx: 0,
      title: '5 Meditation Techniques That Actually Work for Busy Tech Professionals',
      slug: '5-meditation-techniques-for-tech-professionals',
      excerpt: 'You have heard that meditation is good for you. But with a full sprint backlog, back-to-back standups, and a Slack that never sleeps, how do you actually make it work?',
      content: JSON.stringify({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Why Most Tech Workers Give Up on Meditation' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'In my 8 years of teaching in Silicon Valley, I have seen the same pattern repeat: a brilliant engineer or product manager starts a meditation app, practices for 3-5 days, then stops because they "don\'t have time" or "can\'t quiet their mind." The problem isn\'t them — it\'s that most meditation advice was not designed for people whose brains are wired for rapid context-switching and problem-solving.' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'These 5 techniques are specifically chosen because they work with the tech-trained mind, not against it.' }] },
        ],
      }),
      tags: ['Meditation', 'Tech Wellness', 'Mindfulness', 'Silicon Valley', 'Stress'],
      coverImageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 2,
      title: 'The Hidden Cost of Hustle Culture: A Coach\'s View from Silicon Valley',
      slug: 'hidden-cost-of-hustle-culture-silicon-valley',
      excerpt: 'After coaching over 300 tech executives and founders, I\'ve noticed a pattern that nobody talks about at TechCrunch or in Slack channels. This is what I see behind closed doors.',
      content: JSON.stringify({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What Success Looks Like Up Close' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'When I meet with clients for the first time, they typically present a resume that would make most people envious: Staff Engineer at a FAANG company, or founder of a Series B startup, or VP of Product at a unicorn. They are objectively successful by every conventional metric. And they are often quietly miserable.' }] },
        ],
      }),
      tags: ['Life Coaching', 'Burnout', 'Silicon Valley', 'Purpose', 'Mental Health'],
      coverImageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 8,
      title: 'Sound Healing 101: What the Science Actually Says',
      slug: 'sound-healing-101-what-science-says',
      excerpt: 'As a music-school-trained practitioner who spent years studying with Tibetan masters, I get asked all the time: is sound healing real? Here is what the research shows.',
      content: JSON.stringify({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'The Physics of Sound and the Body' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'The human body is approximately 60% water. Sound travels through water roughly 4.3 times faster than through air. When you lie in a sound bath, you are not just hearing the bowls — you are feeling them move through every cell of your body. This is not metaphor. This is physics.' }] },
        ],
      }),
      tags: ['Sound Healing', 'Science', 'Meditation', 'Wellness Research', 'San Jose'],
      coverImageUrl: 'https://images.unsplash.com/photo-1514533212735-5df27d970db0?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 3,
      title: 'Understanding Your Dosha: An Ayurvedic Guide to Self-Care',
      slug: 'understanding-your-dosha-ayurvedic-guide',
      excerpt: 'Ayurveda teaches that each person has a unique constitution. Learning your dosha type is the first step to designing a wellness routine that actually works for your body.',
      content: '<h2>What Is a Dosha?</h2><p>In Ayurveda, the three doshas — Vata, Pitta, and Kapha — are biological energies found throughout the body and mind. They govern all physical and mental processes and provide every living being with an individual blueprint for health and fulfillment.</p><p>Most people are a combination of two doshas, with one being dominant. Understanding your primary dosha helps you make better choices about diet, exercise, sleep, and even career.</p><h2>Quick Dosha Self-Assessment</h2><ul><li><strong>Vata (Air + Ether):</strong> Thin build, creative, energetic, prone to anxiety and dry skin</li><li><strong>Pitta (Fire + Water):</strong> Medium build, focused, ambitious, prone to inflammation and irritability</li><li><strong>Kapha (Earth + Water):</strong> Sturdy build, calm, loyal, prone to weight gain and lethargy</li></ul>',
      tags: ['Ayurveda', 'Yoga', 'Self-Care', 'Wellness', 'Dosha'],
      coverImageUrl: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 5,
      title: 'Reiki for Beginners: What to Expect in Your First Session',
      slug: 'reiki-for-beginners-first-session',
      excerpt: 'Walking into your first Reiki session can feel mysterious. As a Reiki Master with 12 years of practice, here is everything you need to know to feel prepared and at ease.',
      content: '<h2>What Happens During a Reiki Session?</h2><p>Reiki is a gentle, non-invasive form of energy healing. During a session, you lie fully clothed on a massage table while the practitioner places their hands lightly on or just above your body in a series of positions from head to toe.</p><p>Most people experience deep relaxation, warmth, tingling, or a sense of floating. Some people fall asleep — and that is perfectly fine. The healing happens whether you are awake or asleep.</p><h2>How to Prepare</h2><ul><li>Wear comfortable, loose clothing</li><li>Avoid heavy meals 2 hours before</li><li>Stay hydrated</li><li>Come with an open mind — no specific belief system is required</li></ul><p>After the session, drink plenty of water and give yourself permission to rest. Some people feel energized; others feel deeply peaceful. Both responses are normal.</p>',
      tags: ['Reiki', 'Energy Healing', 'Beginners Guide', 'Wellness', 'Los Altos'],
      coverImageUrl: 'https://images.unsplash.com/photo-1600618528240-fb9fc964b853?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 7,
      title: 'Why Art Therapy Works When Talk Therapy Feels Stuck',
      slug: 'why-art-therapy-works-when-talk-therapy-stuck',
      excerpt: 'Sometimes words are not enough. As a board-certified art therapist, I have seen how creative expression can unlock healing that years of traditional therapy could not reach.',
      content: '<h2>The Limits of Language</h2><p>Talk therapy is powerful. But some experiences — trauma, grief, shame, early childhood wounds — are stored in parts of the brain that language cannot easily access. They live in the body, in images, in feelings that resist being put into words.</p><p>Art therapy works because it bypasses the verbal, analytical brain and speaks directly to the emotional and sensory systems where these experiences are stored.</p><h2>You Do Not Need to Be an Artist</h2><p>This is the most important thing I tell every new client: art therapy is not about making beautiful art. It is about using creative materials as a language for expressing what is inside you. Stick figures are welcome. Scribbles are welcome. The process matters, not the product.</p>',
      tags: ['Art Therapy', 'Mental Health', 'Trauma', 'Creative Healing', 'Santa Clara'],
      coverImageUrl: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 4,
      title: 'Hypnotherapy for Engineers: Debugging Your Subconscious Mind',
      slug: 'hypnotherapy-for-engineers-debugging-subconscious',
      excerpt: 'As a hypnotherapist in Silicon Valley, I work with brilliant analytical minds every day. Here is how I explain hypnotherapy in terms that make sense to engineers.',
      content: '<h2>Your Mind Is Software</h2><p>Think of your subconscious mind as an operating system that was largely programmed before age 7. Most of the "bugs" — anxiety, self-doubt, imposter syndrome, procrastination — are not logic errors. They are deeply installed programs running in the background, consuming resources.</p><p>Hypnotherapy is essentially a debugging tool for the subconscious. In a relaxed, focused state (not sleep, not mind control — just deep focus), we can access and update these outdated programs.</p><h2>Common Myths Debunked</h2><ul><li><strong>Myth:</strong> You lose control. <strong>Reality:</strong> You are fully aware and in control at all times.</li><li><strong>Myth:</strong> Only gullible people can be hypnotized. <strong>Reality:</strong> Intelligent, analytical people are often the best subjects because they can focus deeply.</li><li><strong>Myth:</strong> It is instant magic. <strong>Reality:</strong> Most issues resolve in 3-6 sessions, not one.</li></ul>',
      tags: ['Hypnotherapy', 'NLP', 'Tech Wellness', 'Anxiety', 'Silicon Valley'],
      coverImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 6,
      title: 'QiGong for Desk Workers: 5 Exercises You Can Do at Your Standing Desk',
      slug: 'qigong-for-desk-workers-standing-desk-exercises',
      excerpt: 'Spending 8+ hours at a desk is slowly destroying your body. These 5 simple QiGong exercises take less than 10 minutes and can transform how you feel by 3pm.',
      content: '<h2>The Tech Worker Body</h2><p>After teaching QiGong in San Jose for 7 years, I can spot a tech worker from across the room: rounded shoulders, forward head posture, tight hips, shallow breathing. This is not a character flaw — it is the physical adaptation to desk work. And QiGong is the antidote.</p><h2>5 Desk-Friendly QiGong Exercises</h2><ol><li><strong>Shaking the Tree (2 min):</strong> Stand and gently bounce on your heels while shaking your arms loosely. Releases tension throughout the entire body.</li><li><strong>Lifting the Sky (2 min):</strong> Interlace fingers, push palms up overhead, stretch, release. Repeat 8 times. Opens the chest and shoulders.</li><li><strong>Turning the Waist (2 min):</strong> Feet shoulder-width, twist gently side to side letting arms swing. Mobilizes the spine and aids digestion.</li><li><strong>Golden Rooster Stands on One Leg (2 min):</strong> Balance on each leg for 30 seconds. Improves focus, proprioception, and core stability.</li><li><strong>Three Deep Breaths (1 min):</strong> Inhale through nose for 4 counts, hold for 4, exhale through mouth for 8. Resets the nervous system.</li></ol>',
      tags: ['QiGong', 'Desk Workers', 'Tech Wellness', 'Exercises', 'San Jose'],
      coverImageUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=400&fit=crop',
    },
    {
      guideIdx: 9,
      title: 'The Healing Power of Rhythm: How Drumming Reduces Stress',
      slug: 'healing-power-of-rhythm-drumming-reduces-stress',
      excerpt: 'Research shows that group drumming reduces cortisol levels and boosts immune function. As a music therapist, I have witnessed its power firsthand in hospitals, offices, and parks.',
      content: '<h2>Rhythm Is Medicine</h2><p>Humans have been using rhythm for healing for at least 40,000 years. From African djembe circles to Native American powwows to Japanese taiko, every culture on earth has discovered that beating a drum together does something profound to the human body and spirit.</p><p>Modern science is catching up. A landmark study published in the journal Alternative Therapies in Health and Medicine found that group drumming sessions produced significant increases in natural killer cell activity — the immune cells that fight cancer and viruses.</p><h2>Why It Works</h2><ul><li><strong>Entrainment:</strong> Your brainwaves synchronize with the rhythm, inducing a meditative state</li><li><strong>Vagal tone:</strong> Rhythmic vibration stimulates the vagus nerve, activating the relaxation response</li><li><strong>Community:</strong> Group drumming creates social bonding through synchronized activity</li><li><strong>Expression:</strong> Drumming provides a non-verbal outlet for emotions and stress</li></ul>',
      tags: ['Music Therapy', 'Drumming', 'Stress Relief', 'Community', 'Palo Alto'],
      coverImageUrl: 'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=800&h=400&fit=crop',
    },
  ];

  let blogCount = 0;
  for (const post of blogData) {
    const guide = guideUsers[post.guideIdx];
    if (!guide?.guideProfile) continue;

    await prisma.blogPost.upsert({
      where: { guideId_slug: { guideId: guide.guideProfile.id, slug: post.slug } },
      create: {
        guideId: guide.guideProfile.id,
        title: post.title,
        slug: post.slug,
        content: post.content,
        excerpt: post.excerpt,
        coverImageUrl: (post as any).coverImageUrl || null,
        tags: post.tags,
        isPublished: true,
        publishedAt: past(Math.floor(Math.random() * 30) + 5),
      },
      update: {},
    });
    blogCount++;
  }
  console.log(`  ✓ ${blogCount} blog posts created`);

  // ── Shipping Methods ─────────────────────────────────────────────────────────
  console.log('\n📦 Seeding shipping methods...');
  const shippingMethods = [
    { name: 'Standard Shipping', description: 'Delivered via USPS Ground', price: 12.00, estimatedDaysMin: 7, estimatedDaysMax: 14, sortOrder: 0 },
    { name: 'Express Shipping', description: 'Priority delivery via USPS/UPS', price: 28.00, estimatedDaysMin: 3, estimatedDaysMax: 5, sortOrder: 1 },
    { name: 'International Priority', description: 'International delivery via DHL/FedEx', price: 45.00, estimatedDaysMin: 5, estimatedDaysMax: 10, sortOrder: 2 },
  ];
  for (const sm of shippingMethods) {
    await prisma.shippingMethod.upsert({
      where: { id: slug(sm.name) },
      update: sm,
      create: { id: slug(sm.name), ...sm, updatedAt: new Date() },
    });
  }
  console.log(`  ✓ ${shippingMethods.length} shipping methods created`);

  // ── Tax Rates ───────────────────────────────────────────────────────────────
  console.log('💰 Seeding tax rates...');
  const taxRates = [
    { state: 'CA', rate: 0.0863, name: 'California State Tax' },
    { state: 'NY', rate: 0.08, name: 'New York State Tax' },
    { state: 'TX', rate: 0.0625, name: 'Texas State Tax' },
    { state: 'FL', rate: 0.06, name: 'Florida State Tax' },
    { state: 'WA', rate: 0.065, name: 'Washington State Tax' },
    { state: 'CO', rate: 0.029, name: 'Colorado State Tax' },
    { state: 'AZ', rate: 0.056, name: 'Arizona State Tax' },
    { state: 'OR', rate: 0.0, name: 'Oregon (No Sales Tax)' },
    { state: 'NV', rate: 0.0685, name: 'Nevada State Tax' },
    { state: 'HI', rate: 0.04, name: 'Hawaii General Excise Tax' },
  ];
  for (const tr of taxRates) {
    await prisma.taxRate.upsert({
      where: { state_country: { state: tr.state, country: 'US' } },
      update: { rate: tr.rate, name: tr.name },
      create: { state: tr.state, country: 'US', rate: tr.rate, name: tr.name, updatedAt: new Date() },
    });
  }
  console.log(`  ✓ ${taxRates.length} tax rates created`);

  // ── Promo Codes (demo) ──────────────────────────────────────────────────────
  console.log('🎟️  Seeding demo promo codes...');
  await prisma.promoCode.upsert({
    where: { code: 'WELCOME40' },
    update: {},
    create: {
      code: 'WELCOME40',
      type: 'PERCENTAGE',
      amount: 40,
      maxDiscountAmount: 250,
      maxUses: 1000,
      isActive: true,
      expiresAt: future(180),
      updatedAt: new Date(),
    },
  });
  await prisma.promoCode.upsert({
    where: { code: 'SPIRIT10' },
    update: {},
    create: {
      code: 'SPIRIT10',
      type: 'FIXED_AMOUNT',
      amount: 10,
      minOrderAmount: 50,
      isActive: true,
      expiresAt: future(365),
      updatedAt: new Date(),
    },
  });
  console.log('  ✓ 2 promo codes created (WELCOME40, SPIRIT10)');

  // ── Done ────────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('  ALL ACCOUNTS USE PASSWORD: 12345678');
  console.log('───────────────────────────────────────────────────');
  console.log('  ADMIN:  admin@spiritualcalifornia.com');
  console.log('───────────────────────────────────────────────────');
  console.log('  GUIDES:');
  guideData.forEach((g) => console.log(`    ${g.email.padEnd(35)} → ${g.displayName} (${g.location})`));
  console.log('───────────────────────────────────────────────────');
  console.log('  SEEKERS:');
  seekerData.forEach((s) => console.log(`    ${s.email.padEnd(35)} → ${s.firstName} ${s.lastName}`));
  console.log('═══════════════════════════════════════════════════\n');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
