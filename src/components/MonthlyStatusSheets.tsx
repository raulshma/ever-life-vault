import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { HotTable } from "@handsontable/react";
import Handsontable from "handsontable/base";
import { HotTableClass } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import "./MonthlyStatusSheets.css";
import { registerAllModules } from "handsontable/registry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { useMonthlyStatusSheets } from "@/hooks/useMonthlyStatusSheets";
import { format, getDaysInMonth, getDay } from "date-fns";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

// Register Handsontable modules
registerAllModules();

type ExportColumnKey = "Day" | "Weekday" | "Status" | "Notes";

type ExportConfig = {
  columns: Record<ExportColumnKey, boolean>;
  transforms: Partial<Record<ExportColumnKey, string>>;
  fileName: string;
  sheetName: string;
  dateFormat: string; // applies to "Day" column presentation if needed
  numberFormat: string; // reserved for future numeric fields
};

const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  columns: { Day: true, Weekday: true, Status: true, Notes: true },
  transforms: {
    // Day: "return value;",
    // Weekday: "return value.toUpperCase();",
    // Status: "return (value || \"\");",
    // Notes: "return value;"
  },
  fileName: "MonthlyStatus_${YYYY}-${MM}.xlsx",
  sheetName: "Monthly Status",
  dateFormat: "d",
  numberFormat: "0",
};

