# RideMatch — Java Backend & MySQL Integration Guide

This guide explains how to connect the **RideMatch Frontend** to a live **Java + MySQL Backend** running on XAMPP.

---

## 1. Architecture Overview

```
+------------------------------------+
|  RideMatch Frontend                |
|  (HTML5 / CSS3 / Vanilla JS)       |
+-----------------+------------------+
                  |
        REST API  |  JSON Requests/Responses
                  v
+------------------------------------+
|  Java Spring Boot REST Controller  |
|  (RideMatchController.java)        |
|  - Spatial Neighborhood Query      |
|  - PriorityQueue (Min-Heap) ETA    |
|  - Hash Map Driver Index           |
+-----------------+------------------+
                  |
        JDBC      |  SQL Queries
                  v
+------------------------------------+
|  MySQL Database (via XAMPP)        |
|  (ridematch_db)                    |
|  - cells                           |
|  - cell_neighbors                  |
|  - drivers                         |
|  - rides                           |
+------------------------------------+
```

---

## 2. Setting Up MySQL via XAMPP

1. **Start XAMPP**:
   - Open **XAMPP Control Panel**.
   - Click **Start** next to **MySQL** (and Apache if using phpMyAdmin).
2. **Open phpMyAdmin or MySQL CLI**:
   - Navigate to `http://localhost/phpmyadmin` in your web browser.
   - Or open terminal: `mysql -u root`
3. **Import Database Schema & Data**:
   - In phpMyAdmin, click **Import** and choose `backend/schema.sql`.
   - Or run from command prompt:
     ```bash
     mysql -u root -p < backend/schema.sql
     ```
   - This creates `ridematch_db` and seeds the canonical 7 drivers and cell adjacency graph.

---

## 3. Running the Java Spring Boot Backend

The reference implementation is provided in `backend/RideMatchController.java`.

### Dependencies (in `pom.xml` if using Maven):
```xml
<dependencies>
    <!-- Spring Web for REST APIs -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- MySQL JDBC Driver -->
    <dependency>
        <groupId>com.mysql</groupId>
        <artifactId>mysql-connector-j</artifactId>
        <scope>runtime</scope>
    </dependency>
</dependencies>
```

### Run the Application:
```bash
mvn spring-boot:run
```
The server will start on `http://localhost:8080`.

---

## 4. REST Endpoints Implemented

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/drivers` | Retrieve all registered drivers |
| `GET` | `/api/nearby?cell=H12` | Find nearby available drivers using Spatial Grid + Min-Heap |
| `GET` | `/api/match?cell=H12` | Retrieve root best match driver directly |
| `POST` | `/api/assign?id=101&cell=H12` | Assign driver, update status to BOOKED, create ride record |
| `POST` | `/api/reset` | Restore initial canonical 7 drivers and clear rides |

---

## 5. Connecting the Frontend to the Real Backend

To switch the frontend from the standalone in-memory Mock Service to the live Java REST API:

1. Open `frontend/js/apiService.js`.
2. Locate line 21:
   ```javascript
   this.USE_MOCK_API = true;
   ```
3. Change it to:
   ```javascript
   this.USE_MOCK_API = false;
   ```
4. Save the file.
5. Reload the frontend. All calls will now go directly to `http://localhost:8080/api`.
