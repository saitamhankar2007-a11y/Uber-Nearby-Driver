-- ==============================================================
-- RideMatch — Nearby Driver Matching System
-- MySQL Database Schema & Seed Data (XAMPP / MySQL Compatible)
-- ==============================================================

CREATE DATABASE IF NOT EXISTS `ridematch_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `ridematch_db`;

-- 1. Geographical Cells Table
DROP TABLE IF EXISTS `cell_neighbors`;
DROP TABLE IF EXISTS `rides`;
DROP TABLE IF EXISTS `drivers`;
DROP TABLE IF EXISTS `cells`;

CREATE TABLE `cells` (
    `cell_id` VARCHAR(10) PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `zone` VARCHAR(100) NOT NULL,
    `latitude` DECIMAL(10, 6) DEFAULT NULL,
    `longitude` DECIMAL(10, 6) DEFAULT NULL,
    `is_default` BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB;

-- 2. Cell Neighborhood Adjacency Table (Spatial Graph Edges)
CREATE TABLE `cell_neighbors` (
    `cell_id` VARCHAR(10) NOT NULL,
    `neighbor_cell_id` VARCHAR(10) NOT NULL,
    PRIMARY KEY (`cell_id`, `neighbor_cell_id`),
    FOREIGN KEY (`cell_id`) REFERENCES `cells`(`cell_id`) ON DELETE CASCADE,
    FOREIGN KEY (`neighbor_cell_id`) REFERENCES `cells`(`cell_id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Drivers Table
CREATE TABLE `drivers` (
    `id` VARCHAR(20) PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `cell_id` VARCHAR(10) NOT NULL,
    `eta` INT NOT NULL COMMENT 'Arrival time in minutes',
    `status` ENUM('AVAILABLE', 'BOOKED') NOT NULL DEFAULT 'AVAILABLE',
    `rating` DECIMAL(2, 1) DEFAULT 4.8,
    `vehicle` VARCHAR(100) DEFAULT 'Standard Sedan',
    `distance_km` DECIMAL(4, 1) DEFAULT 1.0,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`cell_id`) REFERENCES `cells`(`cell_id`)
) ENGINE=InnoDB;

-- 4. Rides Assignment Table
CREATE TABLE `rides` (
    `ride_id` VARCHAR(30) PRIMARY KEY,
    `pickup_cell` VARCHAR(10) NOT NULL,
    `driver_id` VARCHAR(20) NOT NULL,
    `eta_at_assignment` INT NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'DRIVER ASSIGNED',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`pickup_cell`) REFERENCES `cells`(`cell_id`),
    FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`)
) ENGINE=InnoDB;

-- ==============================================================
-- INITIAL SEED DATA
-- ==============================================================

-- Seed Cells
INSERT INTO `cells` (`cell_id`, `name`, `zone`, `latitude`, `longitude`, `is_default`) VALUES
('H12', 'City Center Hub', 'Downtown Core', 28.613900, 77.209000, TRUE),
('H11', 'West Commercial Plaza', 'Downtown West', 28.612500, 77.201000, FALSE),
('H13', 'East Financial Square', 'Downtown East', 28.615000, 77.217000, FALSE),
('H14', 'Tech Park Boulevard', 'Outer East', 28.617500, 77.225000, FALSE),
('G12', 'North University Campus', 'North Sector', 28.622000, 77.209000, FALSE),
('J12', 'South Medical Center', 'South Sector', 28.605000, 77.209000, FALSE),
('C08', 'Airport & Cargo Terminals', 'Distant Outskirts', 28.556200, 77.100000, FALSE);

-- Seed Neighborhood Adjacency (Spatial Graph)
-- For H12 (Default Hub), neighborhood includes: H12, H11, H13, H14
INSERT INTO `cell_neighbors` (`cell_id`, `neighbor_cell_id`) VALUES
('H12', 'H12'),
('H12', 'H11'),
('H12', 'H13'),
('H12', 'H14'),
('H11', 'H11'),
('H11', 'H12'),
('H11', 'G12'),
('H13', 'H13'),
('H13', 'H12'),
('H13', 'H14'),
('H14', 'H14'),
('H14', 'H13'),
('G12', 'G12'),
('G12', 'H12'),
('J12', 'J12'),
('J12', 'H12'),
('C08', 'C08');

-- Seed Canonical 7 Fleet Drivers (Exact Requirements)
INSERT INTO `drivers` (`id`, `name`, `cell_id`, `eta`, `status`, `rating`, `vehicle`, `distance_km`) VALUES
('101', 'Aarav', 'H12', 3, 'AVAILABLE', 4.9, 'Sedan • DL 01 AB 1234', 0.8),
('102', 'Riya',  'H11', 5, 'AVAILABLE', 4.8, 'Hatchback • DL 02 CD 5678', 1.4),
('103', 'Kabir', 'H13', 7, 'AVAILABLE', 4.7, 'Sedan • DL 03 EF 9012', 2.1),
('104', 'Neha',  'H14', 9, 'AVAILABLE', 4.9, 'SUV • DL 04 GH 3456', 2.7),
('105', 'Dev',   'G12', 4, 'BOOKED',    4.6, 'Hatchback • DL 05 IJ 7890', 1.1),
('106', 'Om',    'J12', 6, 'AVAILABLE', 4.8, 'Sedan • DL 06 KL 2345', 1.8),
('107', 'Mira',  'C08', 12, 'AVAILABLE', 4.9, 'EV Cruiser • DL 07 MN 6789', 4.5);