function formatWithMonth(date: Date, pattern: string) {
  const YYYY = format(date, "yyyy");
  const MM = format(date, "MM");
  const MMM = format(date, "MMM");
  // Use split+join for wide TS lib compatibility instead of String.prototype.replaceAll
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

export const MonthlyStatusSheets: React.FC = React.memo(function MonthlyStatusSheetsComponent(): JSX.Element {
  const hotRef = useRef<HotTableClass>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data, loading, fetchData, updateEntry } = useMonthlyStatusSheets();

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keep track to restore scroll position when exiting fullscreen (UX nicety)
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
  }, [fetchData, monthYear]);

  // Helper function to check if a day is weekend (Saturday = 6, Sunday = 0)
  const isWeekend = (date: Date) => {
    const dayOfWeek = getDay(date);
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
  };

  // Memoize table data to prevent unnecessary recalculations
  const tableData = useMemo(() => {
    const preparedData: (string | number)[][] = [];

    // Create rows for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        day
      );
      const existingEntry = data.find((entry) => entry.day_number === day);

      // Default status: if it's a weekend and no existing entry, mark as 'Holiday'
      let defaultStatus = "";
      if (isWeekend(currentDate) && !existingEntry?.status) {
        defaultStatus = "Holiday";
      }

      preparedData.push([
        day,
        format(currentDate, "EEEE"),
        existingEntry?.status || defaultStatus,
        existingEntry?.notes || "",
      ]);
    }

    return preparedData;
  }, [data, currentMonth, daysInMonth]);

  const handleAfterChange = useCallback(
    (changes: Handsontable.CellChange[] | null) => {
      if (!changes) return;

      changes.forEach(([row, col, oldValue, newValue]) => {
        if (oldValue !== newValue && row !== null && col !== null) {
          const dayNumber = row + 1;
          const status =
            col === 2
              ? (newValue as string)
              : data.find((entry) => entry.day_number === dayNumber)?.status || "";
          const notes =
            col === 3
              ? (newValue as string)
              : data.find((entry) => entry.day_number === dayNumber)?.notes || "";

          updateEntry(dayNumber, monthYear, status, notes);
        }
      });
    },
    [data, monthYear, updateEntry]
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

  // Memoize monthly statistics calculation
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
    (cfg: ExportConfig) => {
      // Build export rows from tableData with selection and transforms
      const columnsOrder: ExportColumnKey[] = ["Day", "Weekday", "Status", "Notes"];
      const enabledCols = columnsOrder.filter((c) => cfg.columns[c]);

      const rows = tableData.map((r) => {
        const rowObj: Record<string, any> = {};
        const sourceRow = {
          Day: r[0],
          Weekday: r[1],
          Status: r[2] || "",
          Notes: r[3] || "",
        } as Record<ExportColumnKey, any>;

        enabledCols.forEach((col) => {
          let v = sourceRow[col];

          // default helper for Day formatting if no custom transform
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

      const ws = XLSX.utils.json_to_sheet(rows, { header: enabledCols });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, cfg.sheetName || "Monthly Status");

      const fileName =
        (() => {
          try {
            return formatWithMonth(
              currentMonth,
              cfg.fileName || DEFAULT_EXPORT_CONFIG.fileName
            );
          } catch {
            return `MonthlyStatus_${format(currentMonth, "yyyy-MM")}.xlsx`;
          }
        })() ?? `MonthlyStatus_${format(currentMonth, "yyyy-MM")}.xlsx`;

      XLSX.writeFile(wb, fileName);
    },
    [tableData, currentMonth]
  );

  return (
    <div className={isFullscreen ? "fixed inset-0 z-[100] bg-white flex flex-col" : ""}>
      <Card className={isFullscreen ? "w-full h-full flex flex-col rounded-none border-0" : "w-full"}>
        <CardHeader className={isFullscreen ? "border-b" : ""}>
          <div className="flex items-center justify-between">
            <CardTitle>Monthly Status Sheets</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateMonth("prev")}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="font-medium min-w-[120px] text-center">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <Button variant="outline" size="sm" onClick={() => navigateMonth("next")}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button
                variant={isFullscreen ? "default" : "outline"}
                size="sm"
                onClick={toggleFullscreen}
                className="ml-2"
                title={isFullscreen ? "Exit Full Screen (Esc)" : "Full Screen"}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="h-4 w-4 mr-2" />
                    Exit Full Screen
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Full Screen
                  </>
                )}
              </Button>

              <Button
                variant="default"
                size="sm"
                className="ml-2"
                onClick={() => setExportOpen(true)}
                title="Export current month to Excel"
              >
                Export to Excel
              </Button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            Weekends (Saturday & Sunday) are automatically marked as holidays. You
            can change them to working days if needed.
          </div>
        </CardHeader>
        <CardContent className={isFullscreen ? "flex-1 flex flex-col min-h-0" : ""}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <div className={isFullscreen ? "flex-1 flex flex-col min-h-0 space-y-4" : "space-y-4"}>
              <div className={isFullscreen ? "flex-1 min-h-0 overflow-auto" : "overflow-auto"}>
                <HotTable
                  key={monthYear} // Force re-render only when month changes
                  ref={hotRef}
                  data={tableData}
                  colHeaders={["Day", "Weekday", "Status", "Notes"]}
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
                  ]}
                  rowHeaders={false}
                  contextMenu={true}
                  manualRowResize={true}
                  manualColumnResize={true}
                  afterChange={handleAfterChange}
                  cells={(row, col) => {
                    // Use a partial so we don't need to satisfy internal props.
                    const cellProperties: Partial<Handsontable.CellProperties> = {};

                    // Color coding for weekends
                    if (col === 1) {
                      const dayName = tableData[row]?.[1] as string;
                      if (dayName === "Saturday" || dayName === "Sunday") {
                        cellProperties.className = "weekend-cell htCenter htMiddle";
                      }
                    }

                    // Color coding for status
                    if (col === 2) {
                      const status = tableData[row]?.[2] as string;
                      const dayName = tableData[row]?.[1] as string;

                      if (dayName === "Saturday" || dayName === "Sunday") {
                        cellProperties.className = "weekend-status-cell htCenter htMiddle";
                      }

                      switch (status) {
                        case "Holiday":
                          cellProperties.className =
                            (cellProperties.className || "") + " holiday-cell htCenter htMiddle";
                          break;
                        case "Working":
                          cellProperties.className =
                            (cellProperties.className || "") + " working-cell htCenter htMiddle";
                          break;
                        case "Sick Leave":
                          cellProperties.className =
                            (cellProperties.className || "") + " sick-cell htCenter htMiddle";
                          break;
                        case "Vacation":
                          cellProperties.className =
                            (cellProperties.className || "") + " vacation-cell htCenter htMiddle";
                          break;
                        case "Work from Home":
                          cellProperties.className =
                            (cellProperties.className || "") + " wfh-cell htCenter htMiddle";
                          break;
                        case "Half Day":
                          cellProperties.className =
                            (cellProperties.className || "") + " half-day-cell htCenter htMiddle";
                          break;
                        case "Training":
                          cellProperties.className =
                            (cellProperties.className || "") + " training-cell htCenter htMiddle";
                          break;
                      }
                    }

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
                    <div className="bg-green-50 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-700">
                        {monthlyStats.working}
                      </div>
                      <div className="text-sm text-green-600">Working Days</div>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-red-700">
                        {monthlyStats.holiday}
                      </div>
                      <div className="text-sm text-red-600">Holidays</div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-700">
                        {monthlyStats.workFromHome}
                      </div>
                      <div className="text-sm text-blue-600">WFH Days</div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-purple-700">
                        {monthlyStats.vacation}
                      </div>
                      <div className="text-sm text-purple-600">Vacation Days</div>
                    </div>
                  </div>

                  {/* Status Legend */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-sm mb-3 text-gray-700">Status Legend:</h4>
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

      {/* Export Configuration Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        {/* Force dialog container to sit above Handsontable headers via a high z-index */}
        <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto p-0 z-[1000]">
          <div className="sticky top-0 z-10 border-b bg-white/90 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <DialogHeader className="p-0">
              <DialogTitle>Configure Export</DialogTitle>
            </DialogHeader>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>Columns</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["Day", "Weekday", "Status", "Notes"] as ExportColumnKey[]).map((key) => (
                  <label key={key} className="flex items-center space-x-2">
                    <Checkbox
                      checked={!!exportConfig.columns[key]}
                      onCheckedChange={(checked) => {
                        const next = {
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
                onChange={(e) =>
                  persistExportConfig({ ...exportConfig, fileName: e.target.value })
                }
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
                onChange={(e) =>
                  persistExportConfig({ ...exportConfig, sheetName: e.target.value })
                }
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
            {(["Day", "Weekday", "Status", "Notes"] as ExportColumnKey[]).map((key) => (
              <div key={key} className="space-y-2">
                <Label>{key} transform (JS)</Label>
                <Textarea
                  rows={5}
                  value={exportConfig.transforms[key] || ""}
                  onChange={(e) => {
                    const next = {
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

          <div className="sticky bottom-0 z-10 border-t bg-white/90 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/60">
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});
