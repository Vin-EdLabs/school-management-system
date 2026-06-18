export const TRANSPORT_DEFAULT_CENTER: [number, number] = [5.6037, -0.187];
export const TRANSPORT_DEFAULT_ZOOM = 15;
export const TRANSPORT_MAP_BOUNDS: [[number, number], [number, number]] = [[4.5, -3.5], [11.5, 1.5]];

export const TRANSPORT_MAP_TILES = {
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    label: 'Street detail',
  },
  voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &copy; OpenStreetMap',
    label: 'Clean map',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    label: 'Satellite',
  },
} as const;

export type TransportMapStyle = keyof typeof TRANSPORT_MAP_TILES;
