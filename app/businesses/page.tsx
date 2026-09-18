"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { Business } from "@/types/business";

type FormState = {
  name: string;
  address: string;
  rating: string;
  verified: boolean;
};

const emptyForm: FormState = {
  name: "",
  address: "",
  rating: "",
  verified: false,
};

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadBusinesses() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/businesses", { cache: "no-store" });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Businesses could not be loaded");
      setBusinesses(data.businesses);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Businesses could not be loaded");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBusinesses();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function editBusiness(business: Business) {
    setEditingId(business.id);
    setForm({
      name: business.name,
      address: business.address ?? "",
      rating: business.rating === null ? "" : String(business.rating),
      verified: business.verified,
    });
    setNotice(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    const payload = {
      name: form.name,
      category: "beauty",
      address: form.address,
      latitude: null,
      longitude: null,
      rating: form.rating === "" ? null : Number(form.rating),
      verified: form.verified,
    };

    try {
      const response = await fetch(
        editingId ? `/api/businesses/${editingId}` : "/api/businesses",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Save failed");
      setNotice(editingId ? "Business updated." : "Business created.");
      resetForm();
      await loadBusinesses();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeBusiness(business: Business) {
    const confirmed = window.confirm(
      `Delete ${business.name}? Its services and availability will also be deleted.`,
    );
    if (!confirmed) return;

    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/businesses/${business.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Delete failed");
      setNotice(`${business.name} deleted.`);
      if (editingId === business.id) resetForm();
      await loadBusinesses();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed");
    }
  }

  return (
    <main className="businessShell">
      <header className="businessHeader">
        <div>
          <div className="adminNav">
            <Link href="/" className="backLink">← Aylo search</Link>
            <Link href="/services" className="backLink">Services</Link>
            <Link href="/availability" className="backLink">Availability</Link>
          </div>
          <p className="eyebrow">Aylo Business</p>
          <h1>Businesses</h1>
          <p>Manage the providers available to Aylo search.</p>
        </div>
        <span className="catalogCount">{businesses.length} providers</span>
      </header>

      <div className="businessLayout">
        <form className="businessForm" onSubmit={submit}>
          <div className="formHeading">
            <div>
              <p className="eyebrow">{editingId ? "Editing" : "New provider"}</p>
              <h2>{editingId ? "Update business" : "Add business"}</h2>
            </div>
            {editingId && (
              <button className="textButton" type="button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>

          <label>
            Business name
            <input
              required
              minLength={2}
              maxLength={100}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Glow Studio"
            />
          </label>

          <label>
            Address
            <input
              required
              minLength={2}
              maxLength={200}
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              placeholder="Ağ Şəhər, Bakı"
            />
          </label>

          <label>
            Rating
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={form.rating}
              onChange={(event) => setForm({ ...form, rating: event.target.value })}
              placeholder="4.8"
            />
          </label>

          <label className="checkboxLabel">
            <input
              type="checkbox"
              checked={form.verified}
              onChange={(event) => setForm({ ...form, verified: event.target.checked })}
            />
            Verified provider
          </label>

          <button className="primaryButton" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Create business"}
          </button>

          <p className="securityNote">
            Write operations run only on the server with the Supabase secret key.
          </p>
        </form>

        <section className="businessList" aria-live="polite">
          {error && <div className="crudMessage error">{error}</div>}
          {notice && <div className="crudMessage success">{notice}</div>}
          {loading && <div className="crudMessage">Loading providers…</div>}
          {!loading && businesses.length === 0 && (
            <div className="crudMessage">No businesses yet.</div>
          )}

          {businesses.map((business) => (
            <article className="businessCard" key={business.id}>
              <div className="businessCardMain">
                <div className="businessAvatar">{business.name.slice(0, 1)}</div>
                <div>
                  <div className="businessNameRow">
                    <h2>{business.name}</h2>
                    {business.verified && <span className="verifiedBadge">Verified</span>}
                  </div>
                  <p>{business.address || "Address not set"}</p>
                  <span className="businessRating">★ {business.rating ?? "New"}</span>
                </div>
              </div>
              <div className="cardActions">
                <button type="button" className="secondaryButton" onClick={() => editBusiness(business)}>
                  Edit
                </button>
                <button type="button" className="dangerButton" onClick={() => removeBusiness(business)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
