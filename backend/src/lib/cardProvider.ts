import { resolveCardProvider, type CardProvider, type Config } from '../config.js';

export type CardStatus = 'ACTIVE' | 'FROZEN';
export type CardCurrency = 'NGN' | 'USD';

export interface CardholderInput { userId: string; email: string; name: string; }
export interface IssueCardInput { userId: string; currency: CardCurrency; }
export interface IssuedCard { providerCardId: string; maskedPan: string; expiry: string; providerCustomerId: string; }

export interface AuthorizationEvent {
  providerAuthorizationId: string;
  providerCardId: string;
  merchantDescriptor: string;
  amountMinor: number;
  currency: CardCurrency;
  channel?: string;
  merchantCategory?: string;
}

export interface AuthorizationResponse {
  statusCode: number;
  body: { statusCode: number; data: { responseCode: string } };
}

export interface TransferRate {
  rate: number;
  sell: number;
  buy: number;
}

export interface CardIssuer {
  readonly provider: CardProvider;
  createCardholder(input: CardholderInput): Promise<{ providerCustomerId: string }>;
  issueVirtualCard(input: IssueCardInput): Promise<IssuedCard>;
  setCardStatus(providerCardId: string, status: CardStatus): Promise<{ providerCardId: string; status: CardStatus }>;
  parseAuthorization(payload: unknown): AuthorizationEvent | null;
  respondToAuthorization(event: AuthorizationEvent, decision: { approved: boolean; declineReason?: string }): Promise<AuthorizationResponse>;
  getTransferRate(currencyPair: string): Promise<TransferRate | null>;
}

const DECLINE_RESPONSE_CODES: Record<string, string> = {
  insufficient_funds: '51',
  price_hike: '61',
  kill_switch: '57',
  card_frozen: '62',
  unknown_merchant: '57',
  currency_mismatch: '57',
};

export class MockCardIssuer implements CardIssuer {
  readonly provider: CardProvider = 'mock';

  private sequence = 0;

  async createCardholder(input: CardholderInput) {
    return { providerCustomerId: `mock_customer_${input.userId}` };
  }

  async issueVirtualCard(input: IssueCardInput) {
    this.sequence += 1;
    const last4 = String(1000 + (this.sequence % 9000));
    return { providerCardId: `mock_card_${input.userId}_${this.sequence}`, maskedPan: `•••• •••• •••• ${last4}`, expiry: '08/29', providerCustomerId: `mock_customer_${input.userId}` };
  }

  async setCardStatus(providerCardId: string, status: CardStatus) {
    return { providerCardId, status };
  }

  async getTransferRate(_currencyPair: string): Promise<TransferRate | null> {
    return null;
  }

  parseAuthorization(payload: unknown): AuthorizationEvent | null {
    if (!payload || typeof payload !== 'object') return null;
    const source = payload as Record<string, unknown>;
    const authorizationId = typeof source.authorizationId === 'string' ? source.authorizationId : '';
    const providerCardId = typeof source.providerCardId === 'string' ? source.providerCardId : '';
    const merchantDescriptor = typeof source.merchantDescriptor === 'string' ? source.merchantDescriptor : '';
    const amountMinor = Number(source.amountMinor);
    const currency = source.currency === 'NGN' || source.currency === 'USD' ? source.currency : 'NGN';
    if (!authorizationId || !providerCardId || !merchantDescriptor || !Number.isFinite(amountMinor) || amountMinor <= 0) return null;
    return {
      providerAuthorizationId: authorizationId,
      providerCardId,
      merchantDescriptor,
      amountMinor,
      currency,
      channel: typeof source.channel === 'string' ? source.channel : 'web',
      merchantCategory: typeof source.merchantCategory === 'string' ? source.merchantCategory : undefined,
    };
  }

  async respondToAuthorization(_event: AuthorizationEvent, decision: { approved: boolean; declineReason?: string }) {
    const approved = decision.approved;
    const statusCode = approved ? 200 : 400;
    const responseCode = approved ? '00' : (DECLINE_RESPONSE_CODES[decision.declineReason ?? ''] ?? '57');
    return { statusCode, body: { statusCode, data: { responseCode } } };
  }
}

export class SudoCardIssuer implements CardIssuer {
  readonly provider: CardProvider = 'sudo';

