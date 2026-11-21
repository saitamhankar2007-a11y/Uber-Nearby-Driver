/**
 * RideMatch — API Service Layer (apiService.js)
 *
 * Provides a clean abstraction between UI rendering and backend data operations.
 * Operates in two modes:
 * 1. Mock Mode (USE_MOCK_API = true): Uses local in-memory DSA instances (SpatialGrid, MinHeap, HashTable).
 * 2. Live Java Mode (USE_MOCK_API = false): Issues standard HTTP fetch requests to Java REST API.
 * 
 * Endpoints simulated / targeted:
 * - GET  /api/drivers
 * - GET  /api/nearby?cell={cell}
 * - GET  /api/match?cell={cell}
 * - POST /api/assign?id={id}&cell={cell}
 * - POST /api/reset
 * - POST /api/drivers (Driver Management)
 * - PUT  /api/drivers/{id}
 * - DELETE /api/drivers/{id}
 */

class ApiService {
    constructor() {
        // Mode toggle: Set to false when connecting to the Spring Boot / Java REST backend
        this.USE_MOCK_API = true;
        this.API_BASE_URL = "http://localhost:8080/api";

        // Internal Mock Database & DSA State
        this.driverTable = new DriverHashTable();
        this.spatialGrid = new SpatialGridManager(CELL_NEIGHBORHOODS);
        this.rideHistory = [];
        this.activeRidesCount = 0;

        // Initialize state with canonical dataset
        this.initMockData();
    }

    /**
     * Initializes or resets mock data to canonical starting dataset
     */
    initMockData() {
        this.driverTable.clear();
        this.rideHistory = [];
        this.activeRidesCount = 0;

        // Deep copy INITIAL_DRIVERS to ensure immutability of the source constant
        for (const driver of INITIAL_DRIVERS) {
            this.driverTable.set(driver.id, JSON.parse(JSON.stringify(driver)));
        }

        this.spatialGrid.indexDrivers(this.driverTable.getAll());
    }

