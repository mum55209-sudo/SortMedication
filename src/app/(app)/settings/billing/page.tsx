import { manageSubscriptionAction, startSubscriptionAction } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SettingsTabs } from "@/components/SettingsTabs";
import { formatDate } from "@/components/ui";
import { confirmCheckout, stripeConfigured, stripeTestMode } from "@/lib/billing";
import { PRICE_PER_MONTH_USD, trialDaysLeft } from "@/lib/domain";
import { UserError } from "@/lib/errors";
import { requireContext } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const day = (d: Date | string) => formatDate(new Date(d).toISOString().slice(0, 10));

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; cancelled?: string; paid?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireContext();
  let checkoutProblem: string | null = null;

  // Back from Stripe's checkout page: check with Stripe that it finished,
  // then reload the page so the whole app shows the new status.
  if (params.checkout && ctx.pharmacy.subscription_status !== "active") {
    let confirmed = false;
    try {
      confirmed = await confirmCheckout(ctx.pharmacy.id, params.checkout);
    } catch (err) {
      checkoutProblem = err instanceof UserError ? err.message : "Couldn't check the payment with Stripe just now.";
    }
    if (confirmed) redirect("/settings/billing?paid=1");
  }

  const p = ctx.pharmacy;
  const trialEnds = new Date(p.trial_ends_at);
  const daysLeft = trialDaysLeft(trialEnds);
  const online = stripeConfigured();
  const owner = ctx.user.role === "owner";
  const subscribed = p.subscription_status === "active" || p.subscription_status === "past_due";
  const canStart = !subscribed && owner && online;
  const canManage = owner && online && Boolean(p.stripe_customer_id);

  return (
    <>
      <SettingsTabs current="/settings/billing" />
      <div className="card">
        <h2>Your plan</h2>
        {online && stripeTestMode() && (
          <p className="notice small">
            <strong>Test mode.</strong> No real money is taken. Pay with card number 4242 4242 4242 4242, any future date and any 3-digit code.
          </p>
        )}
        <p className="price">${PRICE_PER_MONTH_USD}<span className="muted" style={{ fontSize: "1rem" }}> / month per pharmacy</span></p>
        <p>All branches, staff logins and reports included.</p>

        {(params.paid || params.checkout) && p.subscription_status === "active" && <p className="notice">Thank you! Your subscription is set up.</p>}
        {params.checkout && p.subscription_status !== "active" && !checkoutProblem && (
          <p className="notice">Payment received. It can take a few seconds to show here, so reload this page in a moment.</p>
        )}
        {checkoutProblem && <p className="error">{checkoutProblem}</p>}
        {params.cancelled && !subscribed && <p className="muted">Checkout was cancelled. Nothing was charged.</p>}

        {p.subscription_status === "active" ? (
          <p className="notice">
            Your subscription is active.
            {p.subscription_renews_at &&
              (p.subscription_cancel_at_period_end
                ? ` It is set to end on ${day(p.subscription_renews_at)}.`
                : ` Next payment on ${day(p.subscription_renews_at)}.`)}
          </p>
        ) : p.subscription_status === "past_due" ? (
          <p className="error">Your last card payment didn&apos;t go through. Stripe will try again. Please update your card.</p>
        ) : p.subscription_status === "cancelled" ? (
          <p className="error">Your subscription has ended. Your data is safe and you can still view and export it.</p>
        ) : p.subscription_status === "trialing" && daysLeft > 0 ? (
          <p className="notice">
            Free trial: {daysLeft} {daysLeft === 1 ? "day" : "days"} left (ends {day(trialEnds)}).
            {online && " Subscribe any time: your card is first charged when the trial ends."}
          </p>
        ) : (
          <p className="error">Your free trial has ended. Your data is safe and you can still view and export it.</p>
        )}

        {canStart && (
          <ActionForm action={startSubscriptionAction} className="actions">
            <button type="submit">Subscribe with card</button>
          </ActionForm>
        )}
        {canManage && (
          <ActionForm action={manageSubscriptionAction} className="actions">
            <button type="submit" className="secondary">Manage card, invoices or cancel</button>
          </ActionForm>
        )}
        {!subscribed && owner && !online && (
          <p>Online card payment isn&apos;t switched on yet. Please contact us to start your subscription.</p>
        )}
        {!owner && !subscribed && <p className="muted small">Only the pharmacy owner can start the subscription.</p>}
        {online && <p className="muted small">Card details are typed on Stripe&apos;s secure page and never stored by SortMed.</p>}
        <p className="muted small">Larger pharmacy groups: contact us for custom pricing.</p>
      </div>
    </>
  );
}
