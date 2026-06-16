import express from 'express';
import { query, getClient } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest, requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { getIO } from '../socket.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import { resolveActorFromRequest, withActor } from '../utils/auditResolve.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';

const router = express.Router();

function parseTransportDriverId(body: {
  transport_driver_id?: unknown;
  driver_id?: unknown;
  driver_staff_id?: unknown;
}): number | null {
  const raw = body.transport_driver_id ?? body.driver_id ?? body.driver_staff_id;
  if (raw == null || raw === '' || raw === 'none') return null;
  const id = parseInt(String(raw), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function parseVehicleId(raw: unknown): string | null {
  if (raw == null || raw === '' || raw === 'none') return null;
  return String(raw);
}

async function assertDriverVehicleAvailable(
  tenantId: number,
  vehicleId: string | null,
  excludeDriverId?: number
): Promise<string | null> {
  if (!vehicleId) return null;
  const vehicleCheck = await query(
    'SELECT id FROM vehicles WHERE id = $1 AND tenant_id = $2',
    [vehicleId, tenantId]
  );
  if (vehicleCheck.rows.length === 0) {
    return 'Selected vehicle was not found';
  }
  const conflict = await query(
    `SELECT full_name FROM transport_drivers
     WHERE tenant_id = $1 AND vehicle_id = $2 AND status = 'active'
       AND ($3::int IS NULL OR id <> $3)
     LIMIT 1`,
    [tenantId, vehicleId, excludeDriverId ?? null]
  );
  if (conflict.rows.length > 0) {
    return `This bus is already assigned to driver ${conflict.rows[0].full_name}`;
  }
  return null;
}

function emitTransportChanged(tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') {
  try {
    getIO().to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity: `transport-${entity}`,
      action,
      at: Date.now(),
    });
  } catch {
    /* noop */
  }
}

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
attachWritableTermGuard(router);

// ----------------------------------------------------
// 1. STATS OVERVIEW
// ----------------------------------------------------
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;

    const vehiclesRes = await query('SELECT COUNT(*) FROM vehicles WHERE tenant_id = $1', [tenantId]);
    const routesRes = await query("SELECT COUNT(*) FROM routes WHERE tenant_id = $1 AND status = 'active'", [tenantId]);
    const studentsRes = await query(
      `SELECT COUNT(DISTINCT st.student_id) 
       FROM student_transport st 
       JOIN routes r ON st.route_id = r.id 
       WHERE r.tenant_id = $1 AND st.status = 'active'`,
      [tenantId]
    );
    const driversRes = await query(
      `SELECT COUNT(*) FROM transport_drivers WHERE tenant_id = $1 AND status = 'active'`,
      [tenantId]
    );

    // Quick Stats
    const noDriverRes = await query(
      "SELECT COUNT(*) FROM routes WHERE tenant_id = $1 AND transport_driver_id IS NULL AND status = 'active'",
      [tenantId]
    );
    const maintenanceRes = await query(
      "SELECT COUNT(*) FROM vehicles WHERE tenant_id = $1 AND status = 'maintenance'",
      [tenantId]
    );
    const unassignedStudentsRes = await query(
      `SELECT COUNT(*) FROM students s 
       WHERE s.tenant_id = $1 
         AND COALESCE(s.enrollment_status, 'active') = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM student_transport st 
           WHERE st.student_id = s.id AND st.status = 'active'
         )`,
      [tenantId]
    );

    res.json({
      totalVehicles: parseInt(vehiclesRes.rows[0]?.count || '0', 10),
      totalActiveRoutes: parseInt(routesRes.rows[0]?.count || '0', 10),
      totalStudentsOnTransport: parseInt(studentsRes.rows[0]?.count || '0', 10),
      totalDriversAssigned: parseInt(driversRes.rows[0]?.count || '0', 10),
      routesWithNoDriver: parseInt(noDriverRes.rows[0]?.count || '0', 10),
      vehiclesUnderMaintenance: parseInt(maintenanceRes.rows[0]?.count || '0', 10),
      unassignedStudents: parseInt(unassignedStudentsRes.rows[0]?.count || '0', 10),
    });
  } catch (error) {
    console.error('Get transport stats error:', error);
    res.status(500).json({ error: 'Failed to fetch transport stats' });
  }
});

