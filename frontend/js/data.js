/**
 * RideMatch — Nearby Driver Matching System
 * Initial Mock Data & Cell Graph Definitions
 *
 * This file serves as the canonical initial dataset and geographical cell definitions.
 * It strictly adheres to the project requirements:
 * 7 initial drivers with exact IDs, Names, Cells, ETAs, and Statuses.
 */

// Initial Canonical Driver Dataset
const INITIAL_DRIVERS = [
    {
        id: "101",
        name: "Aarav",
        cell: "H12",
        eta: 3,
        status: "AVAILABLE", // AVAILABLE or BOOKED
        rating: 4.9,
        vehicle: "Sedan • DL 01 AB 1234",
        distanceKm: 0.8
    },
    {
        id: "102",
        name: "Riya",
        cell: "H11",
        eta: 5,
        status: "AVAILABLE",
        rating: 4.8,
        vehicle: "Hatchback • DL 02 CD 5678",
        distanceKm: 1.4
    },
    {
        id: "103",
        name: "Kabir",
        cell: "H13",
        eta: 7,
        status: "AVAILABLE",
        rating: 4.7,
        vehicle: "Sedan • DL 03 EF 9012",
        distanceKm: 2.1
    },
    {
        id: "104",
        name: "Neha",
        cell: "H14",
        eta: 9,
        status: "AVAILABLE",
        rating: 4.9,
        vehicle: "SUV • DL 04 GH 3456",
        distanceKm: 2.7
    },
    {
        id: "105",
        name: "Dev",
        cell: "G12",
        eta: 4,
        status: "BOOKED",
        rating: 4.6,
        vehicle: "Hatchback • DL 05 IJ 7890",
        distanceKm: 1.1
    },
    {
        id: "106",
        name: "Om",
        cell: "J12",
        eta: 6,
        status: "AVAILABLE",
        rating: 4.8,
        vehicle: "Sedan • DL 06 KL 2345",
        distanceKm: 1.8
    },
    {
        id: "107",
        name: "Mira",
        cell: "C08",
        eta: 12,
        status: "AVAILABLE",
        rating: 4.9,
        vehicle: "EV Cruiser • DL 07 MN 6789",
        distanceKm: 4.5
    }
];

// Geographical Cell Definitions & Descriptions
const CELL_METADATA = {
    "H12": { name: "City Center Hub", zone: "Downtown Core", lat: 28.6139, lon: 77.2090, isDefault: true },
    "H11": { name: "West Commercial Plaza", zone: "Downtown West", lat: 28.6125, lon: 77.2010 },
    "H13": { name: "East Financial Square", zone: "Downtown East", lat: 28.6150, lon: 77.2170 },
    "H14": { name: "Tech Park Boulevard", zone: "Outer East", lat: 28.6175, lon: 77.2250 },
    "G12": { name: "North University Campus", zone: "North Sector", lat: 28.6220, lon: 77.2090 },
    "J12": { name: "South Medical Center", zone: "South Sector", lat: 28.6050, lon: 77.2090 },
    "C08": { name: "Airport & Cargo Terminals", zone: "Distant Outskirts", lat: 28.5562, lon: 77.1000 }
};

/**
 * Cell Neighborhood Graph (Spatial Adjacency List)
 * For H12 (default), the project requirement specifies: [H12, H11, H13, H14].
 * Other cells have logical neighborhoods configured so users can test searching from other points.
 */
const CELL_NEIGHBORHOODS = {
    "H12": ["H12", "H11", "H13", "H14"],
    "H11": ["H11", "H12", "G12"],
    "H13": ["H13", "H12", "H14"],
    "H14": ["H14", "H13"],
    "G12": ["G12", "H12"],
    "J12": ["J12", "H12"],
    "C08": ["C08"]
};

// Available Cells List for Dropdowns and Validation
const ALL_CELL_IDS = Object.keys(CELL_METADATA);

// Default Pickup Cell
const DEFAULT_PICKUP_CELL = "H12";

// Export / global attachment for browser script loading
if (typeof window !== "undefined") {
    window.INITIAL_DRIVERS = INITIAL_DRIVERS;
    window.CELL_METADATA = CELL_METADATA;
    window.CELL_NEIGHBORHOODS = CELL_NEIGHBORHOODS;
    window.ALL_CELL_IDS = ALL_CELL_IDS;
    window.DEFAULT_PICKUP_CELL = DEFAULT_PICKUP_CELL;
}
