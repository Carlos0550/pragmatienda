import * as React from "react";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface MonthPickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  disabled?: boolean;
  className?: string;
}

export function MonthPicker({ value, onChange, disabled, className }: MonthPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState(value || new Date());
  
  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();
  
  const months = [
    { value: 0, label: "Enero" },
    { value: 1, label: "Febrero" },
    { value: 2, label: "Marzo" },
    { value: 3, label: "Abril" },
    { value: 4, label: "Mayo" },
    { value: 5, label: "Junio" },
    { value: 6, label: "Julio" },
    { value: 7, label: "Agosto" },
    { value: 8, label: "Septiembre" },
    { value: 9, label: "Octubre" },
    { value: 10, label: "Noviembre" },
    { value: 11, label: "Diciembre" },
  ];

  const handleMonthSelect = (monthIndex: number) => {
    const selectedDate = new Date(currentYear, monthIndex, 1);
    onChange(selectedDate);
    setOpen(false);
  };

  const handlePrevYear = () => {
    setViewDate(new Date(currentYear - 1, currentMonth, 1));
  };

  const handleNextYear = () => {
    setViewDate(new Date(currentYear + 1, currentMonth, 1));
  };

  const displayText = value 
    ? format(value, "MMMM yyyy", { locale: es })
    : "Seleccionar mes";

  const isSelectedMonth = (monthIndex: number) => {
    return value?.getMonth() === monthIndex && value?.getFullYear() === currentYear;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("gap-2", className)}
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="capitalize">{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="end">
        <div className="p-4 space-y-4">
          {/* Year selector */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handlePrevYear}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{currentYear}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleNextYear}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-2">
            {months.map((month) => (
              <Button
                key={month.value}
                variant={isSelectedMonth(month.value) ? "default" : "ghost"}
                size="sm"
                className="text-xs h-8"
                onClick={() => handleMonthSelect(month.value)}
              >
                {month.label.slice(0, 3)}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
