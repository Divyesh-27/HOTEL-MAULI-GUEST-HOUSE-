import React, { useState, useMemo, useCallback } from 'react';
import { useMobileStore } from '@/mobile/store/useMobileStore';
import { cn } from '@/lib/utils';
import { getRoomStatusOnDate, normalizeToDayStr, getCheckoutDayStr } from '@/utils/availabilityUtils';
import { RoomStatusType, Booking } from '@/types';
import RoomCard from '@/mobile/components/RoomCard';
import CategorySectionHeader from '@/mobile/components/CategorySectionHeader';
import FilterBar from '@/mobile/components/FilterBar';
import DateFilterControl from '@/mobile/components/DateFilterControl';
import BottomSheet from '@/mobile/components/BottomSheet';
import EmptyState from '@/mobile/components/EmptyState';
import { refreshFromCloud } from '@/mobile/lib/mobileSyncEngine';
import { Eye, Receipt, PlusCircle, LogOut, Sparkles, AlertTriangle, Bed, UserPlus } from 'lucide-react';

const DashboardMobile: React.FC = () => {
  const rooms = useMobileStore((s) => s.rooms);
  const bookings = useMobileStore((s) => s.bookings);
  const roomStatus = useMobileStore((s) => s.roomStatus);
  const currentFilter = useMobileStore((s) => s.currentFilter);
  const setFilter = useMobileStore((s) => s.setFilter);
  const setSection = useMobileStore((s) => s.setSection);
  const dashboardDate = useMobileStore((s) => s.dashboardDate);
  const dashboardDateEnd = useMobileStore((s) => s.dashboardDateEnd);
  const setDashboardDate = useMobileStore((s) => s.setDashboardDate);
  const markCleaned = useMobileStore((s) => s.markCleaned);

  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

  // Determine the target date for status calculation
  const targetDate = dashboardDate || normalizeToDayStr(new Date());

  // Get room status for each room on the target date
  // For date ranges: room is Available ONLY if free for every night
  const getRoomStatusForDisplay = useCallback((roomNo: string): RoomStatusType => {
    if (dashboardDateEnd) {
      // Date range mode: check every day in range
      const start = normalizeToDayStr(dashboardDate!);
      const end = normalizeToDayStr(dashboardDateEnd);
      let current = start;
      while (current <= end) {
        const dayStatus = getRoomStatusOnDate(roomNo, current, bookings, roomStatus);
        if (dayStatus !== 'available') return dayStatus;
        // Advance to next day
        const d = new Date(current);
        d.setDate(d.getDate() + 1);
        current = normalizeToDayStr(d);
      }
      return 'available';
    }
    return getRoomStatusOnDate(roomNo, targetDate, bookings, roomStatus);
  }, [bookings, roomStatus, targetDate, dashboardDate, dashboardDateEnd]);

  // Compute counts
  const statusCounts = useMemo(() => {
    const counts = { available: 0, occupied: 0, reserved: 0, cleaning: 0, maintenance: 0 };
    rooms.forEach((r) => {
      const st = getRoomStatusForDisplay(r.roomNo);
      counts[st]++;
    });
    return counts;
  }, [rooms, getRoomStatusForDisplay]);

  // Filter rooms
  const filteredRooms = useMemo(() => {
    if (currentFilter === 'all') return rooms;
    return rooms.filter((r) => getRoomStatusForDisplay(r.roomNo) === currentFilter);
  }, [rooms, currentFilter, getRoomStatusForDisplay]);

  // Group rooms by category (dynamic)
  const groupedRooms = useMemo(() => {
    const groups: Record<string, typeof filteredRooms> = {};
    filteredRooms.forEach((r) => {
      const cat = r.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    });
    return groups;
  }, [filteredRooms]);

  // Get guest name for occupied rooms
  const getGuestName = useCallback((roomNo: string): string | undefined => {
    const booking = bookings.find(
      (b) => !b.isReservation && b.roomNos.includes(roomNo)
    );
    return booking?.guestName;
  }, [bookings]);

  // Get booking for a room
  const getBookingForRoom = useCallback((roomNo: string): Booking | undefined => {
    return bookings.find((b) => b.roomNos.includes(roomNo));
  }, [bookings]);

  // Handle room card click
  const handleRoomClick = (roomNo: string) => {
    const status = getRoomStatusForDisplay(roomNo);
    if (status === 'available') {
      // Navigate to registration with room preselected
      setSection('registration');
      // TODO: pass roomNo to registration
    } else {
      setSelectedRoom(roomNo);
    }
  };

  // Selected room data for bottom sheet
  const selectedRoomData = selectedRoom ? rooms.find((r) => r.roomNo === selectedRoom) : null;
  const selectedRoomStatus = selectedRoom ? getRoomStatusForDisplay(selectedRoom) : null;
  const selectedRoomBooking = selectedRoom ? getBookingForRoom(selectedRoom) : null;

  // Filters config
  const filters = [
    { id: 'all', label: 'All', count: rooms.length },
    { id: 'available', label: 'Available', count: statusCounts.available },
    { id: 'occupied', label: 'Occupied', count: statusCounts.occupied },
    { id: 'reserved', label: 'Reserved', count: statusCounts.reserved },
    { id: 'cleaning', label: 'Cleaning', count: statusCounts.cleaning },
    { id: 'maintenance', label: 'Maint.', count: statusCounts.maintenance },
  ];

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* Status count cards — horizontally scrollable */}
      <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar snap-x snap-mandatory">
        {[
          { key: 'occupied', label: 'Occupied', color: 'text-status-occupied', bg: 'bg-status-occupied/10 border border-status-occupied/20' },
          { key: 'reserved', label: 'Reserved', color: 'text-status-reserved', bg: 'bg-status-reserved/10 border border-status-reserved/20' },
          { key: 'available', label: 'Available', color: 'text-status-available', bg: 'bg-status-available/10 border border-status-available/20' },
          { key: 'cleaning', label: 'Cleaning', color: 'text-status-cleaning', bg: 'bg-status-cleaning/10 border border-status-cleaning/20' },
          { key: 'maintenance', label: 'Maint.', color: 'text-status-maintenance', bg: 'bg-status-maintenance/10 border border-status-maintenance/20' },
        ].map((s) => (
          <button
            key={s.key}
            className={cn('flex flex-col items-center justify-center rounded-xl shrink-0 snap-start w-[100px] h-[72px]', s.bg, 'active:scale-95 transition-transform')}
            onClick={() => setFilter(currentFilter === s.key ? 'all' : s.key)}
          >
            <span className={cn('text-2xl font-black leading-none mb-1', s.color)}>
              {statusCounts[s.key as keyof typeof statusCounts]}
            </span>
            <span className={cn('text-[10px] font-bold uppercase tracking-wide', s.color)}>
              {s.label}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        activeFilter={currentFilter}
        onFilterChange={setFilter}
      />

      <DateFilterControl
        onDateChange={(date, dateEnd) => setDashboardDate(date, dateEnd)}
      />

      {/* Room grid — grouped by category, 2 columns */}
      {Object.keys(groupedRooms).length === 0 ? (
        <EmptyState
          icon={<Bed className="w-6 h-6" />}
          title="No rooms found"
          description={currentFilter !== 'all' ? 'Try changing your filter' : 'No rooms configured yet'}
        />
      ) : (
        Object.entries(groupedRooms).map(([category, categoryRooms]) => (
          <div key={category} className="m-category-group">
            <CategorySectionHeader category={category} count={categoryRooms.length} />
            <div className="grid grid-cols-2 gap-2">
              {categoryRooms.map((room) => {
                const status = getRoomStatusForDisplay(room.roomNo);
                return (
                  <RoomCard
                    key={room.roomNo}
                    room={room}
                    status={status}
                    guestName={getGuestName(room.roomNo)}
                    onClick={() => handleRoomClick(room.roomNo)}
                  />
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Room action bottom sheet */}
      <BottomSheet
        open={!!selectedRoom}
        onClose={() => setSelectedRoom(null)}
        title={selectedRoomData ? `Room ${selectedRoomData.roomNo}` : undefined}
      >
        {selectedRoomData && selectedRoomStatus && (
          <div className="space-y-1">
            {/* Room info */}
            <div className="text-xs text-muted-foreground mb-3">
              {selectedRoomData.category} · {selectedRoomData.bedType} · ₹{selectedRoomData.rent}/night
            </div>

            {/* Occupied actions */}
            {selectedRoomStatus === 'occupied' && selectedRoomBooking && (
              <>
                <div className="text-sm font-semibold text-foreground mb-3">
                  Guest: {selectedRoomBooking.guestName}
                </div>
                <button
                  className="more-menu-item w-full text-left rounded-lg"
                  onClick={() => {
                    setSelectedRoom(null);
                    // TODO: Navigate to billing detail
                    setSection('billing');
                  }}
                >
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  View Guest Details
                </button>
                <button
                  className="more-menu-item w-full text-left rounded-lg"
                  onClick={() => {
                    setSelectedRoom(null);
                    setSection('billing');
                  }}
                >
                  <Receipt className="w-4 h-4 text-muted-foreground" />
                  View Bill
                </button>
                <button
                  className="more-menu-item w-full text-left rounded-lg"
                  onClick={() => {
                    setSelectedRoom(null);
                    setSection('billing');
                  }}
                >
                  <PlusCircle className="w-4 h-4 text-muted-foreground" />
                  Add Charge
                </button>
                <button
                  className="more-menu-item w-full text-left rounded-lg"
                  onClick={() => {
                    setSelectedRoom(null);
                    setSection('billing');
                  }}
                >
                  <LogOut className="w-4 h-4 text-muted-foreground" />
                  Checkout
                </button>
              </>
            )}

            {/* Reserved actions */}
            {selectedRoomStatus === 'reserved' && selectedRoomBooking && (
              <>
                <div className="text-sm font-semibold text-foreground mb-3">
                  Reserved for: {selectedRoomBooking.guestName}
                </div>
                <button
                  className="more-menu-item w-full text-left rounded-lg"
                  onClick={() => {
                    setSelectedRoom(null);
                    // TODO: show reservation detail
                  }}
                >
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  View Reservation
                </button>
                <button
                  className="more-menu-item w-full text-left rounded-lg text-primary"
                  onClick={() => {
                    // TODO: Convert reservation to check-in
                    setSelectedRoom(null);
                  }}
                >
                  <UserPlus className="w-4 h-4" />
                  Check In Now
                </button>
              </>
            )}

            {/* Cleaning action */}
            {selectedRoomStatus === 'cleaning' && (
              <button
                className="more-menu-item w-full text-left rounded-lg"
                onClick={() => {
                  if (window.confirm(`Mark Room ${selectedRoomData.roomNo} as cleaned and available?`)) {
                    markCleaned(selectedRoomData.roomNo);
                    // TODO: sync to cloud
                    setSelectedRoom(null);
                  }
                }}
              >
                <Sparkles className="w-4 h-4 text-status-available" />
                <span className="text-status-available font-semibold">Mark as Cleaned</span>
              </button>
            )}

            {/* Maintenance info */}
            {selectedRoomStatus === 'maintenance' && (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-status-maintenance">
                <AlertTriangle className="w-4 h-4" />
                <span>Under maintenance. Admin action required.</span>
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
};


export default DashboardMobile;

