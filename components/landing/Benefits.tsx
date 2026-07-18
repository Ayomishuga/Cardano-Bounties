import React from "react";
import { benefits } from "./constants";
import { Icon } from "./Icons";

export function Benefits() {
  return (
    <section className="section" id="benefits">
      <div className="container">
        <div className="section-heading">
          <span className="pill">What we&apos;re building</span>
          <h2>Your entry point into the Cardano ecosystem</h2>
          <p className="section-intro">Cardano Bounties connects people who want to contribute to Cardano with projects, protocols, and community initiatives that need help. Every bounty is a real task with a real ADA reward. No middlemen. No invoices. No waiting.</p>
        </div>
        <div className="benefit-grid">
          {benefits.map((item) => (
            <article className={`benefit-card ${item.highlighted ? "highlight" : ""}`} key={item.title}>
              <div className="icon-box"><Icon name={item.icon as any} /></div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