  constructor(private readonly config: Config) {}

  private get baseUrl(): string { return (this.config.SUDO_BASE_URL ?? 'https://api.sandbox.sudo.cards').replace(/\/$/, ''); }
  private get apiKey(): string { return this.config.SUDO_API_KEY ?? ''; }

  private async request(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}`, ...(init.headers ?? {}) },
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(`Sudo request failed: ${path} (${response.status})`);
    return body;
  }

  async createCardholder(input: CardholderInput) {
    const body = await this.request('/customers', {
      method: 'POST',
      body: JSON.stringify({
        type: 'individual',
        name: input.name,
        phoneNumber: '+2348000000000',
        emailAddress: input.email,
        status: 'active',
        individual: { firstName: 'Ada', lastName: 'Okafor', dob: '1990-01-15', identity: { type: 'BVN', number: '22212345678' } },
        billingAddress: { line1: '4 Barnawa Close', city: 'Lagos', country: 'NG' },
      }),
    });
    return { providerCustomerId: String(body.customerId ?? body._id ?? '') };
  }

  async issueVirtualCard(input: IssueCardInput) {
    const customer = await this.createCardholder({ userId: input.userId, email: 'user@example.com', name: 'Retrest User' });
    const body = await this.request('/cards', {
      method: 'POST',
      body: JSON.stringify({ customerId: customer.providerCustomerId, fundingSourceId: String(this.config.SUDO_FUNDING_SOURCE_ID ?? ''), debitAccountId: String(input.userId), type: 'virtual', currency: input.currency, status: 'active' }),
    });
    return { providerCardId: String(body.cardId ?? body._id ?? ''), maskedPan: String(body.maskedPan ?? ''), expiry: String(body.expiry ?? '08/29'), providerCustomerId: customer.providerCustomerId };
  }

  async setCardStatus(providerCardId: string, status: CardStatus) {
    await this.request(`/cards/${providerCardId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    return { providerCardId, status };
  }

  async getTransferRate(currencyPair: string): Promise<TransferRate | null> {
    try {
      const body = await this.request(`/accounts/transfer/rate/${encodeURIComponent(currencyPair)}`);
      const data = (body.data ?? {}) as Record<string, unknown>;
      const rate = Number(data.rate);
      const sell = Number(data.sell);
      const buy = Number(data.buy);
      if (!Number.isFinite(rate) || rate <= 0) { return null; }
      return { rate, sell: Number.isFinite(sell) && sell > 0 ? sell : rate, buy: Number.isFinite(buy) && buy > 0 ? buy : rate };
    } catch {
      return null;
    }
  }

  parseAuthorization(payload: unknown): AuthorizationEvent | null {
    if (!payload || typeof payload !== 'object') return null;
    const source = payload as Record<string, unknown>;
    const authorizationId = typeof source.authorizationId === 'string' ? source.authorizationId : '';
    const providerCardId = typeof source.providerCardId === 'string' ? source.providerCardId : '';
    const merchantDescriptor = typeof source.merchantDescriptor === 'string' ? source.merchantDescriptor : '';
    const amountMinor = Number(source.amountMinor);
    const currency = source.currency === 'NGN' || source.currency === 'USD' ? source.currency : 'NGN';
    if (!authorizationId || !providerCardId || !merchantDescriptor || !Number.isFinite(amountMinor) || amountMinor <= 0) return null;
    return { providerAuthorizationId: authorizationId, providerCardId, merchantDescriptor, amountMinor, currency, channel: typeof source.channel === 'string' ? source.channel : 'web', merchantCategory: typeof source.merchantCategory === 'string' ? source.merchantCategory : undefined };
  }

  async respondToAuthorization(_event: AuthorizationEvent, decision: { approved: boolean; declineReason?: string }) {
    const approved = decision.approved;
    const statusCode = approved ? 200 : 400;
    const responseCode = approved ? '00' : (DECLINE_RESPONSE_CODES[decision.declineReason ?? ''] ?? '57');
    return { statusCode, body: { statusCode, data: { responseCode } } };
  }
}

export function createCardIssuer(config: Config): CardIssuer {
  return resolveCardProvider(config) === 'sudo' ? new SudoCardIssuer(config) : new MockCardIssuer();
}
