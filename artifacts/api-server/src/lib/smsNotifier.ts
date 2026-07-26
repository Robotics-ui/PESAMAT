import { enqueueEventSms } from "./smsService";
import { logger } from "./logger";

function fire(fn: () => Promise<void>) {
  fn().catch((err) => logger.error({ err }, "SMS notification error"));
}

export function notifySubscriptionActivated(opts: { userId: number; phone: string; name: string; endDate: string }) {
  fire(() =>
    enqueueEventSms({
      userId: opts.userId,
      phone: opts.phone,
      eventType: "subscription_activated",
      vars: { name: opts.name, endDate: opts.endDate },
      preferenceKey: "subscriptionAlerts",
    }),
  );
}

export function notifySubscriptionExpiring(opts: { userId: number; phone: string; name: string; endDate: string; daysLeft: string }) {
  fire(() =>
    enqueueEventSms({
      userId: opts.userId,
      phone: opts.phone,
      eventType: "subscription_expiring",
      vars: { name: opts.name, endDate: opts.endDate, daysLeft: opts.daysLeft },
      preferenceKey: "subscriptionAlerts",
    }),
  );
}

export function notifySubscriptionExpired(opts: { userId: number; phone: string; name: string }) {
  fire(() =>
    enqueueEventSms({
      userId: opts.userId,
      phone: opts.phone,
      eventType: "subscription_expired",
      vars: { name: opts.name },
      preferenceKey: "subscriptionAlerts",
    }),
  );
}

export function notifyPaymentReceived(opts: { userId: number; phone: string; name: string; amount: string; receipt: string; endDate?: string }) {
  fire(() =>
    enqueueEventSms({
      userId: opts.userId,
      phone: opts.phone,
      eventType: "payment_received",
      vars: { name: opts.name, amount: opts.amount, receipt: opts.receipt, endDate: opts.endDate ?? "" },
      preferenceKey: "subscriptionAlerts",
    }),
  );
}

export function notifyPaymentFailed(opts: { userId: number; phone: string; name: string; amount: string }) {
  fire(() =>
    enqueueEventSms({
      userId: opts.userId,
      phone: opts.phone,
      eventType: "payment_failed",
      vars: { name: opts.name, amount: opts.amount },
      preferenceKey: "subscriptionAlerts",
    }),
  );
}

export function notifyFundingPaymentReceived(opts: { userId: number; phone: string; name: string; amount: string; receipt: string; appId: string }) {
  fire(() =>
    enqueueEventSms({
      userId: opts.userId,
      phone: opts.phone,
      eventType: "funding_application_submitted",
      vars: { name: opts.name, amount: opts.amount, receipt: opts.receipt, appId: opts.appId },
      preferenceKey: "subscriptionAlerts",
    }),
  );
}

export function notifyMasterAccountApproved(opts: { userId: number; phone: string; name: string; accountId: string }) {
  fire(() =>
    enqueueEventSms({
      userId: opts.userId,
      phone: opts.phone,
      eventType: "master_account_approved",
      vars: { name: opts.name, accountId: opts.accountId },
      preferenceKey: "subscriptionAlerts",
    }),
  );
}

export function notifyAccountSuspended(opts: { userId: number; phone: string; name: string }) {
  fire(() =>
    enqueueEventSms({
      userId: opts.userId,
      phone: opts.phone,
      eventType: "account_suspended",
      vars: { name: opts.name },
      preferenceKey: "subscriptionAlerts",
    }),
  );
}

export function notifyFreeTrialActivated(opts: {
  userId: number;
  phone: string;
  name: string;
  endDate: string;
}) {
  fire(() =>
    enqueueEventSms({
      userId: opts.userId,
      phone: opts.phone,
      eventType: "free_trial_activated",
      vars: { name: opts.name, endDate: opts.endDate },
      preferenceKey: "subscriptionAlerts",
    }),
  );
}

export function notifyFreeTrialExpired(opts: {
  userId: number;
  phone: string;
  name: string;
}) {
  fire(() =>
    enqueueEventSms({
      userId: opts.userId,
      phone: opts.phone,
      eventType: "free_trial_expired",
      vars: { name: opts.name },
      preferenceKey: "subscriptionAlerts",
    }),
  );
}

export function notifyReferralReward(opts: {
  userId: number;
  phone: string;
  name: string;
  rewardDays: string;
}) {
  fire(() =>
    enqueueEventSms({
      userId: opts.userId,
      phone: opts.phone,
      eventType: "referral_reward",
      vars: { name: opts.name, rewardDays: opts.rewardDays },
      preferenceKey: "subscriptionAlerts",
    }),
  );
}

export function notifyFundingApplicationSubmitted(opts: { userId: number; phone: string; name: string; appId: string }) {
  fire(() =>
    enqueueEventSms({
      userId: opts.userId,
      phone: opts.phone,
      eventType: "funding_application_submitted",
      vars: { name: opts.name, appId: opts.appId },
      preferenceKey: "subscriptionAlerts",
    }),
  );
}

export function notifyFundingApplicationApproved(opts: { userId: number; phone: string; name: string }) {
  fire(() =>
    enqueueEventSms({
      userId: opts.userId,
      phone: opts.phone,
      eventType: "funding_application_approved",
      vars: { name: opts.name },
      preferenceKey: "subscriptionAlerts",
    }),
  );
}

export function notifyFundingApplicationRejected(opts: { userId: number; phone: string; name: string }) {
  fire(() =>
    enqueueEventSms({
      userId: opts.userId,
      phone: opts.phone,
      eventType: "funding_application_rejected",
      vars: { name: opts.name },
      preferenceKey: "subscriptionAlerts",
    }),
  );
}

export function notifyFundingApplicationFunded(opts: { userId: number; phone: string; name: string }) {
  fire(() =>
    enqueueEventSms({
      userId: opts.userId,
      phone: opts.phone,
      eventType: "funding_application_funded",
      vars: { name: opts.name },
      preferenceKey: "subscriptionAlerts",
    }),
  );
}
