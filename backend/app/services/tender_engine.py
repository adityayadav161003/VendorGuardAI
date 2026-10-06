"""
Tender Award Engine.

Turns an RFQ (quantity, target unit price, delivery deadline) and a set of
supplier bids into an explainable, audited award recommendation.

Composite award score (0-100, weights documented in WEIGHTS):
  price     45%  - lowest bid scores 100; others scale against it (or against
                   the buyer's target price when provided, capped at 100)
  risk      30%  - the supplier's latest stored VendorGuard trust score, so a
                   risky cheap bid cannot quietly win
  delivery  25%  - 100 within deadline, decaying 5 points per late day

The engine never auto-awards: it ranks and explains, the human decides — and
every evaluation is persisted (TenderEvaluation) with an audit event.
"""

from typing import Any, Dict, List, Optional

from app.services.risk_engine import risk_engine

WEIGHTS = {"price": 0.45, "risk": 0.30, "delivery": 0.25}
LATE_DAY_PENALTY = 5.0


class TenderAwardEngine:
    def evaluate(
        self,
        bids: List[Dict[str, Any]],
        quantity: int,
        target_unit_price: Optional[float] = None,
        deadline_days: Optional[int] = None,
    ) -> Dict[str, Any]:
        if not bids:
            return {"ranked_bids": [], "recommendation": None}

        valid_prices = [b["unit_price"] for b in bids if b.get("unit_price", 0) > 0]
        best_price = min(valid_prices) if valid_prices else 0.0
        # When the buyer gives a target price, score against it but keep the
        # cheapest bid at 100 so an above-target floor never wins by default.
        price_reference = min(best_price, target_unit_price) if target_unit_price else best_price

        ranked: List[Dict[str, Any]] = []
        for bid in bids:
            price = float(bid.get("unit_price", 0))
            lead = bid.get("lead_time_days")
            raw_risk = bid.get("risk_score")
            risk_score = float(raw_risk) if raw_risk is not None else 50.0
            risk_level = bid.get("risk_level", "MEDIUM")

            # --- price competitiveness ---
            if price <= 0:
                price_score, price_reason = 0.0, "No valid unit price provided."
            elif price_reference <= 0:
                price_score, price_reason = 0.0, "No comparable price baseline."
            else:
                price_score = round(min(100.0, (price_reference / price) * 100.0), 1)
                delta = price - best_price
                if delta <= 0.0001:
                    price_reason = "Lowest quoted unit price."
                elif target_unit_price and price <= target_unit_price:
                    price_reason = f"Within the target price (₹{delta:.2f}/unit above the best bid)."
                else:
                    over_target = price - target_unit_price if target_unit_price else delta
                    price_reason = f"₹{over_target:.2f}/unit above {'target' if target_unit_price else 'the best bid'}."

            # --- delivery feasibility ---
            if lead is None:
                delivery_score = 60.0
                delivery_reason = "Lead time not quoted — scored conservatively."
            elif deadline_days is None:
                delivery_score = 80.0
                delivery_reason = f"{lead} days quoted (no deadline set for comparison)."
            elif lead <= deadline_days:
                delivery_score = 100.0
                delivery_reason = f"Delivers in {lead} days — inside the {deadline_days}-day deadline."
            else:
                late_by = lead - deadline_days
                delivery_score = max(0.0, 100.0 - late_by * LATE_DAY_PENALTY)
                delivery_reason = f"{late_by} day(s) past the deadline — {delivery_score:.0f}/100 delivery score."

            # --- risk adjustment from VendorGuard's own analysis ---
            if raw_risk is not None:
                risk_reason = f"Latest trust score {risk_score:.0f}/100 ({risk_level} risk)."
            else:
                risk_reason = f"Unassessed supplier — conservative baseline {risk_score:.0f}/100 applied ({risk_level} risk)."

            composite = round(
                price_score * WEIGHTS["price"]
                + risk_score * WEIGHTS["risk"]
                + delivery_score * WEIGHTS["delivery"],
                1,
            )

            total_price = round(price * quantity, 2) if price > 0 else None
            flags: List[str] = []
            if risk_level == "HIGH":
                flags.append("HIGH-RISK SUPPLIER")
            if deadline_days is not None and lead is not None and lead > deadline_days:
                flags.append("LATE DELIVERY")
            if target_unit_price and price > target_unit_price:
                flags.append("OVER TARGET PRICE")

            ranked.append({
                "supplier_id": bid["supplier_id"],
                "supplier_name": bid.get("supplier_name", bid["supplier_id"]),
                "unit_price": price,
                "total_price": total_price,
                "lead_time_days": lead,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "price_score": price_score,
                "delivery_score": round(delivery_score, 1),
                "composite_score": composite,
                "reasons": [price_reason, risk_reason, delivery_reason],
                "flags": flags,
            })

        ranked.sort(key=lambda b: b["composite_score"], reverse=True)
        for i, b in enumerate(ranked):
            b["rank"] = i + 1

        winner = ranked[0]
        runner_up = ranked[1] if len(ranked) > 1 else None
        margin = round(winner["composite_score"] - runner_up["composite_score"], 1) if runner_up else None

        recommendation_lines = [
            f"Award recommendation: {winner['supplier_name']} with a composite score of "
            f"{winner['composite_score']}/100 (price {winner['price_score']}, risk-adjusted "
            f"{winner['risk_score']:.0f}, delivery {winner['delivery_score']})."
        ]
        if winner["flags"]:
            recommendation_lines.append(
                "Caution: " + ", ".join(winner["flags"]) + " — the award requires explicit reviewer sign-off."
            )
        if runner_up and margin is not None and margin < 5:
            recommendation_lines.append(
                f"Margin over {runner_up['supplier_name']} is only {margin} points — a split-award "
                "or re-quote is worth considering."
            )
        recommendation_lines.append(
            "This is a decision-support ranking, not an automated award; the purchase decision rests with the reviewer."
        )

        return {
            "quantity": quantity,
            "target_unit_price": target_unit_price,
            "deadline_days": deadline_days,
            "weights": WEIGHTS,
            "ranked_bids": ranked,
            "recommendation": {
                "winner_supplier_id": winner["supplier_id"],
                "winner_supplier_name": winner["supplier_name"],
                "margin_over_runner_up": margin,
                "summary": " ".join(recommendation_lines),
            },
        }


tender_award_engine = TenderAwardEngine()
