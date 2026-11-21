/**
 * RideMatch — Data Structures & Algorithms Core (dsa.js)
 * 
 * Implements core DSA concepts required for the simulation:
 * 1. Spatial Grid Indexing (Spatial Partitioning / Hash Bucketing)
 * 2. Hash Table Driver Registry (O(1) lookup by Driver ID)
 * 3. Min-Heap / Priority Queue (O(log n) ranking by ETA)
 * 4. Graph & Dijkstra's Algorithm (Road network routing simulation)
 */

// ==========================================
// 1. MIN-HEAP (PRIORITY QUEUE) IMPLEMENTATION
// ==========================================
class DriverMinHeap {
    constructor() {
        this.heap = [];
    }

    // Parent and child index calculations
    getParentIndex(i) { return Math.floor((i - 1) / 2); }
    getLeftChildIndex(i) { return 2 * i + 1; }
    getRightChildIndex(i) { return 2 * i + 2; }

    hasParent(i) { return this.getParentIndex(i) >= 0; }
    hasLeftChild(i) { return this.getLeftChildIndex(i) < this.heap.length; }
    hasRightChild(i) { return this.getRightChildIndex(i) < this.heap.length; }

    parent(i) { return this.heap[this.getParentIndex(i)]; }
    leftChild(i) { return this.heap[this.getLeftChildIndex(i)]; }
    rightChild(i) { return this.heap[this.getRightChildIndex(i)]; }

    swap(i, j) {
        const temp = this.heap[i];
        this.heap[i] = this.heap[j];
        this.heap[j] = temp;
    }

    /**
     * Peek at the driver with minimum ETA (Root element)
     * Time Complexity: O(1)
     */
    peek() {
        if (this.heap.length === 0) return null;
        return this.heap[0];
    }

    /**
     * Insert a new driver into the min-heap
     * Time Complexity: O(log n)
     */
    insert(driver) {
        this.heap.push(driver);
        this.heapifyUp();
    }

    heapifyUp() {
        let index = this.heap.length - 1;
        while (this.hasParent(index) && this.parent(index).eta > this.heap[index].eta) {
            const parentIdx = this.getParentIndex(index);
            this.swap(parentIdx, index);
            index = parentIdx;
        }
    }

    /**
     * Extract the driver with the lowest ETA
     * Time Complexity: O(log n)
     */
    extractMin() {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) return this.heap.pop();

        const root = this.heap[0];
        this.heap[0] = this.heap.pop();
        this.heapifyDown();
        return root;
    }

    heapifyDown() {
        let index = 0;
        while (this.hasLeftChild(index)) {
            let smallerChildIndex = this.getLeftChildIndex(index);
            if (this.hasRightChild(index) && this.rightChild(index).eta < this.leftChild(index).eta) {
                smallerChildIndex = this.getRightChildIndex(index);
            }

            if (this.heap[index].eta < this.heap[smallerChildIndex].eta) {
                break;
            } else {
                this.swap(index, smallerChildIndex);
            }
            index = smallerChildIndex;
        }
    }

    /**
     * Build heap in-place from an array of drivers
     * Time Complexity: O(n)
     */
    buildHeap(drivers) {
        this.heap = [...drivers];
        for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
            this.heapifyDownFromIndex(i);
        }
    }

    heapifyDownFromIndex(index) {
        while (2 * index + 1 < this.heap.length) {
            let left = 2 * index + 1;
            let right = 2 * index + 2;
            let smallest = index;

            if (left < this.heap.length && this.heap[left].eta < this.heap[smallest].eta) {
                smallest = left;
            }
            if (right < this.heap.length && this.heap[right].eta < this.heap[smallest].eta) {
                smallest = right;
            }

            if (smallest !== index) {
                this.swap(index, smallest);
                index = smallest;
            } else {
                break;
            }
        }
    }

    size() {
        return this.heap.length;
    }

    isEmpty() {
        return this.heap.length === 0;
    }

    /**
     * Return all elements sorted ascending by ETA (Heap Sort)
     */
    extractAllSorted() {
        // Clone internal heap array to preserve state if needed
        const tempHeap = new DriverMinHeap();
        tempHeap.buildHeap(this.heap);
        const sorted = [];
        while (!tempHeap.isEmpty()) {
            sorted.push(tempHeap.extractMin());
        }
        return sorted;
    }
}

// ==========================================
// 2. HASH TABLE (DRIVER REGISTRY)
// ==========================================
class DriverHashTable {
    constructor() {
        this.table = new Map();
    }

    /**
     * Insert or update driver by ID
     * Time Complexity: O(1) average
     */
    set(driverId, driver) {
        this.table.set(String(driverId), { ...driver });
    }

    /**
     * Fast retrieval by Driver ID
     * Time Complexity: O(1) average
     */
    get(driverId) {
        return this.table.get(String(driverId)) || null;
    }

    has(driverId) {
        return this.table.has(String(driverId));
    }

    delete(driverId) {
        return this.table.delete(String(driverId));
    }

    getAll() {
        return Array.from(this.table.values());
    }

    clear() {
        this.table.clear();
    }

    size() {
        return this.table.size;
    }
}

