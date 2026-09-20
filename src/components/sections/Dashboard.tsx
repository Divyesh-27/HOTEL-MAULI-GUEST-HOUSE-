import { useState } from 'react'; // Added useState
import { useStore } from '@/store/useStore';
import { Bed, CheckCircle, Sparkles, Wrench, CalendarClock, Edit } from 'lucide-react'; // Added Edit icon
import { cn } from '@/lib/utils';
import GuestDetailsModal from '../modals/GuestDetailsModal'; // Import the Modal
import { Booking } from '@/types';
import { deleteRoomStatusFromCloud, pushBookingToCloud } from '@/lib/syncActions';
import { normalizeToDayStr, getCheckoutDayStr } from '@/utils/availabilityUtils';

import { useShallow } from 'zustand/react/shallow';

type FilterType = 'all' | 'occupied' | 'available' | 'reserved' | 'cleaning' | 'maintenance';

const Dashboard = () => {
  const { 
    rooms, bookings, roomStatus, currentFilter, setFilter, setSection, 
    markCleaned, getRoomStatus, getOccupiedRooms, getReservedRooms, 
    getAvailableRooms, convertReservationToCheckIn, updateBooking 
  } = useStore(useShallow(state => ({
    rooms: state.rooms, bookings: state.bookings, roomStatus: state.roomStatus, 
    currentFilter: state.currentFilter, setFilter: state.setFilter, setSection: state.setSection, 
    markCleaned: state.markCleaned, getRoomStatus: state.getRoomStatus, 
    getOccupiedRooms: state.getOccupiedRooms, getReservedRooms: state.getReservedRooms, 
    getAvailableRooms: state.getAvailableRooms, convertReservationToCheckIn: state.convertReservationToCheckIn, 
    updateBooking: state.updateBooking
  })));

  // Local state for the modal
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Calculate stats using centralized Today status checks
  const occupied = getOccupiedRooms().length;
  const reserved = getReservedRooms().length;
  const available = getAvailableRooms().length;
  const maintenance = Object.values(roomStatus).filter(s => s === 'maintenance').length;
  const cleaning = Object.values(roomStatus).filter(s => s === 'cleaning').length;

  const stats = [
    { id: 'occupied', label: 'Occupied', count: occupied, icon: Bed, color: 'text-status-occupied', borderColor: 'hover:border-status-occupied' },
    { id: 'reserved', label: 'Reserved', count: reserved, icon: CalendarClock, color: 'text-status-reserved', borderColor: 'hover:border-status-reserved' },
    { id: 'available', label: 'Available', count: available, icon: CheckCircle, color: 'text-status-available', borderColor: 'hover:border-status-available' },
    { id: 'cleaning', label: 'Cleaning', count: cleaning, icon: Sparkles, color: 'text-status-cleaning', borderColor: 'hover:border-status-cleaning' },
    { id: 'maintenance', label: 'Maintenance', count: maintenance, icon: Wrench, color: 'text-status-maintenance', borderColor: 'hover:border-status-maintenance' },
  ];

  const categories: ('AC' | 'Air Cooled' | 'Hall')[] = ['AC', 'Air Cooled', 'Hall'];

  const getFilterLabel = () => {
    const labels: Record<string, string> = {
      all: '(Showing All)',
      occupied: '(Occupied Only)',
      reserved: '(Reserved Only)',
      available: '(Available Only)',
      maintenance: '(Maintenance Only)',
      cleaning: '(Cleaning Required)',
    };
    return labels[currentFilter] || '';
  };

  const handleRoomClick = (roomNo: string) => {
    const status = getRoomStatus(roomNo);
    if (status === 'cleaning') {
      if (confirm(`Mark Room ${roomNo} as Cleaned and Available?`)) {
        markCleaned(roomNo);
        deleteRoomStatusFromCloud(roomNo); // Sync: Remove from Supabase
      }
    } else if (status === 'reserved') {
      const booking = bookings.find(b => b.roomNos.includes(roomNo) && b.isReservation);
      if (booking && confirm(`Convert reservation for ${booking.guestName} to Check-In now?`)) {
        convertReservationToCheckIn(booking.id);
        // Sync: push updated booking status to cloud
        pushBookingToCloud({ ...booking, isReservation: false, checkIn: new Date().toISOString() });
      }
    } else if (status === 'occupied') {
      setSection('billing');
    }
  };

  const getBookingForRoom = (roomNo: string) => {
    const todayStr = normalizeToDayStr(new Date());
    return bookings.find(b => {
      if (!b.roomNos.includes(roomNo)) return false;
      const bIn = normalizeToDayStr(b.checkIn);
      const bOut = getCheckoutDayStr(b.checkIn, b.days || 1);
      return todayStr >= bIn && todayStr < bOut;
    });
  };

  // Handler to open the Edit Modal
  const handleEditClick = (e: React.MouseEvent, roomNo: string) => {
    e.stopPropagation(); // Stop it from opening Billing
    const booking = getBookingForRoom(roomNo);
    if (booking) {
      setSelectedBooking(booking);
      setShowDetailsModal(true);
    }
  };

  const handleUpdateBooking = (updatedData: any) => {
    if (updateBooking) {
      updateBooking(updatedData); // Call store action
      setShowDetailsModal(false);
    } else {
      alert("Error: updateBooking function missing in store.");
    }
  };

  return (
    <div className="animate-fade-in relative">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.id}
            onClick={() => setFilter(stat.id as FilterType)}
            className={cn('stat-card', stat.borderColor)}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-bold">{stat.label}</p>
                <p className={cn('text-3xl font-bold', stat.color)}>{stat.count}</p>
              </div>
              <stat.icon className={cn('w-8 h-8 opacity-30', stat.color)} />
            </div>
          </div>
        ))}
      </div>

      {/* Room Grid */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="font-bold text-foreground">
            Room Status 
            <span className="text-xs font-normal text-muted-foreground ml-2">{getFilterLabel()}</span>
          </h3>
          <button 
            onClick={() => setFilter('all')}
            className="text-xs bg-secondary px-3 py-1 rounded hover:bg-secondary/80 transition-colors"
          >
            Show All
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-6 text-xs font-medium">
          <span className="flex items-center"><span className="w-3 h-3 status-available rounded-sm mr-1" /> Available</span>
          <span className="flex items-center"><span className="w-3 h-3 status-occupied rounded-sm mr-1" /> Occupied (Click to Bill, Icon to Edit)</span>
          <span className="flex items-center"><span className="w-3 h-3 status-reserved rounded-sm mr-1" /> Reserved (Click to Check In)</span>
          <span className="flex items-center"><span className="w-3 h-3 status-cleaning rounded-sm mr-1" /> Cleaning (Click to Clear)</span>
          <span className="flex items-center"><span className="w-3 h-3 status-maintenance rounded-sm mr-1" /> Maintenance</span>
        </div>

        {/* Rooms by Category */}
        <div className="space-y-6">
          {categories.map((cat) => {
            const catRooms = rooms.filter(r => r.category === cat);
            if (catRooms.length === 0) return null;

            const filteredRooms = catRooms.filter(r => {
              if (currentFilter === 'all') return true;
              return getRoomStatus(r.roomNo) === currentFilter;
            });

            if (filteredRooms.length === 0 && currentFilter !== 'all') return null;

            return (
              <div key={cat}>
                <h4 className="font-bold text-sm text-muted-foreground uppercase mb-3 border-b pb-1">{cat}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {(currentFilter === 'all' ? catRooms : filteredRooms).map((room) => {
                    const status = getRoomStatus(room.roomNo);
                    const booking = getBookingForRoom(room.roomNo);
                    
                    if (currentFilter !== 'all' && status !== currentFilter) return null;

                    return (
                      <div
                        key={room.roomNo}
                        onClick={() => handleRoomClick(room.roomNo)}
                        className={cn(
                          'room-card animate-scale-in group relative', // Added group and relative
                          `room-card-${status}`,
                          (status === 'cleaning' || status === 'reserved' || status === 'occupied') && 'cursor-pointer hover:scale-105'
                        )}
                      >
                        {/* Edit Button for Occupied Rooms */}
                        {status === 'occupied' && (
                          <button
                            onClick={(e) => handleEditClick(e, room.roomNo)}
                            className="absolute top-2 right-2 z-10 p-1 bg-white/20 hover:bg-white/50 rounded-full transition-colors"
                            title="Edit Details"
                          >
                            <Edit className="w-3 h-3 text-foreground" />
                          </button>
                        )}
                        
                        {/* Status Dot (Only if not occupied, since we have the edit button there now) */}
                        {status !== 'occupied' && (
                          <div className={cn(
                            'absolute top-2 right-2 w-2 h-2 rounded-full',
                            `status-${status}`
                          )} />
                        )}

                        <p className="font-bold text-lg text-foreground">{room.roomNo}</p>
                        <p className="text-[10px] text-muted-foreground truncate w-full">
                          {booking ? booking.guestName : status === 'maintenance' ? 'Maintenance' : status === 'cleaning' ? 'Cleaning Required' : 'Available'}
                        </p>
                        <p className="text-[10px] text-muted mt-1">{room.bedType}</p>
                        {booking?.isReservation && (
                          <span className="text-[9px] bg-status-reserved text-white px-1 rounded mt-1">RESERVED</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Render the Modal */}
      {showDetailsModal && selectedBooking && (
        <GuestDetailsModal 
          data={selectedBooking} 
          onClose={() => setShowDetailsModal(false)} 
          onUpdate={handleUpdateBooking}
        />
      )}
    </div>
  );
};

export default Dashboard;