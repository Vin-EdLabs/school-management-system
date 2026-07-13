import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Loader2, MapPinOff, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
  formDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
} from '@/components/ui/dialog';
import {
  estimateWalkMinutes,
  formatDistanceMeters,
  haversineDistanceMeters,
} from '@/utils/haversine';

export type OutsideZoneMapData = {
  teacherLat: number;
  teacherLng: number;
  schoolLat: number;
  schoolLng: number;
  radiusMeters: number;
  /** Server-reported distance; client recalculates for display. */
  distanceMeters?: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: OutsideZoneMapData | null;
  busy?: boolean;
  onTryAgain: () => void;
};

const youIcon = L.divIcon({
  className: '',
  html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
    <div style="background:#dc2626;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25);margin-bottom:4px;">You are here</div>
    <div style="width:14px;height:14px;border-radius:50%;background:#dc2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);"></div>
  </div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

const schoolIcon = L.divIcon({
  className: '',
  html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
    <div style="background:#059669;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25);margin-bottom:4px;">School</div>
    <div style="width:14px;height:14px;border-radius:50%;background:#059669;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);"></div>
  </div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

function FitBothMarkers({
  teacher,
  school,
}: {
  teacher: [number, number];
  school: [number, number];
}) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([teacher, school]);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
    // Leaflet needs a tick after dialog animation / size settle
    const t = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
    }, 200);
    return () => window.clearTimeout(t);
  }, [map, teacher, school]);
  return null;
}

/**
 * Shown only when check-in is rejected for outside_zone.
 * Map mounts after the dialog is open to avoid zero-size Leaflet render.
 */
const OutsideZoneMapModal: React.FC<Props> = ({
  open,
  onOpenChange,
  data,
  busy,
  onTryAgain,
}) => {
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!open || !data) {
      setMapReady(false);
      return;
    }
    // Wait until dialog is painted before mounting MapContainer
    const t = window.setTimeout(() => setMapReady(true), 80);
    return () => {
      window.clearTimeout(t);
      setMapReady(false);
    };
  }, [open, data]);

  const distance = useMemo(() => {
    if (!data) return 0;
    return Math.round(
      haversineDistanceMeters(data.teacherLat, data.teacherLng, data.schoolLat, data.schoolLng)
    );
  }, [data]);

  const infoLine = useMemo(() => {
    if (!data) return '';
    const walk = estimateWalkMinutes(distance);
    return `You are ${formatDistanceMeters(distance)} away · ~${walk} min walk · School zone: ${data.radiusMeters}m`;
  }, [data, distance]);

  const teacherPos: [number, number] | null = data
    ? [data.teacherLat, data.teacherLng]
    : null;
  const schoolPos: [number, number] | null = data
    ? [data.schoolLat, data.schoolLng]
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${formDialogContentClass} sm:max-w-lg`}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              <MapPinOff className="h-4 w-4" />
            </span>
            Outside School Zone
          </DialogTitle>
          <DialogDescription>
            You are outside the school GPS zone. Move closer to campus, then try again.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className={`${detailDialogBodyClass} space-y-3`}>
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50 px-3 py-2.5 text-sm text-rose-900 dark:text-rose-100 font-medium text-center">
            {infoLine || 'Calculating distance…'}
          </div>

          <div className="h-[280px] sm:h-[360px] w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 relative z-0">
            {mapReady && teacherPos && schoolPos ? (
              <MapContainer
                center={teacherPos}
                zoom={15}
                className="h-full w-full"
                scrollWheelZoom={false}
                attributionControl
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBothMarkers teacher={teacherPos} school={schoolPos} />
                <Circle
                  center={schoolPos}
                  radius={data!.radiusMeters}
                  pathOptions={{
                    color: '#059669',
                    fillColor: '#10b981',
                    fillOpacity: 0.12,
                    weight: 2,
                  }}
                />
                <Polyline
                  positions={[teacherPos, schoolPos]}
                  pathOptions={{
                    color: '#64748b',
                    weight: 2,
                    dashArray: '8 8',
                    opacity: 0.85,
                  }}
                />
                <Marker position={teacherPos} icon={youIcon}>
                  <Popup>You are here</Popup>
                </Marker>
                <Marker position={schoolPos} icon={schoolIcon}>
                  <Popup>School</Popup>
                </Marker>
              </MapContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Preparing map…
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter className={`${detailDialogFooterClass} flex-col sm:flex-row gap-2 sm:justify-end`}>
          <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            className="rounded-xl w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
            disabled={busy}
            onClick={() => {
              onOpenChange(false);
              onTryAgain();
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Navigation className="h-4 w-4 mr-2" />}
            Try Again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OutsideZoneMapModal;
