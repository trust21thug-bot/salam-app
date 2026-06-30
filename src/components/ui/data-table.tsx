import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { Button } from "./button";
import { Checkbox } from "./checkbox";

interface ColumnFilterConfig {
  type: "text" | "select";
  placeholder?: string;
  options?: { label: string; value: string }[];
  filterValue?: (item: any) => string;
}

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  filter?: ColumnFilterConfig;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
}

export function DataTable<T extends Record<string, any>>({ columns, data, keyExtractor }: DataTableProps<T>) {
  const filters = columns.filter((c) => c.filter);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [visOpen, setVisOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(
    () => Object.fromEntries(columns.map((c) => [c.key, true]))
  );
  const visRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (visRef.current && !visRef.current.contains(e.target as Node)) setVisOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const visibleColumns = columns.filter((c) => visibleCols[c.key] !== false);

  const filtered = useMemo(() => {
    let result = data;
    for (const col of filters) {
      const fv = filterValues[col.key];
      if (!fv) continue;
      result = result.filter((item) => {
        const raw = col.filter!.filterValue ? col.filter!.filterValue(item) : String(item[col.key] ?? "");
        return raw.toLowerCase().includes(fv.toLowerCase());
      });
    }
    return result;
  }, [data, filterValues, filters]);

  return (
    <div>
      <div className="flex justify-end mb-2" ref={visRef}>
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setVisOpen(!visOpen)}>
            إظهار/إخفاء الأعمدة
          </Button>
          {visOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-md border bg-popover p-2 shadow-md">
              {columns.map((col) => (
                <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted rounded-sm">
                  <Checkbox
                    checked={visibleCols[col.key] !== false}
                    onCheckedChange={(chk) => setVisibleCols((p) => ({ ...p, [col.key]: chk === true }))}
                  />
                  {col.header || col.key}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {visibleColumns.map((col) => (
              <TableHead key={col.key} className="text-center">{col.header}</TableHead>
            ))}
          </TableRow>
          {filters.length > 0 && (
            <TableRow>
              {visibleColumns.map((col) => (
                <TableHead key={col.key} className="text-center">
                  {col.filter ? (
                    col.filter.type === "select" ? (
                      <Select value={filterValues[col.key] ?? ""} onValueChange={(v) => setFilterValues((prev) => ({ ...prev, [col.key]: v === "__all__" ? "" : v }))}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={col.filter.placeholder || "الكل"} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">الكل</SelectItem>
                          {(col.filter.options ?? []).map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder={col.filter.placeholder || "بحث..."}
                        value={filterValues[col.key] ?? ""}
                        onChange={(e) => setFilterValues((prev) => ({ ...prev, [col.key]: e.target.value }))}
                        className="h-7 text-xs"
                      />
                    )
                  ) : null}
                </TableHead>
              ))}
            </TableRow>
          )}
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">
                لا توجد بيانات
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((item) => (
              <TableRow key={keyExtractor(item)}>
                {visibleColumns.map((col) => (
                  <TableCell key={col.key} className="text-center">{col.render ? col.render(item) : String(item[col.key] ?? "")}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
