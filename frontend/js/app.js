/**
 * RideMatch — Master Application Controller (app.js)
 * 
 * Coordinates:
 * - UI Navigation and Section Switching
 * - Dashboard Lifecycle & Statistics Sync
 * - Dynamic Search Execution with Visual Progress Animation
 * - Best Match Selection via Min-Heap Priority Queue
 * - Ride Assignment & Booking Workflow
 * - Reset Simulation to Exact Canonical Dataset
 * - Driver Management CRUD with Form Validation
 * - Ride History Logging
 * - Interactive Algorithm Insights & Live Heap Visualizer
 */

class RideMatchApp {
    constructor() {
        this.api = new ApiService();
        this.gridVisualizer = null;
        this.currentPickupCell = DEFAULT_PICKUP_CELL;
        this.currentSearchResults = null;
        this.activeSection = "dashboard";
        this.currentEditingDriverId = null;

        // Initialize when DOM is ready
        this.init();
    }

    async init() {
        this.bindNavigation();
        this.bindHeaderActions();
        this.bindPassengerPanel();
        this.bindDriverManagement();
        this.bindModals();

        // Initialize Interactive Grid Visualizer
        this.gridVisualizer = new GridVisualizer("cityGridContainer", (cellId) => {
            this.handleCellSelected(cellId);
        });

        // Initial Data Load
        await this.refreshAllViews();

        // Perform initial search for default cell H12 as requested
        await this.executeNearbySearch(false); // false = without prolonged delay on initial load
    }

