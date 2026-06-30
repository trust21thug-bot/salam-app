"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TeachersTable } from "./teachers-table";
import { AssistantTeachersTable } from "./assistant-teachers-table";
import { AttendantsTable } from "./attendants-table";

const TABS = [
  { key: "teachers", label: "الأساتذة" },
  { key: "assistants", label: "الأساتذة المساعدون" },
  { key: "attendants", label: "المداومون" },
] as const;

interface Props {
  initialData: {
    teachers: any[];
    assistants: any[];
    attendants: any[];
  };
}

export function TeachersPageClient({ initialData }: Props) {
  const [tab, setTab] = useState<string>("teachers");

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">الأساتذة والحلقات</h2>
      <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
              tab === t.key && "bg-background text-foreground shadow"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "teachers" && <TeachersTable key="teachers" initialData={initialData.teachers} />}
      {tab === "assistants" && <AssistantTeachersTable key="assistants" initialData={initialData.assistants} />}
      {tab === "attendants" && <AttendantsTable key="attendants" initialData={initialData.attendants} />}
    </div>
  );
}
