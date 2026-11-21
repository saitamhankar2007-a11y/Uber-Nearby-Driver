/**
 * RideMatch — Interactive Conceptual Grid Manager (gridManager.js)
 *
 * Renders and handles interactions for the conceptual spatial cell grid.
 * - Displays cells in an intuitive urban layout (G12 North, H11-H14 Central Corridor, J12 South, C08 Airport).
 * - Visually renders passenger pickup pin.
 * - Highlights searched neighborhood cells with animated glow.
 * - Displays driver tokens situated inside their respective cells.
 * - Handles interactive cell clicking to change pickup location.
 */

class GridVisualizer {
    constructor(containerId, onCellSelectCallback) {
        this.container = document.getElementById(containerId);
        this.onCellSelect = onCellSelectCallback;
        this.currentPickupCell = DEFAULT_PICKUP_CELL;
        this.searchedCells = [];
        this.bestMatchDriverId = null;
        this.drivers = [];
    }

    /**
     * Update state and re-render the grid
     */
    update({ pickupCell, searchedCells = [], bestMatchDriverId = null, drivers = [] }) {
        if (pickupCell) this.currentPickupCell = pickupCell;
        this.searchedCells = searchedCells || [];
        this.bestMatchDriverId = bestMatchDriverId;
        if (drivers && drivers.length > 0) this.drivers = drivers;
        this.render();
    }

    /**
     * Renders the conceptual map layout
     */
    render() {
        if (!this.container) return;

        // Group drivers by cell
        const driversByCell = {};
        for (const cellId of ALL_CELL_IDS) {
            driversByCell[cellId] = [];
        }
        for (const driver of this.drivers) {
            if (driversByCell[driver.cell]) {
                driversByCell[driver.cell].push(driver);
            }
        }

        const renderCellCard = (cellId) => {
            const meta = CELL_METADATA[cellId] || { name: "Sector", zone: "Zone" };
            const isPickup = cellId === this.currentPickupCell;
            const isSearched = this.searchedCells.includes(cellId);
            const residentDrivers = driversByCell[cellId] || [];

            let cellClass = "grid-cell-card";
            if (isPickup) cellClass += " is-pickup";
            if (isSearched) cellClass += " is-searched";

            // Render drivers inside this cell
            const driversHtml = residentDrivers.map(d => {
                const isBestMatch = this.bestMatchDriverId && String(d.id) === String(this.bestMatchDriverId);
                const statusClass = d.status === "AVAILABLE" ? "badge-available" : "badge-booked";
                return `
                    <div class="cell-driver-chip ${statusClass} ${isBestMatch ? 'is-best-match' : ''}" title="${d.name} (${d.status}, ETA: ${d.eta}m)">
                        <span class="driver-status-dot"></span>
                        <span class="driver-chip-name">${d.name}</span>
                        <span class="driver-chip-eta">${d.eta}m</span>
                        ${isBestMatch ? '<span class="best-badge-star" title="Optimal Match">★</span>' : ''}
                    </div>
                `;
            }).join("");

            return `
                <div class="${cellClass}" data-cell="${cellId}" tabindex="0" role="button" aria-label="Select Cell ${cellId}">
                    <div class="cell-header">
                        <div class="cell-id-badge">
                            <span class="cell-code">${cellId}</span>
                            ${isPickup ? '<span class="pickup-pill"><i class="icon-pin">📍</i> PICKUP</span>' : ''}
                            ${!isPickup && isSearched ? '<span class="searched-pill">NEARBY</span>' : ''}
                        </div>
                        <span class="cell-zone-tag">${meta.zone}</span>
                    </div>
                    <div class="cell-name">${meta.name}</div>
                    
                    <div class="cell-drivers-container">
                        <div class="cell-drivers-label">
                            <span>Resident Drivers (${residentDrivers.length})</span>
                        </div>
                        <div class="cell-driver-chips">
                            ${residentDrivers.length > 0 ? driversHtml : '<span class="no-driver-text">No drivers stationed</span>'}
                        </div>
                    </div>
                </div>
            `;
        };

        // Urban grid layout structure
        this.container.innerHTML = `
            <div class="conceptual-grid-layout">
                <!-- Grid legend & interactive tip -->
                <div class="grid-legend-bar">
                    <div class="legend-items">
                        <span class="legend-item"><span class="legend-box pickup-box"></span> Selected Pickup</span>
                        <span class="legend-item"><span class="legend-box searched-box"></span> Searched Neighborhood</span>
                        <span class="legend-item"><span class="legend-dot dot-avail"></span> Available Driver</span>
                        <span class="legend-item"><span class="legend-dot dot-busy"></span> Booked Driver</span>
                    </div>
                    <div class="legend-tip">
                        <span>💡 Tip: Click any cell to test nearby search from that location</span>
                    </div>
                </div>

                <!-- City Grid Canvas -->
                <div class="city-spatial-canvas">
                    <!-- North Row: G12 -->
                    <div class="grid-row row-north">
                        <div class="grid-cell-spacer"></div>
                        <div class="grid-cell-wrapper">${renderCellCard("G12")}</div>
                        <div class="grid-cell-spacer"></div>
                        <div class="grid-cell-spacer"></div>
                    </div>

                    <!-- Connective roads visualizer -->
                    <div class="road-connector-v road-g12-h12">
                        <span class="road-label">North Corridor (4 min)</span>
                    </div>

                    <!-- Central Corridor Row: H11 - H12 - H13 - H14 -->
                    <div class="grid-row row-central">
                        <div class="grid-cell-wrapper">${renderCellCard("H11")}</div>
                        <div class="grid-cell-wrapper">${renderCellCard("H12")}</div>
                        <div class="grid-cell-wrapper">${renderCellCard("H13")}</div>
                        <div class="grid-cell-wrapper">${renderCellCard("H14")}</div>
                    </div>

                    <!-- Connective roads visualizer -->
                    <div class="road-connector-v road-h12-j12">
                        <span class="road-label">South Parkway (3 min)</span>
                    </div>

                    <!-- South Row: J12 -->
                    <div class="grid-row row-south">
                        <div class="grid-cell-spacer"></div>
                        <div class="grid-cell-wrapper">${renderCellCard("J12")}</div>
                        <div class="grid-cell-spacer"></div>
                        <div class="grid-cell-spacer"></div>
                    </div>

                    <!-- Outlying Sector: C08 -->
                    <div class="outlying-sector-container">
                        <div class="outlying-header">
                            <span class="outlying-badge">SUBURB / PERIPHERY ZONE</span>
                            <span class="outlying-distance">Distance from H12 ~ 12 min road travel</span>
                        </div>
                        <div class="grid-cell-wrapper">${renderCellCard("C08")}</div>
                    </div>
                </div>
            </div>
        `;

        // Attach click listeners to cells
        const cellCards = this.container.querySelectorAll(".grid-cell-card");
        cellCards.forEach(card => {
            card.addEventListener("click", () => {
                const selectedCell = card.getAttribute("data-cell");
                if (selectedCell && this.onCellSelect) {
                    this.onCellSelect(selectedCell);
                }
            });

            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const selectedCell = card.getAttribute("data-cell");
                    if (selectedCell && this.onCellSelect) {
                        this.onCellSelect(selectedCell);
                    }
                }
            });
        });
    }
}

// Attach globally
if (typeof window !== "undefined") {
    window.GridVisualizer = GridVisualizer;
}