    /**
     * Helper to simulate network latency for realistic UX feel
     */
    async simulateDelay(ms = 150) {
        if (!this.USE_MOCK_API) return;
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==========================================
    // 1. GET ALL DRIVERS
    // Future: GET /api/drivers
    // ==========================================
    async getDrivers() {
        if (!this.USE_MOCK_API) {
            const res = await fetch(`${this.API_BASE_URL}/drivers`);
            return await res.json();
        }

        await this.simulateDelay(100);
        const drivers = this.driverTable.getAll();
        return {
            status: "success",
            total: drivers.length,
            data: drivers
        };
    }

    // ==========================================
    // 2. SEARCH NEARBY DRIVERS
    // Future: GET /api/nearby?cell={cell}
    // ==========================================
    async searchNearby(pickupCell = DEFAULT_PICKUP_CELL) {
        if (!this.USE_MOCK_API) {
            const res = await fetch(`${this.API_BASE_URL}/nearby?cell=${encodeURIComponent(pickupCell)}`);
            return await res.json();
        }

        await this.simulateDelay(200);

        // Step 1: Validate pickup cell
        const normalizedCell = String(pickupCell).toUpperCase().trim();
        if (!ALL_CELL_IDS.includes(normalizedCell)) {
            return {
                status: "error",
                message: `Invalid pickup cell '${pickupCell}'. Available cells: ${ALL_CELL_IDS.join(", ")}`,
                pickupCell: normalizedCell,
                searchedCells: [],
                nearbyDrivers: [],
                availableDrivers: [],
                bestMatch: null
            };
        }

        // Step 2: Retrieve neighborhood cells via Spatial Grid
        const searchedCells = this.spatialGrid.getNearbyCells(normalizedCell);

        // Step 3: Retrieve all drivers residing in those searched cells
        const allDrivers = this.driverTable.getAll();
        const driversInSearchedCells = this.spatialGrid.getDriversInCells(searchedCells, allDrivers);

        // Step 4: Filter available candidates (Status === 'AVAILABLE')
        const availableCandidates = driversInSearchedCells.filter(d => d.status === "AVAILABLE");

        // Step 5: Rank candidates by ETA using MinHeap
        const minHeap = new DriverMinHeap();
        minHeap.buildHeap(availableCandidates);

        // Heap sort: extract in ascending order
        const rankedAvailableDrivers = minHeap.extractAllSorted();

        // Step 6: Identify best match (minimum ETA)
        const bestMatch = rankedAvailableDrivers.length > 0 ? rankedAvailableDrivers[0] : null;

        // Realistic response matching project specification
        return {
            status: "success",
            pickupCell: normalizedCell,
            searchedCells: searchedCells,
            totalFoundInCells: driversInSearchedCells.length,
            availableCount: availableCandidates.length,
            nearbyDrivers: driversInSearchedCells, // All drivers in cell (including booked)
            availableDrivers: rankedAvailableDrivers, // Ranked available candidates
            bestMatch: bestMatch,
            metadata: {
                algorithm: "SpatialPartitioning + BinaryMinHeap",
                heapSize: availableCandidates.length,
                timestamp: new Date().toISOString()
            }
        };
    }

    // ==========================================
    // 3. GET BEST MATCH DIRECTLY
    // Future: GET /api/match?cell={cell}
    // ==========================================
    async getBestMatch(pickupCell = DEFAULT_PICKUP_CELL) {
        const result = await this.searchNearby(pickupCell);
        return {
            status: result.status,
            pickupCell: result.pickupCell,
            bestMatch: result.bestMatch
        };
    }

    // ==========================================
    // 4. ASSIGN DRIVER (CREATE RIDE)
    // Future: POST /api/assign?id={id}&cell={cell}
    // ==========================================
    async assignDriver(driverId, pickupCell = DEFAULT_PICKUP_CELL) {
        if (!this.USE_MOCK_API) {
            const res = await fetch(`${this.API_BASE_URL}/assign?id=${driverId}&cell=${encodeURIComponent(pickupCell)}`, {
                method: "POST"
            });
            return await res.json();
        }

        await this.simulateDelay(200);

        const driver = this.driverTable.get(driverId);
        if (!driver) {
            return {
                status: "error",
                message: `Driver with ID ${driverId} not found.`
            };
        }

        // Prevent assigning a driver who is already BOOKED
        if (driver.status === "BOOKED") {
            return {
                status: "error",
                code: "DRIVER_ALREADY_BOOKED",
                message: `Driver ${driver.name} (ID: ${driver.id}) is already BOOKED. Cannot assign.`
            };
        }

        // Update driver status to BOOKED
        driver.status = "BOOKED";
        this.driverTable.set(driver.id, driver);
        this.spatialGrid.indexDrivers(this.driverTable.getAll());

        // Generate simulated Ride Record
        const rideId = `RIDE-${Math.floor(1000 + Math.random() * 9000)}`;
        const rideRecord = {
            rideId: rideId,
            pickupCell: pickupCell,
            driverId: driver.id,
            driverName: driver.name,
            driverCell: driver.cell,
            eta: driver.eta,
            vehicle: driver.vehicle,
            status: "DRIVER ASSIGNED",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            createdAt: new Date().toISOString()
        };

        this.rideHistory.unshift(rideRecord); // prepend latest
        this.activeRidesCount++;

        return {
            status: "success",
            message: `Ride booked successfully! Driver ${driver.name} (ID: ${driver.id}) has been assigned.`,
            ride: rideRecord,
            driver: driver
        };
    }

    // ==========================================
    // 5. RESET SIMULATION
    // Future: POST /api/reset
    // ==========================================
    async resetSimulation() {
        if (!this.USE_MOCK_API) {
            const res = await fetch(`${this.API_BASE_URL}/reset`, { method: "POST" });
            return await res.json();
        }

        await this.simulateDelay(150);
        this.initMockData();

        return {
            status: "success",
            message: "Simulation reset to initial canonical dataset.",
            defaultPickupCell: DEFAULT_PICKUP_CELL,
            totalDrivers: this.driverTable.size(),
            availableDrivers: this.driverTable.getAll().filter(d => d.status === "AVAILABLE").length,
            busyDrivers: this.driverTable.getAll().filter(d => d.status === "BOOKED").length,
            activeRides: this.activeRidesCount
        };
    }

    // ==========================================
    // 6. DRIVER MANAGEMENT CRUD OPERATIONS
    // Future: POST, PUT, DELETE /api/drivers
    // ==========================================
    async addDriver(driverData) {
        if (!this.USE_MOCK_API) {
            const res = await fetch(`${this.API_BASE_URL}/drivers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(driverData)
            });
            return await res.json();
        }

        await this.simulateDelay(150);

        // Validation
        const id = String(driverData.id).trim();
        if (!id) return { status: "error", message: "Driver ID is required." };
        if (this.driverTable.has(id)) {
            return { status: "error", message: `Driver with ID ${id} already exists.` };
        }
        if (!driverData.name || driverData.name.trim().length < 2) {
            return { status: "error", message: "Driver name must be at least 2 characters." };
        }
        const cell = String(driverData.cell).toUpperCase().trim();
        if (!ALL_CELL_IDS.includes(cell)) {
            return { status: "error", message: `Invalid cell. Must be one of: ${ALL_CELL_IDS.join(", ")}` };
        }
        const eta = parseInt(driverData.eta, 10);
        if (isNaN(eta) || eta <= 0) {
            return { status: "error", message: "ETA must be a positive integer in minutes." };
        }

        const newDriver = {
            id: id,
            name: driverData.name.trim(),
            cell: cell,
            eta: eta,
            status: driverData.status === "BOOKED" ? "BOOKED" : "AVAILABLE",
            rating: driverData.rating ? parseFloat(driverData.rating) : 4.8,
            vehicle: driverData.vehicle || "Standard Hatchback",
            distanceKm: (eta * 0.3).toFixed(1)
        };

        this.driverTable.set(id, newDriver);
        this.spatialGrid.indexDrivers(this.driverTable.getAll());

        return {
            status: "success",
            message: `Driver ${newDriver.name} (ID: ${newDriver.id}) added successfully.`,
            driver: newDriver
        };
    }

    async updateDriver(driverId, updates) {
        if (!this.USE_MOCK_API) {
            const res = await fetch(`${this.API_BASE_URL}/drivers/${driverId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });
            return await res.json();
        }

        await this.simulateDelay(150);

        const existing = this.driverTable.get(driverId);
        if (!existing) {
            return { status: "error", message: `Driver ID ${driverId} not found.` };
        }

        if (updates.cell && !ALL_CELL_IDS.includes(String(updates.cell).toUpperCase().trim())) {
            return { status: "error", message: `Invalid cell '${updates.cell}'.` };
        }

        const updatedDriver = {
            ...existing,
            name: updates.name ? updates.name.trim() : existing.name,
            cell: updates.cell ? String(updates.cell).toUpperCase().trim() : existing.cell,
            eta: updates.eta ? parseInt(updates.eta, 10) : existing.eta,
            status: updates.status || existing.status,
            vehicle: updates.vehicle || existing.vehicle,
            rating: updates.rating !== undefined ? parseFloat(updates.rating) : existing.rating
        };

        this.driverTable.set(driverId, updatedDriver);
        this.spatialGrid.indexDrivers(this.driverTable.getAll());

        return {
            status: "success",
            message: `Driver ${updatedDriver.name} updated successfully.`,
            driver: updatedDriver
        };
    }

    async deleteDriver(driverId) {
        if (!this.USE_MOCK_API) {
            const res = await fetch(`${this.API_BASE_URL}/drivers/${driverId}`, {
                method: "DELETE"
            });
            return await res.json();
        }

        await this.simulateDelay(150);

        if (!this.driverTable.has(driverId)) {
            return { status: "error", message: `Driver ID ${driverId} not found.` };
        }

        const removedDriver = this.driverTable.get(driverId);
        this.driverTable.delete(driverId);
        this.spatialGrid.indexDrivers(this.driverTable.getAll());

        return {
            status: "success",
            message: `Driver ${removedDriver.name} (ID: ${driverId}) removed.`,
            driver: removedDriver
        };
    }

    // ==========================================
    // 7. GET RIDE HISTORY & DASHBOARD STATS
    // ==========================================
    async getRideHistory() {
        await this.simulateDelay(50);
        return {
            status: "success",
            rides: [...this.rideHistory]
        };
    }

    async getSystemStats() {
        const drivers = this.driverTable.getAll();
        const available = drivers.filter(d => d.status === "AVAILABLE").length;
        const busy = drivers.filter(d => d.status === "BOOKED").length;

        return {
            totalDrivers: drivers.length,
            availableDrivers: available,
            busyDrivers: busy,
            activeRides: this.activeRidesCount
        };
    }
}

// Attach globally
if (typeof window !== "undefined") {
    window.ApiService = ApiService;
}
