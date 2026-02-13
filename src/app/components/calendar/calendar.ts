import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  differenceInCalendarDays,
} from 'date-fns';
import { forkJoin } from 'rxjs';
import { CalendarDay, Holiday, Shift } from './interface/icalendar';
@Component({
  selector: 'app-calendar',
  imports: [CommonModule],
  templateUrl: './calendar.html',
  styles: ``,
  providers: [DatePipe],
})
export class Calendar implements OnInit {
  currentDate: Date = new Date();
  days = signal<CalendarDay[]>([]);
  weekDays: string[] = ['日', '一', '二', '三', '四', '五', '六'];

  // 暫存讀取到的資料
  private holidaysData: Holiday[] = [];
  private readonly ANCHOR_DATE = new Date('2025-06-30');

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.generateCalendar();

    setTimeout(() => {
      this.loadData();
    }, 1000);
  }

  // 同時讀取兩個 JSON 檔案
  loadData(): void {
    forkJoin({
      holidays: this.http.get<Holiday[]>('./assets/holidays.json'),
    }).subscribe({
      next: (response) => {
        this.holidaysData = response.holidays;
      },
      error: (err) => console.error('無法讀取資料:', err),
      complete: () => {
        this.generateCalendar();
      },
    });
  }

  //* 計算休假日
  getShiftsByRule(date: Date): Shift[] {
    // 1. 計算這一天跟基準日差了幾天
    const diff = differenceInCalendarDays(date, this.ANCHOR_DATE);

    const cycleDay = ((diff % 4) + 4) % 4;

    if (cycleDay === 0 || cycleDay === 1) {
      // 這是上班日
      return [
        {
          title: '上班',
          type: 'morning',
          color: 'bg-blue-100 text-blue-700 border-blue-200',
        },
      ];
    } else {
      return [{ title: '休', type: 'off', color: 'bg-gray-100 text-gray-400' }];
    }
  }

  generateCalendar(): void {
    const start = startOfWeek(startOfMonth(this.currentDate));
    const end = endOfWeek(endOfMonth(this.currentDate));

    const interval = eachDayOfInterval({ start, end });

    this.days.set(
      interval.map((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');

        // 查找是否有假日
        const holiday = this.holidaysData.find((h) => h.date === dateStr)?.name;

        // 查找是否有班表
        const shifts = this.getShiftsByRule(date);

        return {
          date: date,
          dateStr: dateStr,
          isCurrentMonth: isSameMonth(date, this.currentDate),
          isToday: isToday(date),
          holiday: holiday,
          shifts: shifts,
        };
      }),
    );
  }

  prevMonth(): void {
    this.currentDate = subMonths(this.currentDate, 1);
    this.generateCalendar();
  }

  nextMonth(): void {
    this.currentDate = addMonths(this.currentDate, 1);
    this.generateCalendar();
  }
}
