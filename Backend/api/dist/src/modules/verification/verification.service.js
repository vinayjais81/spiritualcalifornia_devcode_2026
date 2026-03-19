"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var VerificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../database/prisma.service");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_textract_1 = require("@aws-sdk/client-textract");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const resend_1 = require("resend");
const QUEUE_NAME = 'document-analysis';
let VerificationService = VerificationService_1 = class VerificationService {
    prisma;
    config;
    logger = new common_1.Logger(VerificationService_1.name);
    queue = null;
    worker = null;
    isPersonaStub;
    isTextractStub;
    isClaudeStub;
    isRedisStub;
    personaApiKey;
    personaTemplateId;
    redisHost;
    redisPort;
    redisPassword;
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
        const personaKey = this.config.get('PERSONA_API_KEY', '');
        const anthropicKey = this.config.get('ANTHROPIC_API_KEY', '');
        const awsKey = this.config.get('AWS_ACCESS_KEY_ID', '');
        this.isPersonaStub = !personaKey || personaKey.startsWith('your-');
        this.isTextractStub = !awsKey || awsKey.startsWith('your-');
        this.isClaudeStub = !anthropicKey || anthropicKey.startsWith('your-');
        this.personaApiKey = personaKey;
        this.personaTemplateId = this.config.get('PERSONA_TEMPLATE_ID', '');
        this.redisHost = this.config.get('REDIS_HOST', 'localhost');
        this.redisPort = this.config.get('REDIS_PORT', 6379);
        this.redisPassword = this.config.get('REDIS_PASSWORD');
        this.isRedisStub = this.isPersonaStub && this.isTextractStub && this.isClaudeStub;
    }
    async onModuleInit() {
        if (this.isRedisStub) {
            this.logger.warn('[STUB] Verification service in stub mode — BullMQ queue not started (no real API keys detected)');
            return;
        }
        const connection = {
            host: this.redisHost,
            port: this.redisPort,
            ...(this.redisPassword ? { password: this.redisPassword } : {}),
        };
        this.queue = new bullmq_1.Queue(QUEUE_NAME, { connection });
        this.worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
            await this.processVerificationJob(job.data.guideId);
        }, { connection, concurrency: 3 });
        this.worker.on('completed', (job) => this.logger.log(`[Queue] Job ${job.id} completed for guide ${job.data.guideId}`));
        this.worker.on('failed', (job, err) => this.logger.error(`[Queue] Job ${job?.id} failed: ${err.message}`));
        this.logger.log('[Queue] document-analysis BullMQ worker started');
    }
    async onModuleDestroy() {
        await this.worker?.close();
        await this.queue?.close();
    }
    async enqueueGuideVerification(guideId) {
        if (this.isRedisStub || !this.queue) {
            this.logger.warn(`[STUB] enqueueGuideVerification — running inline stub pipeline for guide: ${guideId}`);
            this.runStubPipeline(guideId).catch((err) => this.logger.error(`[STUB] Inline stub pipeline error: ${err.message}`));
            return;
        }
        await this.queue.add('analyze-guide-credentials', { guideId }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 50 },
        });
        this.logger.log(`[Queue] Enqueued verification job for guide: ${guideId}`);
    }
    async processVerificationJob(guideId) {
        this.logger.log(`[Verification] Starting pipeline for guide: ${guideId}`);
        const guide = await this.prisma.guideProfile.findUnique({
            where: { id: guideId },
            include: { credentials: true, user: true },
        });
        if (!guide) {
            this.logger.error(`[Verification] Guide not found: ${guideId}`);
            return;
        }
        for (const credential of guide.credentials) {
            const s3Key = credential.documentS3Key;
            if (!s3Key) {
                this.logger.debug(`[Verification] Credential ${credential.id} has no document — skipping OCR`);
                continue;
            }
            try {
                const ocrResult = await this.analyzeWithTextract(s3Key);
                const entities = await this.extractEntitiesWithClaude(ocrResult.rawText, credential.title);
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
                this.logger.log(`[Verification] Credential ${credential.id} processed — confidence: ${entities.confidence}`);
            }
            catch (err) {
                this.logger.error(`[Verification] Failed to process credential ${credential.id}: ${err.message}`);
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
        await this.initiatePersonaCheck(guide.userId, guideId);
        this.logger.log(`[Verification] Pipeline complete for guide: ${guideId} — awaiting admin review`);
    }
    async runStubPipeline(guideId) {
        return this.processVerificationJob(guideId);
    }
    async analyzeWithTextract(s3Key) {
        if (this.isTextractStub) {
            this.logger.warn(`[STUB] Textract OCR skipped for key: ${s3Key}`);
            return {
                rawText: 'STUB EXTRACTED TEXT: Certified Meditation Teacher • Chopra Center for Wellbeing • Issued 2021',
                confidence: 0.94,
            };
        }
        const awsRegion = this.config.get('AWS_REGION', 'eu-north-1');
        const bucket = this.config.get('AWS_S3_BUCKET');
        const credentials = {
            accessKeyId: this.config.get('AWS_ACCESS_KEY_ID'),
            secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY'),
        };
        const s3 = new client_s3_1.S3Client({ region: awsRegion, credentials });
        const s3Response = await s3.send(new client_s3_1.GetObjectCommand({ Bucket: bucket, Key: s3Key }));
        const bytes = await s3Response.Body.transformToByteArray();
        const textractRegion = this.config.get('AWS_TEXTRACT_REGION', 'eu-west-1');
        const textract = new client_textract_1.TextractClient({ region: textractRegion, credentials });
        const response = await textract.send(new client_textract_1.DetectDocumentTextCommand({ Document: { Bytes: bytes } }));
        const lineBlocks = response.Blocks?.filter((b) => b.BlockType === 'LINE' && b.Text) ?? [];
        const rawText = lineBlocks.map((b) => b.Text).join('\n');
        const avgConfidence = lineBlocks.length > 0
            ? lineBlocks.reduce((sum, b) => sum + (b.Confidence ?? 0), 0) / lineBlocks.length / 100
            : 0.9;
        this.logger.log(`[Textract] Extracted ${lineBlocks.length} lines from ${s3Key}, avg confidence: ${avgConfidence.toFixed(2)}`);
        return { rawText, confidence: Math.min(avgConfidence, 1) };
    }
    async extractEntitiesWithClaude(ocrText, credentialTitle) {
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
        const client = new sdk_1.default({
            apiKey: this.config.get('ANTHROPIC_API_KEY'),
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
            model: this.config.get('ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
            max_tokens: 256,
            messages: [{ role: 'user', content: prompt }],
        });
        const responseText = message.content[0].text.trim();
        let parsed;
        try {
            parsed = JSON.parse(responseText);
        }
        catch {
            this.logger.error(`[Claude] Failed to parse JSON response: ${responseText}`);
            parsed = { institution: null, title: credentialTitle, year: null, confidence: 0.5 };
        }
        this.logger.log(`[Claude] Extracted entities for "${credentialTitle}" — confidence: ${parsed.confidence}`);
        return { rawText: ocrText, ...parsed };
    }
    async initiatePersonaCheck(userId, guideId) {
        if (this.isPersonaStub) {
            const stubInquiryId = `stub-inquiry-${(0, crypto_1.randomUUID)()}`;
            this.logger.warn(`[STUB] Persona identity check skipped for user: ${userId} — fake inquiryId: ${stubInquiryId}`);
            await this.prisma.personaVerification.upsert({
                where: { userId },
                create: { userId, inquiryId: stubInquiryId, status: 'stub_pending', referenceId: guideId },
                update: { inquiryId: stubInquiryId, status: 'stub_pending', referenceId: guideId },
            });
            return;
        }
        const apiKey = this.config.get('PERSONA_API_KEY');
        const templateId = this.config.get('PERSONA_TEMPLATE_ID');
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
        const json = (await response.json());
        const inquiryId = json.data?.id;
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
    async startIdentityVerification(userId) {
        if (this.isPersonaStub) {
            const stubId = `stub_inq_${(0, crypto_1.randomUUID)()}`;
            this.logger.warn(`[STUB] Persona identity verification — returning mock inquiryId: ${stubId}`);
            return { inquiryId: stubId, sessionToken: null, verifyUrl: null, stub: true };
        }
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
            throw new common_1.BadGatewayException(`Persona API error: ${response.status} — ${errText}`);
        }
        const json = await response.json();
        const inquiryId = json?.data?.id;
        const sessionToken = json?.data?.attributes?.['session-token'];
        if (!inquiryId) {
            throw new Error('Persona returned no inquiry ID');
        }
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
    async handlePersonaWebhook(payload) {
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
        if (status === 'approved') {
            await this.prisma.guideProfile.updateMany({
                where: { userId: record.userId },
                data: { verificationStatus: 'IN_REVIEW' },
            });
        }
    }
    async reviewGuide(guideId, decision, adminNotes) {
        const status = decision === 'approve' ? 'APPROVED' : 'REJECTED';
        const guide = await this.prisma.guideProfile.update({
            where: { id: guideId },
            data: {
                verificationStatus: status,
                isVerified: decision === 'approve',
                isPublished: decision === 'approve',
            },
            include: { user: { select: { email: true, firstName: true } } },
        });
        if (adminNotes) {
            await this.prisma.credential.updateMany({
                where: { guideId },
                data: { adminNotes },
            });
        }
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
        await this.sendVerificationStatusEmail(guide.user.email, guide.user.firstName, decision, adminNotes);
    }
    async sendVerificationStatusEmail(email, firstName, decision, notes) {
        const resendKey = this.config.get('RESEND_API_KEY', '');
        const fromEmail = this.config.get('EMAIL_FROM', 'noreply@spiritualcalifornia.com');
        if (!resendKey) {
            this.logger.warn(`[Email] RESEND_API_KEY not set — skipping verification email to ${email}`);
            return;
        }
        const resend = new resend_1.Resend(resendKey);
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
        }
        catch (err) {
            this.logger.error(`[Email] Failed to send verification email to ${email}: ${err.message}`);
        }
    }
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
};
exports.VerificationService = VerificationService;
exports.VerificationService = VerificationService = VerificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], VerificationService);
//# sourceMappingURL=verification.service.js.map