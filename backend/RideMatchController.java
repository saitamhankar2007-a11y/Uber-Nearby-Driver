package com.ridematch.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * RideMatch — Nearby Driver Matching System
 * Reference Java REST Controller & Matching Service
 * 
 * Demonstrates:
 * 1. Spatial Partitioning / Cell Neighborhood Query
 * 2. Hash Table Driver Lookup
 * 3. PriorityQueue (Min-Heap) for ETA Ranking
 * 4. JDBC / MySQL Integration
 */
@SpringBootApplication
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class RideMatchController {

    // Database Connection Settings for local XAMPP MySQL
    private static final String DB_URL = "jdbc:mysql://localhost:3306/ridematch_db?useSSL=false&serverTimezone=UTC";
    private static final String DB_USER = "root";
    private static final String DB_PASSWORD = "";

    public static void main(String[] args) {
        SpringApplication.run(RideMatchController.class, args);
    }

    private Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
    }

    // ==============================================================
    // 1. GET ALL DRIVERS: GET /api/drivers
    // ==============================================================
    @GetMapping("/drivers")
    public ResponseEntity<?> getAllDrivers() {
        List<Driver> drivers = new ArrayList<>();
        String sql = "SELECT * FROM drivers ORDER BY CAST(id AS UNSIGNED) ASC";

        try (Connection conn = getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {

            while (rs.next()) {
                drivers.add(mapDriver(rs));
            }

            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("total", drivers.size());
            response.put("data", drivers);
            return ResponseEntity.ok(response);

        } catch (SQLException e) {
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    // ==============================================================
    // 2. NEARBY DRIVER SEARCH: GET /api/nearby?cell=H12
    // Uses Spatial Neighborhood + Min-Heap (PriorityQueue)
    // ==============================================================
    @GetMapping("/nearby")
    public ResponseEntity<?> searchNearby(@RequestParam(defaultValue = "H12") String cell) {
        String pickupCell = cell.toUpperCase().trim();

        try (Connection conn = getConnection()) {
            // Step 1: Query adjacent neighborhood cells from database (Spatial Grid)
            List<String> searchedCells = new ArrayList<>();
            String neighborSql = "SELECT neighbor_cell_id FROM cell_neighbors WHERE cell_id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(neighborSql)) {
                stmt.setString(1, pickupCell);
                ResultSet rs = stmt.executeQuery();
                while (rs.next()) {
                    searchedCells.add(rs.getString("neighbor_cell_id"));
                }
            }

            if (searchedCells.isEmpty()) {
                searchedCells.add(pickupCell);
            }

            // Step 2: Retrieve all drivers residing in searched cells
            String inClause = searchedCells.stream().map(c -> "?").collect(Collectors.joining(","));
            String driverSql = "SELECT * FROM drivers WHERE cell_id IN (" + inClause + ")";
            List<Driver> allNearbyDrivers = new ArrayList<>();

            try (PreparedStatement stmt = conn.prepareStatement(driverSql)) {
                for (int i = 0; i < searchedCells.size(); i++) {
                    stmt.setString(i + 1, searchedCells.get(i));
                }
                ResultSet rs = stmt.executeQuery();
                while (rs.next()) {
                    allNearbyDrivers.add(mapDriver(rs));
                }
            }

            // Step 3: Filter AVAILABLE drivers only (Dev 105 is BOOKED -> excluded)
            List<Driver> availableDrivers = allNearbyDrivers.stream()
                    .filter(d -> "AVAILABLE".equalsIgnoreCase(d.getStatus()))
                    .collect(Collectors.toList());

            // Step 4: Min-Heap Ranking by ETA using Java PriorityQueue (Binary Heap)
            // PriorityQueue comparator compares ETA: (a, b) -> a.getEta() - b.getEta()
            PriorityQueue<Driver> minHeap = new PriorityQueue<>(Comparator.comparingInt(Driver::getEta));
            minHeap.addAll(availableDrivers);

            // Step 5: Extract drivers in sorted ascending ETA order
            List<Driver> rankedAvailable = new ArrayList<>();
            Driver bestMatch = minHeap.peek(); // Root element (O(1) peek)

            while (!minHeap.isEmpty()) {
                rankedAvailable.add(minHeap.poll()); // O(log M) extraction
            }

            // Step 6: Return formatted JSON response matching specification
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("status", "success");
            response.put("pickupCell", pickupCell);
            response.put("searchedCells", searchedCells);
            response.put("totalFoundInCells", allNearbyDrivers.size());
            response.put("availableCount", rankedAvailable.size());
            response.put("nearbyDrivers", allNearbyDrivers);
            response.put("availableDrivers", rankedAvailable);
            response.put("bestMatch", bestMatch);

            return ResponseEntity.ok(response);

        } catch (SQLException e) {
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    // ==============================================================
    // 3. BEST MATCH ENDPOINT: GET /api/match?cell=H12
    // ==============================================================
    @GetMapping("/match")
    public ResponseEntity<?> getBestMatch(@RequestParam(defaultValue = "H12") String cell) {
        ResponseEntity<?> nearbyRes = searchNearby(cell);
        if (nearbyRes.getStatusCode().is2xxSuccessful() && nearbyRes.getBody() instanceof Map) {
            Map<?, ?> body = (Map<?, ?>) nearbyRes.getBody();
            Map<String, Object> matchResponse = new HashMap<>();
            matchResponse.put("status", "success");
            matchResponse.put("pickupCell", body.get("pickupCell"));
            matchResponse.put("bestMatch", body.get("bestMatch"));
            return ResponseEntity.ok(matchResponse);
        }
        return nearbyRes;
    }

    // ==============================================================
    // 4. ASSIGN DRIVER: POST /api/assign?id=101&cell=H12
    // ==============================================================
    @PostMapping("/assign")
    public ResponseEntity<?> assignDriver(@RequestParam String id, @RequestParam(defaultValue = "H12") String cell) {
        try (Connection conn = getConnection()) {
            conn.setAutoCommit(false);

            // Check current status
            String checkSql = "SELECT * FROM drivers WHERE id = ?";
            Driver driver = null;
            try (PreparedStatement stmt = conn.prepareStatement(checkSql)) {
                stmt.setString(1, id);
                ResultSet rs = stmt.executeQuery();
                if (rs.next()) {
                    driver = mapDriver(rs);
                }
            }

            if (driver == null) {
                conn.rollback();
                return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Driver not found"));
            }

            if ("BOOKED".equalsIgnoreCase(driver.getStatus())) {
                conn.rollback();
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "code", "DRIVER_ALREADY_BOOKED",
                        "message", "Driver " + driver.getName() + " is already BOOKED."
                ));
            }

            // Update status to BOOKED
            String updateSql = "UPDATE drivers SET status = 'BOOKED' WHERE id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(updateSql)) {
                stmt.setString(1, id);
                stmt.executeUpdate();
            }

            // Insert Ride record
            String rideId = "RIDE-" + (1000 + new Random().nextInt(9000));
            String insertRideSql = "INSERT INTO rides (ride_id, pickup_cell, driver_id, eta_at_assignment, status) VALUES (?, ?, ?, ?, ?)";
            try (PreparedStatement stmt = conn.prepareStatement(insertRideSql)) {
                stmt.setString(1, rideId);
                stmt.setString(2, cell);
                stmt.setString(3, id);
                stmt.setInt(4, driver.getEta());
                stmt.setString(5, "DRIVER ASSIGNED");
                stmt.executeUpdate();
            }

            conn.commit();

            driver.setStatus("BOOKED");
            Map<String, Object> res = new HashMap<>();
            res.put("status", "success");
            res.put("message", "Driver " + driver.getName() + " assigned successfully.");
            res.put("rideId", rideId);
            res.put("driver", driver);
            return ResponseEntity.ok(res);

        } catch (SQLException e) {
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    // ==============================================================
    // 5. RESET SIMULATION: POST /api/reset
    // Restores Canonical 7 Initial Drivers & Clears Active Rides
    // ==============================================================
    @PostMapping("/reset")
    public ResponseEntity<?> resetSimulation() {
        try (Connection conn = getConnection()) {
            conn.setAutoCommit(false);

            // Clear rides
            try (Statement stmt = conn.createStatement()) {
                stmt.executeUpdate("DELETE FROM rides");
                stmt.executeUpdate("DELETE FROM drivers");

                // Re-insert exact canonical 7 initial drivers
                String insertSql = "INSERT INTO drivers (id, name, cell_id, eta, status, rating, vehicle, distance_km) VALUES " +
                        "('101', 'Aarav', 'H12', 3, 'AVAILABLE', 4.9, 'Sedan • DL 01 AB 1234', 0.8)," +
                        "('102', 'Riya',  'H11', 5, 'AVAILABLE', 4.8, 'Hatchback • DL 02 CD 5678', 1.4)," +
                        "('103', 'Kabir', 'H13', 7, 'AVAILABLE', 4.7, 'Sedan • DL 03 EF 9012', 2.1)," +
                        "('104', 'Neha',  'H14', 9, 'AVAILABLE', 4.9, 'SUV • DL 04 GH 3456', 2.7)," +
                        "('105', 'Dev',   'G12', 4, 'BOOKED',    4.6, 'Hatchback • DL 05 IJ 7890', 1.1)," +
                        "('106', 'Om',    'J12', 6, 'AVAILABLE', 4.8, 'Sedan • DL 06 KL 2345', 1.8)," +
                        "('107', 'Mira',  'C08', 12, 'AVAILABLE', 4.9, 'EV Cruiser • DL 07 MN 6789', 4.5)";
                stmt.executeUpdate(insertSql);
            }

            conn.commit();
            return ResponseEntity.ok(Map.of("status", "success", "message", "Simulation dataset reset successfully."));

        } catch (SQLException e) {
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    private Driver mapDriver(ResultSet rs) throws SQLException {
        Driver d = new Driver();
        d.setId(rs.getString("id"));
        d.setName(rs.getString("name"));
        d.setCell(rs.getString("cell_id"));
        d.setEta(rs.getInt("eta"));
        d.setStatus(rs.getString("status"));
        d.setRating(rs.getDouble("rating"));
        d.setVehicle(rs.getString("vehicle"));
        d.setDistanceKm(rs.getDouble("distance_km"));
        return d;
    }

    // Driver POJO Model
    public static class Driver {
        private String id;
        private String name;
        private String cell;
        private int eta;
        private String status;
        private double rating;
        private String vehicle;
        private double distanceKm;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getCell() { return cell; }
        public void setCell(String cell) { this.cell = cell; }
        public int getEta() { return eta; }
        public void setEta(int eta) { this.eta = eta; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public double getRating() { return rating; }
        public void setRating(double rating) { this.rating = rating; }
        public String getVehicle() { return vehicle; }
        public void setVehicle(String vehicle) { this.vehicle = vehicle; }
        public double getDistanceKm() { return distanceKm; }
        public void setDistanceKm(double distanceKm) { this.distanceKm = distanceKm; }
    }
}
