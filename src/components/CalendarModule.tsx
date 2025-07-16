import React, { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  description?: string;
  color: string;
}

const eventColors = [
  { name: 'Blue', value: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
  { name: 'Green', value: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50' },
  { name: 'Purple', value: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50' },
  { name: 'Orange', value: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50' },
  { name: 'Red', value: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
  { name: 'Pink', value: 'bg-pink-500', text: 'text-pink-700', bg: 'bg-pink-50' },
];

export default function CalendarModule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([
    {
      id: '1',
      title: 'Parent-Teacher Conference',
      date: new Date(),
      description: 'Quarterly parent-teacher meetings',
      color: 'bg-blue-500'
    },
    {
      id: '2',
      title: 'School Sports Day',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      description: 'Annual athletics competition',
      color: 'bg-green-500'
    }
  ]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    color: 'bg-blue-500'
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
      date: selectedDate,
      color: eventForm.color
    };

    setEvents([...events, newEvent]);
    resetForm();
  };

  const handleEditEvent = () => {
    if (!editingEvent || !eventForm.title.trim()) return;

    setEvents(events.map(event => 
      event.id === editingEvent.id 
        ? { ...event, title: eventForm.title, description: eventForm.description, color: eventForm.color }
        : event
    ));
    resetForm();
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents(events.filter(event => event.id !== eventId));
  };

  const resetForm = () => {
    setEventForm({ title: '', description: '', color: 'bg-blue-500' });
    setEditingEvent(null);
    setIsDialogOpen(false);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      description: event.description || '',
      color: event.color
    });
    setIsDialogOpen(true);
  };

  const openAddDialog = (date?: Date) => {
    setSelectedDate(date || new Date());
    setEditingEvent(null);
    setEventForm({ title: '', description: '', color: 'bg-blue-500' });
    setIsDialogOpen(true);
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
                  <div key={event.id} className={`p-3 rounded-lg border ${colorConfig.bg}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`${colorConfig.value} text-white`}>
                            {format(event.date, 'MMM d')}
                          </Badge>
                          <h3 className={`font-semibold ${colorConfig.text}`}>
                            {event.title}
                          </h3>
                        </div>
                        {event.description && (
                          <p className="text-sm text-muted-foreground">{event.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(event)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteEvent(event.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
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

            {selectedDate && !editingEvent && (
              <div className="text-sm text-muted-foreground">
                Event will be added to: {format(selectedDate, 'MMMM d, yyyy')}
              </div>
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
    </div>
  );
}