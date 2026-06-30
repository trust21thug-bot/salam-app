"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DAY_LABELS } from "@/lib/utils";

function parseTimeRange(val: string): { from: string; to: string } {
  const m = val.match(/^من (.+) إلى (.+)$/);
  if (m) return { from: m[1].trim(), to: m[2].trim() };
  return { from: val, to: "" };
}

export function DayRow({
  day, value, onChange, prayerTimes,
}: {
  day: number; value: string; onChange: (val: string) => void; prayerTimes: string[];
}) {
  const parsed = parseTimeRange(value);
  const [from, setFrom] = useState(parsed.from);
  const [to, setTo] = useState(parsed.to);
  const [fromIsPrayer, setFromIsPrayer] = useState(
    parsed.from ? prayerTimes.some((p) => parsed.from.includes(p)) : false
  );
  const [toIsPrayer, setToIsPrayer] = useState(
    parsed.to ? prayerTimes.some((p) => parsed.to.includes(p)) : false
  );
  const active = !!value;

  const toggleActive = () => {
    if (active) {
      onChange("");
    } else {
      onChange("من 08:00 إلى 10:00");
      setFrom("08:00");
      setTo("10:00");
    }
  };

  const update = (f?: string, t?: string) => {
    const ff = f ?? from;
    const tt = t ?? to;
    onChange(tt ? `من ${ff} إلى ${tt}` : ff);
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant={active ? "default" : "outline"}
        size="sm"
        onClick={toggleActive}
        className="shrink-0 w-16 text-xs"
      >
        {DAY_LABELS[day]}
      </Button>
      {active && (
        <div className="flex items-center gap-1 flex-1">
          <div className="flex items-center gap-0.5 flex-1">
            {fromIsPrayer ? (
              <Select value={from} onValueChange={(v) => { setFrom(v); update(v, undefined); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {prayerTimes.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                </SelectContent>
              </Select>
            ) : (
              <Input type="time" value={from} onChange={(e) => { setFrom(e.target.value); update(e.target.value, undefined); }} className="h-8 text-xs" />
            )}
            <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" title="تبديل" onClick={() => { setFromIsPrayer(!fromIsPrayer); setFrom(""); }}>
              {fromIsPrayer ? "🕌" : "🕐"}
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">—</span>
          <div className="flex items-center gap-0.5 flex-1">
            {toIsPrayer ? (
              <Select value={to} onValueChange={(v) => { setTo(v); update(undefined, v); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {prayerTimes.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                </SelectContent>
              </Select>
            ) : (
              <Input type="time" value={to} onChange={(e) => { setTo(e.target.value); update(undefined, e.target.value); }} className="h-8 text-xs" />
            )}
            <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" title="تبديل" onClick={() => { setToIsPrayer(!toIsPrayer); setTo(""); }}>
              {toIsPrayer ? "🕌" : "🕐"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
