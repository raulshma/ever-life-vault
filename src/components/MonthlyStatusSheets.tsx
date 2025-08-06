import React, { useEffect, useRef, useState } from "react";
import { HotTable } from "@handsontable/react";
import Handsontable from "handsontable/base";
import { HotTableClass } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import "./MonthlyStatusSheets.css";
import { registerAllModules } from "handsontable/registry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMonthlyStatusSheets } from "@/hooks/useMonthlyStatusSheets";
import {
  format,
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
  getDay,
} from "date-fns";

// Register Handsontable modules
registerAllModules();

export const MonthlyStatusSheets: React.FC = () => {
  const hotRef = useRef<HotTableClass>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data, loading, fetchData, updateEntry } = useMonthlyStatusSheets();

  const monthYear = format(currentMonth, "yyyy-MM");
  const daysInMonth = getDaysInMonth(currentMonth);

  useEffect(() => {
    fetchData(monthYear);
  }, [monthYear]);

  // Helper function to check if a day is weekend (Saturday = 6, Sunday = 0)
  const isWeekend = (date: Date) => {
    const dayOfWeek = getDay(date);
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
  };

  // Prepare data for Handsontable
  const prepareTableData = () => {
    const tableData: (string | number)[][] = [];

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

      tableData.push([
        day,
        format(currentDate, "EEEE"),
        existingEntry?.status || defaultStatus,
        existingEntry?.notes || "",
      ]);
    }

    return tableData;
  };

  const handleAfterChange = (changes: Handsontable.CellChange[] | null) => {
    if (!changes) return;

    changes.forEach(([row, col, oldValue, newValue]) => {
      if (oldValue !== newValue && row !== null && col !== null) {
        const dayNumber = row + 1;
        const status =
          col === 2
            ? (newValue as string)
            : data.find((entry) => entry.day_number === dayNumber)?.status ||
              "";
        const notes =
          col === 3
            ? (newValue as string)
            : data.find((entry) => entry.day_number === dayNumber)?.notes || "";

        updateEntry(dayNumber, monthYear, status, notes);
      }
    });
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const tableData = prepareTableData();

  // Calculate monthly statistics
  const getMonthlyStats = () => {
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
  };

  const monthlyStats = getMonthlyStats();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Monthly Status Sheets</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("prev")}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="font-medium min-w-[120px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth("next")}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-sm text-muted-foreground mt-2">
          Weekends (Saturday & Sunday) are automatically marked as holidays. You
          can change them to working days if needed.
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-auto">
              <HotTable
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
                  const cellProperties: any = {};

                  // Color coding for weekends
                  if (col === 1) {
                    // Weekday column
                    const dayName = tableData[row]?.[1] as string;
                    if (dayName === "Saturday" || dayName === "Sunday") {
                      cellProperties.className =
                        "weekend-cell htCenter htMiddle";
                    }
                  }

                  // Color coding for status
                  if (col === 2) {
                    // Status column
                    const status = tableData[row]?.[2] as string;
                    const dayName = tableData[row]?.[1] as string;

                    if (dayName === "Saturday" || dayName === "Sunday") {
                      cellProperties.className =
                        "weekend-status-cell htCenter htMiddle";
                    }

                    switch (status) {
                      case "Holiday":
                        cellProperties.className =
                          (cellProperties.className || "") +
                          " holiday-cell htCenter htMiddle";
                        break;
                      case "Working":
                        cellProperties.className =
                          (cellProperties.className || "") +
                          " working-cell htCenter htMiddle";
                        break;
                      case "Sick Leave":
                        cellProperties.className =
                          (cellProperties.className || "") +
                          " sick-cell htCenter htMiddle";
                        break;
                      case "Vacation":
                        cellProperties.className =
                          (cellProperties.className || "") +
                          " vacation-cell htCenter htMiddle";
                        break;
                      case "Work from Home":
                        cellProperties.className =
                          (cellProperties.className || "") +
                          " wfh-cell htCenter htMiddle";
                        break;
                      case "Half Day":
                        cellProperties.className =
                          (cellProperties.className || "") +
                          " half-day-cell htCenter htMiddle";
                        break;
                      case "Training":
                        cellProperties.className =
                          (cellProperties.className || "") +
                          " training-cell htCenter htMiddle";
                        break;
                    }
                  }

                  return cellProperties;
                }}
                stretchH="all"
                height="500"
                licenseKey="non-commercial-and-evaluation"
                className="handsontable-theme"
              />
            </div>

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
              <h4 className="font-medium text-sm mb-3 text-gray-700">
                Status Legend:
              </h4>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};
