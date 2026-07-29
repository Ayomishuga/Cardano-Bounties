import React from "react";
import { NewsletterForm } from "./NewsletterForm";

export function FinalCTA() {
  return (
    <section className="final-wrap" id="newsletter">
      <div className="container">
        <div className="final-cta">
          <h2>Stay in the Loop</h2>
          <div>
            <p>Get notified when new bounties go live, ecosystem updates land, and ADA rewards are paid out. No noise, only what matters.</p>
            <NewsletterForm />
          </div>
        </div>
      </div>
    </section>
  );
}
