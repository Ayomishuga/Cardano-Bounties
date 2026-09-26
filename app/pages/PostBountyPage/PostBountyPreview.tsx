import styles from "../PostBountyPage.module.css";
import type { BountyForm } from "./types";

export function PostBountyPreview({
  form,
  projectNamePreview,
  displayType,
  rewardPreview,
  totalFundingPreview,
}: {
  form: BountyForm;
  projectNamePreview: string;
  displayType: string;
  rewardPreview: string;
  totalFundingPreview: string;
}) {
  return (
    <aside className={styles.briefPreview} aria-label="Bounty preview">
      <span>Preview</span>
      <h2>{form.title || "Your bounty title"}</h2>
      <strong className={styles.projectPreviewName}>{projectNamePreview}</strong>
      <p>{form.description || "A concise contributor-facing summary will appear here as you write the brief."}</p>
      <dl>
        <div>
          <dt>Type</dt>
          <dd>{displayType}</dd>
        </div>
        <div>
          <dt>Reward</dt>
          <dd>{rewardPreview}</dd>
        </div>
        <div>
          <dt>Total funding</dt>
          <dd>{totalFundingPreview}</dd>
        </div>
        <div>
          <dt>Deadline</dt>
          <dd>{form.deadline || "Rolling"}</dd>
        </div>
      </dl>
    </aside>
  );
}