// ----------------------------------------------------
// 1b. SCHOOL LOCATION (hub for all routes on the map)
// ----------------------------------------------------
router.get('/school-location', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const result = await query(
      `SELECT school_name, logo_url, school_latitude, school_longitude, school_location_label, physical_address
       FROM school_settings WHERE tenant_id = $1`,
      [tenantId]
    );
    const row = result.rows[0];
    if (!row?.school_latitude || !row?.school_longitude) {
      return res.json(null);
    }
    res.json({
      school_name: row.school_name,
      logo_url: row.logo_url || null,
      latitude: parseFloat(String(row.school_latitude)),
      longitude: parseFloat(String(row.school_longitude)),
      label: row.school_name,
      address: row.physical_address || null,
    });
  } catch (error) {
    console.error('Get school location error:', error);
    res.status(500).json({ error: 'Failed to fetch school location' });
  }
});

router.patch('/school-location', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { latitude, longitude, label } = req.body ?? {};
    const lat = latitude != null ? parseFloat(String(latitude)) : NaN;
    const lng = longitude != null ? parseFloat(String(longitude)) : NaN;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Coordinates out of range' });
    }

    const locationLabel = label ? String(label).trim().slice(0, 255) : null;

    const result = await query(
      `UPDATE school_settings
       SET school_latitude = $1, school_longitude = $2,
           school_location_label = COALESCE($3, school_location_label),
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $4
       RETURNING school_name, logo_url, school_latitude, school_longitude, school_location_label, physical_address`,
      [lat, lng, locationLabel, tenantId]
    );

    if (result.rows.length === 0) {
      await query(
        `INSERT INTO school_settings (tenant_id, school_name, school_latitude, school_longitude, school_location_label)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, 'School', lat, lng, locationLabel || 'School']
      );
    }

    const row = result.rows[0] || { school_name: 'School', school_latitude: lat, school_longitude: lng, school_location_label: locationLabel, logo_url: null };
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'TRANSPORT_SCHOOL_LOCATION',
      entityId: 0,
      module: 'transport',
      summary: withActor(`School map location set: ${locationLabel || row.school_name}`, actor),
      details: { latitude: lat, longitude: lng, label: locationLabel },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTransportChanged(tenantId, 'school-location', 'updated');
    res.json({
      school_name: row.school_name,
      logo_url: row.logo_url || null,
      latitude: lat,
      longitude: lng,
      label: row.school_name,
      address: row.physical_address || null,
    });
  } catch (error) {
    console.error('Update school location error:', error);
    res.status(500).json({ error: 'Failed to save school location' });
  }
});

router.delete('/school-location', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    await query(
      `UPDATE school_settings
       SET school_latitude = NULL, school_longitude = NULL, school_location_label = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'DELETE',
      entityType: 'TRANSPORT_SCHOOL_LOCATION',
      entityId: 0,
      module: 'transport',
      summary: withActor('School map location removed', actor),
      details: {},
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTransportChanged(tenantId, 'school-location', 'deleted');
    res.json({ success: true });
  } catch (error) {
    console.error('Delete school location error:', error);
    res.status(500).json({ error: 'Failed to remove school location' });
  }
});

// ----------------------------------------------------
// 2. VEHICLES CRUD
// ----------------------------------------------------
router.get('/vehicles', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const result = await query(
      `SELECT v.*,
         t.full_name AS instructor_name,
         (SELECT td.full_name FROM transport_drivers td
          WHERE td.vehicle_id = v.id AND td.tenant_id = v.tenant_id AND td.status = 'active'
          ORDER BY td.updated_at DESC NULLS LAST, td.id DESC LIMIT 1) AS driver_name,
         (SELECT COUNT(*)::int FROM routes r
          WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id AND r.status = 'active') AS route_count,
         (SELECT STRING_AGG(r.name, ', ' ORDER BY r.name)
          FROM routes r WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id AND r.status = 'active') AS route_names,
         (SELECT COUNT(DISTINCT st.student_id)::int
          FROM student_transport st
          JOIN routes r ON st.route_id = r.id AND r.status = 'active'
          WHERE r.vehicle_id = v.id AND r.tenant_id = v.tenant_id AND st.status = 'active') AS student_count
       FROM vehicles v
       LEFT JOIN teachers t ON v.instructor_id = t.id
       WHERE v.tenant_id = $1
       ORDER BY v.vehicle_name ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List vehicles error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

router.post('/vehicles', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { plate_number, vehicle_name, capacity, model, color, status, instructor_id } = req.body;

    if (!plate_number || !vehicle_name || !capacity) {
      return res.status(400).json({ error: 'Plate number, vehicle name, and capacity are required' });
    }

    const result = await query(
      `INSERT INTO vehicles (tenant_id, plate_number, vehicle_name, capacity, model, color, status, instructor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [tenantId, plate_number.trim(), vehicle_name.trim(), parseInt(capacity, 10), model || null, color || null, status || 'active', instructor_id ? parseInt(instructor_id, 10) : null]
    );

    const vehicle = result.rows[0];
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'CREATE',
      entityType: 'TRANSPORT_VEHICLE',
      entityId: 0, // UUID string not numeric, pass placeholder or default
      module: 'transport',
      summary: withActor(`Vehicle added: ${vehicle.vehicle_name} (${vehicle.plate_number})`, actor),
      details: { vehicleId: vehicle.id, plateNumber: vehicle.plate_number },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTransportChanged(tenantId, 'vehicle', 'created');
    res.status(201).json(vehicle);
  } catch (error: any) {
    console.error('Create vehicle error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Vehicle with this plate number already exists' });
    }
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

