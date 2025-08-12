import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { HotTable } from "@handsontable/react";
import Handsontable from "handsontable/base";
import { HotTableClass } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import "./MonthlyStatusSheets.css";
import { registerAllModules } from "handsontable/registry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Settings2, Download } from "lucide-react";
import { useMonthlyStatusSheets } from "@/hooks/useMonthlyStatusSheets";
import { format, getDaysInMonth, getDay } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

// Register Handsontable modules
registerAllModules();

type BuiltinColumnKey = "Day" | "Weekday" | "Status" | "Notes";
type ExportColumnKey = BuiltinColumnKey | string;

type CustomColumnType = "text" | "dropdown";
type CustomColumnDef = {
  id: string;            // stable id
  title: string;         // header shown
  type: CustomColumnType;
  options?: string[];    // for dropdown type
  position?: number;     // ordering index
};

type CustomSchema = {
  columns: CustomColumnDef[];
};

type CustomDataRow = Record<string, any>; // key by column id - value
type CustomMonthData = {
  [day: number]: CustomDataRow;
};

type ExportConfig = {
  columns: Record<string, boolean>;
  transforms: Record<string, string>;
  fileName: string;
  sheetName: string;
  dateFormat: string; // applies to "Day" column presentation if needed
  numberFormat: string; // reserved for future numeric fields
};

const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  columns: { Day: true, Weekday: true, Status: true, Notes: true },
  transforms: {},
  fileName: "MonthlyStatus_${YYYY}-${MM}.xlsx",
  sheetName: "Monthly Status",
  dateFormat: "d",
  numberFormat: "0",
};

function formatWithMonth(date: Date, pattern: string) {
  const YYYY = format(date, "yyyy");
  const MM = format(date, "MM");
  const MMM = format(date, "MMM");
  return pattern.split("${YYYY}").join(YYYY).split("${MM}").join(MM).split("${MMM}").join(MMM);
}

function safeTransform(body: string | undefined, value: any, row: any) {
  if (!body || !body.trim()) return value;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("value", "row", body);
    const res = fn(value, row);
    return res;
  } catch (e) {
    console.error("Transform error:", e);
    return value;
  }
}

