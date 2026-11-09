import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { computeTxHash, hashesMatch, type VaultPreimage } from './canonical.js';

@Injectable()
export class VaultService {
  constructor(private readonly config: ConfigService) {}

  seal(input: Omit<VaultPreimage, 'secret'>): string {
    return computeTxHash({ ...input, secret: this.secret() });
  }

  verify(input: Omit<VaultPreimage, 'secret'>, expected: string): boolean {
    return hashesMatch(this.seal(input), expected);
  }

  private secret(): string {
    const secret = this.config.getOrThrow<string>('SERVER_VAULT_SECRET');
    if (secret.length < 32) {
      throw new Error('SERVER_VAULT_SECRET must be set');
    }
    return secret;
  }
}
