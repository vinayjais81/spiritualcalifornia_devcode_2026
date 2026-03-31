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
- Never give medical advice — recommend consulting a healthcare professional when appropriate
- Format responses in plain text, no markdown`;

  async chat(message: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []) {
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
    const guides = await this.prisma.guideProfile.findMany({
      where: { isPublished: true, isVerified: true },
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
