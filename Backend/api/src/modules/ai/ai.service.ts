import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AiService {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.client = new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') });
    this.model = this.config.get('ANTHROPIC_MODEL', 'claude-sonnet-4-6');
  }

  private readonly SYSTEM_PROMPT = `You are the Spiritual California AI Guide — a warm, knowledgeable assistant helping seekers find the right practitioners, products, events, and resources for their spiritual journey.

Your personality: Wise but approachable. Grounded but open. You speak with clarity and gentle encouragement.

Guidelines:
- Give concise, helpful answers (2-4 sentences for simple questions, up to a short paragraph for complex ones)
- When recommending practitioners, mention their specialty and why they'd be a good fit
- When recommending products, mention what makes them special
- Always be respectful of all spiritual traditions
- If you don't know something specific about the platform, say so honestly
- Format responses in plain text, no markdown

STRICT BOUNDARIES — these are non-negotiable:
- You are NOT a counselor, therapist, physician, or licensed professional. Do not present yourself as one.
- Do not give medical, mental-health, legal, or financial advice.
- Do not diagnose or treat any condition — physical or psychological. If someone describes symptoms, do not assess them; suggest they consult a qualified professional.
- You are not a crisis or emergency service. If someone mentions self-harm, suicidal thoughts, abuse, or any immediate danger, your only response is to refer them to professional help (988 Suicide & Crisis Lifeline in the US, or local emergency services).`;

  // ─── Crisis detection ──────────────────────────────────────────────────
  //
  // Compliance implementation spec (2026-05-22, Task 6): if a user message
  // contains crisis terms, suspend the normal AI response and surface a
  // crisis-resources card instead. The detection runs server-side so every
  // AI surface (current chat input, product finder, practitioner matcher,
  // any future surface) gets the same protection — defense-in-depth.
  //
  // Patterns are tight on purpose: matching unambiguous crisis phrases is
  // safer than matching ambiguous single words (e.g. "abuse" alone has
  // benign meanings like "substance abuse education" or "don't abuse the
  // equipment"). Tune by adding patterns here, not by relaxing existing
  // ones.

  private readonly CRISIS_PATTERNS: RegExp[] = [
    /\bsuicid(e|al|es|ing)\b/i,
    /\bself[\s-]?harm/i,
    /\bkill\s+(my[\s-]?self|me)\b/i,
    /\bend(ing)?\s+(my|it\s+all)\s*(life)?\b/i,
    /\b(over|drug)\s?dos(e|ed|ing)\b/i,
    /\bwant\s+to\s+die\b/i,
    /\bbeing\s+(abused|assaulted|hit|hurt)\b/i,
    /\b(abusive\s+(partner|relationship)|domestic\s+violence)\b/i,
    /\bno\s+(reason|point|will)\s+to\s+live\b/i,
    /\bharm(ing)?\s+my[\s-]?self\b/i,
  ];

  private detectsCrisis(message: string): boolean {
    if (!message) return false;
    return this.CRISIS_PATTERNS.some((p) => p.test(message));
  }

  /**
   * Verbatim safety response surfaced to the client whenever the crisis
   * detector trips. The shape is uniform across all three AI methods
   * (chat / productFinder / practitionerMatcher) so the frontend can
   * branch on `crisis: true` regardless of which endpoint it called.
   */
  private crisisResponse() {
    return {
      crisis: true as const,
      reply:
        "It sounds like you may be carrying something deeply painful right now. The AI Guide is not a counselor or emergency service and isn't equipped to support you through this — but trained, caring people are. " +
        "If you're in immediate danger, please call 911 (or your local emergency number). " +
        "For crisis support, call or text 988 (US Suicide & Crisis Lifeline) — available 24/7, free and confidential. " +
        "You can also text HOME to 741741 (Crisis Text Line). Please reach out — you deserve real human support.",
    };
  }

  async chat(message: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []) {
    // Crisis short-circuit — must run before the Claude call so we don't
    // accidentally generate an AI response that competes with the safety
    // referral. See compliance spec Task 6.
    if (this.detectsCrisis(message)) {
      this.logger.warn('[crisis-detect] chat() suppressed AI response and returned safety referral');
      return { ...this.crisisResponse(), usage: null };
    }

    const [guideCount, categories] = await Promise.all([
      this.prisma.guideProfile.count({ where: { isPublished: true } }),
      this.prisma.category.findMany({ where: { isActive: true }, select: { name: true }, take: 20 }),
    ]);

    const contextPrompt = `Platform context: Spiritual California has ${guideCount} verified practitioners across categories: ${categories.map(c => c.name).join(', ')}.`;
    const messages = [
      ...conversationHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message },
    ];

    try {
      const response = await this.client.messages.create({
        model: this.model, max_tokens: 500,
        system: `${this.SYSTEM_PROMPT}\n\n${contextPrompt}`,
        messages,
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return { reply: text, usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } };
    } catch (err: any) {
      this.logger.error(`AI chat failed: ${err.message}`);
      return { reply: "I apologize, but I'm having trouble connecting right now. Please try again in a moment, or browse our practitioners and shop directly.", usage: null };
    }
  }

  async productFinder(query: string) {
    if (this.detectsCrisis(query)) {
      this.logger.warn('[crisis-detect] productFinder() suppressed AI response and returned safety referral');
      return { ...this.crisisResponse(), products: [] };
    }
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true, price: true, description: true, guide: { select: { displayName: true } } },
      take: 20,
    });
    const productList = products.map(p => `- ${p.name} ($${p.price}, ${p.type}) by ${p.guide.displayName}: ${p.description?.slice(0, 100) || ''}`).join('\n');

    try {
      const response = await this.client.messages.create({
        model: this.model, max_tokens: 300,
        system: 'You are a product recommendation assistant for a spiritual marketplace. Recommend 2-3 most relevant products from the list. Be warm. Reply in plain text.',
        messages: [{ role: 'user', content: `Looking for: "${query}"\n\nProducts:\n${productList}\n\nRecommend 2-3 best matches.` }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const recommended = products.filter(p => text.toLowerCase().includes(p.name.toLowerCase())).slice(0, 3);
      return { reply: text, products: recommended.map(p => ({ id: p.id, name: p.name, price: Number(p.price), type: p.type })) };
    } catch (err: any) {
      this.logger.error(`Product finder failed: ${err.message}`);
      return { reply: 'Here are some popular items from our shop.', products: products.slice(0, 3).map(p => ({ id: p.id, name: p.name, price: Number(p.price), type: p.type })) };
    }
  }

  async practitionerMatcher(query: string) {
    if (this.detectsCrisis(query)) {
      this.logger.warn('[crisis-detect] practitionerMatcher() suppressed AI response and returned safety referral');
      return { ...this.crisisResponse(), practitioners: [] };
    }
    const guides = await this.prisma.guideProfile.findMany({
      where: { isPublished: true, isVerified: true, user: { isActive: true } },
      select: { id: true, slug: true, displayName: true, tagline: true, modalities: true, averageRating: true, location: true },
      take: 15,
    });
    const guideList = guides.map(g => `- ${g.displayName} (${g.tagline || ''}) — ${g.modalities.join(', ')} — Rating: ${g.averageRating}`).join('\n');

    try {
      const response = await this.client.messages.create({
        model: this.model, max_tokens: 300,
        system: 'You are a practitioner matching assistant. Recommend 2-3 best matches from the list. Be warm and explain why each fits.',
        messages: [{ role: 'user', content: `Seeker needs: "${query}"\n\nPractitioners:\n${guideList}\n\nRecommend 2-3.` }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const matched = guides.filter(g => text.toLowerCase().includes(g.displayName.toLowerCase())).slice(0, 3);
      return { reply: text, practitioners: matched.map(g => ({ id: g.id, slug: g.slug, displayName: g.displayName, rating: g.averageRating })) };
    } catch (err: any) {
      this.logger.error(`Practitioner matcher failed: ${err.message}`);
      return { reply: 'Here are some of our top-rated practitioners.', practitioners: guides.slice(0, 3).map(g => ({ id: g.id, slug: g.slug, displayName: g.displayName, rating: g.averageRating })) };
    }
  }
}