export const MonthlyStatusSheets: React.FC = React.memo(function MonthlyStatusSheetsComponent(): React.ReactElement {
  const hotRef = useRef<HotTableClass>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data, loading, fetchData, updateEntry } = useMonthlyStatusSheets();

  // Local persistence keys
  const LS_SCHEMA_KEY = "mss_custom_schema";
  const LS_MONTH_DATA_PREFIX = "mss_custom_data_"; // + monthYear

  // Schema state (custom columns)
  const [schema, setSchema] = useState<CustomSchema>(() => {
    try {
      const raw = localStorage.getItem(LS_SCHEMA_KEY);
      if (raw) return JSON.parse(raw) as CustomSchema;
    } catch {}
    return { columns: [] };
  });

  const persistSchema = useCallback((next: CustomSchema) => {
    setSchema(next);
    try {
      localStorage.setItem(LS_SCHEMA_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  // Per month custom values
  const [customMonthData, setCustomMonthData] = useState<CustomMonthData>(() => {
    try {
      const raw = localStorage.getItem(LS_MONTH_DATA_PREFIX + format(new Date(), "yyyy-MM"));
      if (raw) return JSON.parse(raw) as CustomMonthData;
    } catch {}
    return {};
  });

  const loadMonthCustomData = useCallback((month: string) => {
    try {
      const raw = localStorage.getItem(LS_MONTH_DATA_PREFIX + month);
      return raw ? (JSON.parse(raw) as CustomMonthData) : {};
    } catch {
      return {};
    }
  }, []);

  const persistMonthCustomData = useCallback((month: string, next: CustomMonthData) => {
    setCustomMonthData(next);
    try {
      localStorage.setItem(LS_MONTH_DATA_PREFIX + month, JSON.stringify(next));
    } catch {}
  }, []);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollPosRef = useRef(0);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      if (!prev) {
        scrollPosRef.current = window.scrollY;
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
        window.scrollTo({ top: scrollPosRef.current });
      }
      return !prev;
    });
  }, []);

  // Batch and debounce persistence to DB per-day to avoid excessive writes
  const pendingSaveByDayRef = useRef<Map<number, { status?: string; notes?: string; customPatch?: Record<string, any> }>>(new Map())
  const saveTimersRef = useRef<Map<number, number>>(new Map())

  const scheduleSaveForDay = useCallback((dayNumber: number, monthYearValue: string) => {
    const existingTimer = saveTimersRef.current.get(dayNumber)
    if (existingTimer) {
      window.clearTimeout(existingTimer)
    }
    const timerId = window.setTimeout(() => {
      const payload = pendingSaveByDayRef.current.get(dayNumber)
      if (payload) {
        // Fire-and-forget to avoid blocking UI
        void updateEntry(dayNumber, monthYearValue, payload.status, payload.notes, payload.customPatch)
        pendingSaveByDayRef.current.delete(dayNumber)
      }
      saveTimersRef.current.delete(dayNumber)
    }, 500)
    saveTimersRef.current.set(dayNumber, timerId)
  }, [updateEntry])

  // Cleanup any outstanding timers on unmount
  useEffect(() => () => {
    for (const id of saveTimersRef.current.values()) {
      try { window.clearTimeout(id) } catch {}
    }
    saveTimersRef.current.clear()
    pendingSaveByDayRef.current.clear()
  }, [])

  // Escape to exit fullscreen
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        document.body.style.overflow = "";
        window.scrollTo({ top: scrollPosRef.current });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  const monthYear = format(currentMonth, "yyyy-MM");
  const daysInMonth = getDaysInMonth(currentMonth);

  useEffect(() => {
    fetchData(monthYear);
    // load custom values when month changes
    const monthData = loadMonthCustomData(monthYear);
    setCustomMonthData(monthData);
  }, [fetchData, monthYear, loadMonthCustomData]);

  // Helper function to check if a day is weekend (Saturday = 6, Sunday = 0)
  const isWeekend = (date: Date) => {
    const dayOfWeek = getDay(date);
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  // Memoize table data to prevent unnecessary recalculations
  const orderedCustomColumns = useMemo(() => {
    return [...schema.columns].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [schema.columns]);

  const tableData = useMemo(() => {
    const preparedData: (string | number)[][] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const existingEntry = data.find((entry) => entry.day_number === day);

      let defaultStatus = "";
      if (isWeekend(currentDate) && !existingEntry?.status) {
        defaultStatus = "Holiday";
      }

      const base = [
        day,
        format(currentDate, "EEEE"),
        existingEntry?.status || defaultStatus,
        existingEntry?.notes || "",
      ] as (string | number)[];

      const dayCustom = customMonthData[day] || {};
      orderedCustomColumns.forEach((col) => {
        base.push(dayCustom[col.id] ?? "");
      });

      preparedData.push(base);
    }

    return preparedData;
  }, [data, currentMonth, daysInMonth, customMonthData, orderedCustomColumns]);

  const handleAfterChange = useCallback(
    (changes: Handsontable.CellChange[] | null) => {
      if (!changes) return;

      const nextMonthData: CustomMonthData = { ...customMonthData };

      changes.forEach(([row, col, oldValue, newValue]) => {
        if (oldValue === newValue || row === null || col === null) return;
        const dayNumber = (row as number) + 1;
        const colIndex = typeof col === "number" ? col : Number(col);

        // Prepare or merge pending payload for this day
        const pending = pendingSaveByDayRef.current.get(dayNumber) ?? {};

        if (colIndex <= 3) {
          // Built-in columns: 0 Day, 1 Weekday (read-only), 2 Status, 3 Notes
          if (colIndex === 2) {
            pending.status = (newValue as string) ?? ''
          }
          if (colIndex === 3) {
            pending.notes = (newValue as string) ?? ''
          }
        } else {
          // Custom column value
          const customIndex = colIndex - 4;
          const def = orderedCustomColumns[customIndex];
          if (!def) return;
          const rowData = nextMonthData[dayNumber] ? { ...nextMonthData[dayNumber] } : {};
          rowData[def.id] = newValue;
          nextMonthData[dayNumber] = rowData;
          pending.customPatch = { ...(pending.customPatch ?? {}), [def.id]: newValue };
        }

        pendingSaveByDayRef.current.set(dayNumber, pending);
        scheduleSaveForDay(dayNumber, monthYear);
      });

      // Persist local custom data snapshot immediately for UX
      persistMonthCustomData(monthYear, nextMonthData);
    },
    [customMonthData, monthYear, orderedCustomColumns, persistMonthCustomData, scheduleSaveForDay]
  );

  const navigateMonth = useCallback((direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  }, []);

  // Monthly stats from Status column
  const monthlyStats = useMemo(() => {
    const stats = {
      working: 0,
      holiday: 0,
      sickLeave: 0,
      vacation: 0,
      workFromHome: 0,
      halfDay: 0,
      training: 0,
      total: daysInMonth,
    };

    tableData.forEach((row) => {
      const status = row[2] as string;
      switch (status) {
        case "Working":
          stats.working++;
          break;
        case "Holiday":
          stats.holiday++;
          break;
        case "Sick Leave":
          stats.sickLeave++;
          break;
        case "Vacation":
          stats.vacation++;
          break;
        case "Work from Home":
          stats.workFromHome++;
          break;
        case "Half Day":
          stats.halfDay++;
          break;
        case "Training":
          stats.training++;
          break;
      }
    });

    return stats;
  }, [tableData, daysInMonth]);

  // Export configuration state
  const [exportOpen, setExportOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig>(() => {
    const saved = localStorage.getItem("mss_export_config");
    if (saved) {
      try {
        return JSON.parse(saved) as ExportConfig;
      } catch {}
    }
    return DEFAULT_EXPORT_CONFIG;
  });

  const persistExportConfig = (cfg: ExportConfig) => {
    setExportConfig(cfg);
    try {
      localStorage.setItem("mss_export_config", JSON.stringify(cfg));
    } catch {}
  };

  const performExport = useCallback(
    async (cfg: ExportConfig) => {
      const XLSX = await import("xlsx");
      const builtinOrder: BuiltinColumnKey[] = ["Day", "Weekday", "Status", "Notes"];
      const customOrder = orderedCustomColumns.map((c) => c.title);
      const columnTitles = [...builtinOrder, ...customOrder] as ExportColumnKey[];

      const enabledCols = columnTitles.filter((c) => cfg.columns[c] ?? false);

      const rows = tableData.map((r, idx) => {
        const dayNum = idx + 1;
        const customRow = customMonthData[dayNum] || {};
        const sourceRow: Record<string, any> = {
          Day: r[0],
          Weekday: r[1],
          Status: r[2] || "",
          Notes: r[3] || "",
        };
        orderedCustomColumns.forEach((def, i) => {
          const value = customRow[def.id] ?? r[4 + i] ?? "";
          sourceRow[def.title] = value;
        });

        const rowObj: Record<string, any> = {};

        enabledCols.forEach((col) => {
          let v = sourceRow[col];
          if (col === "Day") {
            const custom = cfg.transforms[col];
            if (!custom || !custom.trim()) {
              v = cfg.dateFormat === "dd" ? String(v).padStart(2, "0") : v;
            }
          }
          const transformed = safeTransform(cfg.transforms[col], v, sourceRow);
          rowObj[col] = transformed;
        });
        return rowObj;
      });

      const ws = XLSX.utils.json_to_sheet(rows, { header: enabledCols as string[] });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, cfg.sheetName || "Monthly Status");

      const fileName =
        (() => {
          try {
            return formatWithMonth(currentMonth, cfg.fileName || DEFAULT_EXPORT_CONFIG.fileName);
          } catch {
            return `MonthlyStatus_${format(currentMonth, "yyyy-MM")}.xlsx`;
          }
        })() ?? `MonthlyStatus_${format(currentMonth, "yyyy-MM")}.xlsx`;

      XLSX.writeFile(wb, fileName);
    },
    [tableData, currentMonth, orderedCustomColumns, customMonthData]
  );

  return (
    <div className={isFullscreen ? "fixed inset-0 z-[100] bg-background flex flex-col" : ""}>
      <Card className={isFullscreen ? "w-full h-full flex flex-col rounded-none border-0" : "w-full"}>
        <CardHeader className={isFullscreen ? "border-b" : ""}>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="shrink-0">Monthly Status Sheets</CardTitle>
            <div className="flex items-center gap-1 flex-wrap justify-end max-w-full overflow-x-hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth("prev")}
                className="shrink-0"
                aria-label="Previous month"
                title="Previous month"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <span className="font-medium min-w-[100px] text-center truncate px-1">
                {format(currentMonth, "MMM yyyy")}
              </span>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth("next")}
                className="shrink-0"
                aria-label="Next month"
                title="Next month"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setCustomizeOpen(true)}
                aria-label="Customize Columns"
                title="Customize Columns"
              >
                <Settings2 className="h-4 w-4 mr-1" />
                Columns
              </Button>

              <Button
                variant={isFullscreen ? "default" : "ghost"}
                size="icon"
                onClick={toggleFullscreen}
                className="shrink-0"
                aria-label={isFullscreen ? "Exit Full Screen" : "Full Screen"}
                title={isFullscreen ? "Exit Full Screen (Esc)" : "Full Screen"}
              >
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </Button>

              <Button
                variant="default"
                size="icon"
                className="shrink-0"
                onClick={() => setExportOpen(true)}
                aria-label="Export to Excel"
                title="Export to Excel"
              >
                <Download className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            Weekends (Saturday & Sunday) are automatically marked as holidays. You can change them to working days if needed.
          </div>
        </CardHeader>
        <CardContent className={isFullscreen ? "flex-1 flex flex-col min-h-0" : ""}>
          {loading ? (
            <TableSkeleton headers={6} rows={12} />
          ) : (
            <div className={isFullscreen ? "flex-1 flex flex-col min-h-0 space-y-4" : "space-y-4"}>
              <div className={isFullscreen ? "flex-1 min-h-0 overflow-auto" : "overflow-auto"}>
                <HotTable
                  key={monthYear + ":" + orderedCustomColumns.map((c) => c.id).join(",")}
                  ref={hotRef}
                  data={tableData}
                  colHeaders={[
                    "Day",
                    "Weekday",
                    "Status",
                    "Notes",
                    ...orderedCustomColumns.map((c) => c.title),
                  ]}
                  columns={[
                    {
                      data: 0,
                      readOnly: true,
                      width: 60,
                      className: "htCenter htMiddle",
                    },
                    {
                      data: 1,
                      readOnly: true,
                      width: 100,
                      className: "htCenter htMiddle",
                    },
                    {
                      data: 2,
                      width: 150,
                      type: "dropdown",
                      source: [
                        "Working",
                        "Holiday",
                        "Sick Leave",
                        "Vacation",
                        "Work from Home",
                        "Half Day",
                        "Training",
                      ],
                      className: "htCenter htMiddle",
                    },
                    {
                      data: 3,
                      width: 300,
                      className: "htLeft htMiddle",
                    },
                    ...orderedCustomColumns.map((colDef, idx) => {
                      const colIndex = 4 + idx;
                      const base: any = { data: colIndex, width: 180, className: "htLeft htMiddle" };
                      if (colDef.type === "dropdown") {
                        base.type = "dropdown";
                        base.source = colDef.options || [];
                        base.strict = false;
                        base.allowInvalid = true;
                      }
                      return base;
                    }),
                  ]}
                  rowHeaders={false}
                  contextMenu={true}
                  manualRowResize={true}
                  manualColumnResize={true}
                  afterChange={handleAfterChange}
                  cells={(row, col) => {
                    const cellProperties: Partial<Handsontable.CellProperties> = {};

                    // weekend highlight on weekday name
                    if (col === 1) {
                      const dayName = tableData[row]?.[1] as string;
                      if (dayName === "Saturday" || dayName === "Sunday") {
                        cellProperties.className = [cellProperties.className, "weekend-cell htCenter htMiddle"].filter(Boolean).join(" ");
                      }
                    }

                    // color coding by status
                    if (col === 2) {
                      const status = tableData[row]?.[2] as string;
                      const dayName = tableData[row]?.[1] as string;

                      if (dayName === "Saturday" || dayName === "Sunday") {
                        cellProperties.className = [cellProperties.className, "weekend-status-cell htCenter htMiddle"].filter(Boolean).join(" ");
                      }

                      switch (status) {
                        case "Holiday":
                          cellProperties.className = (cellProperties.className || "") + " holiday-cell htCenter htMiddle";
                          break;
                        case "Working":
                          cellProperties.className = (cellProperties.className || "") + " working-cell htCenter htMiddle";
                          break;
                        case "Sick Leave":
                          cellProperties.className = (cellProperties.className || "") + " sick-cell htCenter htMiddle";
                          break;
                        case "Vacation":
                          cellProperties.className = (cellProperties.className || "") + " vacation-cell htCenter htMiddle";
                          break;
                        case "Work from Home":
                          cellProperties.className = (cellProperties.className || "") + " wfh-cell htCenter htMiddle";
                          break;
                        case "Half Day":
                          cellProperties.className = (cellProperties.className || "") + " half-day-cell htCenter htMiddle";
                          break;
                        case "Training":
                          cellProperties.className = (cellProperties.className || "") + " training-cell htCenter htMiddle";
                          break;
                      }
                    }

                    // Row-level background tint (theme-aware) for all cells except Status column
                    try {
                      const status = tableData[row]?.[2] as string;
                      const dayName = tableData[row]?.[1] as string;
                      const append = (klass: string) => {
                        cellProperties.className = [cellProperties.className, klass].filter(Boolean).join(" ");
                      };
                      if (col !== 2) {
                        if (dayName === "Saturday" || dayName === "Sunday") {
                          append("weekend-row-cell");
                        }
                        if (status === "Holiday") {
                          append("holiday-row-cell");
                        }
                      }
                    } catch {}

                    return cellProperties as Handsontable.CellProperties;
                  }}
                  stretchH="all"
                  height={isFullscreen ? "auto" : "500"}
                  licenseKey="non-commercial-and-evaluation"
                  className="handsontable-theme"
                />
              </div>

              {!isFullscreen && (
                <>
                  {/* Monthly Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[hsl(var(--success)/0.15)] p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-[hsl(var(--success))]">
                        {monthlyStats.working}
                      </div>
                    <div className="text-sm text-[hsl(var(--success))]">Working Days</div>
                    </div>
                  <div className="bg-[hsl(var(--destructive)/0.15)] p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-[hsl(var(--destructive))]">
                        {monthlyStats.holiday}
                      </div>
                    <div className="text-sm text-[hsl(var(--destructive))]">Holidays</div>
                    </div>
                  <div className="bg-[hsl(var(--info)/0.15)] p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-[hsl(var(--info))]">
                        {monthlyStats.workFromHome}
                      </div>
                    <div className="text-sm text-[hsl(var(--info))]">WFH Days</div>
                    </div>
                  <div className="bg-[hsl(var(--primary)/0.15)] p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-[hsl(var(--primary))]">
                        {monthlyStats.vacation}
                      </div>
                    <div className="text-sm text-[hsl(var(--primary))]">Vacation Days</div>
                    </div>
                  </div>

                  {/* Status Legend */}
                  <div className="bg-muted/40 p-4 rounded-lg">
                    <h4 className="font-medium text-sm mb-3 text-muted-foreground">Status Legend:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded holiday-cell"></div>
                        <span>Holiday</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded working-cell"></div>
                        <span>Working</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded sick-cell"></div>
                        <span>Sick Leave</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded vacation-cell"></div>
                        <span>Vacation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded wfh-cell"></div>
                        <span>Work from Home</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded half-day-cell"></div>
                        <span>Half Day</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded training-cell"></div>
                        <span>Training</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded weekend-cell"></div>
                        <span>Weekend</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customize Columns Dialog */}
      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[85vh] z-[1000]">
          <DialogHeader>
            <DialogTitle>Customize Columns</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Add custom columns that appear after Notes. Values are saved per month locally (in this browser).
            </div>

            <div className="space-y-3">
              {orderedCustomColumns.map((c) => {
                const idx = schema.columns.findIndex((s) => s.id === c.id);
                return (
                  <div key={c.id} className="grid grid-cols-1 md:grid-cols-7 gap-2 items-center">
                    {/* Order controls */}
                    <div className="flex md:col-span-1 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const cols = [...schema.columns];
                          const curIndex = cols.findIndex((cc) => cc.id === c.id);
                          if (curIndex <= 0) return;
                          const prev = cols[curIndex - 1];
                          const curPos = cols[curIndex].position ?? curIndex;
                          const prevPos = prev.position ?? (curIndex - 1);
                          cols[curIndex] = { ...cols[curIndex], position: prevPos };
                          cols[curIndex - 1] = { ...prev, position: curPos };
                          persistSchema({ columns: cols });
                        }}
                        title="Move up"
                      >
                        ↑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const cols = [...schema.columns];
                          const curIndex = cols.findIndex((cc) => cc.id === c.id);
                          if (curIndex >= cols.length - 1) return;
                          const next = cols[curIndex + 1];
                          const curPos = cols[curIndex].position ?? curIndex;
                          const nextPos = next.position ?? (curIndex + 1);
                          cols[curIndex] = { ...cols[curIndex], position: nextPos };
                          cols[curIndex + 1] = { ...next, position: curPos };
                          persistSchema({ columns: cols });
                        }}
                        title="Move down"
                      >
                        ↓
                      </Button>
                    </div>

                    <Label className="md:col-span-2">Title</Label>
                    <Input
                      value={c.title}
                      onChange={(e) => {
                        const next = { ...schema, columns: [...schema.columns] };
                        next.columns[idx] = { ...next.columns[idx], title: e.target.value };
                        persistSchema(next);

                        // migrate export config keys if renamed
                        const oldTitle = c.title;
                        const newTitle = e.target.value;
                        if (oldTitle !== newTitle) {
                          const nextCfg: ExportConfig = {
                            ...exportConfig,
                            columns: { ...exportConfig.columns },
                            transforms: { ...exportConfig.transforms },
                          };
                          if (nextCfg.columns[oldTitle] !== undefined) {
                            nextCfg.columns[newTitle] = nextCfg.columns[oldTitle];
                            delete nextCfg.columns[oldTitle];
                          }
                          if (nextCfg.transforms[oldTitle] !== undefined) {
                            nextCfg.transforms[newTitle] = nextCfg.transforms[oldTitle];
                            delete nextCfg.transforms[oldTitle];
                          }
                          persistExportConfig(nextCfg);
                        }
                      }}
                      className="md:col-span-4"
                    />

                    <Label className="md:col-span-2">Type</Label>
                    <div className="md:col-span-4 relative z-[1200]">
                      <Select
                        value={c.type}
                        onValueChange={(v) => {
                          const next = { ...schema, columns: [...schema.columns] };
                          const newType = (v === "dropdown" ? "dropdown" : "text") as CustomColumnType;
                          next.columns[idx] = {
                            ...next.columns[idx],
                            type: newType,
                            options: newType === "dropdown" ? c.options || [] : undefined,
                          };
                          persistSchema(next);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Type">{c.type === "dropdown" ? "Dropdown" : "Text"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="z-[1300]">
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="dropdown">Dropdown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {schema.columns[idx]?.type === "dropdown" && (
                      <>
                        <Label className="md:col-span-2">Options (comma separated)</Label>
                        <div className="md:col-span-4 relative z-[1200]">
                          <Input
                            value={(schema.columns[idx].options || []).join(", ")}
                            onChange={(e) => {
                              const opts = e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean);
                              const next = { ...schema, columns: [...schema.columns] };
                              next.columns[idx] = { ...next.columns[idx], options: opts };
                              persistSchema(next);
                            }}
                          />
                        </div>
                      </>
                    )}

                    <div className="md:col-span-7 flex justify-end">
                      <Button
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          const next = { ...schema, columns: schema.columns.filter((_, i) => i !== idx) };
                          persistSchema(next);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <Button
                onClick={() => {
                  const id = "col_" + Math.random().toString(36).slice(2, 9);
                  const nextPos = schema.columns.length;
                  const next: CustomSchema = {
                    columns: [...schema.columns, { id, title: "Custom " + (schema.columns.length + 1), type: "text", position: nextPos }],
                  };
                  persistSchema(next);
                }}
              >
                Add Column
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setCustomizeOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Configuration Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[85vh] z-[1000]">
          <DialogHeader>
            <DialogTitle>Configure Export</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>Columns</Label>
              <div className="grid grid-cols-2 gap-2">
                {[..."Day,Weekday,Status,Notes".split(","), ...orderedCustomColumns.map((c) => c.title)].map((key) => (
                  <label key={key} className="flex items-center space-x-2">
                    <Checkbox
                      checked={!!exportConfig.columns[key]}
                      onCheckedChange={(checked) => {
                        const next: ExportConfig = {
                          ...exportConfig,
                          columns: { ...exportConfig.columns, [key]: !!checked },
                        };
                        persistExportConfig(next);
                      }}
                    />
                    <span className="text-sm">{key}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>File name</Label>
              <Input
                value={exportConfig.fileName}
                onChange={(e) => persistExportConfig({ ...exportConfig, fileName: e.target.value })}
                placeholder='e.g. MonthlyStatus_${YYYY}-${MM}.xlsx'
              />
              <div className="text-xs text-muted-foreground">
                Supports tokens: ${"{YYYY}"}, ${"{MM}"}, ${"{MMM}"}.
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sheet name</Label>
              <Input
                value={exportConfig.sheetName}
                onChange={(e) => persistExportConfig({ ...exportConfig, sheetName: e.target.value })}
                placeholder="Monthly Status"
              />
            </div>

            <div className="space-y-2">
              <Label>Date format (Day column)</Label>
              <Select
                value={exportConfig.dateFormat}
                onValueChange={(v) => persistExportConfig({ ...exportConfig, dateFormat: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="d">d (1..31)</SelectItem>
                  <SelectItem value="dd">dd (01..31)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
            {[..."Day,Weekday,Status,Notes".split(","), ...orderedCustomColumns.map((c) => c.title)].map((key) => (
              <div key={key} className="space-y-2">
                <Label>{key} transform (JS)</Label>
                <Textarea
                  rows={5}
                  value={exportConfig.transforms[key] || ""}
                  onChange={(e) => {
                    const next: ExportConfig = {
                      ...exportConfig,
                      transforms: { ...exportConfig.transforms, [key]: e.target.value },
                    };
                    persistExportConfig(next);
                  }}
                  placeholder='Example: return (value ?? "").toString().toUpperCase();'
                />
                <div className="text-xs text-muted-foreground">
                  Function body. Args: value, row. Must return the transformed value.
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                performExport(exportConfig);
                setExportOpen(false);
              }}
            >
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
