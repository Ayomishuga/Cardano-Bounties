"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api";
import styles from "./page.module.css";

type UserProfile = {
  id: string;
  stake_address: string;
  role: string;
  display_name: string | null;
  bio: string | null;
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        setErrorMsg("");
        const res = await authFetch("/api/users/profile");
        if (!res.ok) {
          throw new Error("Failed to load profile settings.");
        }
        const data = (await res.json()) as UserProfile;
        setProfile(data);
        setDisplayName(data.display_name || "");
        setBio(data.bio || "");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "An error occurred.");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const res = await authFetch("/api/users/profile", {
        method: "PUT",
        body: JSON.stringify({ display_name: displayName, bio }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile settings.");
      }

      setProfile(data as UserProfile);
      setSuccessMsg("Profile settings updated successfully.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.settingsContainer}>
      <div className={styles.settingsCard}>
        <div className={styles.titleSection}>
          <h2>Profile Settings</h2>
          <p>Manage your public profile identity associated with your wallet stake key.</p>
        </div>

        {loading ? (
          <p>Loading profile details...</p>
        ) : (
          <form onSubmit={handleSave}>
            {successMsg && (
              <div className={`${styles.feedbackMessage} ${styles.successMessage}`}>
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className={`${styles.feedbackMessage} ${styles.errorMessage}`}>
                {errorMsg}
              </div>
            )}

            <div className={styles.formGroup}>
              <label>Wallet Stake Key</label>
              <div className={styles.infoBlock}>
                <span>Connected address</span>
                <code>{profile?.stake_address}</code>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="display_name">Display Name</label>
              <input
                id="display_name"
                type="text"
                placeholder="Enter display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                disabled={saving}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="bio">Profile Bio</label>
              <textarea
                id="bio"
                placeholder="Tell us about yourself or your organization..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                disabled={saving}
              />
            </div>

            <div className={styles.actions}>
              <button type="submit" className={styles.saveButton} disabled={saving}>
                {saving ? "Saving Changes..." : "Save Settings"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