router.put('/vehicles/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { plate_number, vehicle_name, capacity, model, color, status, instructor_id } = req.body;

    if (!plate_number || !vehicle_name || !capacity) {
      return res.status(400).json({ error: 'Plate number, vehicle name, and capacity are required' });
    }

    const result = await query(
      `UPDATE vehicles 
       SET plate_number = $1, vehicle_name = $2, capacity = $3, model = $4, color = $5, status = $6, instructor_id = $7
       WHERE id = $8 AND tenant_id = $9
       RETURNING *`,
      [plate_number.trim(), vehicle_name.trim(), parseInt(capacity, 10), model || null, color || null, status || 'active', instructor_id ? parseInt(instructor_id, 10) : null, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const vehicle = result.rows[0];
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'TRANSPORT_VEHICLE',
      entityId: 0,
      module: 'transport',
      summary: withActor(`Vehicle updated: ${vehicle.vehicle_name} (${vehicle.plate_number})`, actor),
      details: { vehicleId: vehicle.id, plateNumber: vehicle.plate_number },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTransportChanged(tenantId, 'vehicle', 'updated');
    res.json(vehicle);
  } catch (error: any) {
    console.error('Update vehicle error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Vehicle with this plate number already exists' });
    }
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

router.delete('/vehicles/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;

    const result = await query(
      `DELETE FROM vehicles WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const vehicle = result.rows[0];
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'DELETE',
      entityType: 'TRANSPORT_VEHICLE',
      entityId: 0,
      module: 'transport',
      summary: withActor(`Vehicle deleted: ${vehicle.vehicle_name} (${vehicle.plate_number})`, actor),
      details: { plateNumber: vehicle.plate_number },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTransportChanged(tenantId, 'vehicle', 'deleted');
    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

// ----------------------------------------------------
// 3. ROUTES & STOPS CRUD
// ----------------------------------------------------
router.get('/routes', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;

    const routesResult = await query(
      `SELECT r.*, v.plate_number, v.vehicle_name, drv.full_name AS driver_name, drv.phone AS driver_phone,
         drv.license_number AS driver_license,
         t.full_name AS instructor_name,
         (SELECT COUNT(*) FROM student_transport st WHERE st.route_id = r.id AND st.status = 'active') AS student_count
       FROM routes r
       LEFT JOIN vehicles v ON r.vehicle_id = v.id
       LEFT JOIN transport_drivers drv ON r.transport_driver_id = drv.id
       LEFT JOIN teachers t ON v.instructor_id = t.id
       WHERE r.tenant_id = $1
       ORDER BY r.name ASC`,
      [tenantId]
    );

    const routes = routesResult.rows;

    for (const r of routes) {
      const stopsResult = await query(
        `SELECT * FROM stops WHERE route_id = $1 ORDER BY order_index ASC`,
        [r.id]
      );
      r.stops = stopsResult.rows;
    }

    res.json(routes);
  } catch (error) {
    console.error('List routes error:', error);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

router.post('/routes', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  const client = await getClient();
  try {
    const tenantId = req.user!.tenantId!;
    const { name, time_of_day, vehicle_id, status, color, stops } = req.body;
    const driverId = parseTransportDriverId(req.body);
    let resolvedVehicleId = vehicle_id && vehicle_id !== 'none' ? vehicle_id : null;

    if (!name) {
      return res.status(400).json({ error: 'Route name is required' });
    }

    if (driverId) {
      const driverCheck = await query(
        'SELECT id, vehicle_id FROM transport_drivers WHERE id = $1 AND tenant_id = $2 AND status = $3',
        [driverId, tenantId, 'active']
      );
      if (driverCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Selected driver was not found. Add drivers under Transport → Drivers first.' });
      }
      if (!resolvedVehicleId && driverCheck.rows[0].vehicle_id) {
        resolvedVehicleId = driverCheck.rows[0].vehicle_id;
      }
    }

    await client.query('BEGIN');

    const routeRes = await client.query(
      `INSERT INTO routes (tenant_id, name, time_of_day, vehicle_id, transport_driver_id, status, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, name.trim(), time_of_day || 'both', resolvedVehicleId, driverId, status || 'active', color || '#3b82f6']
    );

    const route = routeRes.rows[0];

    if (Array.isArray(stops) && stops.length > 0) {
      for (const stop of stops) {
        await client.query(
          `INSERT INTO stops (route_id, name, latitude, longitude, order_index)
           VALUES ($1, $2, $3, $4, $5)`,
          [route.id, stop.name.trim(), parseFloat(stop.latitude), parseFloat(stop.longitude), parseInt(stop.order_index, 10)]
        );
      }
    }

    await client.query('COMMIT');

    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'CREATE',
      entityType: 'TRANSPORT_ROUTE',
      entityId: 0,
      module: 'transport',
      summary: withActor(`Route created: ${route.name}`, actor),
      details: { routeId: route.id, stopsCount: stops?.length || 0 },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTransportChanged(tenantId, 'route', 'created');
    res.status(201).json(route);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create route error:', error);
    res.status(500).json({ error: 'Failed to create route' });
  } finally {
    client.release();
  }
});

