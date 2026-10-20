import { startSubscriptionAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SettingsTabs } from "@/components/SettingsTabs";
import { formatDate } from "@/components/ui";
import { PRICE_PER_MONTH_USD, trialDaysLeft } from "@/lib/domain";
import { requireContext } from "@/lib/session";

export default async function BillingPage() {
  const ctx = await requireContext();
  const p = ctx.pharmacy;
  const trialEnds = new Date(p.trial_ends_at);
  const daysLeft = trialDaysLeft(trialEnds);
  return (
    <>
      <SettingsTabs current="/settings/billing" />
      <div className="card">
        <h2>Your plan</h2>
        <p className="price">${PRICE_PER_MONTH_USD}<span className="muted" style={{ fontSize: "1rem" }}> / month per pharmacy</span></p>
        <p>All branches, staff logins and reports included.</p>
        {p.subscription_status === "active" ? (
          <p className="notice">Your subscription is active. Thank you!</p>
        ) : p.subscription_status === "trialing" && daysLeft > 0 ? (
          <p className="notice">
            Free trial: {daysLeft} {daysLeft === 1 ? "day" : "days"} left (ends {formatDate(trialEnds.toISOString().slice(0, 10))}).
          </p>
        ) : (
          <p className="error">Your free trial has ended. Your data is safe and you can still view and export it.</p>
        )}
        {p.subscription_status !== "active" && ctx.user.role === "owner" && (
          <ActionForm action={startSubscriptionAction} className="actions">
            <button type="submit">Start subscription</button>
          </ActionForm>
        )}
        <p className="muted small">Larger pharmacy groups: contact us for custom pricing.</p>
      </div>
    </>
  );
}
