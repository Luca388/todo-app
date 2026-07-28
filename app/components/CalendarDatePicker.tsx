"use client";

import { useMemo, useState } from "react";
import {
  formatDateKey,
  getLocalDateKey,
} from "../task-dates";

type CalendarDatePickerProps = {
  disabled: boolean;
  onChange: (value: string) => void;
  value: string;
};

function monthFromDateKey(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function startOfCalendarGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstDay.getDay());
  start.setHours(12, 0, 0, 0);
  return start;
}

export function CalendarDatePicker({
  disabled,
  onChange,
  value,
}: CalendarDatePickerProps) {
  const todayKey = getLocalDateKey();
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    monthFromDateKey(value || todayKey),
  );

  const days = useMemo(() => {
    const start = startOfCalendarGrid(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
    );
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        date,
        key: getLocalDateKey(date),
      };
    });
  }, [visibleMonth]);

  function selectDate(dateKey: string) {
    onChange(dateKey);
    setVisibleMonth(monthFromDateKey(dateKey));
    setIsOpen(false);
  }

  return (
    <div className="task-date-picker">
      <span className="task-date-label">날짜</span>
      <button
        className="task-date-trigger"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <span>{value ? formatDateKey(value) : "날짜 없음"}</span>
        <small>{value || "날짜 선택"}</small>
      </button>

      {isOpen && (
        <div className="task-date-calendar">
          <div className="calendar-month-nav">
            <button
              type="button"
              onClick={() =>
                setVisibleMonth(
                  new Date(
                    visibleMonth.getFullYear(),
                    visibleMonth.getMonth() - 1,
                    1,
                  ),
                )
              }
              aria-label="이전 달"
            >
              ←
            </button>
            <strong>
              {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
            </strong>
            <button
              type="button"
              onClick={() =>
                setVisibleMonth(
                  new Date(
                    visibleMonth.getFullYear(),
                    visibleMonth.getMonth() + 1,
                    1,
                  ),
                )
              }
              aria-label="다음 달"
            >
              →
            </button>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar-grid task-date-grid">
            {days.map(({ date, key }) => (
              <button
                className={[
                  "calendar-day",
                  date.getMonth() === visibleMonth.getMonth()
                    ? ""
                    : "is-outside",
                  key === value ? "is-selected" : "",
                  key === todayKey ? "is-today" : "",
                ].join(" ")}
                type="button"
                key={key}
                onClick={() => selectDate(key)}
                aria-label={formatDateKey(key)}
                aria-pressed={key === value}
              >
                <span>{date.getDate()}</span>
              </button>
            ))}
          </div>

          <div className="task-date-actions">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
            >
              날짜 없음
            </button>
            <button type="button" onClick={() => selectDate(todayKey)}>
              오늘
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
