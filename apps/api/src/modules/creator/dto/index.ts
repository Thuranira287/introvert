import { IsBoolean, IsString, Matches } from 'class-validator';

export class PurchasePremiumDto {
  /** A Stripe PaymentMethod id produced client-side. The pattern rejects raw card numbers outright. */
  @IsString()
  @Matches(/^pm_[A-Za-z0-9_]+$/, { message: 'paymentMethodId must be a Stripe PaymentMethod id' })
  paymentMethodId: string;
}

export class FinalizePremiumDto {
  @IsString()
  @Matches(/^pi_[A-Za-z0-9_]+$/, { message: 'paymentIntentId must be a Stripe PaymentIntent id' })
  paymentIntentId: string;
}

export class SetProfileAdsDto {
  @IsBoolean()
  enabled: boolean;
}
