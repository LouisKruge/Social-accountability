import { describe, expect, it } from "vitest";
import { daysBetween, planEvent, readiness, upcoming, whenLabel } from "./events";

const TODAY = "2026-08-03";
const task = (p: ReturnType<typeof planEvent>, key: string) =>
  [...p.tasks, ...p.missed].find((t) => t.key === key);

describe("planEvent — the haircut rule", () => {
  it("schedules the haircut five days out, not the day before", () => {
    const p = planEvent("interview", "2026-08-24", TODAY);
    const cut = task(p, "haircut")!;
    expect(cut.dueOn).toBe("2026-08-19");
    expect(daysBetween(cut.dueOn, "2026-08-24")).toBe(5);
  });

  it("closes the haircut window at two days, rather than calling it merely late", () => {
    // A cut needs ~48h to settle. With the event tomorrow, booking one is not
    // "overdue" — it is actively a bad idea, and the plan has to say so.
    const p = planEvent("interview", "2026-08-04", TODAY);
    expect(task(p, "haircut")!.status).toBe("missed_window");
    expect(p.tasks.map((t) => t.key)).not.toContain("haircut");
  });

  it("still offers the haircut when there is exactly enough time", () => {
    const p = planEvent("interview", "2026-08-05", TODAY); // two days out
    expect(task(p, "haircut")!.status).not.toBe("missed_window");
  });
});

describe("planEvent — windows that have already shut", () => {
  it("does not list a three-week skincare routine for an event in four days", () => {
    // The failure this exists to prevent: a cheerful checklist that the person
    // discovers was fiction on the morning of the event.
    const p = planEvent("wedding", "2026-08-07", TODAY);
    expect(task(p, "skincare_start")!.status).toBe("missed_window");
    expect(p.missed.map((t) => t.key)).toContain("skincare_start");
  });

  it("keeps skincare live when there is still a real window", () => {
    const p = planEvent("wedding", "2026-09-10", TODAY);
    expect(task(p, "skincare_start")!.status).toBe("upcoming");
  });

  it("separates missed windows from the live plan entirely", () => {
    const p = planEvent("interview", "2026-08-04", TODAY);
    expect(p.tasks.every((t) => t.status !== "missed_window")).toBe(true);
    expect(p.missed.length).toBeGreaterThan(0);
  });
});

describe("planEvent — status", () => {
  it("marks a task due today as due and a passed one as overdue", () => {
    // Outfit is chosen 7 days out; with the event 7 days away that is today.
    const p = planEvent("interview", "2026-08-10", TODAY);
    expect(task(p, "outfit_chosen")!.status).toBe("due");

    const later = planEvent("interview", "2026-08-08", TODAY);
    expect(task(later, "outfit_chosen")!.status).toBe("overdue");
  });

  it("never marks a ticked task as overdue", () => {
    const p = planEvent("interview", "2026-08-08", TODAY, ["outfit_chosen"]);
    expect(task(p, "outfit_chosen")!.status).toBe("done");
  });

  it("does not call the follow-up overdue before the event has happened", () => {
    // follow_up sits two days AFTER. It cannot be late in advance.
    const p = planEvent("interview", "2026-08-20", TODAY);
    expect(task(p, "follow_up")!.status).toBe("upcoming");
    expect(task(p, "follow_up")!.dueOn).toBe("2026-08-22");
  });

  it("does mark the follow-up overdue once its own date has passed", () => {
    const p = planEvent("interview", "2026-07-25", TODAY);
    expect(task(p, "follow_up")!.status).toBe("overdue");
    expect(p.past).toBe(true);
  });

  it("orders the live plan by what is soonest", () => {
    const p = planEvent("wedding", "2026-09-20", TODAY);
    const days = p.tasks.map((t) => t.inDays);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });

  it("names the next thing to do", () => {
    const p = planEvent("interview", "2026-09-01", TODAY);
    expect(p.next).not.toBeNull();
    expect(p.next!.inDays).toBe(Math.min(...p.tasks.map((t) => t.inDays)));
  });
});

describe("planEvent — the plans themselves", () => {
  it("gives an interview speech practice and a date conversation practice", () => {
    const interview = planEvent("interview", "2026-09-01", TODAY);
    const date = planEvent("first_date", "2026-09-01", TODAY);
    expect(interview.tasks.map((t) => t.key)).toContain("speech_practice");
    expect(date.tasks.map((t) => t.key)).toContain("conversation_practice");
    expect(date.tasks.map((t) => t.key)).not.toContain("speech_practice");
  });

  it("only packs for the events you travel to", () => {
    expect(planEvent("holiday", "2026-09-01", TODAY).tasks.map((t) => t.key)).toContain("packing");
    expect(planEvent("first_date", "2026-09-01", TODAY).tasks.map((t) => t.key)).not.toContain("packing");
  });

  it("routes every task to the studio that handles it, or to none", () => {
    const p = planEvent("photoshoot", "2026-09-01", TODAY);
    expect(task(p, "photo_prep")!.studio).toBe("photo");
    expect(task(p, "outfit_chosen")!.studio).toBe("style");
    expect(task(p, "haircut")!.studio).toBe("look");
    expect(task(p, "final_check")!.studio).toBeNull();
  });
});

describe("readiness", () => {
  it("is null when there is nothing left to do", () => {
    const past = planEvent("graduation", "2026-01-01", TODAY);
    expect(readiness({ ...past, tasks: [] })).toBeNull();
  });

  it("measures done against what is still achievable, not against the full list", () => {
    // Someone four days from a wedding should not be told they are 40% ready
    // because of a skincare window that closed before they opened the app.
    const p = planEvent("wedding", "2026-08-07", TODAY, ["outfit_chosen", "shoes"]);
    const r = readiness(p)!;
    expect(r).toBeGreaterThan(0);
    expect(r).toBe(2 / p.tasks.length);
    expect(p.tasks.map((t) => t.key)).not.toContain("skincare_start");
  });
});

describe("upcoming", () => {
  const events = [
    { eventDate: "2026-07-01" }, // past
    { eventDate: "2026-08-20" },
    { eventDate: "2026-08-05" },
    { eventDate: "2027-06-01" }, // beyond the horizon
  ];

  it("drops past events and sorts the rest", () => {
    expect(upcoming(events, TODAY).map((e) => e.eventDate)).toEqual(["2026-08-05", "2026-08-20"]);
  });

  it("includes an event happening today", () => {
    expect(upcoming([{ eventDate: TODAY }], TODAY)).toHaveLength(1);
  });

  it("respects the horizon", () => {
    expect(upcoming(events, TODAY, 400).map((e) => e.eventDate)).toContain("2027-06-01");
  });
});

describe("whenLabel", () => {
  it("reads like a person wrote it", () => {
    expect(whenLabel(0)).toBe("today");
    expect(whenLabel(1)).toBe("tomorrow");
    expect(whenLabel(9)).toBe("in 9 days");
    expect(whenLabel(21)).toBe("in 3 weeks");
    expect(whenLabel(90)).toBe("in 3 months");
    expect(whenLabel(-1)).toBe("1 day ago");
  });
});

describe("daysBetween", () => {
  it("counts calendar days in UTC, across a month and a year boundary", () => {
    expect(daysBetween("2026-08-03", "2026-08-10")).toBe(7);
    expect(daysBetween("2026-08-31", "2026-09-01")).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-08-10", "2026-08-03")).toBe(-7);
  });
});
