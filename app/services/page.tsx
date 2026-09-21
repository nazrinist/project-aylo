"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Business } from "@/types/business";
import type { Service } from "@/types/service";

type FormState = {
  businessId: string;
  name: string;
  description: string;
  price: string;
  durationMinutes: string;
  active: boolean;
};

const emptyForm: FormState = {
  businessId: "",
  name: "",
  description: "",
  price: "",
  durationMinutes: "60",
  active: true,
};

export default function ServicesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState("all");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [businessResponse, serviceResponse] = await Promise.all([
        fetch("/api/businesses", { cache: "no-store" }),
        fetch("/api/services", { cache: "no-store" }),
      ]);
      const [businessData, serviceData] = await Promise.all([
        businessResponse.json(),
        serviceResponse.json(),
      ]);
      if (!businessData.ok) throw new Error(businessData.error || "Businesses could not be loaded");
      if (!serviceData.ok) throw new Error(serviceData.error || "Services could not be loaded");

      setBusinesses(businessData.businesses);
      setServices(serviceData.services);
      setForm((current) => ({
        ...current,
        businessId: current.businessId || businessData.businesses[0]?.id || "",
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Services could not be loaded");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const visibleServices = useMemo(
    () =>
      selectedBusiness === "all"
        ? services
        : services.filter((service) => service.business_id === selectedBusiness),
    [selectedBusiness, services],
  );

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm, businessId: businesses[0]?.id || "" });
  }

  function editService(service: Service) {
    setEditingId(service.id);
    setForm({
      businessId: service.business_id,
      name: service.name,
      description: service.description ?? "",
      price: String(service.price),
      durationMinutes: String(service.duration_minutes),
      active: service.active,
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
      business_id: form.businessId,
      name: form.name,
      description: form.description.trim() || null,
      price: Number(form.price),
      currency: "AZN",
      duration_minutes: Number(form.durationMinutes),
      active: form.active,
    };

    try {
      const response = await fetch(
        editingId ? `/api/services/${editingId}` : "/api/services",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Save failed");
      setNotice(editingId ? "Service updated." : "Service created.");
      resetForm();
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeService(service: Service) {
    const confirmed = window.confirm(
      `Delete ${service.name} from ${service.business_name}? Its availability slots will also be deleted.`,
    );
    if (!confirmed) return;

    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/services/${service.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Delete failed");
      setNotice(`${service.name} deleted.`);
      if (editingId === service.id) resetForm();
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed");
    }
  }

  return (
    <main className="businessShell">
      <header className="businessHeader serviceHeader">
        <div>
          <div className="adminNav">
            <Link href="/" className="backLink">← Aylo search</Link>
            <Link href="/dashboard" className="backLink">Dashboard</Link>
            <Link href="/leads" className="backLink">Leads</Link>
            <Link href="/analytics" className="backLink">Analytics</Link>
            <Link href="/businesses" className="backLink">Businesses</Link>
            <Link href="/availability" className="backLink">Availability</Link>
          </div>
          <p className="eyebrow">Aylo Business</p>
          <h1>Services</h1>
          <p>Manage what every provider offers, including price and duration.</p>
        </div>
        <span className="catalogCount">{visibleServices.length} services</span>
      </header>

      <div className="businessLayout">
        <form className="businessForm" onSubmit={submit}>
          <div className="formHeading">
            <div>
              <p className="eyebrow">{editingId ? "Editing" : "New service"}</p>
              <h2>{editingId ? "Update service" : "Add service"}</h2>
            </div>
            {editingId && (
              <button className="textButton" type="button" onClick={resetForm}>Cancel</button>
            )}
          </div>

          <label>
            Business
            <select
              required
              value={form.businessId}
              onChange={(event) => setForm({ ...form, businessId: event.target.value })}
            >
              <option value="" disabled>Select a business</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>{business.name}</option>
              ))}
            </select>
          </label>

          <label>
            Service name
            <input
              required
              minLength={2}
              maxLength={100}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Hair + Makeup"
            />
          </label>

          <label>
            Description
            <textarea
              maxLength={500}
              rows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Event-ready hair and makeup"
            />
          </label>

          <div className="formColumns">
            <label>
              Price (AZN)
              <input
                required
                type="number"
                min="0"
                max="10000"
                step="0.01"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                placeholder="95"
              />
            </label>
            <label>
              Duration (min)
              <input
                required
                type="number"
                min="15"
                max="480"
                step="5"
                value={form.durationMinutes}
                onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })}
              />
            </label>
          </div>

          <label className="checkboxLabel">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm({ ...form, active: event.target.checked })}
            />
            Available in Aylo search
          </label>

          <button className="primaryButton" disabled={saving || businesses.length === 0}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Create service"}
          </button>
        </form>

        <section className="businessList" aria-live="polite">
          <div className="serviceToolbar">
            <label>
              Filter by business
              <select value={selectedBusiness} onChange={(event) => setSelectedBusiness(event.target.value)}>
                <option value="all">All businesses</option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>{business.name}</option>
                ))}
              </select>
            </label>
          </div>

          {error && <div className="crudMessage error">{error}</div>}
          {notice && <div className="crudMessage success">{notice}</div>}
          {loading && <div className="crudMessage">Loading services…</div>}
          {!loading && visibleServices.length === 0 && (
            <div className="crudMessage">No services for this business yet.</div>
          )}

          {visibleServices.map((service) => (
            <article className="businessCard serviceCard" key={service.id}>
              <div className="businessCardMain">
                <div className="businessAvatar">{service.name.slice(0, 1)}</div>
                <div>
                  <div className="businessNameRow">
                    <h2>{service.name}</h2>
                    <span className={`activeBadge ${service.active ? "on" : "off"}`}>
                      {service.active ? "Active" : "Hidden"}
                    </span>
                  </div>
                  <p>{service.business_name}</p>
                  <div className="serviceMeta">
                    <strong>{service.price} {service.currency}</strong>
                    <span>{service.duration_minutes} min</span>
                  </div>
                </div>
              </div>
              <div className="cardActions">
                <button type="button" className="secondaryButton" onClick={() => editService(service)}>Edit</button>
                <button type="button" className="dangerButton" onClick={() => removeService(service)}>Delete</button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
