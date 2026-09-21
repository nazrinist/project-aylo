"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  applyDemoAvailabilityMutation,
  buildAvailabilityCounts,
  catalogAvailabilityCounts,
  filterAvailabilitySlots,
  isProtectedAvailabilityStatus,
  withAvailabilitySlots,
} from "@/lib/availability-management/shared";
import {
  AVAILABILITY_FILTERS,
  AvailabilityMutationInputSchema,
  type AvailabilityCounts,
  type AvailabilityFilter,
  type AvailabilityManagementApiResponse,
  type AvailabilityManagementData,
  type AvailabilityMutationApiResponse,
  type AvailabilityMutationInput,
  type AvailabilityServiceOption,
  type AvailabilitySlotSummary,
  type AvailabilityStatus,
} from "@/types/availability";

type PendingSlotAction =
  | {
      action: "set_status";
      targetStatus: "available" | "blocked";
      slot: AvailabilitySlotSummary;
    }
  | { action: "delete"; slot: AvailabilitySlotSummary };

const dateHeadingFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Baku",
  weekday: "long",
  day: "2-digit",
  month: "short",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Baku",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function bakuToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addCalendarDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
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

function statusLabel(status: AvailabilityStatus) {
  if (status === "available") return "Available";
  if (status === "held") return "Held";
  if (status === "booked") return "Booked";
  return "Blocked";
}

function sourceLabel(data: AvailabilityManagementData) {
  if (data.source === "operations") return "Live schedule";
  if (data.source === "catalog") return "Catalog only";
  return "Demo schedule";
}

