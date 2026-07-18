import Link from "next/link";
import React from "react";

export function Footer() {
  return (
    <footer className="site-footer" id="contact">
      <div className="container footer-shell">
        <div className="footer-main">
          <div className="footer-brand">
            <Link className="brand" href="/">
              <img className="brand-logo footer-logo" src="/cardano_bounties_logo.png" alt="Cardano Bounties" />
            </Link>
            <p>Learn, contribute, and earn in the Cardano ecosystem.</p>
          </div>
          <div>
            <h3>Platform</h3>
            <Link href="/explore">Explore Bounties</Link>
            <Link href="/#pricing">How It Works</Link>
            <Link href="/#faq">FAQs</Link>
            <Link href="/post-bounty">Post a Bounty</Link>
          </div>
          <div>
            <h3>For Projects</h3>
            <a href="#contact">Post a Bounty</a>
            <a href={`mailto:${process.env.NEXT_PUBLIC_ADMIN_EMAIL || "aanuoluwapo.ay@gmail.com"}`}>Contact Admin</a>
          </div>
          <div>
            <h3>Community</h3>
            <a href="https://x.com/cardanobounties" target="_blank" rel="noopener noreferrer">Follow on X (Twitter)</a>
            <a href="https://discord.gg/rbQ97RaNw" target="_blank" rel="noopener noreferrer">Join our Discord</a>
            <a href="https://github.com/Ayomishuga/Cardano-Bounties" target="_blank" rel="noopener noreferrer">Star on GitHub</a>
            <a href="https://youtube.com/@cardanobounties" target="_blank" rel="noopener noreferrer">Follow us on Youtube</a>
          </div>
        </div>
        <div className="footer-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
          <p style={{ margin: 0 }}>© 2026 Cardano Bounties. All rights reserved.</p>
          <p style={{ margin: 0, textAlign: 'right' }}>Built with ❤️ by <a href="https://x.com/TechKr_Team" target="_blank" rel="noopener noreferrer">TechKR</a> and <a href="https://gimbalabs.com" target="_blank" rel="noopener noreferrer">Gimbalabs</a>.</p>
        </div>
      </div>
    </footer>
  );
}
