import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';

// ─── Job payload shape ────────────────────────────────────────────────────────
interface VerificationJobData {
  guideId: string;
}

// ─── Stub extracted data shape ────────────────────────────────────────────────
interface ExtractedCredentialData {
  rawText: string;
  institution: string | null;
  title: string | null;
  year: number | null;
  confidence: number;
}

const QUEUE_NAME = 'document-analysis';

@Injectable()
export class VerificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VerificationService.name);

  // BullMQ instances — null in stub mode (no Redis / placeholder keys)
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  // Stub mode flags
  private readonly isPersonaStub: boolean;
  private readonly isTextractStub: boolean;
  private readonly isClaudeStub: boolean;
  private readonly isRedisStub: boolean;

  // Persona config
  private readonly personaApiKey: string;
  private readonly personaTemplateId: string;

  // Redis connection config
  private readonly redisHost: string;
  private readonly redisPort: number;
  private readonly redisPassword: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const personaKey = this.config.get<string>('PERSONA_API_KEY', '');
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY', '');
    const awsKey = this.config.get<string>('AWS_ACCESS_KEY_ID', '');

    this.isPersonaStub = !personaKey || personaKey.startsWith('your-');
    this.isTextractStub = !awsKey || awsKey.startsWith('your-');
    this.isClaudeStub = !anthropicKey || anthropicKey.startsWith('your-');
    this.personaApiKey = personaKey;
    this.personaTemplateId = this.config.get<string>('PERSONA_TEMPLATE_ID', '');

    this.redisHost = this.config.get<string>('REDIS_HOST', 'localhost');
    this.redisPort = this.config.get<number>('REDIS_PORT', 6379);
    this.redisPassword = this.config.get<string>('REDIS_PASSWORD');

    // Stub mode: skip BullMQ if Redis is unavailable or all APIs are stubs
    this.isRedisStub = this.isPersonaStub && this.isTextractStub && this.isClaudeStub;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async onModuleInit() {
    if (this.isRedisStub) {
      this.logger.warn(
        '[STUB] Verification service in stub mode — BullMQ queue not started (no real API keys detected)',
      );
      return;
    }

    const connection = {
      host: this.redisHost,
      port: this.redisPort,
      ...(this.redisPassword ? { password: this.redisPassword } : {}),
    };

    this.queue = new Queue(QUEUE_NAME, { connection });

    this.worker = new Worker<VerificationJobData>(
      QUEUE_NAME,
      async (job: Job<VerificationJobData>) => {
        await this.processVerificationJob(job.data.guideId);
      },
      { connection, concurrency: 3 },
    );

    this.worker.on('completed', (job) =>
      this.logger.log(`[Queue] Job ${job.id} completed for guide ${job.data.guideId}`),
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`[Queue] Job ${job?.id} failed: ${err.message}`),
    );

    this.logger.log('[Queue] document-analysis BullMQ worker started');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Called by GuidesController after a guide submits onboarding.
   * Enqueues the full credential + identity verification pipeline.
   */
  async enqueueGuideVerification(guideId: string): Promise<void> {
    if (this.isRedisStub || !this.queue) {
      this.logger.warn(
        `[STUB] enqueueGuideVerification — running inline stub pipeline for guide: ${guideId}`,
      );
      // Fire-and-forget: run stub synchronously in background
      this.runStubPipeline(guideId).catch((err) =>
        this.logger.error(`[STUB] Inline stub pipeline error: ${err.message}`),
      );
      return;
    }

    await this.queue.add(
      'analyze-guide-credentials',
      { guideId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    );

    this.logger.log(`[Queue] Enqueued verification job for guide: ${guideId}`);
  }

  // ─── Core Processing Pipeline ──────────────────────────────────────────────

  /**
   * Main verification pipeline — runs both in BullMQ worker and inline stub mode.
   * Steps:
   *   1. Fetch guide + credentials
   *   2. OCR each credential document (Textract / stub)
   *   3. NLP entity extraction on OCR text (Claude / stub)
   *   4. Persist results to DB
   *   5. Initiate Persona identity check (Persona / stub)
   *   6. Guide remains IN_REVIEW — admin picks up from verification queue
   */
  private async processVerificationJob(guideId: string): Promise<void> {
    this.logger.log(`[Verification] Starting pipeline for guide: ${guideId}`);

    const guide = await this.prisma.guideProfile.findUnique({
      where: { id: guideId },
      include: { credentials: true, user: true },
    });

    if (!guide) {
      this.logger.error(`[Verification] Guide not found: ${guideId}`);
      return;
    }

    // ── Step 2: OCR + NLP each credential document ────────────────────────
    for (const credential of guide.credentials) {
      // Only process credentials that have an uploaded document
      const s3Key = (credential as any).documentS3Key as string | null;
      if (!s3Key) {
        this.logger.debug(
          `[Verification] Credential ${credential.id} has no document — skipping OCR`,
        );
        continue;
      }

      try {
        // 2a. Textract OCR
        const ocrResult = await this.analyzeWithTextract(s3Key);

        // 2b. Claude NLP entity extraction
        const entities = await this.extractEntitiesWithClaude(
          ocrResult.rawText,
          credential.title,
        );

        // 2c. Persist results
        await this.prisma.credential.update({
          where: { id: credential.id },
          data: {
            confidenceScore: entities.confidence,
            extractedData: {
              rawText: ocrResult.rawText,
              institution: entities.institution,
              title: entities.title,
              year: entities.year,
              processedAt: new Date().toISOString(),
            },
          },
        });

        // 2d. Log to CredentialVerification audit trail
        await this.prisma.credentialVerification.createMany({
          data: [
            {
              credentialId: credential.id,
              stage: 'textract',
              status: 'completed',
              result: { rawText: ocrResult.rawText, confidence: ocrResult.confidence },
            },
            {
              credentialId: credential.id,
              stage: 'claude_nlp',
              status: 'completed',
              result: {
                institution: entities.institution,
                title: entities.title,
                year: entities.year,
                confidence: entities.confidence,
              },
            },
          ],
        });

        this.logger.log(
          `[Verification] Credential ${credential.id} processed — confidence: ${entities.confidence}`,
        );
      } catch (err: any) {
        this.logger.error(
          `[Verification] Failed to process credential ${credential.id}: ${err.message}`,
        );

        await this.prisma.credentialVerification.create({
          data: {
            credentialId: credential.id,
            stage: 'textract',
            status: 'failed',
            result: { error: err.message },
          },
        });
      }
    }

    // ── Step 3: Persona identity check ────────────────────────────────────
    await this.initiatePersonaCheck(guide.userId, guideId);

    this.logger.log(
      `[Verification] Pipeline complete for guide: ${guideId} — awaiting admin review`,
    );
  }

  // Alias for BullMQ worker + inline stub
  private async runStubPipeline(guideId: string): Promise<void> {
    return this.processVerificationJob(guideId);
  }

  // ─── Textract Integration ──────────────────────────────────────────────────

  /**
   * OCR a credential document via AWS Textract.
   * Downloads the file from S3 first (as bytes) since Textract doesn't support
   * eu-north-1 directly — uses eu-west-1 Textract endpoint with byte input.
   */
  private async analyzeWithTextract(
    s3Key: string,
  ): Promise<{ rawText: string; confidence: number }> {
    if (this.isTextractStub) {
      this.logger.warn(`[STUB] Textract OCR skipped for key: ${s3Key}`);
      return {
        rawText:
          'STUB EXTRACTED TEXT: Certified Meditation Teacher • Chopra Center for Wellbeing • Issued 2021',
        confidence: 0.94,
      };
    }

    const awsRegion = this.config.get<string>('AWS_REGION', 'eu-north-1');
    const bucket = this.config.get<string>('AWS_S3_BUCKET')!;
    const credentials = {
      accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID')!,
      secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY')!,
    };

    // Step 1: Download file bytes from S3
    const s3 = new S3Client({ region: awsRegion, credentials });
    const s3Response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }));
    const bytes = await (s3Response.Body as any).transformToByteArray() as Uint8Array;

    // Step 2: Send bytes to Textract using AWS_TEXTRACT_REGION (must support Textract — eu-north-1 does not)
    const textractRegion = this.config.get<string>('AWS_TEXTRACT_REGION', 'eu-west-1');
    const textract = new TextractClient({ region: textractRegion, credentials });
    const response = await textract.send(
      new DetectDocumentTextCommand({ Document: { Bytes: bytes } }),
    );

    const lineBlocks = response.Blocks?.filter((b) => b.BlockType === 'LINE' && b.Text) ?? [];
    const rawText = lineBlocks.map((b) => b.Text!).join('\n');
    const avgConfidence =
      lineBlocks.length > 0
        ? lineBlocks.reduce((sum, b) => sum + (b.Confidence ?? 0), 0) / lineBlocks.length / 100
        : 0.9;

    this.logger.log(
      `[Textract] Extracted ${lineBlocks.length} lines from ${s3Key}, avg confidence: ${avgConfidence.toFixed(2)}`,
    );

    return { rawText, confidence: Math.min(avgConfidence, 1) };
  }

  // ─── Claude NLP Integration ────────────────────────────────────────────────

  /**
   * Extract structured entities from OCR text using Claude.
   */
  private async extractEntitiesWithClaude(
    ocrText: string,
    credentialTitle: string,
  ): Promise<ExtractedCredentialData> {
    if (this.isClaudeStub) {
      this.logger.warn(`[STUB] Claude NLP extraction skipped for: "${credentialTitle}"`);
      return {
        rawText: ocrText,
        institution: 'Chopra Center for Wellbeing',
        title: credentialTitle,
        year: 2021,
        confidence: 0.87,
      };
    }

    const client = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY')!,
    });

    const prompt = `You are extracting structured data from a wellness/spiritual practitioner credential document.

Extract the following fields from the document text below:
- institution: The name of the issuing organization, school, or certifying body (string or null)
- title: The exact name of the certification, degree, or credential (string or null)
- year: The 4-digit year the credential was issued (number or null)
- confidence: Your confidence score from 0.0 to 1.0 in the accuracy of these extractions

Return ONLY valid JSON with no markdown, no explanation, no code blocks. Example:
{"institution":"Chopra Center for Wellbeing","title":"Certified Meditation Teacher","year":2021,"confidence":0.92}

Credential title provided by applicant: "${credentialTitle}"

Document text:
${ocrText}`;

    const message = await client.messages.create({
      model: this.config.get<string>('ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = (message.content[0] as Anthropic.TextBlock).text.trim();

    let parsed: { institution: string | null; title: string | null; year: number | null; confidence: number };
    try {
      parsed = JSON.parse(responseText);
    } catch {
      this.logger.error(`[Claude] Failed to parse JSON response: ${responseText}`);
      parsed = { institution: null, title: credentialTitle, year: null, confidence: 0.5 };
    }

    this.logger.log(
      `[Claude] Extracted entities for "${credentialTitle}" — confidence: ${parsed.confidence}`,
    );

    return { rawText: ocrText, ...parsed };
  }

  // ─── Persona Identity Check ────────────────────────────────────────────────

  /**
   * Create a Persona identity verification inquiry for the guide's user account.
   * Persona calls back to POST /verification/persona/webhook with the result.
   */
  private async initiatePersonaCheck(userId: string, guideId: string): Promise<void> {
    if (this.isPersonaStub) {
      const stubInquiryId = `stub-inquiry-${randomUUID()}`;
      this.logger.warn(
        `[STUB] Persona identity check skipped for user: ${userId} — fake inquiryId: ${stubInquiryId}`,
      );

      await this.prisma.personaVerification.upsert({
        where: { userId },
        create: { userId, inquiryId: stubInquiryId, status: 'stub_pending', referenceId: guideId },
        update: { inquiryId: stubInquiryId, status: 'stub_pending', referenceId: guideId },
      });

      return;
    }

    const apiKey = this.config.get<string>('PERSONA_API_KEY')!;
    const templateId = this.config.get<string>('PERSONA_TEMPLATE_ID')!;

    const response = await fetch('https://withpersona.com/api/v1/inquiries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Persona-Version': '2023-01-05',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            'inquiry-template-id': templateId,
            'reference-id': userId,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Persona API error: ${response.status} ${response.statusText} — ${errorBody}`);
    }

    const json = (await response.json()) as any;
    const inquiryId: string = json.data?.id;

    if (!inquiryId) {
      throw new Error('Persona API returned no inquiry ID');
    }

    await this.prisma.personaVerification.upsert({
      where: { userId },
      create: { userId, inquiryId, status: 'created', referenceId: guideId },
      update: { inquiryId, status: 'created', referenceId: guideId },
    });

    this.logger.log(`[Persona] Inquiry created: ${inquiryId} for user: ${userId}`);
  }

  // ─── Persona Webhook Handler ───────────────────────────────────────────────

  /**
   * Called by VerificationController when Persona posts a webhook event.
   * Updates PersonaVerification status and conditionally approves the guide.
   */
  // ─── Start Identity Verification (Persona) ──────────────────────────────────

  async startIdentityVerification(userId: string): Promise<{
    inquiryId: string;
    sessionToken: string | null;
    verifyUrl: string | null;
    stub: boolean;
  }> {
    if (this.isPersonaStub) {
      const stubId = `stub_inq_${randomUUID()}`;
      this.logger.warn(`[STUB] Persona identity verification — returning mock inquiryId: ${stubId}`);
      return { inquiryId: stubId, sessionToken: null, verifyUrl: null, stub: true };
    }

    // Check if an existing pending inquiry exists for this user
    const existing = await this.prisma.personaVerification.findUnique({ where: { userId } });
    if (existing && existing.status === 'pending') {
      this.logger.log(`[Persona] Resuming existing inquiry ${existing.inquiryId} for user ${userId}`);
      return {
        inquiryId: existing.inquiryId,
        sessionToken: null,
        verifyUrl: `https://withpersona.com/verify?inquiry-id=${existing.inquiryId}`,
        stub: false,
      };
    }

    // Create new Persona inquiry via REST API
    // itmplv_ prefix = template version → use inquiry-template-version-id
    // itmpl_  prefix = template          → use inquiry-template-id
    const isTemplateVersion = this.personaTemplateId.startsWith('itmplv_');
    const templateAttrKey = isTemplateVersion ? 'inquiry-template-version-id' : 'inquiry-template-id';

    const response = await fetch('https://withpersona.com/api/v1/inquiries', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.personaApiKey}`,
        'Content-Type': 'application/json',
        'Persona-Version': '2023-01-05',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            [templateAttrKey]: this.personaTemplateId,
            'reference-id': userId,
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`[Persona] Failed to create inquiry: ${response.status} ${errText}`);
      throw new BadGatewayException(`Persona API error: ${response.status} — ${errText}`);
    }

    const json: any = await response.json();
    const inquiryId: string = json?.data?.id;
    const sessionToken: string | undefined = json?.data?.attributes?.['session-token'];

    if (!inquiryId) {
      throw new Error('Persona returned no inquiry ID');
    }

    // Persist inquiry record
    await this.prisma.personaVerification.upsert({
      where: { userId },
      create: { userId, inquiryId, status: 'pending' },
      update: { inquiryId, status: 'pending', completedAt: null },
    });

    this.logger.log(`[Persona] Created inquiry ${inquiryId} for user ${userId}`);

    return {
      inquiryId,
      sessionToken: sessionToken ?? null,
      verifyUrl: `https://withpersona.com/verify?inquiry-id=${inquiryId}${sessionToken ? `&session-token=${sessionToken}` : ''}`,
      stub: false,
    };
  }

  async handlePersonaWebhook(payload: {
    inquiryId: string;
    status: 'approved' | 'declined' | 'needs_review';
  }): Promise<void> {
    const { inquiryId, status } = payload;

    const record = await this.prisma.personaVerification.findUnique({
      where: { inquiryId },
    });

    if (!record) {
      this.logger.warn(`[Persona] Webhook received for unknown inquiryId: ${inquiryId}`);
      return;
    }

    await this.prisma.personaVerification.update({
      where: { inquiryId },
      data: {
        status,
        completedAt: new Date(),
      },
    });

    this.logger.log(`[Persona] Inquiry ${inquiryId} → ${status} for user: ${record.userId}`);

    // Auto-approve identity when Persona approves (credential review still manual)
    if (status === 'approved') {
      await this.prisma.guideProfile.updateMany({
        where: { userId: record.userId },
        data: { verificationStatus: 'IN_REVIEW' },
      });
    }
  }

  // ─── Admin Review Helpers ──────────────────────────────────────────────────

  /**
   * Used by Admin to approve or reject a guide after credential + identity review.
   */
  async reviewGuide(
    guideId: string,
    decision: 'approve' | 'reject',
    adminNotes?: string,
  ): Promise<void> {
    const status = decision === 'approve' ? 'APPROVED' : 'REJECTED';

    const guide = await this.prisma.guideProfile.update({
      where: { id: guideId },
      data: {
        verificationStatus: status as any,
        isVerified: decision === 'approve',
        isPublished: decision === 'approve',
      },
      include: { user: { select: { email: true, firstName: true } } },
    });

    // Persist admin notes on any flagged credentials
    if (adminNotes) {
      await this.prisma.credential.updateMany({
        where: { guideId },
        data: { adminNotes },
      });
    }

    // Log to CredentialVerification audit trail
    const credentials = await this.prisma.credential.findMany({ where: { guideId } });
    for (const cred of credentials) {
      await this.prisma.credentialVerification.create({
        data: {
          credentialId: cred.id,
          stage: 'admin_review',
          status: decision,
          result: { adminNotes: adminNotes ?? null },
        },
      });
    }

    this.logger.log(`[Admin] Guide ${guideId} → ${status}`);

    // Send email notification to guide
    await this.sendVerificationStatusEmail(guide.user.email, guide.user.firstName, decision, adminNotes);
  }

  private async sendVerificationStatusEmail(
    email: string,
    firstName: string,
    decision: 'approve' | 'reject',
    notes?: string,
  ): Promise<void> {
    const resendKey = this.config.get<string>('RESEND_API_KEY', '');
    const fromEmail = this.config.get<string>('EMAIL_FROM', 'noreply@spiritualcalifornia.com');

    if (!resendKey) {
      this.logger.warn(`[Email] RESEND_API_KEY not set — skipping verification email to ${email}`);
      return;
    }

    const resend = new Resend(resendKey);
    const isApproved = decision === 'approve';

    const subject = isApproved
      ? 'Your Spiritual California Guide application has been approved!'
      : 'Update on your Spiritual California Guide application';

    const html = isApproved
      ? `<h2>Welcome to Spiritual California, ${firstName}!</h2>
         <p>Your Guide application has been <strong>approved</strong>. Your profile is now live and visible to Seekers.</p>
         <p>Log in to your dashboard to complete your profile and start accepting bookings.</p>`
      : `<h2>Hi ${firstName},</h2>
         <p>After reviewing your application, we were unable to approve your Guide listing at this time.</p>
         ${notes ? `<p><strong>Reviewer notes:</strong> ${notes}</p>` : ''}
         <p>If you believe this is an error or would like to reapply, please contact our support team.</p>`;

    try {
      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject,
        html,
      });
      this.logger.log(`[Email] Verification ${decision} email sent to ${email}`);
    } catch (err: any) {
      this.logger.error(`[Email] Failed to send verification email to ${email}: ${err.message}`);
    }
  }

  /**
   * Returns all guides pending admin review (IN_REVIEW status).
   */
  async getPendingReviews() {
    return this.prisma.guideProfile.findMany({
      where: { verificationStatus: 'IN_REVIEW' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        credentials: true,
        categories: { include: { category: true, subcategory: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }
}
