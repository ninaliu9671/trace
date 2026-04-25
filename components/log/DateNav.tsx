'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { toDateString } from '@/lib/utils'

interface DateNavProps {
  currentDate: Date
  onDateChange: (date: Date) => void
  recordDates: string[]
}

interface CalendarPopupProps {
  selectedDate: Date
  recordDates: string[]
  onSelect: (date: Date) => void
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function formatDateLabel(date: Date): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const w = WEEKDAYS[date.getDay()]
  return `${y}年${m}月${d}日 周${w}`
}

function isSameDay(a: Date, b: Date): boolean {
  return toDateString(a) === toDateString(b)
}

export default function DateNav({ currentDate, onDateChange, recordDates }: DateNavProps) {
  const [showCalendar, setShowCalendar] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowCalendar(false)
      }
    }

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCalendar])

  function goToPrev() {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 1)
    onDateChange(d)
  }

  function goToNext() {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 1)
    onDateChange(d)
  }

  const isToday = isSameDay(currentDate, new Date())

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}
    >
      <button
        onClick={goToPrev}
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #E8E4DD',
          borderRadius: 6,
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 14,
          color: '#6B6B6B',
        }}
      >
        ‹
      </button>

      <button
        onClick={() => setShowCalendar(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          border: '1px solid #E8E4DD',
          borderRadius: 6,
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 13,
          color: '#1A1A1A',
          fontFamily: 'inherit',
        }}
      >
        {isToday && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#1D9E75',
              flexShrink: 0,
            }}
          />
        )}
        <span>{formatDateLabel(currentDate)}</span>
        <span style={{ fontSize: 10, color: '#B0ADA6' }}>▾</span>
      </button>

      <button
        onClick={goToNext}
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #E8E4DD',
          borderRadius: 6,
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 14,
          color: '#6B6B6B',
        }}
      >
        ›
      </button>

      {showCalendar && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 6,
            zIndex: 50,
          }}
        >
          <CalendarPopup
            selectedDate={currentDate}
            recordDates={recordDates}
            onSelect={(date) => {
              onDateChange(date)
              setShowCalendar(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

function CalendarPopup({ selectedDate, recordDates, onSelect }: CalendarPopupProps) {
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth())

  const today = new Date()
  const recordSet = new Set(recordDates)

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear(y => y - 1)
      setViewMonth(11)
      return
    }

    setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear(y => y + 1)
      setViewMonth(0)
      return
    }

    setViewMonth(m => m + 1)
  }

  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  while (cells.length < 42) {
    cells.push(null)
  }

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E4DD',
        borderRadius: 10,
        padding: 14,
        width: 240,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <button onClick={prevMonth} style={navBtnStyle}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>
          {viewYear}年{viewMonth + 1}月
        </span>
        <button onClick={nextMonth} style={navBtnStyle}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            style={{ textAlign: 'center', fontSize: 11, color: '#B0ADA6', padding: '2px 0' }}
          >
            {day}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />

          const cellDate = new Date(viewYear, viewMonth, day)
          const dateStr = toDateString(cellDate)
          const isSelected = isSameDay(cellDate, selectedDate)
          const isTodayCell = isSameDay(cellDate, today)
          const hasRecord = recordSet.has(dateStr)

          return (
            <div
              key={idx}
              onClick={() => onSelect(cellDate)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '4px 2px',
                cursor: 'pointer',
                borderRadius: 6,
                background: isSelected ? '#1D9E75' : isTodayCell ? '#F0FBF7' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isSelected && !isTodayCell) {
                  e.currentTarget.style.background = '#F4F3F0'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = isTodayCell ? '#F0FBF7' : 'transparent'
                }
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: isSelected ? '#FFFFFF' : isTodayCell ? '#1D9E75' : '#1A1A1A',
                  fontWeight: isSelected || isTodayCell ? 500 : 400,
                  lineHeight: 1.5,
                }}
              >
                {day}
              </span>
              {hasRecord && !isSelected && (
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#1D9E75',
                    marginTop: 1,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const navBtnStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  fontSize: 16,
  color: '#6B6B6B',
  cursor: 'pointer',
  borderRadius: 4,
}