function slotDateKey(value: string) {
  return new Date(new Date(value).getTime() + 4 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function groupSlots(slots: AvailabilitySlotSummary[]) {
  const groups = new Map<string, AvailabilitySlotSummary[]>();
  for (const slot of slots) {
    const key = slotDateKey(slot.startTime);
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }
  return [...groups.entries()];
}

export default function AvailabilityPage() {
  const [data, setData] = useState<AvailabilityManagementData | null>(null);
  const [operatorToken, setOperatorToken] = useState("");
  const [needsAccess, setNeedsAccess] = useState(false);
  const [configurationMissing, setConfigurationMissing] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<AvailabilityFilter>("all");
  const [formServiceId, setFormServiceId] = useState("");
  const [slotDate, setSlotDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingSlotAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSchedule = useCallback(async ({
    businessId,
    date,
    token,
  }: {
    businessId?: string;
    date: string;
    token?: string;
  }) => {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const params = new URLSearchParams({ startDate: date });
      if (businessId) params.set("businessId", businessId);
      const headers: HeadersInit = {};
      if (token?.trim()) headers.Authorization = `Bearer ${token.trim()}`;

      const response = await fetch(`/api/availability/manage?${params}`, {
        cache: "no-store",
        headers,
      });
      const result = (await response.json()) as AvailabilityManagementApiResponse;

      if (!result.ok) {
        if (result.code === "AVAILABILITY_ACCESS_REQUIRED") {
          setData(null);
          setNeedsAccess(true);
          setConfigurationMissing(false);
          setAccessError(token ? result.error : null);
          return false;
        }
        if (result.code === "AVAILABILITY_ACCESS_NOT_CONFIGURED") {
          setData(null);
          setOperatorToken("");
          setNeedsAccess(false);
          setConfigurationMissing(true);
          setAccessError(null);
          return false;
        }
        throw new Error(result.error);
      }

      const activeServices = result.services.filter((service) => service.active);
      const firstService = activeServices[0];
      setData(result);
      setSelectedBusinessId(result.selectedBusinessId ?? "");
      setSelectedServiceId("");
      setStartDate(result.window.startDate);
      setFormServiceId(firstService?.id ?? "");
      setSlotDate(result.window.startDate);
      setStartTime("10:00");
      setEndTime(addMinutes("10:00", firstService?.durationMinutes ?? 60));
      setEditingId(null);
      setPendingAction(null);
      setNeedsAccess(false);
      setConfigurationMissing(false);
      setAccessError(null);
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The availability schedule could not be loaded.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const today = bakuToday();
    setStartDate(today);
    void loadSchedule({ date: today });
  }, [loadSchedule]);

  const activeServices = useMemo(
    () => data?.services.filter((service) => service.active) ?? [],
    [data],
  );
  const formService = data?.services.find(
    (service) => service.id === formServiceId,
  );
  const serviceSlots = useMemo(() => {
    if (!data) return [];
    return selectedServiceId
      ? data.slots.filter((slot) => slot.serviceId === selectedServiceId)
      : data.slots;
  }, [data, selectedServiceId]);
  const visibleCounts: AvailabilityCounts = useMemo(() => {
    if (!data || !selectedServiceId) {
      return data?.counts ?? {
        all: 0,
        available: 0,
        held: 0,
        booked: 0,
        blocked: 0,
      };
    }
    return data.source === "catalog"
      ? catalogAvailabilityCounts(serviceSlots.length)
      : buildAvailabilityCounts(serviceSlots);
  }, [data, selectedServiceId, serviceSlots]);
  const visibleSlots = useMemo(
    () => filterAvailabilitySlots(serviceSlots, statusFilter),
    [serviceSlots, statusFilter],
  );
  const slotGroups = useMemo(() => groupSlots(visibleSlots), [visibleSlots]);

  function resetForm(services: AvailabilityServiceOption[] = activeServices) {
    const preferred = services.find((service) => service.id === selectedServiceId);
    const service = preferred ?? services[0];
    setEditingId(null);
    setFormServiceId(service?.id ?? "");
    setSlotDate(startDate);
    setStartTime("10:00");
    setEndTime(addMinutes("10:00", service?.durationMinutes ?? 60));
  }

  function lockSchedule(message?: string) {
    setData(null);
    setOperatorToken("");
    setNeedsAccess(true);
    setConfigurationMissing(false);
    setAccessError(message ?? null);
    setPendingAction(null);
    setEditingId(null);
  }

  async function unlock(event: FormEvent) {
    event.preventDefault();
    const token = operatorToken.trim();
    if (!token) {
      setAccessError("Enter the configured operator token.");
      return;
    }
    await loadSchedule({ date: startDate || bakuToday(), token });
  }

  async function changeWindow(nextDate: string) {
    setStatusFilter("all");
    setSelectedServiceId("");
    await loadSchedule({
      businessId: selectedBusinessId || undefined,
      date: nextDate,
      token: operatorToken,
    });
  }

  async function sendLiveMutation(input: AvailabilityMutationInput) {
    const response = await fetch("/api/availability/manage", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${operatorToken.trim()}`,
      },
      body: JSON.stringify(input),
    });
    const result = (await response.json()) as AvailabilityMutationApiResponse;

    if (!result.ok) {
      if (result.code === "AVAILABILITY_ACCESS_REQUIRED") {
        lockSchedule(result.error);
        return null;
      }
      if (result.code === "AVAILABILITY_ACCESS_NOT_CONFIGURED") {
        setData(null);
        setOperatorToken("");
        setNeedsAccess(false);
        setConfigurationMissing(true);
        return null;
      }
      throw new Error(result.error);
    }
    if (!response.ok) throw new Error("The availability change could not be saved.");
    return result;
  }

  async function applyMutation(input: AvailabilityMutationInput) {
    if (!data) throw new Error("Load the schedule before making changes.");

    if (data.source === "demo") {
      const result = applyDemoAvailabilityMutation(
        data.slots,
        data.services,
        input,
        { newSlotId: crypto.randomUUID() },
      );
      setData(withAvailabilitySlots(data, result.slots));
      return { changed: result.changed };
    }

    if (data.source !== "operations") {
      throw new Error("Live changes are unavailable in catalog-only mode.");
    }

    const result = await sendLiveMutation(input);
    if (!result) return null;
    await loadSchedule({
      businessId: selectedBusinessId || undefined,
      date: startDate,
      token: operatorToken,
    });
    return { changed: result.changed };
  }

  function editSlot(slot: AvailabilitySlotSummary) {
    if (isProtectedAvailabilityStatus(slot.status)) return;
    const start = bakuDateAndTime(slot.startTime);
    const end = bakuDateAndTime(slot.endTime);
    setEditingId(slot.id);
    setFormServiceId(slot.serviceId);
    setSlotDate(start.date);
    setStartTime(start.time);
    setEndTime(end.time);
    setNotice(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!data?.selectedBusinessId) return;

    const rawInput = editingId
      ? {
          action: "update",
          slotId: editingId,
          businessId: data.selectedBusinessId,
          serviceId: formServiceId,
          startTime: new Date(`${slotDate}T${startTime}:00+04:00`).toISOString(),
          endTime: new Date(`${slotDate}T${endTime}:00+04:00`).toISOString(),
          confirmed: true,
        }
      : {
          action: "create",
          businessId: data.selectedBusinessId,
          serviceId: formServiceId,
          startTime: new Date(`${slotDate}T${startTime}:00+04:00`).toISOString(),
          endTime: new Date(`${slotDate}T${endTime}:00+04:00`).toISOString(),
          confirmed: true,
        };
    const parsed = AvailabilityMutationInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the slot details.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await applyMutation(parsed.data);
      if (!result) return;
      setNotice(editingId ? "Slot updated." : "Slot created.");
      resetForm();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The slot could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction || !data?.selectedBusinessId) return;
    setSaving(true);
    setError(null);
    setNotice(null);

    const input: AvailabilityMutationInput =
      pendingAction.action === "delete"
        ? {
            action: "delete",
            slotId: pendingAction.slot.id,
            businessId: data.selectedBusinessId,
            confirmed: true,
          }
        : {
            action: "set_status",
            slotId: pendingAction.slot.id,
            businessId: data.selectedBusinessId,
            targetStatus: pendingAction.targetStatus,
            confirmed: true,
          };

    try {
      const result = await applyMutation(input);
      if (!result) return;
      const action = pendingAction;
      setPendingAction(null);
      if (editingId === action.slot.id) resetForm();
      setNotice(
        action.action === "delete"
          ? "Slot deleted."
          : action.targetStatus === "blocked"
            ? result.changed ? "Slot blocked." : "Slot was already blocked."
            : result.changed ? "Slot reopened." : "Slot was already available.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The availability change could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="businessShell availabilityShell">
      <header className="businessHeader availabilityHeader">
        <div>
          <div className="adminNav">
            <Link href="/" className="backLink">← Aylo search</Link>
            <Link href="/dashboard" className="backLink">Dashboard</Link>
            <Link href="/leads" className="backLink">Leads</Link>
            <Link href="/businesses" className="backLink">Businesses</Link>
            <Link href="/services" className="backLink">Services</Link>
          </div>
          <p className="eyebrow">Aylo Business · Day 20</p>
          <h1>Availability schedule</h1>
          <p>Manage seven days of open, held, booked, and blocked time in Baku time.</p>
        </div>
        {data && (
          <span className={`dashboardHeaderBadge ${data.source}`}>
            {sourceLabel(data)}
          </span>
        )}
      </header>

      {needsAccess && (
        <form className="leadAccessCard availabilityAccessCard" onSubmit={unlock}>
          <div className="leadAccessIcon" aria-hidden="true">◇</div>
          <div>
            <p className="eyebrow">Private operations</p>
            <h2>Unlock availability management</h2>
            <p>
              Enter the value configured as <code>AYLO_OPERATOR_TOKEN</code>.
              It stays only in this page&apos;s memory and is never saved in browser storage.
            </p>
            <label htmlFor="availability-operator-token">Operator token</label>
            <div className="leadAccessFields">
              <input
                id="availability-operator-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={operatorToken}
                onChange={(event) => setOperatorToken(event.target.value)}
                placeholder="32+ character token"
              />
              <button type="submit" disabled={loading}>
                {loading ? "Checking…" : "Unlock schedule"}
              </button>
            </div>
            {accessError && <p className="leadAccessError">{accessError}</p>}
          </div>
        </form>
      )}

      {configurationMissing && (
        <section className="leadConfigurationCard">
          <p className="eyebrow">Setup required</p>
          <h2>Operator access is not configured.</h2>
          <p>
            Add a random 32+ character <code>AYLO_OPERATOR_TOKEN</code> to
            {" "}<code>.env.local</code>, then restart the development server.
          </p>
        </section>
      )}

      {data && (
        <>
          <section className="availabilityControlBar" aria-label="Schedule controls">
            <label htmlFor="availability-business">
              <span>Business</span>
              <select
                id="availability-business"
                value={selectedBusinessId}
                disabled={loading}
                onChange={(event) => {
                  const businessId = event.target.value;
                  setSelectedBusinessId(businessId);
                  setSelectedServiceId("");
                  setStatusFilter("all");
                  void loadSchedule({
                    businessId,
                    date: startDate,
                    token: operatorToken,
                  });
                }}
              >
                {data.businesses.map((business) => (
                  <option value={business.id} key={business.id}>{business.name}</option>
                ))}
              </select>
            </label>
            <label htmlFor="availability-service-filter">
              <span>Service</span>
              <select
                id="availability-service-filter"
                value={selectedServiceId}
                onChange={(event) => {
                  setSelectedServiceId(event.target.value);
                  setStatusFilter("all");
                }}
              >
                <option value="">All services</option>
                {data.services.map((service) => (
                  <option value={service.id} key={service.id}>
                    {service.name}{service.active ? "" : " · inactive"}
                  </option>
                ))}
              </select>
            </label>
            <div className="availabilityWeekControls">
              <span>Week</span>
              <div>
                <button
                  type="button"
                  disabled={loading || startDate <= bakuToday()}
                  onClick={() => void changeWindow(addCalendarDays(startDate, -7))}
                  aria-label="Previous seven days"
                >
                  ←
                </button>
                <strong>{data.window.label}</strong>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void changeWindow(addCalendarDays(startDate, 7))}
                  aria-label="Next seven days"
                >
                  →
                </button>
              </div>
            </div>
            <div className="availabilityControlActions">
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadSchedule({
                  businessId: selectedBusinessId || undefined,
                  date: startDate,
                  token: operatorToken,
                })}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
              {data.source === "operations" && (
                <button type="button" onClick={() => lockSchedule()}>Lock</button>
              )}
            </div>
          </section>

          <div className="dashboardLiveStatus" aria-live="polite">
            {loading && "Refreshing availability…"}
            {error && <span className="error">{error}</span>}
            {notice && <span className="leadDecisionSuccess">{notice}</span>}
          </div>

          {data.source === "catalog" && (
            <section className="leadUnavailable availabilityCatalogNotice">
              <span aria-hidden="true">◇</span>
              <div>
                <p className="eyebrow">Read-only catalog</p>
                <h2>Private schedule states and actions are unavailable.</h2>
                <p>
                  Add <code>SUPABASE_SECRET_KEY</code> and a strong
                  {" "}<code>AYLO_OPERATOR_TOKEN</code>, then restart the server.
                  Only public available slots are shown here.
                </p>
              </div>
            </section>
          )}

          {data.source === "demo" && (
            <p className="availabilityDemoNotice">
              Demo changes stay in this page&apos;s memory only. Refreshing or changing
              the week resets the sample schedule.
            </p>
          )}

          <section className="availabilityStatusFilters" aria-label="Filter schedule by status">
            {AVAILABILITY_FILTERS.map((filter) => (
              <button
                type="button"
                key={filter}
                className={statusFilter === filter ? "active" : ""}
                aria-pressed={statusFilter === filter}
                onClick={() => setStatusFilter(filter)}
              >
                <span>{filter === "all" ? "All" : statusLabel(filter)}</span>
                <strong>{visibleCounts[filter] ?? "—"}</strong>
              </button>
            ))}
          </section>

          {data.resultsLimited && !selectedServiceId && (
            <p className="leadLimitNotice">
              Showing the first 200 slots in this week. Choose one service to
              inspect a narrower schedule.
            </p>
          )}

          <div className={`availabilityWorkspace ${data.canManage ? "managed" : "readonly"}`}>
            {data.canManage && (
              <form className="businessForm availabilityForm" onSubmit={submit}>
                <div className="formHeading">
                  <div>
                    <p className="eyebrow">{editingId ? "Editing" : "New slot"}</p>
                    <h2>{editingId ? "Update slot" : "Add availability"}</h2>
                  </div>
                  {editingId && (
                    <button className="textButton" type="button" onClick={() => resetForm()}>
                      Cancel
                    </button>
                  )}
                </div>

                <label>
                  Service
                  <select
                    required
                    value={formServiceId}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      const service = activeServices.find((item) => item.id === nextId);
                      setFormServiceId(nextId);
                      setEndTime(addMinutes(startTime, service?.durationMinutes ?? 60));
                    }}
                  >
                    <option value="" disabled>Select an active service</option>
                    {activeServices.map((service) => (
                      <option value={service.id} key={service.id}>
                        {service.name} · {service.durationMinutes ?? 60} min
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Date
                  <input
                    required
                    type="date"
                    min={startDate > bakuToday() ? startDate : bakuToday()}
                    max={data.window.endDate}
                    value={slotDate}
                    onChange={(event) => setSlotDate(event.target.value)}
                  />
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
                        setEndTime(
                          addMinutes(nextStart, formService?.durationMinutes ?? 60),
                        );
                      }}
                    />
                  </label>
                  <label>
                    End
                    <input
                      required
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                    />
                  </label>
                </div>

                <button className="primaryButton" disabled={saving || !formServiceId}>
                  {saving ? "Saving…" : editingId ? "Save changes" : "Create slot"}
                </button>
                <p className="securityNote">
                  Overlaps are rejected atomically. Held and booked slots stay read-only.
                </p>
              </form>
            )}

            <section className="availabilitySchedule" aria-live="polite">
              {slotGroups.length === 0 ? (
                <div className="leadEmptyState availabilityEmptyState">
                  <span aria-hidden="true">✓</span>
                  <h2>No matching slots</h2>
                  <p>Try another service, status, or seven-day window.</p>
                </div>
              ) : (
                slotGroups.map(([date, slots]) => (
                  <section className="availabilityDay" key={date}>
                    <header>
                      <div>
                        <p className="eyebrow">Baku time</p>
                        <h2>
                          {dateHeadingFormatter.format(new Date(`${date}T12:00:00+04:00`))}
                        </h2>
                      </div>
                      <span>{slots.length} slot{slots.length === 1 ? "" : "s"}</span>
                    </header>
                    <div className="availabilityDaySlots">
                      {slots.map((slot) => {
                        const protectedSlot = isProtectedAvailabilityStatus(slot.status);
                        const expired = new Date(slot.startTime).getTime() <= Date.now();
                        return (
                          <article className={`availabilityScheduleCard ${slot.status}`} key={slot.id}>
                            <div className="availabilityScheduleTime">
                              <strong>{timeFormatter.format(new Date(slot.startTime))}</strong>
                              <span>– {timeFormatter.format(new Date(slot.endTime))}</span>
                            </div>
                            <div className="availabilityScheduleIdentity">
                              <strong>{slot.serviceName}</strong>
                              <span className={`dashboardStatus ${slot.status}`}>
                                {statusLabel(slot.status)}
                              </span>
                            </div>
                            <div className="availabilityScheduleActions">
                              {protectedSlot || expired ? (
                                <span>
                                  {protectedSlot ? "Booking flow controlled" : "Past slot"}
                                </span>
                              ) : (
                                <>
                                  <button type="button" onClick={() => editSlot(slot)}>Edit</button>
                                  <button
                                    type="button"
                                    onClick={() => setPendingAction({
                                      action: "set_status",
                                      targetStatus:
                                        slot.status === "available" ? "blocked" : "available",
                                      slot,
                                    })}
                                  >
                                    {slot.status === "available" ? "Block" : "Reopen"}
                                  </button>
                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() => setPendingAction({ action: "delete", slot })}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </section>
          </div>

          <aside className="leadPrivacyNote availabilitySafetyNote">
            <span aria-hidden="true">i</span>
            <p>
              Booking-owned slots cannot be edited, blocked, reopened, or deleted here.
              Use the lead flow for booking decisions; availability management never
              loads customer identity or request text.
            </p>
          </aside>
        </>
      )}

      {!data && loading && !needsAccess && !configurationMissing && (
        <div className="dashboardLiveStatus">Loading availability…</div>
      )}
      {!data && error && <div className="crudMessage error">{error}</div>}

      {pendingAction && (
        <div className="leadDecisionBackdrop">
          <section
            className={`leadDecisionDialog ${pendingAction.action === "delete" ? "rejected" : "accepted"}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="availability-action-title"
            aria-describedby="availability-action-description"
          >
            <p className="eyebrow">Final confirmation</p>
            <h2 id="availability-action-title">
              {pendingAction.action === "delete"
                ? "Delete this slot?"
                : pendingAction.targetStatus === "blocked"
                  ? "Block this slot?"
                  : "Reopen this slot?"}
            </h2>
            <p id="availability-action-description">
              {pendingAction.action === "delete"
                ? "The slot will be removed permanently from the schedule."
                : pendingAction.targetStatus === "blocked"
                  ? "Customers will no longer see this time as bookable."
                  : "The time will become publicly bookable again if it does not overlap another active slot."}
            </p>
            <dl className="leadDecisionSummary">
              <div>
                <dt>Service</dt>
                <dd>{pendingAction.slot.serviceName}</dd>
              </div>
              <div>
                <dt>Baku time</dt>
                <dd>
                  {timeFormatter.format(new Date(pendingAction.slot.startTime))}
                  {"–"}
                  {timeFormatter.format(new Date(pendingAction.slot.endTime))}
                </dd>
              </div>
            </dl>
            <p className="leadDecisionAuthNote">
              Live mode re-checks the operator token and database state before saving.
            </p>
            <div className="leadDecisionDialogActions">
              <button type="button" disabled={saving} onClick={() => setPendingAction(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={pendingAction.action === "delete" ? "leadRejectAction" : "leadAcceptAction"}
                disabled={saving}
                onClick={() => void confirmPendingAction()}
              >
                {saving ? "Saving…" : "Confirm action"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