    // ==========================================
    // 1. NAVIGATION & LAYOUT
    // ==========================================
    bindNavigation() {
        const navLinks = document.querySelectorAll(".sidebar-nav .nav-item");
        navLinks.forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const targetSection = link.getAttribute("data-section");
                this.switchSection(targetSection);
            });
        });

        // Mobile drawer toggle
        const menuToggle = document.getElementById("mobileMenuToggle");
        const sidebar = document.querySelector(".app-sidebar");
        const backdrop = document.getElementById("sidebarBackdrop");

        if (menuToggle && sidebar) {
            menuToggle.addEventListener("click", () => {
                sidebar.classList.toggle("open");
                if (backdrop) backdrop.classList.toggle("open");
            });
        }

        if (backdrop) {
            backdrop.addEventListener("click", () => {
                if (sidebar) sidebar.classList.remove("open");
                backdrop.classList.remove("open");
            });
        }
    }

    switchSection(sectionId) {
        this.activeSection = sectionId;

        // Update nav UI
        document.querySelectorAll(".sidebar-nav .nav-item").forEach(item => {
            if (item.getAttribute("data-section") === sectionId) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });

        // Switch main views
        document.querySelectorAll(".main-section").forEach(sec => {
            if (sec.id === `section-${sectionId}`) {
                sec.classList.remove("hidden");
            } else {
                sec.classList.add("hidden");
            }
        });

        // Close mobile drawer if open
        const sidebar = document.querySelector(".app-sidebar");
        const backdrop = document.getElementById("sidebarBackdrop");
        if (sidebar) sidebar.classList.remove("open");
        if (backdrop) backdrop.classList.remove("open");

        // Specific section hooks
        if (sectionId === "driver-management") {
            this.renderDriverManagementTable();
        } else if (sectionId === "ride-history") {
            this.renderRideHistoryTable();
        } else if (sectionId === "algorithm-insights") {
            this.renderAlgorithmInsightsVisualizer();
        } else if (sectionId === "driver-search") {
            this.renderDedicatedSearchWorkbench();
        }
    }

    // ==========================================
    // 2. HEADER ACTIONS & RESET
    // ==========================================
    bindHeaderActions() {
        const resetBtn = document.getElementById("resetSimulationBtn");
        if (resetBtn) {
            resetBtn.addEventListener("click", () => this.handleResetSimulation());
        }
    }

    async handleResetSimulation() {
        const res = await this.api.resetSimulation();
        this.currentPickupCell = DEFAULT_PICKUP_CELL;
        this.currentSearchResults = null;

        // Update pickup selector
        const select = document.getElementById("pickupCellSelect");
        if (select) select.value = DEFAULT_PICKUP_CELL;

        // Reset Ride Assignment Panel
        this.resetRideAssignmentPanel();

        // Refresh views
        await this.refreshAllViews();

        // Re-execute default search for H12
        await this.executeNearbySearch(false);

        this.showToast("Simulation reset to canonical initial dataset.", "info");
    }

    resetRideAssignmentPanel() {
        const panel = document.getElementById("rideAssignmentCard");
        if (panel) {
            panel.innerHTML = `
                <div class="empty-state-small">
                    <div class="empty-icon">🚗</div>
                    <h4>No Active Ride Assignment</h4>
                    <p>Select a pickup cell, find nearby drivers, and assign the best match to view live assignment details.</p>
                </div>
            `;
        }
    }

    // ==========================================
    // 3. PASSENGER RIDE REQUEST & SEARCH
    // ==========================================
    bindPassengerPanel() {
        // Pickup cell selector dropdown
        const cellSelect = document.getElementById("pickupCellSelect");
        if (cellSelect) {
            cellSelect.innerHTML = ALL_CELL_IDS.map(cellId => {
                const meta = CELL_METADATA[cellId];
                return `<option value="${cellId}" ${cellId === this.currentPickupCell ? "selected" : ""}>${cellId} — ${meta.name}</option>`;
            }).join("");

            cellSelect.addEventListener("change", (e) => {
                this.handleCellSelected(e.target.value);
            });
        }

        // Find Nearby Drivers Button
        const findDriversBtn = document.getElementById("findNearbyDriversBtn");
        if (findDriversBtn) {
            findDriversBtn.addEventListener("click", () => this.executeNearbySearch(true));
        }
    }

    handleCellSelected(cellId) {
        this.currentPickupCell = cellId;

        // Sync dropdown
        const select = document.getElementById("pickupCellSelect");
        if (select) select.value = cellId;

        const select2 = document.getElementById("searchWorkbenchCellSelect");
        if (select2) select2.value = cellId;

        // Re-run search
        this.executeNearbySearch(true);
    }

    /**
     * Executes the nearby driver matching pipeline
     * with visual progress animation
     */
    async executeNearbySearch(showAnimation = true) {
        const findBtn = document.getElementById("findNearbyDriversBtn");
        const animContainer = document.getElementById("searchAnimationContainer");

        if (findBtn) findBtn.disabled = true;

        if (showAnimation && animContainer) {
            animContainer.classList.remove("hidden");
            await this.runSearchAnimationSteps();
            animContainer.classList.add("hidden");
        }

        // Call Service API
        const result = await this.api.searchNearby(this.currentPickupCell);
        this.currentSearchResults = result;

        if (result.status === "error") {
            this.showToast(result.message, "error");
            if (findBtn) findBtn.disabled = false;
            return;
        }

        // Update statistics and search metrics
        this.updateSearchMetrics(result);

        // Update Grid
        const allDriversRes = await this.api.getDrivers();
        this.gridVisualizer.update({
            pickupCell: result.pickupCell,
            searchedCells: result.searchedCells,
            bestMatchDriverId: result.bestMatch ? result.bestMatch.id : null,
            drivers: allDriversRes.data
        });

        // Render Nearby Drivers Table
        this.renderNearbyDriversTable(result);

        // Render Best Match Panel
        this.renderBestMatchPanel(result.bestMatch, result.pickupCell);

        if (findBtn) findBtn.disabled = false;

        // If in dedicated search workbench view, also update that
        if (this.activeSection === "driver-search") {
            this.renderDedicatedSearchWorkbench();
        }
    }

    async runSearchAnimationSteps() {
        const steps = [
            "1. Spatial Grid: Querying neighborhood cells...",
            "2. Hash Buckets: Retrieving drivers in candidate cells...",
            "3. Availability Filter: Excluding booked / busy drivers...",
            "4. Priority Queue: Building Min-Heap & sorting by shortest ETA...",
            "5. Algorithm Complete: Optimal driver selected!"
        ];

        const textEl = document.getElementById("searchAnimationText");
        const barEl = document.getElementById("searchProgressBar");

        for (let i = 0; i < steps.length; i++) {
            if (textEl) textEl.textContent = steps[i];
            if (barEl) barEl.style.width = `${((i + 1) / steps.length) * 100}%`;
            await new Promise(r => setTimeout(r, 120)); // Fast and smooth
        }
    }

    updateSearchMetrics(result) {
        const searchedCellsEl = document.getElementById("metricSearchedCells");
        const totalFoundEl = document.getElementById("metricTotalFound");
        const availableFoundEl = document.getElementById("metricAvailableFound");
        const statusBadgeEl = document.getElementById("searchStatusBadge");

        if (searchedCellsEl) searchedCellsEl.textContent = result.searchedCells.length;
        if (totalFoundEl) totalFoundEl.textContent = result.totalFoundInCells;
        if (availableFoundEl) availableFoundEl.textContent = result.availableCount;

        if (statusBadgeEl) {
            if (result.availableCount > 0) {
                statusBadgeEl.innerHTML = `<span class="badge badge-success">✓ ${result.availableCount} Available</span>`;
            } else {
                statusBadgeEl.innerHTML = `<span class="badge badge-warning">⚠ No Available Drivers</span>`;
            }
        }

        const searchedListEl = document.getElementById("searchedCellsList");
        if (searchedListEl) {
            searchedListEl.innerHTML = result.searchedCells.map(c => `<span class="cell-tag">${c}</span>`).join(" ");
        }
    }

    // ==========================================
    // 4. NEARBY DRIVERS TABLE RENDERING
    // ==========================================
    renderNearbyDriversTable(result) {
        const tableBody = document.getElementById("nearbyDriversTableBody");
        const emptyState = document.getElementById("nearbyDriversEmptyState");
        const tableContainer = document.getElementById("nearbyDriversTableWrapper");

        if (!tableBody) return;

        // We display all drivers retrieved from the searched neighborhood cells,
        // highlighting available ones and clearly showing busy ones.
        const drivers = result.nearbyDrivers;

        if (!drivers || drivers.length === 0) {
            if (emptyState) emptyState.classList.remove("hidden");
            if (tableContainer) tableContainer.classList.add("hidden");
            return;
        }

        if (emptyState) emptyState.classList.add("hidden");
        if (tableContainer) tableContainer.classList.remove("hidden");

        // Sort available first, then by ETA
        const sortedDisplay = [...drivers].sort((a, b) => {
            if (a.status === "AVAILABLE" && b.status !== "AVAILABLE") return -1;
            if (a.status !== "AVAILABLE" && b.status === "AVAILABLE") return 1;
            return a.eta - b.eta;
        });

        tableBody.innerHTML = sortedDisplay.map(d => {
            const isAvailable = d.status === "AVAILABLE";
            const isBestMatch = result.bestMatch && String(result.bestMatch.id) === String(d.id);
            const statusBadge = isAvailable
                ? '<span class="badge badge-success">AVAILABLE</span>'
                : '<span class="badge badge-danger">BOOKED</span>';

            const actionBtn = isAvailable
                ? `<button class="btn btn-sm btn-primary assign-driver-btn" data-id="${d.id}" title="Assign Driver ${d.name}">Assign</button>`
                : `<button class="btn btn-sm btn-secondary" disabled title="Driver is currently booked">Busy</button>`;

            return `
                <tr class="${isBestMatch ? 'row-best-match' : ''}">
                    <td>
                        <div class="driver-id-cell">
                            <strong>#${d.id}</strong>
                            ${isBestMatch ? '<span class="best-pill">BEST MATCH</span>' : ''}
                        </div>
                    </td>
                    <td>
                        <div class="driver-name-cell">
                            <span class="avatar-letter">${d.name.charAt(0)}</span>
                            <div>
                                <span class="name-text">${d.name}</span>
                                <span class="vehicle-subtext">${d.vehicle || 'Standard'}</span>
                            </div>
                        </div>
                    </td>
                    <td><span class="cell-badge">${d.cell}</span></td>
                    <td><strong>${d.eta} mins</strong></td>
                    <td>${statusBadge}</td>
                    <td>${d.distanceKm ? d.distanceKm + ' km' : '—'}</td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        }).join("");

        // Attach assign button handlers
        tableBody.querySelectorAll(".assign-driver-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const driverId = btn.getAttribute("data-id");
                this.handleAssignDriver(driverId);
            });
        });
    }

    // ==========================================
    // 5. BEST MATCH PANEL RENDERING
    // ==========================================
    renderBestMatchPanel(bestMatch, pickupCell) {
        const container = document.getElementById("bestMatchCardContainer");
        if (!container) return;

        if (!bestMatch) {
            container.innerHTML = `
                <div class="empty-state-small">
                    <div class="empty-icon">⚠️</div>
                    <h4>No Available Drivers</h4>
                    <p>All drivers in the searched neighborhood are currently booked or out of service.</p>
                </div>
            `;
            return;
        }

        const distanceText = bestMatch.distanceKm ? `${bestMatch.distanceKm} km away` : "Nearby";
        const explanation = bestMatch.cell === pickupCell
            ? `Optimal candidate: Located in immediate pickup cell <strong>${pickupCell}</strong> with the lowest estimated arrival time of <strong>${bestMatch.eta} minutes</strong> (${distanceText}). Verified via Min-Heap Priority Queue extraction.`
            : `Optimal candidate: Stationed in adjacent cell <strong>${bestMatch.cell}</strong> with the lowest ETA of <strong>${bestMatch.eta} minutes</strong> (${distanceText}) among all available drivers.`;

        container.innerHTML = `
            <div class="best-match-content">
                <div class="best-match-header">
                    <div class="best-match-badge-tag">
                        <span class="star-icon">★</span> RECOMMENDED BEST MATCH
                    </div>
                    <span class="badge badge-success">READY TO DISPATCH</span>
                </div>

                <div class="best-match-profile">
                    <div class="profile-avatar">${bestMatch.name.charAt(0)}</div>
                    <div class="profile-details">
                        <h3 class="profile-name">${bestMatch.name} <span class="profile-id">#${bestMatch.id}</span></h3>
                        <div class="profile-meta">
                            <span>⭐ ${bestMatch.rating || '4.8'}</span> •
                            <span>📍 Cell ${bestMatch.cell}</span> •
                            <span>🚗 ${bestMatch.vehicle || 'Standard'}</span>
                        </div>
                    </div>
                    <div class="profile-eta">
                        <span class="eta-number">${bestMatch.eta}</span>
                        <span class="eta-unit">MINS ETA</span>
                    </div>
                </div>

                <div class="best-match-explanation">
                    <div class="explanation-title">
                        <span class="icon-brain">🧠</span> Why this driver was selected:
                    </div>
                    <p class="explanation-text">${explanation}</p>
                </div>

                <div class="best-match-footer">
                    <button id="assignBestMatchBtn" class="btn btn-primary btn-block btn-lg" data-id="${bestMatch.id}">
                        <span>🚗</span> Confirm & Assign Driver #${bestMatch.id} (${bestMatch.name})
                    </button>
                </div>
            </div>
        `;

        const assignBtn = document.getElementById("assignBestMatchBtn");
        if (assignBtn) {
            assignBtn.addEventListener("click", () => {
                this.handleAssignDriver(bestMatch.id);
            });
        }
    }

    // ==========================================
    // 6. ASSIGN DRIVER WORKFLOW
    // ==========================================
    async handleAssignDriver(driverId) {
        const res = await this.api.assignDriver(driverId, this.currentPickupCell);

        if (res.status === "error") {
            this.showToast(res.message, "error");
            return;
        }

        this.showToast(res.message, "success");

        // Render Ride Assignment Panel with live success confirmation
        this.renderRideAssignmentConfirmation(res.ride, res.driver);

        // Refresh stats & views
        await this.refreshAllViews();

        // Re-execute search to reflect driver status change (driver is now BOOKED and removed from available list)
        await this.executeNearbySearch(false);
    }

    renderRideAssignmentConfirmation(ride, driver) {
        const panel = document.getElementById("rideAssignmentCard");
        if (!panel) return;

        panel.innerHTML = `
            <div class="ride-confirmation-card">
                <div class="ride-confirmation-header">
                    <div class="success-indicator">
                        <span class="check-circle">✓</span>
                        <div>
                            <h4>Ride Confirmed & Dispatched</h4>
                            <span class="ride-id-tag">${ride.rideId}</span>
                        </div>
                    </div>
                    <span class="badge badge-success">DRIVER ASSIGNED</span>
                </div>

                <div class="ride-info-grid">
                    <div class="info-block">
                        <span class="info-label">Assigned Driver</span>
                        <span class="info-value"><strong>${driver.name}</strong> (#${driver.id})</span>
                    </div>
                    <div class="info-block">
                        <span class="info-label">Pickup Location</span>
                        <span class="info-value"><strong>Cell ${ride.pickupCell}</strong></span>
                    </div>
                    <div class="info-block">
                        <span class="info-label">Estimated Arrival</span>
                        <span class="info-value highlight-eta"><strong>${driver.eta} minutes</strong></span>
                    </div>
                    <div class="info-block">
                        <span class="info-label">Vehicle</span>
                        <span class="info-value">${driver.vehicle || 'Standard'}</span>
                    </div>
                    <div class="info-block">
                        <span class="info-label">Dispatch Time</span>
                        <span class="info-value">${ride.timestamp}</span>
                    </div>
                    <div class="info-block">
                        <span class="info-label">Driver Stationed At</span>
                        <span class="info-value">Cell ${driver.cell}</span>
                    </div>
                </div>

                <div class="ride-progress-simulation">
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill animated-stripes" style="width: 100%;"></div>
                    </div>
                    <div class="progress-labels">
                        <span>Dispatched from Cell ${driver.cell}</span>
                        <span>En route to Cell ${ride.pickupCell}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // 7. STATISTICS SYNCHRONIZATION
    // ==========================================
    async refreshStatistics() {
        const stats = await this.api.getSystemStats();

        const totalEl = document.getElementById("statTotalDrivers");
        const availableEl = document.getElementById("statAvailableDrivers");
        const busyEl = document.getElementById("statBusyDrivers");
        const activeRidesEl = document.getElementById("statActiveRides");

        if (totalEl) totalEl.textContent = stats.totalDrivers;
        if (availableEl) availableEl.textContent = stats.availableDrivers;
        if (busyEl) busyEl.textContent = stats.busyDrivers;
        if (activeRidesEl) activeRidesEl.textContent = stats.activeRides;
    }

    async refreshAllViews() {
        await this.refreshStatistics();
        const allDrivers = await this.api.getDrivers();

        // Update Grid visualizer drivers
        if (this.gridVisualizer) {
            this.gridVisualizer.update({
                pickupCell: this.currentPickupCell,
                searchedCells: this.currentSearchResults ? this.currentSearchResults.searchedCells : [],
                bestMatchDriverId: this.currentSearchResults && this.currentSearchResults.bestMatch ? this.currentSearchResults.bestMatch.id : null,
                drivers: allDrivers.data
            });
        }

        // Refresh section tables if active
        if (this.activeSection === "driver-management") {
            this.renderDriverManagementTable();
        } else if (this.activeSection === "ride-history") {
            this.renderRideHistoryTable();
        }
    }

    // ==========================================
    // 8. DRIVER MANAGEMENT CRUD
    // ==========================================
    bindDriverManagement() {
        const searchInput = document.getElementById("driverSearchInput");
        const statusFilter = document.getElementById("driverStatusFilter");
        const addDriverBtn = document.getElementById("addDriverBtn");

        if (searchInput) {
            searchInput.addEventListener("input", () => this.renderDriverManagementTable());
        }

        if (statusFilter) {
            statusFilter.addEventListener("change", () => this.renderDriverManagementTable());
        }

        if (addDriverBtn) {
            addDriverBtn.addEventListener("click", () => this.openAddDriverModal());
        }

        // Add Driver Form Submit
        const addDriverForm = document.getElementById("addDriverForm");
        if (addDriverForm) {
            addDriverForm.addEventListener("submit", (e) => this.handleSaveNewDriver(e));
        }

        // Edit Driver Form Submit
        const editDriverForm = document.getElementById("editDriverForm");
        if (editDriverForm) {
            editDriverForm.addEventListener("submit", (e) => this.handleSaveEditDriver(e));
        }

        // Populate cell dropdowns in forms
        ["newDriverCell", "editDriverCell"].forEach(elemId => {
            const selectEl = document.getElementById(elemId);
            if (selectEl) {
                selectEl.innerHTML = ALL_CELL_IDS.map(c => `<option value="${c}">${c} — ${CELL_METADATA[c].name}</option>`).join("");
            }
        });
    }

    async renderDriverManagementTable() {
        const tableBody = document.getElementById("driverManagementTableBody");
        const emptyState = document.getElementById("driverManagementEmptyState");
        if (!tableBody) return;

        const res = await this.api.getDrivers();
        let drivers = res.data || [];

        // Apply search query
        const query = (document.getElementById("driverSearchInput")?.value || "").toLowerCase().trim();
        if (query) {
            drivers = drivers.filter(d =>
                d.name.toLowerCase().includes(query) ||
                String(d.id).includes(query) ||
                d.cell.toLowerCase().includes(query)
            );
        }

        // Apply status filter
        const statusFilter = document.getElementById("driverStatusFilter")?.value || "ALL";
        if (statusFilter !== "ALL") {
            drivers = drivers.filter(d => d.status === statusFilter);
        }

        if (drivers.length === 0) {
            tableBody.innerHTML = "";
            if (emptyState) emptyState.classList.remove("hidden");
            return;
        }

        if (emptyState) emptyState.classList.add("hidden");

        tableBody.innerHTML = drivers.map(d => {
            const isAvail = d.status === "AVAILABLE";
            const badgeClass = isAvail ? "badge-success" : "badge-danger";

            return `
                <tr>
                    <td><strong>#${d.id}</strong></td>
                    <td>
                        <div class="driver-name-cell">
                            <span class="avatar-letter">${d.name.charAt(0)}</span>
                            <div>
                                <span class="name-text">${d.name}</span>
                                <span class="vehicle-subtext">${d.vehicle || 'Standard'}</span>
                            </div>
                        </div>
                    </td>
                    <td><span class="cell-badge">${d.cell}</span></td>
                    <td>${d.eta} mins</td>
                    <td><span class="badge ${badgeClass}">${d.status}</span></td>
                    <td>⭐ ${d.rating || '4.8'}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn btn-sm btn-outline edit-driver-btn" data-id="${d.id}">Edit</button>
                            <button class="btn btn-sm btn-danger-outline delete-driver-btn" data-id="${d.id}" data-name="${d.name}">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        // Attach action handlers
        tableBody.querySelectorAll(".edit-driver-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const driverId = btn.getAttribute("data-id");
                this.openEditDriverModal(driverId);
            });
        });

        tableBody.querySelectorAll(".delete-driver-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const driverId = btn.getAttribute("data-id");
                const driverName = btn.getAttribute("data-name");
                this.handleDeleteDriver(driverId, driverName);
            });
        });
    }

    openAddDriverModal() {
        const form = document.getElementById("addDriverForm");
        if (form) form.reset();
        this.openModal("addDriverModal");
    }

    async handleSaveNewDriver(e) {
        e.preventDefault();
        const id = document.getElementById("newDriverId").value.trim();
        const name = document.getElementById("newDriverName").value.trim();
        const cell = document.getElementById("newDriverCell").value;
        const eta = parseInt(document.getElementById("newDriverEta").value, 10);
        const status = document.getElementById("newDriverStatus").value;
        const vehicle = document.getElementById("newDriverVehicle").value.trim();

        const res = await this.api.addDriver({ id, name, cell, eta, status, vehicle });

        if (res.status === "error") {
            this.showToast(res.message, "error");
            return;
        }

        this.showToast(res.message, "success");
        this.closeModal("addDriverModal");
        await this.refreshAllViews();
        await this.executeNearbySearch(false);
    }

    async openEditDriverModal(driverId) {
        const res = await this.api.getDrivers();
        const driver = res.data.find(d => String(d.id) === String(driverId));
        if (!driver) return;

        this.currentEditingDriverId = driver.id;
        document.getElementById("editDriverIdDisplay").textContent = `#${driver.id}`;
        document.getElementById("editDriverName").value = driver.name;
        document.getElementById("editDriverCell").value = driver.cell;
        document.getElementById("editDriverEta").value = driver.eta;
        document.getElementById("editDriverStatus").value = driver.status;
        document.getElementById("editDriverVehicle").value = driver.vehicle || "";

        this.openModal("editDriverModal");
    }

    async handleSaveEditDriver(e) {
        e.preventDefault();
        if (!this.currentEditingDriverId) return;

        const name = document.getElementById("editDriverName").value.trim();
        const cell = document.getElementById("editDriverCell").value;
        const eta = parseInt(document.getElementById("editDriverEta").value, 10);
        const status = document.getElementById("editDriverStatus").value;
        const vehicle = document.getElementById("editDriverVehicle").value.trim();

        const res = await this.api.updateDriver(this.currentEditingDriverId, { name, cell, eta, status, vehicle });

        if (res.status === "error") {
            this.showToast(res.message, "error");
            return;
        }

        this.showToast(res.message, "success");
        this.closeModal("editDriverModal");
        await this.refreshAllViews();
        await this.executeNearbySearch(false);
    }

    async handleDeleteDriver(driverId, driverName) {
        if (!confirm(`Are you sure you want to remove driver ${driverName} (ID: #${driverId})?`)) {
            return;
        }

        const res = await this.api.deleteDriver(driverId);
        if (res.status === "error") {
            this.showToast(res.message, "error");
            return;
        }

        this.showToast(res.message, "info");
        await this.refreshAllViews();
        await this.executeNearbySearch(false);
    }

    // ==========================================
    // 9. RIDE HISTORY
    // ==========================================
    async renderRideHistoryTable() {
        const tableBody = document.getElementById("rideHistoryTableBody");
        const emptyState = document.getElementById("rideHistoryEmptyState");
        if (!tableBody) return;

        const res = await this.api.getRideHistory();
        const rides = res.rides || [];

        if (rides.length === 0) {
            tableBody.innerHTML = "";
            if (emptyState) emptyState.classList.remove("hidden");
            return;
        }

        if (emptyState) emptyState.classList.add("hidden");

        tableBody.innerHTML = rides.map(r => `
            <tr>
                <td><strong>${r.rideId}</strong></td>
                <td><span class="cell-badge">${r.pickupCell}</span></td>
                <td>
                    <div class="driver-name-cell">
                        <span class="avatar-letter">${r.driverName.charAt(0)}</span>
                        <div>
                            <span class="name-text">${r.driverName}</span>
                            <span class="vehicle-subtext">#${r.driverId}</span>
                        </div>
                    </div>
                </td>
                <td>${r.eta} mins</td>
                <td><span class="badge badge-success">${r.status}</span></td>
                <td>${r.timestamp}</td>
            </tr>
        `).join("");
    }

    // ==========================================
    // 10. ALGORITHM INSIGHTS VISUALIZER
    // ==========================================
    async renderAlgorithmInsightsVisualizer() {
        const heapVisContainer = document.getElementById("liveHeapVisualizer");
        if (!heapVisContainer) return;

        // Retrieve available drivers for current pickup cell
        const result = await this.api.searchNearby(this.currentPickupCell);
        const candidates = result.availableDrivers || [];

        if (candidates.length === 0) {
            heapVisContainer.innerHTML = `<p class="muted-text">No available drivers currently in neighborhood of ${this.currentPickupCell}.</p>`;
            return;
        }

        // Render binary heap array & tree representation
        heapVisContainer.innerHTML = `
            <div class="heap-vis-header">
                <span class="heap-vis-title">Active Priority Queue (Min-Heap of Available Candidates)</span>
                <span class="badge badge-info">Heap Size: ${candidates.length}</span>
            </div>
            
            <div class="heap-array-display">
                <div class="heap-array-label">Min-Heap Array Storage [0 ... ${candidates.length - 1}]:</div>
                <div class="heap-array-chips">
                    ${candidates.map((d, idx) => `
                        <div class="heap-array-slot ${idx === 0 ? 'is-root' : ''}">
                            <span class="slot-idx">[${idx}]</span>
                            <span class="slot-val">${d.name} (${d.eta}m)</span>
                            ${idx === 0 ? '<span class="root-pill">ROOT (MIN)</span>' : ''}
                        </div>
                    `).join("")}
                </div>
            </div>

            <div class="heap-tree-display">
                <div class="heap-tree-root">
                    <div class="tree-node root-node">
                        <span class="node-id">#${candidates[0].id}</span>
                        <span class="node-name">${candidates[0].name}</span>
                        <span class="node-eta">ETA: ${candidates[0].eta} min</span>
                        <span class="node-badge">BEST MATCH</span>
                    </div>
                </div>
                ${candidates.length > 1 ? `
                    <div class="tree-children-row">
                        ${candidates.slice(1, 3).map(c => `
                            <div class="tree-node child-node">
                                <span class="node-id">#${c.id}</span>
                                <span class="node-name">${c.name}</span>
                                <span class="node-eta">ETA: ${c.eta} min</span>
                            </div>
                        `).join("")}
                    </div>
                ` : ''}
                ${candidates.length > 3 ? `
                    <div class="tree-children-row row-level-2">
                        ${candidates.slice(3).map(c => `
                            <div class="tree-node child-node sub-child">
                                <span class="node-id">#${c.id}</span>
                                <span class="node-name">${c.name}</span>
                                <span class="node-eta">ETA: ${c.eta} min</span>
                            </div>
                        `).join("")}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // ==========================================
    // 11. DEDICATED SEARCH WORKBENCH
    // ==========================================
    renderDedicatedSearchWorkbench() {
        const select = document.getElementById("searchWorkbenchCellSelect");
        if (select && select.children.length === 0) {
            select.innerHTML = ALL_CELL_IDS.map(c => `<option value="${c}" ${c === this.currentPickupCell ? 'selected' : ''}>${c} — ${CELL_METADATA[c].name}</option>`).join("");
            select.addEventListener("change", (e) => {
                this.handleCellSelected(e.target.value);
            });
        }

        const runBtn = document.getElementById("workbenchRunSearchBtn");
        if (runBtn) {
            runBtn.onclick = () => this.executeNearbySearch(true);
        }

        // Display current search results in workbench
        if (this.currentSearchResults) {
            const resultBox = document.getElementById("workbenchResultDetails");
            if (resultBox) {
                resultBox.innerHTML = `
                    <div class="workbench-summary-cards">
                        <div class="wb-card">
                            <span class="wb-label">Target Pickup Cell</span>
                            <span class="wb-val">${this.currentSearchResults.pickupCell}</span>
                        </div>
                        <div class="wb-card">
                            <span class="wb-label">Searched Radius Cells</span>
                            <span class="wb-val">${this.currentSearchResults.searchedCells.join(", ")}</span>
                        </div>
                        <div class="wb-card">
                            <span class="wb-label">Candidates Evaluated</span>
                            <span class="wb-val">${this.currentSearchResults.totalFoundInCells} drivers</span>
                        </div>
                        <div class="wb-card">
                            <span class="wb-label">Min-Heap Best Match</span>
                            <span class="wb-val highlight-green">${this.currentSearchResults.bestMatch ? this.currentSearchResults.bestMatch.name + ' (' + this.currentSearchResults.bestMatch.eta + 'm)' : 'None'}</span>
                        </div>
                    </div>
                `;
            }
        }
    }

    // ==========================================
    // 12. MODAL CONTROLS & TOAST NOTIFICATIONS
    // ==========================================
    bindModals() {
        document.querySelectorAll(".modal-close-btn, .modal-backdrop").forEach(el => {
            el.addEventListener("click", () => {
                document.querySelectorAll(".app-modal").forEach(m => m.classList.remove("open"));
            });
        });
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add("open");
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove("open");
    }

    showToast(message, type = "info") {
        const container = document.getElementById("toastContainer");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = `toast-item toast-${type}`;

        const icons = {
            success: "✓",
            error: "✕",
            info: "ℹ",
            warning: "⚠"
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || "ℹ"}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add("show"), 10);

        // Auto remove
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// Start application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    window.app = new RideMatchApp();
});
