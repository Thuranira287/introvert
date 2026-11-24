import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AchievementsService } from './achievements.service';
import { AnalyticsService } from './analytics.service';
import { MonetizationService } from './monetization.service';
import { FinalizePremiumDto, PurchasePremiumDto, SetProfileAdsDto } from './dto';

/** Tight limit on payment endpoints to blunt card-testing abuse. */
const PAYMENT_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller()
@UseGuards(JwtAuthGuard)
export class CreatorController {
  constructor(
    private readonly achievementsService: AchievementsService,
    private readonly analyticsService: AnalyticsService,
    private readonly monetizationService: MonetizationService,
  ) {}

  @Get('achievements')
  getMyAchievements(@CurrentUser('id') userId: string) {
    return this.achievementsService.getUserAchievements(userId);
  }

  @Get('achievements/progress')
  getMyProgress(@CurrentUser('id') userId: string) {
    return this.achievementsService.getProgress(userId);
  }

  @Public()
  @Get('users/:userId/achievements')
  getUserAchievements(@Param('userId') userId: string) {
    return this.achievementsService.getUserAchievements(userId);
  }

  @Get('analytics/dashboard')
  getDashboard(@CurrentUser('id') userId: string) {
    return this.analyticsService.getUserDashboard(userId);
  }

  @Get('monetization/premium-price')
  getPremiumPrice() {
    return { priceCents: this.monetizationService.getPremiumMonthlyPriceCents(), billingPeriod: 'monthly' };
  }

  @Throttle(PAYMENT_THROTTLE)
  @Post('monetization/premium/purchase')
  purchasePremium(@CurrentUser('id') userId: string, @Body() dto: PurchasePremiumDto) {
    return this.monetizationService.purchasePremiumVerification(userId, dto.paymentMethodId);
  }

  @Throttle(PAYMENT_THROTTLE)
  @Post('monetization/premium/renew')
  renewPremium(@CurrentUser('id') userId: string, @Body() dto: PurchasePremiumDto) {
    return this.monetizationService.renewPremiumVerification(userId, dto.paymentMethodId);
  }

  @Throttle(PAYMENT_THROTTLE)
  @Post('monetization/premium/finalize')
  finalizePremium(@CurrentUser('id') userId: string, @Body() dto: FinalizePremiumDto) {
    return this.monetizationService.finalizePremiumVerification(userId, dto.paymentIntentId);
  }

  @Post('monetization/profile-ads')
  setProfileAds(@CurrentUser('id') userId: string, @Body() dto: SetProfileAdsDto) {
    return this.monetizationService.setProfileAdsEnabled(userId, dto.enabled);
  }

  @Get('monetization/earnings')
  getEarnings(@CurrentUser('id') userId: string) {
    return this.monetizationService.getEarningsSummary(userId);
  }

  @Post('profile-views/:profileUserId')
  recordProfileView(@CurrentUser('id') viewerId: string, @Param('profileUserId') profileUserId: string) {
    return this.monetizationService.recordProfileView(profileUserId, viewerId);
  }
}
