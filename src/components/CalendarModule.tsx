
import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Trash2, ChevronLeft, ChevronRight, Bell, Clock, Eye, Calendar as CalendarIcon, MapPin, Tag } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday, isPast, isBefore, addHours, subHours } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { apiService } from '../services/api';
import { useSchool } from '../contexts/SchoolContext';
import { Loader2 } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  time?: string;
  description?: string;
  color: string;
  category: string;
  reminder?: boolean;
  reminderTime?: string;
  location?: string;
}

const eventColors = [
  { name: 'Academic', value: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-500' },
  { name: 'Sports', value: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  { name: 'Meeting', value: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', dot: 'bg-purple-500' },
  { name: 'Holiday', value: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', dot: 'bg-rose-500' },
  { name: 'Exam', value: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  { name: 'Other', value: 'bg-slate-500', text: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', dot: 'bg-slate-500' },
];

const eventCategories = [
  'Academic',
  'Sports',
  'Meeting',
  'Holiday',
  'Exam',
  'Other'
];

export default function CalendarModule() {
  const { schoolId } = useSchool();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    time: '',
    location: '',
    color: 'bg-blue-500',
    category: 'Academic',
    reminder: false,
    reminderTime: '30'
  });

  const months = [
    subMonths(currentDate, 1),
    currentDate,
    addMonths(currentDate, 1)
  ];

  useEffect(() => {
    if (schoolId) {
      apiService.setTenantContext(schoolId);
      fetchEvents();
    }
  }, [schoolId]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await apiService.get<any[]>('/events');
      const mappedEvents: CalendarEvent[] = data.map(e => ({
        id: String(e.id),
        title: e.title,
        date: new Date(e.event_date),
        time: e.event_time,
        description: e.description,
        color: e.color || 'bg-blue-500',
        category: e.category || 'Other',
        reminder: e.reminder,
        reminderTime: e.reminder_time,
        location: e.location
      }));
      setEvents(mappedEvents);
    } catch (error) {
      console.error('Fetch events error:', error);
      toast({ title: 'Error', description: 'Failed to load calendar events', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(event.date, date));
  };

  const handleAddEvent = async () => {
    if (!selectedDate || !eventForm.title.trim()) return;

    try {
      const payload = {
        title: eventForm.title,
        description: eventForm.description,
        event_time: eventForm.time,
        location: eventForm.location,
        event_date: format(selectedDate, 'yyyy-MM-dd'),
        color: eventForm.color,
        category: eventForm.category,
        reminder: eventForm.reminder,
        reminder_time: eventForm.reminderTime
      };

      const newEvent = await apiService.post<any>('/events', payload);
      
      setEvents([...events, {
        id: String(newEvent.id),
        title: newEvent.title,
        date: new Date(newEvent.event_date),
        time: newEvent.event_time,
        description: newEvent.description,
        color: newEvent.color,
        category: newEvent.category,
        reminder: newEvent.reminder,
        reminderTime: newEvent.reminder_time,
        location: newEvent.location
      }]);

      resetForm();
      
      toast({
        title: "Event Created",
        description: `${eventForm.title} has been added to your calendar.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to create event",
        variant: "destructive",
      });
    }
  };

  const handleEditEvent = async () => {
    if (!editingEvent || !eventForm.title.trim()) return;

    try {
      const payload = {
        title: eventForm.title,
        description: eventForm.description,
        event_time: eventForm.time,
        location: eventForm.location,
        event_date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(editingEvent.date, 'yyyy-MM-dd'),
        color: eventForm.color,
        category: eventForm.category,
        reminder: eventForm.reminder,
        reminder_time: eventForm.reminderTime
      };

      const updatedEvent = await apiService.put<any>(`/events/${editingEvent.id}`, payload);

      setEvents(events.map(event => 
        event.id === editingEvent.id 
          ? { 
              ...event, 
              title: updatedEvent.title, 
              description: updatedEvent.description,
              time: updatedEvent.event_time,
              location: updatedEvent.location,
              date: new Date(updatedEvent.event_date),
              color: updatedEvent.color,
              category: updatedEvent.category,
              reminder: updatedEvent.reminder,
              reminderTime: updatedEvent.reminder_time
            }
          : event
      ));
      
      resetForm();
      
      toast({
        title: "Event Updated",
        description: `${eventForm.title} has been updated successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update event",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await apiService.delete(`/events/${eventId}`);
      
      setEvents(events.filter(event => event.id !== eventId));
      
      toast({
        title: "Event Deleted",
        description: "Event has been removed from your calendar.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete event",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEventForm({ 
      title: '', 
      description: '', 
      time: '',
      location: '',
      color: 'bg-blue-500',
      category: 'Academic',
      reminder: false,
      reminderTime: '30'
    });
    setEditingEvent(null);
    setIsDialogOpen(false);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedDate(event.date);
    setEventForm({
      title: event.title,
      description: event.description || '',
      time: event.time || '',
      location: event.location || '',
      color: event.color,
      category: event.category,
      reminder: event.reminder || false,
      reminderTime: event.reminderTime || '30'
    });
    setIsDialogOpen(true);
  };

  const openAddDialog = (date?: Date) => {
    setSelectedDate(date || new Date());
    setEditingEvent(null);
    setEventForm({ 
      title: '', 
      description: '', 
      time: '',
      location: '',
      color: 'bg-blue-500',
      category: 'Academic',
      reminder: false,
      reminderTime: '30'
    });
    setIsDialogOpen(true);
  };

  const openDetailsDialog = (event: CalendarEvent) => {
    setViewingEvent(event);
    setIsDetailsOpen(true);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
  };

  const getColorConfig = (colorValue: string) => {
    return eventColors.find(color => color.value === colorValue) || eventColors[0];
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/20">
            <CalendarIcon className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Academic Calendar
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              Organize your academic year with style and precision
            </p>
          </div>
          <Button 
            onClick={() => openAddDialog()} 
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-3 rounded-xl text-lg font-semibold"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Event
          </Button>
        </div>

        {/* Calendar Navigation */}
        <Card className="border-border shadow-lg bg-card/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <Button 
                variant="outline" 
                onClick={() => navigateMonth('prev')} 
                className="gap-2 hover:bg-muted border-border px-6 py-3 rounded-xl"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground">
                  {format(subMonths(currentDate, 1), 'MMM')} - {format(addMonths(currentDate, 1), 'MMM yyyy')}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Three month view</p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => navigateMonth('next')} 
                className="gap-2 hover:bg-muted border-border px-6 py-3 rounded-xl"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Three Month Calendar View */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            <p className="text-slate-500 font-medium animate-pulse">Syncing your calendar...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {months.map((month, index) => (
              <Card key={index} className="border-border shadow-2xl bg-card/95 backdrop-blur-md hover:shadow-indigo-500/10 transition-all duration-500 rounded-3xl group">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-center text-lg font-bold text-foreground">
                    {format(month, 'MMMM yyyy')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date);
                        openAddDialog(date);
                      }
                    }}
                    month={month}
                    showOutsideDays={true}
                    className="p-0 w-full"
                    classNames={{
                      head_cell: "text-muted-foreground rounded-md w-10 h-10 font-bold text-xs uppercase tracking-widest flex items-center justify-center",
                      cell: "relative h-12 w-10 text-center text-sm p-0 focus-within:relative focus-within:z-20",
                      day: "h-12 w-10 p-0 font-semibold hover:bg-indigo-500/10 hover:text-indigo-600 cursor-pointer rounded-xl transition-all duration-300 flex items-center justify-center relative group/day",
                      day_today: "bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 z-10",
                      day_selected: "bg-gradient-to-br from-purple-500 to-indigo-600 text-white hover:opacity-90 shadow-xl z-10",
                      day_outside: "text-muted-foreground/20 opacity-20",
                      nav_button: "hover:bg-muted border-border",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                    }}
                    components={{
                      Day: ({ date, ...props }) => {
                        const dayEvents = getEventsForDate(date);
                        const isTodayDate = isSameDay(date, new Date());
                        const isSelected = selectedDate && isSameDay(date, selectedDate);
                        const isCurrentMonth = isSameMonth(date, month);

                        return (
                          <div className="relative w-full h-full flex items-center justify-center">
                            <button
                              {...props}
                              className={`
                                w-10 h-10 p-0 font-bold rounded-xl transition-all duration-300 relative
                                ${isTodayDate ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20' : ''}
                                ${isSelected ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20 scale-105 z-10' : ''}
                                ${!isCurrentMonth ? 'text-muted-foreground/20 opacity-30' : 'text-foreground/80 hover:bg-indigo-500/10 hover:text-indigo-600'}
                                flex items-center justify-center
                              `}
                              onClick={() => {
                                setSelectedDate(date);
                                openAddDialog(date);
                              }}
                            >
                              <span className="relative z-10">{format(date, 'd')}</span>

                              <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover/day:border-indigo-500/20 transition-all duration-300" />
                            </button>

                            {dayEvents.length > 0 && (
                              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1 z-20">
                                {dayEvents.slice(0, 3).map((event, i) => {
                                  const colorConfig = getColorConfig(event.color);
                                  return (
                                    <div
                                      key={i}
                                      className={`w-1.5 h-1.5 rounded-full ${colorConfig.dot} ring-1 ring-white shadow-sm`}
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }
                    }}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Events List */}
        <Card className="border-border shadow-xl bg-card/90 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-muted to-muted/50 border-b border-border">
            <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Clock className="h-4 w-4 text-white" />
              </div>
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {events
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .slice(0, 10)
                .map((event) => {
                  const colorConfig = getColorConfig(event.color);
                  return (
                    <div key={event.id} className={`p-6 rounded-2xl border-2 ${colorConfig.bg} ${colorConfig.border} hover:shadow-lg transition-all duration-300 group`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-4">
                            <Badge className={`${colorConfig.value} text-white px-4 py-2 text-sm font-semibold rounded-xl shadow-sm`}>
                              {format(event.date, 'MMM d')}
                            </Badge>
                            <Badge variant="outline" className={`px-3 py-1 text-xs font-medium rounded-lg border-2 ${colorConfig.border} ${colorConfig.text}`}>
                              <Tag className="h-3 w-3 mr-1" />
                              {event.category}
                            </Badge>
                            {event.reminder && (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50 px-3 py-1 rounded-lg">
                                <Bell className="h-3 w-3 mr-1" />
                                {event.reminderTime}m
                              </Badge>
                            )}
                          </div>
                          <h3 className={`font-bold text-lg ${colorConfig.text} mb-3 group-hover:text-foreground transition-colors`}>
                            {event.title}
                          </h3>
                          <div className="flex items-center gap-6 text-sm text-muted-foreground mb-3">
                            {event.time && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span className="font-medium">{event.time}</span>
                              </div>
                            )}
                            {event.location && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                <span className="font-medium">{event.location}</span>
                              </div>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{event.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetailsDialog(event)}
                            className="h-10 w-10 p-0 hover:bg-blue-100 hover:text-blue-600 rounded-xl transition-all duration-200"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(event)}
                            className="h-10 w-10 p-0 hover:bg-purple-100 hover:text-purple-600 rounded-xl transition-all duration-200"
                            title="Edit Event"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEvent(event.id)}
                            className="h-10 w-10 p-0 text-red-500 hover:bg-red-100 hover:text-red-600 rounded-xl transition-all duration-200"
                            title="Delete Event"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              {events.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CalendarIcon className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No events scheduled</h3>
                  <p className="text-muted-foreground">Click on any date to create your first event</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Event Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto border-border shadow-2xl bg-card/95 backdrop-blur-sm">
            <DialogHeader className="pb-6 border-b border-border">
              <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="h-4 w-4 text-white" />
                </div>
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-8 py-6">
              {/* Selected Date Display */}
              {selectedDate && (
                <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 p-6 rounded-2xl border border-blue-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <CalendarIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Selected Date</span>
                      <div className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Event Title */}
              <div className="space-y-3">
                <Label htmlFor="title" className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
                  Event Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  placeholder="Enter a descriptive title for your event"
                  className="h-12 border-border bg-background rounded-xl focus:ring-blue-500/20 text-lg"
                />
              </div>
              
              {/* Description */}
              <div className="space-y-3">
                <Label htmlFor="description" className="text-sm font-semibold text-foreground/80">Description</Label>
                <Textarea
                  id="description"
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  placeholder="Add details about your event..."
                  rows={4}
                  className="resize-none border-border bg-background rounded-xl focus:ring-blue-500/20"
                />
              </div>

              {/* Time and Category Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="time" className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Time
                  </Label>
                  <Input
                    id="time"
                    type="time"
                    value={eventForm.time}
                    onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                    className="h-12 border-border bg-background rounded-xl focus:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="category" className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Category
                  </Label>
                  <Select value={eventForm.category} onValueChange={(value) => setEventForm({ ...eventForm, category: value })}>
                    <SelectTrigger className="h-12 border-border bg-background rounded-xl focus:ring-blue-500/20">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-card">
                      {eventCategories.map((category) => (
                        <SelectItem key={category} value={category} className="rounded-lg">
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-3">
                <Label htmlFor="location" className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </Label>
                <Input
                  id="location"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  placeholder="Where will this event take place?"
                  className="h-12 border-border bg-background rounded-xl focus:ring-blue-500/20"
                />
              </div>

              {/* Color Tag */}
              <div className="space-y-3">
                <Label htmlFor="color" className="text-sm font-semibold text-foreground/80">Color Theme</Label>
                <Select value={eventForm.color} onValueChange={(value) => setEventForm({ ...eventForm, color: value })}>
                  <SelectTrigger className="h-12 border-border bg-background rounded-xl focus:ring-blue-500/20">
                    <SelectValue placeholder="Choose a color theme" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border bg-card">
                    {eventColors.map((color) => (
                      <SelectItem key={color.value} value={color.value} className="rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full ${color.value} shadow-sm`} />
                          <span className="font-medium">{color.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator className="bg-border" />

              {/* Reminder Section */}
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                  <div className="space-y-1">
                    <Label htmlFor="reminder" className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Set Reminder
                    </Label>
                    <p className="text-xs text-amber-600/70 dark:text-amber-400/70">Get notified before the event starts</p>
                  </div>
                  <Switch
                    id="reminder"
                    checked={eventForm.reminder}
                    onCheckedChange={(checked) => setEventForm({ ...eventForm, reminder: checked })}
                  />
                </div>
                
                {eventForm.reminder && (
                  <div className="space-y-3 pl-6 border-l-4 border-amber-500/30 bg-amber-500/5 py-4 rounded-r-xl">
                    <Label htmlFor="reminderTime" className="text-sm font-semibold text-foreground/80">Remind me</Label>
                    <Select value={eventForm.reminderTime} onValueChange={(value) => setEventForm({ ...eventForm, reminderTime: value })}>
                      <SelectTrigger className="h-12 border-2 border-amber-500/20 rounded-xl focus:border-amber-500 focus:ring-0 bg-background">
                        <SelectValue placeholder="Select reminder time" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-2 border-amber-500/20">
                        <SelectItem value="15">15 minutes before</SelectItem>
                        <SelectItem value="30">30 minutes before</SelectItem>
                        <SelectItem value="60">1 hour before</SelectItem>
                        <SelectItem value="120">2 hours before</SelectItem>
                        <SelectItem value="1440">1 day before</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Dialog Actions */}
            <div className="flex justify-end gap-4 pt-6 border-t border-border">
              <Button 
                variant="outline" 
                onClick={resetForm} 
                className="px-8 py-3 rounded-xl border-2 border-border hover:bg-muted"
              >
                Cancel
              </Button>
              <Button 
                onClick={editingEvent ? handleEditEvent : handleAddEvent}
                disabled={!eventForm.title.trim()}
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {editingEvent ? 'Update Event' : 'Create Event'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Event Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-[600px] border-border shadow-2xl bg-card/95 backdrop-blur-sm">
            <DialogHeader className="border-b border-border pb-6">
              <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-foreground">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Eye className="h-4 w-4 text-white" />
                </div>
                Event Details
              </DialogTitle>
            </DialogHeader>
            {viewingEvent && (
              <div className="space-y-6 py-6">
                <div className="text-center space-y-4">
                  <h2 className="text-3xl font-bold text-foreground">{viewingEvent.title}</h2>
                  <div className="flex justify-center gap-3">
                    <Badge className={`${getColorConfig(viewingEvent.color).value} text-white px-4 py-2 text-sm font-semibold rounded-xl shadow-sm`}>
                      {format(viewingEvent.date, 'EEEE, MMMM d, yyyy')}
                    </Badge>
                    <Badge variant="outline" className="px-3 py-1 text-sm font-medium rounded-lg border-2">
                      {viewingEvent.category}
                    </Badge>
                  </div>
                </div>

                <Separator className="bg-border" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {viewingEvent.time && (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Time
                      </Label>
                      <p className="text-lg font-medium text-foreground">{viewingEvent.time}</p>
                    </div>
                  )}
                  
                  {viewingEvent.location && (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Location
                      </Label>
                      <p className="text-lg font-medium text-foreground">{viewingEvent.location}</p>
                    </div>
                  )}
                </div>

                {viewingEvent.description && (
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-muted-foreground">Description</Label>
                    <p className="text-foreground/90 bg-muted p-4 rounded-xl leading-relaxed">
                      {viewingEvent.description}
                    </p>
                  </div>
                )}

                {viewingEvent.reminder && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Reminder
                    </Label>
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-500/5 p-3 rounded-lg border border-amber-500/20">
                      <Bell className="h-4 w-4" />
                      <span className="font-medium">Set for {viewingEvent.reminderTime} minutes before</span>
                    </div>
                  </div>
                )}

                <Separator className="bg-border" />

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsDetailsOpen(false)}
                    className="px-6 py-3 rounded-xl border-2 border-border hover:bg-muted"
                  >
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDetailsOpen(false);
                      openEditDialog(viewingEvent);
                    }}
                    className="gap-2 px-6 py-3 rounded-xl border-2 border-purple-200 text-purple-600 hover:bg-purple-50"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setIsDetailsOpen(false);
                      handleDeleteEvent(viewingEvent.id);
                    }}
                    className="gap-2 px-6 py-3 rounded-xl bg-red-500 hover:bg-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