// ==========================================
// 3. SPATIAL GRID (CELL-BASED PARTITIONING)
// ==========================================
class SpatialGridManager {
    constructor(neighborhoodConfig = CELL_NEIGHBORHOODS) {
        this.neighborhoodConfig = neighborhoodConfig;
        this.gridBuckets = new Map(); // CellId -> Array of Drivers
    }

    /**
     * Buckets drivers by their current cell
     * Space Complexity: O(N) where N is number of drivers
     * Time Complexity: O(N) to populate
     */
    indexDrivers(drivers) {
        this.gridBuckets.clear();
        for (const driver of drivers) {
            const cell = driver.cell;
            if (!this.gridBuckets.has(cell)) {
                this.gridBuckets.set(cell, []);
            }
            this.gridBuckets.get(cell).push({ ...driver });
        }
    }

    /**
     * Get adjacent/nearby cells for a given center cell
     * Returns array of cell IDs (e.g., ["H12", "H11", "H13", "H14"] for H12)
     */
    getNearbyCells(pickupCell) {
        if (this.neighborhoodConfig[pickupCell]) {
            return [...this.neighborhoodConfig[pickupCell]];
        }
        // Fallback: If cell has no explicit neighbors defined, search itself
        return [pickupCell];
    }

    /**
     * Retrieve all drivers located within the nearby cell neighborhood
     * Time Complexity: O(K * d) where K is number of searched cells and d is drivers per cell
     * This avoids scanning the entire city driver pool of size N!
     */
    getDriversInCells(cellList, allDrivers = null) {
        const results = [];
        const cellSet = new Set(cellList);

        if (allDrivers) {
            // Direct filter if allDrivers array passed
            for (const driver of allDrivers) {
                if (cellSet.has(driver.cell)) {
                    results.push({ ...driver });
                }
            }
        } else {
            // Retrieve from bucketed index
            for (const cell of cellList) {
                const driversInCell = this.gridBuckets.get(cell) || [];
                for (const d of driversInCell) {
                    results.push({ ...d });
                }
            }
        }
        return results;
    }
}

// ==========================================
// 4. GRAPH & DIJKSTRA ROUTING SIMULATION
// ==========================================
class RoadNetworkGraph {
    constructor() {
        this.adjacencyList = new Map();
        this.initDefaultGraph();
    }

    addVertex(cell) {
        if (!this.adjacencyList.has(cell)) {
            this.adjacencyList.set(cell, []);
        }
    }

    addEdge(cell1, cell2, weightMinutes) {
        this.addVertex(cell1);
        this.addVertex(cell2);
        this.adjacencyList.get(cell1).push({ node: cell2, weight: weightMinutes });
        this.adjacencyList.get(cell2).push({ node: cell1, weight: weightMinutes });
    }

    initDefaultGraph() {
        // Connect cells with realistic road travel weights (in minutes)
        this.addEdge("H12", "H11", 2);
        this.addEdge("H12", "H13", 2);
        this.addEdge("H13", "H14", 2);
        this.addEdge("H12", "G12", 4);
        this.addEdge("H12", "J12", 3);
        this.addEdge("H11", "C08", 10);
    }

    /**
     * Dijkstra's Algorithm for Shortest Path calculation
     * Time Complexity: O((V + E) log V) with Min-Priority Queue
     */
    findShortestPath(startCell, endCell) {
        const distances = {};
        const previous = {};
        const pq = []; // Array-based Priority Queue for educational demonstration

        for (const vertex of this.adjacencyList.keys()) {
            if (vertex === startCell) {
                distances[vertex] = 0;
                pq.push({ node: vertex, priority: 0 });
            } else {
                distances[vertex] = Infinity;
                pq.push({ node: vertex, priority: Infinity });
            }
            previous[vertex] = null;
        }

        while (pq.length > 0) {
            // Sort by priority (simulate min-heap extraction)
            pq.sort((a, b) => a.priority - b.priority);
            const { node: current } = pq.shift();

            if (current === endCell) {
                // Construct path
                const path = [];
                let curr = endCell;
                while (curr) {
                    path.unshift(curr);
                    curr = previous[curr];
                }
                return {
                    path,
                    totalEta: distances[endCell],
                    steps: path.length - 1
                };
            }

            if (!current || distances[current] === Infinity) break;

            const neighbors = this.adjacencyList.get(current) || [];
            for (const neighbor of neighbors) {
                const candidateDistance = distances[current] + neighbor.weight;
                if (candidateDistance < distances[neighbor.node]) {
                    distances[neighbor.node] = candidateDistance;
                    previous[neighbor.node] = current;

                    // Update in PQ
                    const pqItem = pq.find(item => item.node === neighbor.node);
                    if (pqItem) {
                        pqItem.priority = candidateDistance;
                    }
                }
            }
        }

        return {
            path: [startCell],
            totalEta: distances[endCell] || 0,
            steps: 0
        };
    }
}

// Export / global attachment
if (typeof window !== "undefined") {
    window.DriverMinHeap = DriverMinHeap;
    window.DriverHashTable = DriverHashTable;
    window.SpatialGridManager = SpatialGridManager;
    window.RoadNetworkGraph = RoadNetworkGraph;
}