router.put('/routes/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  const client = await getClient();
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { name, time_of_day, vehicle_id, status, color, stops } = req.body;
    const driverId = parseTransportDriverId(req.body);
    let resolvedVehicleId = vehicle_id && vehicle_id !== 'none' ? vehicle_id : null;

    if (!name) {
      return res.status(400).json({ error: 'Route name is required' });
    }

    if (driverId) {
      const driverCheck = await query(
        'SELECT id, vehicle_id FROM transport_drivers WHERE id = $1 AND tenant_id = $2 AND status = $3',
        [driverId, tenantId, 'active']
      );
      if (driverCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Selected driver was not found. Add drivers under Transport → Drivers first.' });
      }
      if (!resolvedVehicleId && driverCheck.rows[0].vehicle_id) {
        resolvedVehicleId = driverCheck.rows[0].vehicle_id;
      }
    }

    await client.query('BEGIN');

    const routeRes = await client.query(
      `UPDATE routes 
       SET name = $1, time_of_day = $2, vehicle_id = $3, transport_driver_id = $4, status = $5, color = $6
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [name.trim(), time_of_day || 'both', resolvedVehicleId, driverId, status || 'active', color || '#3b82f6', id, tenantId]
    );

    if (routeRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Route not found' });
    }

    const route = routeRes.rows[0];

    // Replace stops
    await client.query('DELETE FROM stops WHERE route_id = $1', [id]);

    if (Array.isArray(stops) && stops.length > 0) {
      for (const stop of stops) {
        await client.query(
          `INSERT INTO stops (route_id, name, latitude, longitude, order_index)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, stop.name.trim(), parseFloat(stop.latitude), parseFloat(stop.longitude), parseInt(stop.order_index, 10)]
        );
      }
    }

    await client.query('COMMIT');

    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'TRANSPORT_ROUTE',
      entityId: 0,
      module: 'transport',
      summary: withActor(`Route updated: ${route.name}`, actor),
      details: { routeId: route.id, stopsCount: stops?.length || 0 },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTransportChanged(tenantId, 'route', 'updated');
    res.json(route);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update route error:', error);
    res.status(500).json({ error: 'Failed to update route' });
  } finally {
    client.release();
  }
});

