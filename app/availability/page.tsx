"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Availability } from "@/types/availability";
import type { Business } from "@/types/business";
import type { Service } from "@/types/service";

function tomorrowInBaku() {
  const nowInBaku = new Date(Date.now() + 4 * 60 * 60 * 1000);
  nowInBaku.setUTCDate(nowInBaku.getUTCDate() + 1);
  return nowInBaku.toISOString().slice(0, 10);
}

function addMinutes(time: string, minutes: number) {
  const [hours, minute] = time.split(":").map(Number);
  const total = hours * 60 + minute + minutes;
  const endHours = Math.floor(total / 60);
  const endMinutes = total % 60;
  if (endHours > 23) return "23:59";
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

function bakuDateAndTime(value: string) {
  const baku = new Date(new Date(value).getTime() + 4 * 60 * 60 * 1000)
    .toISOString();
  return { date: baku.slice(0, 10), time: baku.slice(11, 16) };
}

function formatSlotTime(value: string) {
  return new Intl.DateTimeFormat("az-AZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Baku",
  }).format(new Date(value));
}

export default function AvailabilityPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<Availability[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const businessServices = useMemo(
    () => services.filter((service) => service.business_id === businessId),
    [businessId, services],
  );
  const selectedService = services.find((service) => service.id === serviceId);

  useEffect(() => {
    setDate(tomorrowInBaku());
  }, []);

  useEffect(() => {
    async function loadCatalog() {
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

        const loadedBusinesses = businessData.businesses as Business[];
        const loadedServices = serviceData.services as Service[];
        const firstBusinessId = loadedBusinesses[0]?.id ?? "";
        const firstService = loadedServices.find(
          (service) => service.business_id === firstBusinessId,
        );
        setBusinesses(loadedBusinesses);
        setServices(loadedServices);
        setBusinessId(firstBusinessId);
        setServiceId(firstService?.id ?? "");
        if (firstService) setEndTime(addMinutes("10:00", firstService.duration_minutes));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Catalog could not be loaded");
      } finally {
        setLoading(false);
      }
    }

    void loadCatalog();
  }, []);

  useEffect(() => {
    if (!businessId || !serviceId || !date) {
      setSlots([]);
      return;
    }

    let active = true;
    async function loadSlots() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ businessId, serviceId, date });
        const response = await fetch(`/api/availability?${params}`, { cache: "no-store" });
        const data = await response.json();
        if (!data.ok) throw new Error(data.error || "Availability could not be loaded");
        if (active) setSlots(data.availability);
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Availability could not be loaded");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSlots();
    return () => {
      active = false;
    };
  }, [businessId, date, refreshKey, serviceId]);

  function resetForm() {
    setEditingId(null);
    setStartTime("10:00");
    setEndTime(addMinutes("10:00", selectedService?.duration_minutes ?? 60));
  }

  function selectBusiness(nextBusinessId: string) {
    const firstService = services.find(
      (service) => service.business_id === nextBusinessId,
    );
    setBusinessId(nextBusinessId);
    setServiceId(firstService?.id ?? "");
    setEditingId(null);
    if (firstService) setEndTime(addMinutes(startTime, firstService.duration_minutes));
  }

  function selectService(nextServiceId: string) {
    const service = services.find((item) => item.id === nextServiceId);
    setServiceId(nextServiceId);
    setEditingId(null);
    if (service) setEndTime(addMinutes(startTime, service.duration_minutes));
  }

  function editSlot(slot: Availability) {
    const start = bakuDateAndTime(slot.start_time);
    const end = bakuDateAndTime(slot.end_time);
    setBusinessId(slot.business_id);
    setServiceId(slot.service_id);
    setDate(start.date);
    setStartTime(start.time);
    setEndTime(end.time);
    setEditingId(slot.id);
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
      business_id: businessId,
      service_id: serviceId,
      start_time: new Date(`${date}T${startTime}:00+04:00`).toISOString(),
      end_time: new Date(`${date}T${endTime}:00+04:00`).toISOString(),
      status: "available",
    };

    try {
      const response = await fetch(
        editingId ? `/api/availability/${editingId}` : "/api/availability",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Save failed");
      setNotice(editingId ? "Slot updated." : "Slot created.");
      resetForm();
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeSlot(slot: Availability) {
    const confirmed = window.confirm(
      `Delete the ${formatSlotTime(slot.start_time)}–${formatSlotTime(slot.end_time)} slot?`,
    );
    if (!confirmed) return;

    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/availability/${slot.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Delete failed");
      setNotice("Slot deleted.");
      if (editingId === slot.id) resetForm();
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed");
    }
  }

  return (
    <main className="businessShell">
      <header className="businessHeader availabilityHeader">
        <div>
          <div className="adminNav">
            <Link href="/" className="backLink">← Aylo search</Link>
            <Link href="/businesses" className="backLink">Businesses</Link>
            <Link href="/services" className="backLink">Services</Link>
          </div>
          <p className="eyebrow">Aylo Business</p>
          <h1>Availability</h1>
          <p>Create and manage bookable service times in Baku time.</p>
        </div>
        <span className="catalogCount">{slots.length} open slots</span>
      </header>

      <div className="businessLayout">
        <form className="businessForm" onSubmit={submit}>
          <div className="formHeading">
            <div>
              <p className="eyebrow">{editingId ? "Editing" : "New slot"}</p>
              <h2>{editingId ? "Update slot" : "Add availability"}</h2>
            </div>
            {editingId && (
              <button className="textButton" type="button" onClick={resetForm}>Cancel</button>
            )}
          </div>

          <label>
            Business
            <select required value={businessId} onChange={(event) => selectBusiness(event.target.value)}>
              <option value="" disabled>Select a business</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>{business.name}</option>
              ))}
            </select>
          </label>

          <label>
            Service
            <select required value={serviceId} onChange={(event) => selectService(event.target.value)}>
              <option value="" disabled>Select a service</option>
              {businessServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.duration_minutes} min
                </option>
              ))}
            </select>
          </label>

          <label>
            Date
            <input required type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>

          <div className="formColumns">
            <label>
              Start
              <input
                required
                type="time"
                value={startTime}
                onChange={(event) => {
                  const nextStart = event.target.value;
                  setStartTime(nextStart);
                  setEndTime(addMinutes(nextStart, selectedService?.duration_minutes ?? 60));
                }}
              />
            </label>
            <label>
              End
              <input required type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </label>
          </div>

          <button className="primaryButton" disabled={saving || !serviceId}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Create slot"}
          </button>
          <p className="securityNote">
            Overlapping times for the same service are rejected automatically.
          </p>
        </form>

        <section className="businessList" aria-live="polite">
          <div className="availabilityToolbar">
            <div>
              <span>Selected date</span>
              <strong>{date}</strong>
            </div>
            <div>
              <span>Service duration</span>
              <strong>{selectedService?.duration_minutes ?? "—"} min</strong>
            </div>
          </div>

          {error && <div className="crudMessage error">{error}</div>}
          {notice && <div className="crudMessage success">{notice}</div>}
          {loading && <div className="crudMessage">Loading availability…</div>}
          {!loading && serviceId && slots.length === 0 && (
            <div className="crudMessage">No open slots for this date.</div>
          )}
          {!loading && businessId && !serviceId && (
            <div className="crudMessage">Create an active service for this business first.</div>
          )}

          {slots.map((slot) => (
            <article className="businessCard availabilityCard" key={slot.id}>
              <div className="slotTime">
                <strong>{formatSlotTime(slot.start_time)}</strong>
                <span>to {formatSlotTime(slot.end_time)}</span>
              </div>
              <div className="slotDetails">
                <h2>{slot.service_name}</h2>
                <p>{slot.business_name}</p>
                <span className="activeBadge on">Available</span>
              </div>
              <div className="cardActions">
                <button type="button" className="secondaryButton" onClick={() => editSlot(slot)}>Edit</button>
                <button type="button" className="dangerButton" onClick={() => removeSlot(slot)}>Delete</button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
