import React from "react";
import { plans } from "./constants";

export function HowItWorks() {
  return (
    <section className="section pricing-section" id="pricing">
      <div className="container">
        <div className="section-heading">
          <span className="pill">How it works</span>
          <h2>Three steps from curious to contributor</h2>
        </div>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <article className={`price-card ${plan.featured ? "featured" : ""}`} key={plan.name}>
              <div className="price-head">
                <span>{plan.name}</span>
                <p>{plan.intro}</p>
                <h3>{plan.price}</h3>
                {plan.action && (
                  <a href={(plan as any).link || "#"}>{plan.action}</a>
                )}
              </div>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}><span>{"\u2713"}</span>{feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