/** Quick assign driver and/or vehicle without editing full route. */
router.patch('/routes/:id/assignments', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const body = req.body ?? {};
    const updates: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    let pendingDriverId: number | null | undefined;
    let pendingVehicleId: string | null | undefined;

    if ('transport_driver_id' in body || 'driver_id' in body || 'driver_staff_id' in body) {
      const driverId = parseTransportDriverId(body);
      if (driverId) {
        const driverCheck = await query(
          'SELECT id, vehicle_id FROM transport_drivers WHERE id = $1 AND tenant_id = $2 AND status = $3',
          [driverId, tenantId, 'active']
        );
        if (driverCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Selected driver was not found. Add drivers under Transport → Drivers first.' });
        }
        pendingDriverId = driverId;
        if (!('vehicle_id' in body) && driverCheck.rows[0].vehicle_id) {
          pendingVehicleId = driverCheck.rows[0].vehicle_id;
        }
      } else {
        pendingDriverId = null;
      }
      updates.push(`transport_driver_id = $${p++}`);
      params.push(driverId);
    }

    if ('vehicle_id' in body) {
      const raw = body.vehicle_id;
      pendingVehicleId = raw == null || raw === '' || raw === 'none' ? null : String(raw);
    }

    if (pendingVehicleId !== undefined) {
      if (pendingVehicleId) {
        const vehicleCheck = await query(
          'SELECT id FROM vehicles WHERE id = $1 AND tenant_id = $2',
          [pendingVehicleId, tenantId]
        );
        if (vehicleCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Selected vehicle was not found' });
        }
      }
      updates.push(`vehicle_id = $${p++}`);
      params.push(pendingVehicleId);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nothing to update. Send transport_driver_id (or driver_id) and/or vehicle_id.' });
    }

    params.push(id, tenantId);
    const result = await query(
      `UPDATE routes SET ${updates.join(', ')} WHERE id = $${p++} AND tenant_id = $${p} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const route = result.rows[0];
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'TRANSPORT_ROUTE',
      entityId: 0,
      module: 'transport',
      summary: withActor(`Route assignments updated: ${route.name}`, actor),
      details: { routeId: route.id, transportDriverId: route.transport_driver_id, vehicleId: route.vehicle_id },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTransportChanged(tenantId, 'route', 'updated');
    res.json(route);
  } catch (error) {
    console.error('Patch route assignments error:', error);
    res.status(500).json({ error: 'Failed to update route assignments' });
  }
});

router.delete('/routes/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;

    const result = await query(
      `DELETE FROM routes WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const route = result.rows[0];
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'DELETE',
      entityType: 'TRANSPORT_ROUTE',
      entityId: 0,
      module: 'transport',
      summary: withActor(`Route deleted: ${route.name}`, actor),
      details: { routeName: route.name },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTransportChanged(tenantId, 'route', 'deleted');
    res.json({ message: 'Route deleted successfully' });
  } catch (error) {
    console.error('Delete route error:', error);
    res.status(500).json({ error: 'Failed to delete route' });
  }
});

// ----------------------------------------------------
// 4. DRIVERS MANAGEMENT (Transport → Drivers registry)
// ----------------------------------------------------
router.get('/drivers', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const result = await query(
      `SELECT td.id, td.full_name, td.phone, td.license_number, td.email, td.notes, td.status,
         td.vehicle_id, td.created_at, td.updated_at,
         v.vehicle_name, v.plate_number,
         (SELECT STRING_AGG(r.name, ', ' ORDER BY r.name)
          FROM routes r WHERE r.transport_driver_id = td.id AND r.status = 'active') AS route_names,
         (SELECT COUNT(*)::int FROM routes r
          WHERE r.transport_driver_id = td.id AND r.status = 'active') AS route_count
       FROM transport_drivers td
       LEFT JOIN vehicles v ON td.vehicle_id = v.id
       WHERE td.tenant_id = $1
       ORDER BY td.full_name ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List drivers error:', error);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

router.post('/drivers', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { full_name, phone, license_number, email, notes, status, vehicle_id } = req.body;

    if (!full_name || !String(full_name).trim()) {
      return res.status(400).json({ error: 'Driver full name is required' });
    }

    const vehicleId = parseVehicleId(vehicle_id);
    const vehicleError = await assertDriverVehicleAvailable(tenantId, vehicleId);
    if (vehicleError) {
      return res.status(400).json({ error: vehicleError });
    }

    const result = await query(
      `INSERT INTO transport_drivers (tenant_id, full_name, phone, license_number, email, notes, status, vehicle_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenantId,
        String(full_name).trim(),
        phone ? String(phone).trim() : null,
        license_number ? String(license_number).trim() : null,
        email ? String(email).trim() : null,
        notes ? String(notes).trim() : null,
        status === 'inactive' ? 'inactive' : 'active',
        vehicleId,
      ]
    );

    const driver = result.rows[0];
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'CREATE',
      entityType: 'TRANSPORT_DRIVER',
      entityId: driver.id,
      module: 'transport',
      summary: withActor(`Transport driver added: ${driver.full_name}`, actor),
      details: { driverId: driver.id, fullName: driver.full_name },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTransportChanged(tenantId, 'driver', 'created');
    res.status(201).json(driver);
  } catch (error) {
    console.error('Create driver error:', error);
    res.status(500).json({ error: 'Failed to create driver' });
  }
});

