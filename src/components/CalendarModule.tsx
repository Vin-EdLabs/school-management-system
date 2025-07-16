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
import { Plus, Edit, Trash2, ChevronLeft, ChevronRight, Bell, Clock, Eye, Calendar as CalendarIcon } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday, isPast, isBefore, addHours, subHours } from 'date-fns';
import { toast } from '@/hooks/use-toast';

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
  { name: 'Academic', value: 'bg-primary', text: 'text-primary', bg: 'bg-primary/5', border: 'border-primary/20' },
  { name: 'Sports', value: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { name: 'Meeting', value: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  { name: 'Holiday', value: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  { name: 'Exam', value: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  { name: 'Other', value: 'bg-slate-500', text: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([
    {
      id: '1',
      title: 'Parent-Teacher Conference',
      date: new Date(),
      time: '10:00',
      description: 'Quarterly parent-teacher meetings',
      color: 'bg-primary',
      category: 'Academic',
      reminder: true,
      reminderTime: '30',
      location: 'Main Hall'
    },
    {
      id: '2',
      title: 'School Sports Day',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      time: '09:00',
      description: 'Annual athletics competition',
      color: 'bg-emerald-500',
      category: 'Sports',
      reminder: true,
      reminderTime: '60',
      location: 'Sports Ground'
    }
  ]);
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
    color: 'bg-primary',
    category: 'Academic',
    reminder: false,
    reminderTime: '30'
  });

  const months = [
    subMonths(currentDate, 1),
    currentDate,
    addMonths(currentDate, 1)
  ];

  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(event.date, date));
  };

  const handleAddEvent = () => {
    if (!selectedDate || !eventForm.title.trim()) return;

    const newEvent: CalendarEvent = {
      id: Date.now().toString(),
      title: eventForm.title,
      description: eventForm.description,
      time: eventForm.time,
      location: eventForm.location,
      date: selectedDate,
      color: eventForm.color,
      category: eventForm.category,
      reminder: eventForm.reminder,
      reminderTime: eventForm.reminderTime
    };

    setEvents([...events, newEvent]);
    resetForm();
    
    // Show success toast
    toast({
      title: "Event Created",
      description: `${eventForm.title} has been added to your calendar.`,
    });
  };

  const handleEditEvent = () => {
    if (!editingEvent || !eventForm.title.trim()) return;

    setEvents(events.map(event => 
      event.id === editingEvent.id 
        ? { 
            ...event, 
            title: eventForm.title, 
            description: eventForm.description,
            time: eventForm.time,
            location: eventForm.location,
            color: eventForm.color,
            category: eventForm.category,
            reminder: eventForm.reminder,
            reminderTime: eventForm.reminderTime
          }
        : event
    ));
    resetForm();
    
    // Show success toast
    toast({
      title: "Event Updated",
      description: `${eventForm.title} has been updated successfully.`,
    });
  };

  const handleDeleteEvent = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    setEvents(events.filter(event => event.id !== eventId));
    
    // Show success toast
    toast({
      title: "Event Deleted",
      description: `${event?.title} has been removed from your calendar.`,
    });
  };

  const resetForm = () => {
    setEventForm({ 
      title: '', 
      description: '', 
      time: '',
      location: '',
      color: 'bg-primary',
      category: 'Academic',
      reminder: false,
      reminderTime: '30'
    });
    setEditingEvent(null);
    setIsDialogOpen(false);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
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
      color: 'bg-primary',
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Academic Calendar</h1>
          <p className="text-muted-foreground">Manage school events and important dates</p>
        </div>
        <Button onClick={() => openAddDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Event
        </Button>
      </div>

      {/* Calendar Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => navigateMonth('prev')} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <h2 className="text-xl font-semibold">
          {format(subMonths(currentDate, 1), 'MMM yyyy')} - {format(addMonths(currentDate, 1), 'MMM yyyy')}
        </h2>
        <Button variant="outline" onClick={() => navigateMonth('next')} className="gap-2">
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Three Month Calendar View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {months.map((month, index) => (
          <Card key={index} className="p-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-center text-lg">
                {format(month, 'MMMM yyyy')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && openAddDialog(date)}
                month={month}
                className="rounded-md border-none p-0"
                classNames={{
                  head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                  cell: "relative h-9 w-9 text-center text-sm p-0 focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent",
                  day: "h-9 w-9 p-0 font-normal hover:bg-accent hover:text-accent-foreground",
                  day_today: "bg-accent text-accent-foreground font-semibold",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_outside: "text-muted-foreground opacity-50",
                }}
                components={{
                  Day: ({ date, ...props }) => {
                    const dayEvents = getEventsForDate(date);
                    const isToday = isSameDay(date, new Date());
                    const isCurrentMonth = isSameMonth(date, month);
                    
                    return (
                      <div className="relative">
                        <button
                          {...props}
                          className={`
                            h-9 w-9 p-0 font-normal rounded-md transition-colors
                            ${isToday ? 'bg-accent text-accent-foreground font-semibold' : ''}
                            ${!isCurrentMonth ? 'text-muted-foreground opacity-50' : ''}
                            hover:bg-accent hover:text-accent-foreground
                          `}
                        >
                          {format(date, 'd')}
                        </button>
                        {dayEvents.length > 0 && (
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                            {dayEvents.slice(0, 3).map((event, i) => {
                              const colorConfig = getColorConfig(event.color);
                              return (
                                <div
                                  key={i}
                                  className={`w-1.5 h-1.5 rounded-full ${colorConfig.value}`}
                                />
                              );
                            })}
                            {dayEvents.length > 3 && (
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            )}
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

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {events
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .slice(0, 10)
              .map((event) => {
                const colorConfig = getColorConfig(event.color);
                return (
                  <div key={event.id} className={`p-4 rounded-lg border ${colorConfig.bg} ${colorConfig.border}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${colorConfig.value} text-white`}>
                            {format(event.date, 'MMM d')}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {event.category}
                          </Badge>
                          {event.reminder && (
                            <Badge variant="outline" className="text-xs text-amber-600">
                              <Bell className="h-3 w-3 mr-1" />
                              {event.reminderTime}m
                            </Badge>
                          )}
                        </div>
                        <h3 className={`font-semibold ${colorConfig.text} mb-1`}>
                          {event.title}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          {event.time && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {event.time}
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <span>📍</span>
                              {event.location}
                            </div>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetailsDialog(event)}
                          className="h-8 w-8 p-0"
                          title="View Details"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(event)}
                          className="h-8 w-8 p-0"
                          title="Edit Event"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteEvent(event.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          title="Delete Event"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Event Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? 'Edit Event' : 'Add New Event'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder="Enter event title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Enter event description (optional)"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={eventForm.time}
                  onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={eventForm.category} onValueChange={(value) => setEventForm({ ...eventForm, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                placeholder="Enter event location (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color Tag</Label>
              <Select value={eventForm.color} onValueChange={(value) => setEventForm({ ...eventForm, color: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a color" />
                </SelectTrigger>
                <SelectContent>
                  {eventColors.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${color.value}`} />
                        {color.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="reminder"
                  checked={eventForm.reminder}
                  onCheckedChange={(checked) => setEventForm({ ...eventForm, reminder: checked })}
                />
                <Label htmlFor="reminder">Set Reminder</Label>
              </div>
              
              {eventForm.reminder && (
                <div className="space-y-2">
                  <Label htmlFor="reminderTime">Remind me</Label>
                  <Select value={eventForm.reminderTime} onValueChange={(value) => setEventForm({ ...eventForm, reminderTime: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reminder time" />
                    </SelectTrigger>
                    <SelectContent>
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

            {selectedDate && !editingEvent && (
              <Alert>
                <CalendarIcon className="h-4 w-4" />
                <AlertDescription>
                  Event will be added to: {format(selectedDate, 'MMMM d, yyyy')}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={editingEvent ? handleEditEvent : handleAddEvent}>
              {editingEvent ? 'Update Event' : 'Add Event'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Event Details
            </DialogTitle>
          </DialogHeader>
          {viewingEvent && (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground mb-2">{viewingEvent.title}</h2>
                <div className="flex justify-center gap-2 mb-4">
                  <Badge className={`${getColorConfig(viewingEvent.color).value} text-white`}>
                    {format(viewingEvent.date, 'EEEE, MMMM d, yyyy')}
                  </Badge>
                  <Badge variant="outline">{viewingEvent.category}</Badge>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                {viewingEvent.time && (
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground">Time</Label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{viewingEvent.time}</span>
                    </div>
                  </div>
                )}
                
                {viewingEvent.location && (
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground">Location</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">📍</span>
                      <span className="text-sm">{viewingEvent.location}</span>
                    </div>
                  </div>
                )}
              </div>

              {viewingEvent.description && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                  <p className="text-sm text-foreground bg-muted p-3 rounded-md">
                    {viewingEvent.description}
                  </p>
                </div>
              )}

              {viewingEvent.reminder && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Reminder</Label>
                  <div className="flex items-center gap-2 text-sm">
                    <Bell className="h-4 w-4 text-amber-600" />
                    <span>Set for {viewingEvent.reminderTime} minutes before</span>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDetailsOpen(false)}
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    openEditDialog(viewingEvent);
                  }}
                  className="gap-2"
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
                  className="gap-2"
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
  );
}