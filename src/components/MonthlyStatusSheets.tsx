import React, { useEffect, useRef, useState } from 'react';
import { HotTable } from '@handsontable/react';
import Handsontable from 'handsontable/base';
import { HotTableClass } from '@handsontable/react';
import 'handsontable/dist/handsontable.full.css';
import { registerAllModules } from 'handsontable/registry';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMonthlyStatusSheets } from '@/hooks/useMonthlyStatusSheets';
import { format, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns';

// Register Handsontable modules
registerAllModules();

export const MonthlyStatusSheets: React.FC = () => {
  const hotRef = useRef<HotTableClass>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data, loading, fetchData, updateEntry } = useMonthlyStatusSheets();

  const monthYear = format(currentMonth, 'yyyy-MM');
  const daysInMonth = getDaysInMonth(currentMonth);

  useEffect(() => {
    fetchData(monthYear);
  }, [monthYear]);

  // Prepare data for Handsontable
  const prepareTableData = () => {
    const tableData: (string | number)[][] = [];
    
    // Create rows for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const existingEntry = data.find(entry => entry.day_number === day);
      tableData.push([
        day,
        format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day), 'EEEE'),
        existingEntry?.status || '',
        existingEntry?.notes || ''
      ]);
    }

    return tableData;
  };

  const handleAfterChange = (changes: Handsontable.CellChange[] | null) => {
    if (!changes) return;

    changes.forEach(([row, col, oldValue, newValue]) => {
      if (oldValue !== newValue && row !== null && col !== null) {
        const dayNumber = row + 1;
        const status = col === 2 ? newValue as string : (data.find(entry => entry.day_number === dayNumber)?.status || '');
        const notes = col === 3 ? newValue as string : (data.find(entry => entry.day_number === dayNumber)?.notes || '');
        
        updateEntry(dayNumber, monthYear, status, notes);
      }
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const tableData = prepareTableData();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Monthly Status Sheets</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="font-medium min-w-[120px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : (
          <div className="overflow-auto">
            <HotTable
              ref={hotRef}
              data={tableData}
              colHeaders={['Day', 'Weekday', 'Status', 'Notes']}
              columns={[
                { data: 0, readOnly: true, width: 60 },
                { data: 1, readOnly: true, width: 100 },
                { data: 2, width: 150 },
                { data: 3, width: 300 }
              ]}
              rowHeaders={false}
              contextMenu={true}
              manualRowResize={true}
              manualColumnResize={true}
              afterChange={handleAfterChange}
              stretchH="all"
              height="500"
              licenseKey="non-commercial-and-evaluation"
              className="handsontable-theme"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};