router.put('/drivers/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const { full_name, phone, license_number, email, notes, status, vehicle_id } = req.body;
    const driverId = parseInt(id, 10);

    if (!full_name || !String(full_name).trim()) {
      return res.status(400).json({ error: 'Driver full name is required' });
    }

    const vehicleId = parseVehicleId(vehicle_id);
    const vehicleError = await assertDriverVehicleAvailable(tenantId, vehicleId, driverId);
    if (vehicleError) {
      return res.status(400).json({ error: vehicleError });
    }

    const result = await query(
      `UPDATE transport_drivers
       SET full_name = $1, phone = $2, license_number = $3, email = $4, notes = $5,
           status = $6, vehicle_id = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND tenant_id = $9
       RETURNING *`,
      [
        String(full_name).trim(),
        phone ? String(phone).trim() : null,
        license_number ? String(license_number).trim() : null,
        email ? String(email).trim() : null,
        notes ? String(notes).trim() : null,
        status === 'inactive' ? 'inactive' : 'active',
        vehicleId,
        driverId,
        tenantId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const driver = result.rows[0];
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'TRANSPORT_DRIVER',
      entityId: driver.id,
      module: 'transport',
      summary: withActor(`Transport driver updated: ${driver.full_name}`, actor),
      details: { driverId: driver.id, fullName: driver.full_name },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTransportChanged(tenantId, 'driver', 'updated');
    res.json(driver);
  } catch (error) {
    console.error('Update driver error:', error);
    res.status(500).json({ error: 'Failed to update driver' });
  }
});

router.delete('/drivers/:id', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const driverId = parseInt(id, 10);

    const result = await query(
      `DELETE FROM transport_drivers WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [driverId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const driver = result.rows[0];
    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'DELETE',
      entityType: 'TRANSPORT_DRIVER',
      entityId: driver.id,
      module: 'transport',
      summary: withActor(`Transport driver removed: ${driver.full_name}`, actor),
      details: { driverId: driver.id, fullName: driver.full_name },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTransportChanged(tenantId, 'driver', 'deleted');
    res.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('Delete driver error:', error);
    res.status(500).json({ error: 'Failed to delete driver' });
  }
});

// ----------------------------------------------------
// 5. STUDENTS TRANSPORT ENROLLMENT
// ----------------------------------------------------
router.get('/students', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const result = await query(
      `SELECT s.id AS id, s.first_name, s.last_name, s.passport_photo_url,
         c.class_name, c.level,
         st.id AS student_transport_id, st.enrolled_at, st.status AS transport_status,
         r.name AS route_name, r.id AS route_id,
         stop.name AS stop_name, stop.id AS stop_id,
         v.plate_number AS vehicle_plate, v.vehicle_name,
         drv.full_name AS driver_name
       FROM student_transport st
       JOIN students s ON st.student_id = s.id
       LEFT JOIN classes c ON s.class_assigned_id = c.id
       JOIN routes r ON st.route_id = r.id
       LEFT JOIN stops stop ON st.stop_id = stop.id
       LEFT JOIN vehicles v ON r.vehicle_id = v.id
       LEFT JOIN transport_drivers drv ON r.transport_driver_id = drv.id
       WHERE s.tenant_id = $1 AND st.status = 'active'
       ORDER BY s.first_name ASC, s.last_name ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List transport students error:', error);
    res.status(500).json({ error: 'Failed to fetch transport students' });
  }
});

