'use client';

import { useEffect, useState } from 'react';

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  color: 'emerald' | 'amber' | 'rose' | 'sky';
};

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const colorTokens: Record<CalendarEvent['color'], { bg: string; text: string; ring: string }> = {
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-900', ring: 'ring-emerald-200' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-900', ring: 'ring-amber-200' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-900', ring: 'ring-rose-200' },
  sky: { bg: 'bg-sky-100', text: 'text-sky-900', ring: 'ring-sky-200' },
};

const addDays = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);

const addMinutes = (date: Date, amount: number) => new Date(date.getTime() + amount * 60 * 1000);

const shiftMonth = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const formatMonth = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);

const formatDayLabel = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(date);

const formatTime = (date: Date) => new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(date);

const formatInputTime = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

type CalendarViewProps = {
  mode?: 'page' | 'modal';
};

type EventDraft = {
  title: string;
  location: string;
  startTime: string;
  endTime: string;
  color: CalendarEvent['color'];
};

export default function CalendarView({ mode = 'page' }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EventDraft>({
    title: '',
    location: '',
    startTime: '09:00',
    endTime: '10:00',
    color: 'emerald',
  });

  const loadEvents = async (monthAnchor: Date) => {
    const rangeStart = startOfMonth(monthAnchor);
    const rangeEnd = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0, 23, 59, 59, 999);

    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/calendar?start=${encodeURIComponent(rangeStart.toISOString())}&end=${encodeURIComponent(
          rangeEnd.toISOString()
        )}`
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to load events');
      }
      const data = await res.json();
      const mapped = Array.isArray(data)
        ? data.map((event: any) => ({
            id: event.id,
            title: event.title,
            start: new Date(event.startAt),
            end: new Date(event.endAt),
            location: event.location || undefined,
            color: event.color as CalendarEvent['color'],
          }))
        : [];
      setEvents(mapped);
    } catch (error: any) {
      setLoadError(error.message || 'Failed to load events');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents(currentMonth);
    const today = new Date();
    const sameMonth = today.getFullYear() === currentMonth.getFullYear() && today.getMonth() === currentMonth.getMonth();
    setSelectedDate(sameMonth ? today : new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
    setEditingId(null);
    setDraft({
      title: '',
      location: '',
      startTime: '09:00',
      endTime: '10:00',
      color: 'emerald',
    });
  }, [currentMonth]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const offset = (monthStart.getDay() + 6) % 7;
  const gridStart = addDays(monthStart, -offset);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

  const selectedEvents = selectedDate
    ? events.filter(event => isSameDay(event.start, selectedDate))
    : [];

  const colorOptions: Array<{ label: string; value: CalendarEvent['color'] }> = [
    { label: 'Emerald', value: 'emerald' },
    { label: 'Amber', value: 'amber' },
    { label: 'Rose', value: 'rose' },
    { label: 'Sky', value: 'sky' },
  ];

  const startDraftForDate = (date: Date) => {
    setEditingId(null);
    setDraft({
      title: '',
      location: '',
      startTime: '09:00',
      endTime: '10:00',
      color: 'emerald',
    });
    setSelectedDate(date);
  };

  const startEdit = (event: CalendarEvent) => {
    setEditingId(event.id);
    setDraft({
      title: event.title,
      location: event.location ?? '',
      startTime: formatInputTime(event.start),
      endTime: formatInputTime(event.end),
      color: event.color,
    });
  };

  const combineDateAndTime = (date: Date, time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours || 0, minutes || 0);
  };

  const handleSaveEvent = async () => {
    if (!selectedDate || !draft.title.trim()) {
      return;
    }
    const start = combineDateAndTime(selectedDate, draft.startTime);
    let end = combineDateAndTime(selectedDate, draft.endTime);
    if (end <= start) {
      end = addMinutes(start, 30);
    }

    try {
      if (editingId) {
        const res = await fetch(`/api/calendar/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: draft.title.trim(),
            location: draft.location.trim() || null,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            color: draft.color,
          }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to update event');
        }
        const updated = await res.json();
        setEvents(prev =>
          prev.map(event =>
            event.id === updated.id
              ? {
                  id: updated.id,
                  title: updated.title,
                  start: new Date(updated.startAt),
                  end: new Date(updated.endAt),
                  location: updated.location || undefined,
                  color: updated.color as CalendarEvent['color'],
                }
              : event
          )
        );
      } else {
        const res = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: draft.title.trim(),
            location: draft.location.trim() || null,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            color: draft.color,
          }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to create event');
        }
        const created = await res.json();
        setEvents(prev => [
          ...prev,
          {
            id: created.id,
            title: created.title,
            start: new Date(created.startAt),
            end: new Date(created.endAt),
            location: created.location || undefined,
            color: created.color as CalendarEvent['color'],
          },
        ]);
      }
    } catch (error: any) {
      setLoadError(error.message || 'Failed to save event');
      return;
    }

    setEditingId(null);
    setDraft({
      title: '',
      location: '',
      startTime: '09:00',
      endTime: '10:00',
      color: 'emerald',
    });
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const res = await fetch(`/api/calendar/${eventId}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to delete event');
      }
      setEvents(prev => prev.filter(event => event.id !== eventId));
    } catch (error: any) {
      setLoadError(error.message || 'Failed to delete event');
      return;
    }
    if (editingId === eventId) {
      setEditingId(null);
      setDraft({
        title: '',
        location: '',
        startTime: '09:00',
        endTime: '10:00',
        color: 'emerald',
      });
    }
  };

  const shellClass =
    mode === 'modal'
      ? 'bg-slate-50 text-slate-900'
      : 'min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#f8fafc_50%,_#ecfdf3)] text-slate-900';
  const containerClass = mode === 'modal' ? 'max-w-5xl px-5 py-6' : 'max-w-6xl px-4 py-8 lg:px-8';

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setEditingId(null);
  };

  return (
    <div className={shellClass}>
      <div className={`mx-auto flex w-full flex-col gap-6 ${containerClass}`}>
        <header className="flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">UxMail Calendar</p>
              <h1 className="text-3xl font-semibold text-slate-900">{formatMonth(currentMonth)}</h1>
              <p className="text-sm text-slate-500">
                Meet the day view that stays in sync with your mail invites.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentMonth(shiftMonth(monthStart, -1))}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth(shiftMonth(monthEnd, 1))}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = startOfMonth(new Date());
                  setCurrentMonth(today);
                  setSelectedDate(new Date());
                }}
                className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm transition hover:border-amber-300 hover:text-amber-800"
              >
                Today
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1">Linked to invitations</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">Auto-timezone aware</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">Editable per account</span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,_1fr)_320px]">
          <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur">
            <div className="grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {weekdayLabels.map(label => (
                <div key={label} className="text-center">
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-7 gap-2">
              {days.map(day => {
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isToday = isSameDay(day, new Date());
                const dayEvents = events.filter(event => isSameDay(event.start, day));

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleSelectDate(day)}
                    className={`flex h-24 flex-col rounded-2xl border p-3 text-left text-sm transition ${
                      isCurrentMonth
                        ? 'border-slate-100 bg-white hover:border-amber-200'
                        : 'border-transparent bg-slate-50 text-slate-400'
                    } ${isSameDay(day, selectedDate ?? new Date(0)) ? 'ring-2 ring-amber-300' : 'ring-0'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`${isCurrentMonth ? 'text-slate-900' : 'text-slate-400'} text-sm font-medium`}>
                        {day.getDate()}
                      </span>
                      {isToday ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          Today
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-col gap-1">
                      {dayEvents.slice(0, 2).map(event => (
                        <span
                          key={event.id}
                          className={`truncate rounded-full px-2 py-1 text-[11px] font-medium ${colorTokens[event.color].bg} ${colorTokens[event.color].text}`}
                        >
                          {event.title}
                        </span>
                      ))}
                      {dayEvents.length > 2 ? (
                        <span className="text-[11px] font-medium text-slate-400">+{dayEvents.length - 2} more</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Day details</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedDate ? formatDayLabel(selectedDate) : 'Pick a date to see invitations.'}
                  </p>
                </div>
                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => startDraftForDate(selectedDate)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                  >
                    New
                  </button>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {loadError && (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-600">
                    {loadError}
                  </div>
                )}
                {isLoading && (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
                    Loading calendar events...
                  </div>
                )}
                {selectedEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    No scheduled invites yet. Drag in mail threads to create one.
                  </div>
                ) : (
                  selectedEvents.map(event => (
                    <div
                      key={event.id}
                      className={`rounded-2xl border border-white/80 bg-white p-4 shadow-sm ring-1 ${colorTokens[event.color].ring}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                          <p className="text-xs text-slate-500">
                            {formatTime(event.start)} - {formatTime(event.end)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${colorTokens[event.color].bg} ${colorTokens[event.color].text}`}
                          >
                            Invite
                          </span>
                          <button
                            type="button"
                            onClick={() => startEdit(event)}
                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(event.id)}
                            className="text-[11px] font-semibold text-rose-500 hover:text-rose-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {event.location ? (
                        <p className="mt-2 text-xs text-slate-500">Location: {event.location}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
              {selectedDate && (
                <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {editingId ? 'Edit invite' : 'Add invite'}
                  </p>
                  <div className="mt-3 flex flex-col gap-3">
                    <input
                      value={draft.title}
                      onChange={(event) => setDraft(prev => ({ ...prev, title: event.target.value }))}
                      placeholder="Invite title"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-300"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        value={draft.startTime}
                        onChange={(event) => setDraft(prev => ({ ...prev, startTime: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-300"
                      />
                      <input
                        type="time"
                        value={draft.endTime}
                        onChange={(event) => setDraft(prev => ({ ...prev, endTime: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-300"
                      />
                    </div>
                    <input
                      value={draft.location}
                      onChange={(event) => setDraft(prev => ({ ...prev, location: event.target.value }))}
                      placeholder="Location (optional)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-300"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {colorOptions.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDraft(prev => ({ ...prev, color: option.value }))}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            draft.color === option.value
                              ? `${colorTokens[option.value].bg} ${colorTokens[option.value].text} border-transparent`
                              : 'border-slate-200 text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveEvent}
                        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-800"
                      >
                        {editingId ? 'Save changes' : 'Add invite'}
                      </button>
                      {editingId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setDraft({
                              title: '',
                              location: '',
                              startTime: '09:00',
                              endTime: '10:00',
                              color: 'emerald',
                            });
                          }}
                          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-800"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur">
              <h2 className="text-lg font-semibold text-slate-900">Upcoming invites</h2>
              <div className="mt-4 flex flex-col gap-3">
                {events.slice(0, 3).map(event => (
                  <div
                    key={`${event.id}-upcoming`}
                    className={`rounded-2xl border border-white/80 bg-white p-4 shadow-sm ring-1 ${colorTokens[event.color].ring}`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    <p className="text-xs text-slate-500">
                      {new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                      }).format(event.start)}{' '}
                      • {formatTime(event.start)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{event.location}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