router.post('/students/enroll', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  const client = await getClient();
  try {
    const tenantId = req.user!.tenantId!;
    const { student_id, route_id, stop_id } = req.body;

    if (!student_id || !route_id || !stop_id) {
      return res.status(400).json({ error: 'Student, route, and stop are required' });
    }

    // Verify student belongs to this tenant
    const studentCheck = await query('SELECT first_name, last_name FROM students WHERE id = $1 AND tenant_id = $2', [student_id, tenantId]);
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentName = `${studentCheck.rows[0].first_name} ${studentCheck.rows[0].last_name}`;

    await client.query('BEGIN');

    // Deactivate existing enrollments for this student (ensure single route active)
    await client.query(
      `UPDATE student_transport SET status = 'inactive' WHERE student_id = $1`,
      [student_id]
    );

    // Upsert new active enrollment
    const result = await client.query(
      `INSERT INTO student_transport (student_id, route_id, stop_id, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (student_id, route_id) 
       DO UPDATE SET stop_id = $3, status = 'active'
       RETURNING *`,
      [student_id, route_id, stop_id]
    );

    await client.query('COMMIT');

    const routeRes = await query('SELECT name FROM routes WHERE id = $1', [route_id]);
    const stopRes = await query('SELECT name FROM stops WHERE id = $1', [stop_id]);
    const routeName = routeRes.rows[0]?.name || 'Unknown Route';
    const stopName = stopRes.rows[0]?.name || 'Unknown Stop';

    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'STUDENT',
      entityId: student_id,
      module: 'transport',
      summary: withActor(`Student ${studentName} enrolled in transport route ${routeName} at stop ${stopName}`, actor),
      details: { studentId: student_id, routeId: route_id, stopId: stop_id },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTransportChanged(tenantId, 'student', 'updated');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Enroll student error:', error);
    res.status(500).json({ error: 'Failed to enroll student' });
  } finally {
    client.release();
  }
});

router.post('/students/remove', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { student_id, route_id } = req.body;

    if (!student_id || !route_id) {
      return res.status(400).json({ error: 'Student and route are required' });
    }

    const studentCheck = await query('SELECT first_name, last_name FROM students WHERE id = $1 AND tenant_id = $2', [student_id, tenantId]);
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentName = `${studentCheck.rows[0].first_name} ${studentCheck.rows[0].last_name}`;

    const result = await query(
      `UPDATE student_transport 
       SET status = 'inactive'
       WHERE student_id = $1 AND route_id = $2 AND status = 'active'
       RETURNING *`,
      [student_id, route_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student is not actively enrolled on this transport route' });
    }

    const routeRes = await query('SELECT name FROM routes WHERE id = $1', [route_id]);
    const routeName = routeRes.rows[0]?.name || 'Unknown';

    const actor = await resolveActorFromRequest(req);
    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'STUDENT',
      entityId: student_id,
      module: 'transport',
      summary: withActor(`Student ${studentName} removed from transport route ${routeName}`, actor),
      details: { studentId: student_id, routeId: route_id },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTransportChanged(tenantId, 'student', 'updated');
    res.json({ message: 'Student removed from transport successfully' });
  } catch (error) {
    console.error('Remove student from transport error:', error);
    res.status(500).json({ error: 'Failed to remove student from transport' });
  }
});

// Single student current active transport details
router.get('/student/:studentId', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { studentId } = req.params;

    const result = await query(
      `SELECT st.enrolled_at, st.status,
         r.name AS route_name, r.id AS route_id, r.time_of_day, r.color AS route_color,
         stop.name AS stop_name, stop.id AS stop_id, stop.latitude, stop.longitude,
         v.plate_number, v.vehicle_name,
         drv.full_name AS driver_name, drv.phone AS driver_phone
       FROM student_transport st
       JOIN routes r ON st.route_id = r.id
       LEFT JOIN stops stop ON st.stop_id = stop.id
       LEFT JOIN vehicles v ON r.vehicle_id = v.id
       LEFT JOIN transport_drivers drv ON r.transport_driver_id = drv.id
       WHERE r.tenant_id = $1 AND st.student_id = $2 AND st.status = 'active'`,
      [tenantId, parseInt(studentId, 10)]
    );

    if (result.rows.length === 0) {
      return res.json(null);
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get student transport details error:', error);
    res.status(500).json({ error: 'Failed to fetch student transport details' });
  }
});

export default router;
